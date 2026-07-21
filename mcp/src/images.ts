/**
 * Cloudflare Images upload client for the MCP asset tools.
 *
 * Images (not R2) is deliberate: one POST returns a stable public delivery
 * URL with variants/resizing handled by Cloudflare — no bucket, no custom
 * domain, no extra Worker route. Configuration:
 *
 *   CF_IMAGES_ACCOUNT_ID  — Worker var (the Cloudflare account id)
 *   CF_IMAGES_TOKEN       — secret (`wrangler secret put CF_IMAGES_TOKEN`),
 *                           an API token scoped to Cloudflare Images edit.
 *
 * Without both, upload tools fail closed with a clear "not configured"
 * message instead of guessing.
 */

export interface ImagesEnv {
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

export async function uploadImage(
  env: ImagesEnv,
  bytes: Uint8Array,
  opts: { id?: string; contentType: UploadContentType },
): Promise<UploadResult> {
  if (!imagesConfigured(env)) {
    throw new Error(
      "Image upload is not configured on this server (CF_IMAGES_ACCOUNT_ID / CF_IMAGES_TOKEN unset).",
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
