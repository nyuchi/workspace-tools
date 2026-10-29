/**
 * Public image storage for the MCP asset tools.
 *
 * Preferred: the R2 `IMAGES` binding. The Worker writes the PNG itself (no API
 * token) and serves it at `<MCP origin>/images/<key>`, a plain public URL that
 * Postiz, Instagram and other link-only tools can fetch.
 *
 * Fallback: Cloudflare Images, for deployments without the binding:
 *
 *   CF_IMAGES_ACCOUNT_ID  — Worker var (the Cloudflare account id)
 *   CF_IMAGES_TOKEN       — secret (`wrangler secret put CF_IMAGES_TOKEN`),
 *                           an API token scoped to Cloudflare Images edit.
 *
 * With neither, upload tools fail closed with a clear "not configured"
 * message instead of guessing.
 */

/** Public path the Worker serves stored images from, on the MCP host. */
export const IMAGES_PATH_PREFIX = "/images/";

export interface ImagesEnv {
  /**
   * R2 bucket binding (wrangler.toml [[r2_buckets]]). Preferred store: no API
   * token to provision, the Worker writes it directly and serves it back at
   * `<MCP origin>/images/<key>` (see `serveStoredImage`).
   */
  IMAGES?: R2Bucket;
  CF_IMAGES_ACCOUNT_ID?: string;
  CF_IMAGES_TOKEN?: string;
  /** Accepted alias — the production secret was provisioned under this
      name; prefer CF_IMAGES_TOKEN for new setups. */
  CF_IMAGE_TOKEN?: string;
}

function imagesToken(env: ImagesEnv): string | undefined {
  return env.CF_IMAGES_TOKEN || env.CF_IMAGE_TOKEN;
}

export type UploadContentType = "image/png" | "image/svg+xml";

/** Cloudflare Images hard limit is 10 MB per image. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function imagesConfigured(env: ImagesEnv): boolean {
  return Boolean(env.CF_IMAGES_ACCOUNT_ID && imagesToken(env));
}

/** True when ANY public image store (R2 binding or Cloudflare Images) is set up. */
export function storageConfigured(env: ImagesEnv): boolean {
  return Boolean(env.IMAGES) || imagesConfigured(env);
}

/**
 * Normalize a caller-suggested key into a safe custom image id
 * (e.g. `nhimbe/2026-07/harvest-post.png`). Returns undefined for anything
 * unusable so the upload falls back to a Cloudflare-generated id — never
 * throws, a bad key should not sink the upload.
 */
export function sanitizeKey(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const trimmed = key.replace(/^\/+/, "").trim();
  if (!trimmed || trimmed.length > 512) return undefined;
  if (trimmed.split("/").some((seg) => seg === "" || seg === "." || seg === "..")) return undefined;
  if (!/^[A-Za-z0-9/_.-]+$/.test(trimmed)) return undefined;
  return trimmed;
}

interface CfImagesResponse {
  success: boolean;
  errors?: { code: number; message: string }[];
  result?: { id: string; variants: string[] };
}

export interface UploadResult {
  url: string;
  id: string;
}

const EXT: Record<UploadContentType, string> = { "image/png": "png", "image/svg+xml": "svg" };

/**
 * Store an image in the R2 bucket and return its public URL on `origin`
 * (the MCP host). A caller-suggested key is kept (extension added if missing);
 * otherwise a random id. Never overwrites: an existing key is an error.
 */
async function storeInR2(
  bucket: R2Bucket,
  origin: string,
  bytes: Uint8Array,
  opts: { id?: string; contentType: UploadContentType },
): Promise<UploadResult> {
  const ext = EXT[opts.contentType];
  const suggested = opts.id && /\.[A-Za-z0-9]+$/.test(opts.id) ? opts.id : opts.id && `${opts.id}.${ext}`;
  const key = suggested ?? `${crypto.randomUUID()}.${ext}`;
  const stored = await bucket.put(key, bytes, {
    httpMetadata: { contentType: opts.contentType },
    onlyIf: { etagDoesNotMatch: "*" },
  });
  if (!stored) {
    throw new Error(`An image with the key '${key}' already exists; pick a unique uploadKey.`);
  }
  const path = key.split("/").map(encodeURIComponent).join("/");
  return { url: `${origin}${IMAGES_PATH_PREFIX}${path}`, id: key };
}

/**
 * Publish an image and return a public URL: the R2 binding when present,
 * otherwise Cloudflare Images. Throws a clear error when neither is set up.
 */
export async function publishImage(
  env: ImagesEnv,
  origin: string,
  bytes: Uint8Array,
  opts: { id?: string; contentType: UploadContentType },
): Promise<UploadResult> {
  if (bytes.length === 0) throw new Error("Refusing to upload an empty image.");
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error(`Image is ${bytes.length} bytes; the upload cap is ${MAX_UPLOAD_BYTES} bytes.`);
  }
  if (env.IMAGES) return storeInR2(env.IMAGES, origin, bytes, opts);
  return uploadImage(env, bytes, opts);
}

/** Public GET handler for stored images; 404 for anything not a valid key. */
export async function serveStoredImage(env: ImagesEnv, rawPath: string): Promise<Response> {
  const notFound = () => new Response("Not found", { status: 404 });
  if (!env.IMAGES) return notFound();
  let key: string | undefined;
  try {
    key = sanitizeKey(decodeURIComponent(rawPath.slice(IMAGES_PATH_PREFIX.length)));
  } catch {
    return notFound();
  }
  if (!key) return notFound();
  const object = await env.IMAGES.get(key);
  if (!object) return notFound();
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream",
      // Keys are never overwritten, so a stored image is immutable.
      "Cache-Control": "public, max-age=31536000, immutable",
      ETag: object.httpEtag,
      "X-Content-Type-Options": "nosniff",
      // An SVG opened directly must not be able to run script.
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

export async function uploadImage(
  env: ImagesEnv,
  bytes: Uint8Array,
  opts: { id?: string; contentType: UploadContentType },
): Promise<UploadResult> {
  if (!imagesConfigured(env)) {
    throw new Error(
      "Image upload is not configured on this server (CF_IMAGES_ACCOUNT_ID plus the " +
        "CF_IMAGES_TOKEN — or legacy CF_IMAGE_TOKEN — secret are required).",
    );
  }
  if (bytes.length === 0) {
    throw new Error("Refusing to upload an empty image.");
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Image is ${bytes.length} bytes; Cloudflare Images caps uploads at ${MAX_UPLOAD_BYTES} bytes.`,
    );
  }

  const form = new FormData();
  const ext = opts.contentType === "image/png" ? "png" : "svg";
  form.append("file", new Blob([bytes], { type: opts.contentType }), `asset.${ext}`);
  if (opts.id) form.append("id", opts.id);

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_IMAGES_ACCOUNT_ID}/images/v1`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${imagesToken(env)}` },
      body: form,
    },
  );

  let body: CfImagesResponse | null = null;
  try {
    body = (await res.json()) as CfImagesResponse;
  } catch {
    // fall through to the status-based error below
  }
  if (!res.ok || !body?.success || !body.result) {
    const detail = body?.errors?.map((e) => e.message).join("; ") || `HTTP ${res.status}`;
    throw new Error(`Cloudflare Images upload failed: ${detail}`);
  }

  const variants = body.result.variants ?? [];
  const url = variants.find((v) => v.endsWith("/public")) ?? variants[0];
  if (!url) {
    throw new Error("Cloudflare Images upload succeeded but returned no delivery URL variants.");
  }
  return { url, id: body.result.id };
}
