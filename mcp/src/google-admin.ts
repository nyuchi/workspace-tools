/**
 * Admin orchestration APIs for the Signature Console (Phase 1 of
 * docs/signature-console-plan.md §4):
 *
 *   GET  /api/admin/users — list domain users + aliases + derived brand via
 *        the Admin SDK Directory API, using the signed-in admin's own Google
 *        OAuth token (admin.directory.user.readonly).
 *   POST /api/admin/push  — render signatures through engines/signature (the
 *        ONE byte-locked template) and write them to each target user's
 *        Gmail send-as settings, impersonating that user through the
 *        service account + domain-wide delegation. Dry-run by DEFAULT —
 *        bulk writes are strictly opt-in (`dryRun: false`).
 *
 * This is the Worker port of email-signature/Code.js's behavior: the
 * domain→division derivation (getDivisionFromEmail), job-title/phone
 * extraction (getJobTitle/getPhoneNumber/formatPhoneNumber), alias coverage
 * (primary + every send-as address), and its pacing/tolerance for the
 * per-user Gmail settings rate limits (sequential, think-time between
 * users, retry-once-with-backoff on 429/5xx).
 *
 * Both routes sit behind the site-wide login gate (they are NOT in
 * index.ts's exempt list), and additionally require a Google OAuth session
 * carrying the directory scope. Configuration follows the images.ts
 * fail-closed pattern: without GOOGLE_WORKSPACE_DOMAIN (var) and — for push
 * — GOOGLE_SA_KEY (secret), the routes return clear "not configured"
 * errors instead of guessing. Error responses never echo tokens or any part
 * of the service-account key.
 */

import type { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { SignJWT, base64url, importPKCS8 } from "jose";
import {
  buildSignatureHtml,
  type BrandKey,
} from "../../signature-generator/src/engines/signature";
import {
  decryptGoogleSession,
  GOOGLE_COOKIE_NAME,
  type GoogleSession,
} from "./google-auth.js";

const getGoogleSession = decryptGoogleSession;

export interface GoogleAdminEnv {
  /** Shared with site-auth.ts — also keys the Google session cookie. */
  SESSION_SECRET?: string;
  /** Secret: JSON service-account key (client_email + private_key PEM)
      authorized for domain-wide delegation. */
  GOOGLE_SA_KEY?: string;
  /** Var: the Google Workspace primary domain, e.g. nyuchi.com. */
  GOOGLE_WORKSPACE_DOMAIN?: string;
}

// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Constants & pacing.
// -----------------------------------------------------------------------------

export const DIRECTORY_SCOPE = "https://www.googleapis.com/auth/admin.directory.user.readonly";
/** DWD impersonation acts AS the target user, so their own settings scope
    suffices — the Worker never needs gmail.settings.sharing itself. */
const GMAIL_SETTINGS_SCOPE = "https://www.googleapis.com/auth/gmail.settings.basic";

const DIRECTORY_USERS_URL = "https://admin.googleapis.com/admin/directory/v1/users";
const GMAIL_SENDAS_URL = "https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Hard cap on push targets per call — bulk beyond this must be batched. */
export const MAX_PUSH_TARGETS = 500;

/** Think-time between users during a push run (Code.js used 500ms sleeps;
    the Worker's per-call time budget wants something leaner). */
const USER_PACING_MS = 200;
/** Backoff before the single retry on a 429/5xx Google response. */
const RETRY_BACKOFF_MS = 1000;

/**
 * Injectable sleep hook: production uses a real timer; tests replace
 * `pacing.sleep` with a no-op spy so push runs don't wall-clock wait.
 */
export const pacing = {
  sleep: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};

/** fetch with a single retry (after backoff) on 429/5xx — the pacing
    tolerance the batch script's sleeps + manual re-runs provided. */
async function googleFetch(url: string, init: RequestInit): Promise<Response> {
  let res = await fetch(url, init);
  if (res.status === 429 || res.status >= 500) {
    await pacing.sleep(RETRY_BACKOFF_MS);
    res = await fetch(url, init);
  }
  return res;
}

// -----------------------------------------------------------------------------
// Brand derivation — the Worker port of Code.js getDivisionFromEmail.
//
// Code.js maps email DOMAINS to division identities; the signature engine
// keys brands by slug, so each Code.js division maps onto the engine brand
// that carries its (byte-locked) signature identity. Divisions without a
// legacy signature key (Lingo, Development, Mukoko News) render under their
// parent brand, exactly as unknown domains default to nyuchi in Code.js.
// -----------------------------------------------------------------------------

const BRAND_BY_DOMAIN: Record<string, BrandKey> = {
  "nyuchi.com": "nyuchi",
  "lingo.nyuchi.com": "nyuchi", // Nyuchi Lingo — no legacy signature key; parent brand
  "services.nyuchi.com": "nyuchi", // Nyuchi Development — no legacy signature key; parent brand
  "learning.nyuchi.com": "learning", // legacy signature key
  "travel-info.co.zw": "travel", // legacy signature key (Zimbabwe Travel Information)
  "mukoko.com": "mukoko",
  "hararemetro.co.zw": "mukoko", // Mukoko News — no signature key; parent brand
  "news.mukoko.com": "mukoko", // Mukoko News — no signature key; parent brand
  "bundu.org": "bundu",
  "shamwari.ai": "shamwari",
};

export function brandFromEmail(email: string): BrandKey {
  const domain = email.split("@")[1]?.toLowerCase();
  return (domain && BRAND_BY_DOMAIN[domain]) || "nyuchi";
}

// -----------------------------------------------------------------------------
// Directory user field extraction — ports of Code.js getJobTitle,
// getPhoneNumber, and formatPhoneNumber.
// -----------------------------------------------------------------------------

interface DirectoryUser {
  primaryEmail?: string;
  name?: { fullName?: string };
  suspended?: boolean;
  aliases?: string[];
  emails?: { address?: string; primary?: boolean }[];
  organizations?: { title?: string; primary?: boolean }[];
  phones?: { value?: string; type?: string; primary?: boolean }[];
  customSchemas?: { Employment?: { jobTitle?: string } };
}

function getJobTitle(user: DirectoryUser): string | undefined {
  if (user.organizations && user.organizations.length > 0) {
    const primaryOrg = user.organizations.find((org) => org.primary) ?? user.organizations[0];
    if (primaryOrg?.title) return primaryOrg.title;
  }
  return user.customSchemas?.Employment?.jobTitle || undefined;
}

function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+") && cleaned.length > 8) {
    const countryCode = cleaned.substring(0, cleaned.length > 12 ? 3 : 2);
    const rest = cleaned.substring(countryCode.length);
    const mid = Math.ceil(rest.length / 2);
    return `${countryCode} ${rest.substring(0, mid)} ${rest.substring(mid)}`;
  }
  return phone;
}

function getPhoneNumber(user: DirectoryUser): string | undefined {
  if (!user.phones || user.phones.length === 0) return undefined;
  const workPhone = user.phones.find((p) => p.type === "work");
  const mobilePhone = user.phones.find((p) => p.type === "mobile");
  const primaryPhone = user.phones.find((p) => p.primary);
  const phone = workPhone ?? mobilePhone ?? primaryPhone ?? user.phones[0];
  return phone?.value ? formatPhoneNumber(phone.value) : undefined;
}

/** Directory-visible aliases: the `aliases` field plus non-primary entries
    from the `emails` list, deduped, primary excluded. */
function directoryAliases(user: DirectoryUser): string[] {
  const primary = (user.primaryEmail ?? "").toLowerCase();
  const seen = new Set<string>();
  const out: string[] = [];
  const candidates = [
    ...(user.aliases ?? []),
    ...(user.emails ?? []).map((e) => e.address ?? ""),
  ];
  for (const address of candidates) {
    const lower = address.toLowerCase();
    if (!address || lower === primary || seen.has(lower)) continue;
    seen.add(lower);
    out.push(address);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Admin SDK Directory listing (with the admin's own bearer token).
// -----------------------------------------------------------------------------

interface DirectoryListResponse {
  users?: DirectoryUser[];
  nextPageToken?: string;
}

async function listDirectoryUsers(accessToken: string): Promise<DirectoryUser[]> {
  const users: DirectoryUser[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(DIRECTORY_USERS_URL);
    url.searchParams.set("customer", "my_customer");
    url.searchParams.set("maxResults", "200");
    url.searchParams.set("projection", "full");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await googleFetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      // Status only — never the response body, which Google may fill with
      // request echoes.
      throw new Error(`Directory API request failed: HTTP ${res.status}`);
    }
    const body = (await res.json()) as DirectoryListResponse;
    if (body.users) users.push(...body.users);
    pageToken = body.nextPageToken;
  } while (pageToken);
  return users;
}

// -----------------------------------------------------------------------------
// Service-account impersonation (domain-wide delegation).
// -----------------------------------------------------------------------------

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

/**
 * Parse GOOGLE_SA_KEY. Throws a configuration error that names the problem
 * but NEVER includes any part of the key material.
 */
function parseServiceAccountKey(env: GoogleAdminEnv): ServiceAccountKey {
  if (!env.GOOGLE_SA_KEY) {
    throw new Error(
      "Signature push is not configured on this server (the GOOGLE_SA_KEY secret is unset). " +
        "Provision the service-account key with `wrangler secret put GOOGLE_SA_KEY`.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(env.GOOGLE_SA_KEY);
  } catch {
    throw new Error("GOOGLE_SA_KEY is not valid JSON.");
  }
  const key = parsed as Partial<ServiceAccountKey> | null;
  if (!key || typeof key.client_email !== "string" || typeof key.private_key !== "string") {
    throw new Error("GOOGLE_SA_KEY is missing client_email or private_key.");
  }
  return { client_email: key.client_email, private_key: key.private_key };
}

/**
 * Mint an access token impersonating `userEmail`: a service-account JWT
 * (RS256, sub = the impersonated user, scope = gmail.settings.basic)
 * exchanged at Google's token endpoint via the jwt-bearer grant. This is
 * what domain-wide delegation authorizes — the same trust path the Apps
 * Script admin flows used.
 */
async function impersonatedAccessToken(sa: ServiceAccountKey, userEmail: string): Promise<string> {
  const privateKey = await importPKCS8(sa.private_key, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: GMAIL_SETTINGS_SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(userEmail)
    .setAudience(GOOGLE_TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const res = await googleFetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`Service-account token exchange failed: HTTP ${res.status}`);
  }
  let data: unknown;
  try {
    data = await res.json();
  } catch {
    throw new Error("Service-account token exchange returned invalid JSON.");
  }
  const token = (data as { access_token?: unknown } | null)?.access_token;
  if (typeof token !== "string" || !token) {
    throw new Error("Service-account token exchange response is missing access_token.");
  }
  return token;
}

/** Port of Code.js getSendAsAddresses: list the user's send-as addresses
    with the impersonated token; any failure degrades to [] (the primary
    address is always covered separately). */
async function listSendAsAddresses(accessToken: string): Promise<string[]> {
  try {
    const res = await googleFetch(GMAIL_SENDAS_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const body = (await res.json()) as { sendAs?: { sendAsEmail?: string }[] };
    return (body.sendAs ?? []).map((s) => s.sendAsEmail ?? "").filter(Boolean);
  } catch {
    return [];
  }
}

async function patchSendAsSignature(
  accessToken: string,
  sendAsEmail: string,
  signature: string,
): Promise<void> {
  const res = await googleFetch(`${GMAIL_SENDAS_URL}/${encodeURIComponent(sendAsEmail)}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ signature }),
  });
  if (!res.ok) {
    throw new Error(`Gmail sendAs update failed: HTTP ${res.status}`);
  }
}

// -----------------------------------------------------------------------------
// Route payload shapes.
// -----------------------------------------------------------------------------

export interface ConsoleUser {
  email: string;
  name: string;
  title?: string;
  phone?: string;
  aliases: string[];
  brand: BrandKey;
}

export interface PushResult {
  email: string;
  sendAs: string;
  status: "pushed" | "dry-run" | "failed";
  error?: string;
}

function toConsoleUser(user: DirectoryUser): ConsoleUser {
  const email = user.primaryEmail ?? "";
  const title = getJobTitle(user);
  const phone = getPhoneNumber(user);
  return {
    email,
    name: user.name?.fullName || (email ? email.split("@")[0] : ""),
    ...(title ? { title } : {}),
    ...(phone ? { phone } : {}),
    aliases: directoryAliases(user),
    brand: brandFromEmail(email),
  };
}

/** Our own thrown messages are crafted to be safe (status codes only, no
    bodies, no key material); anything else gets a generic label. */
function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected error";
}

// -----------------------------------------------------------------------------
// Route registration.
// -----------------------------------------------------------------------------

/**
 * Register the admin orchestration routes. Must be called BEFORE the
 * ASSETS catch-all in index.ts; the site-wide login gate middleware
 * (registered first, `/api/*` is not exempt) already fronts both routes.
 */
export function registerGoogleAdminRoutes<E extends { Bindings: GoogleAdminEnv }>(
  app: Hono<E>,
): void {
  app.get("/api/admin/users", async (c) => {
    const env = c.env as GoogleAdminEnv;
    const session = await getGoogleSession(env, getCookie(c, GOOGLE_COOKIE_NAME));
    if (!session) return c.json({ error: "google_not_connected" }, 401);
    if (!session.scopes.includes(DIRECTORY_SCOPE)) return c.json({ error: "missing_scope" }, 401);
    if (!env.GOOGLE_WORKSPACE_DOMAIN) {
      return c.json(
        {
          error: "not_configured",
          detail: "GOOGLE_WORKSPACE_DOMAIN is not configured on this server.",
        },
        503,
      );
    }

    let users: DirectoryUser[];
    try {
      users = await listDirectoryUsers(session.access_token);
    } catch (error) {
      return c.json({ error: "directory_error", detail: safeErrorMessage(error) }, 502);
    }

    return c.json({
      users: users.filter((u) => !u.suspended).map(toConsoleUser),
      domain: env.GOOGLE_WORKSPACE_DOMAIN,
    });
  });

  app.post("/api/admin/push", async (c) => {
    const env = c.env as GoogleAdminEnv;
    const session = await getGoogleSession(env, getCookie(c, GOOGLE_COOKIE_NAME));
    if (!session) return c.json({ error: "google_not_connected" }, 401);
    if (!session.scopes.includes(DIRECTORY_SCOPE)) return c.json({ error: "missing_scope" }, 401);
    if (!env.GOOGLE_WORKSPACE_DOMAIN) {
      return c.json(
        {
          error: "not_configured",
          detail: "GOOGLE_WORKSPACE_DOMAIN is not configured on this server.",
        },
        503,
      );
    }
    // Fail closed on the service account up front — even a dry run should
    // surface "push cannot work yet" rather than a green report that turns
    // red the moment dryRun is dropped.
    let sa: ServiceAccountKey;
    try {
      sa = parseServiceAccountKey(env);
    } catch (error) {
      return c.json({ error: "sa_not_configured", detail: safeErrorMessage(error) }, 503);
    }

    let body: { targets?: unknown; dryRun?: unknown; includeAliases?: unknown };
    try {
      body = (await c.req.json()) as typeof body;
    } catch {
      body = {};
    }
    if (
      body.targets !== undefined &&
      (!Array.isArray(body.targets) || body.targets.some((t) => typeof t !== "string"))
    ) {
      return c.json({ error: "bad_request", detail: "`targets` must be an array of emails." }, 400);
    }
    const explicitTargets = body.targets as string[] | undefined;
    if (explicitTargets && explicitTargets.length > MAX_PUSH_TARGETS) {
      return c.json(
        {
          error: "too_many_targets",
          detail: `At most ${MAX_PUSH_TARGETS} targets per call; batch larger runs.`,
        },
        400,
      );
    }
    // Bulk push is opt-in: anything but an explicit false stays a dry run.
    const dryRun = body.dryRun !== false;
    const includeAliases = body.includeAliases !== false;

    let allUsers: DirectoryUser[];
    try {
      allUsers = await listDirectoryUsers(session.access_token);
    } catch (error) {
      return c.json({ error: "directory_error", detail: safeErrorMessage(error) }, 502);
    }
    const byEmail = new Map<string, DirectoryUser>();
    for (const user of allUsers) {
      if (user.primaryEmail) byEmail.set(user.primaryEmail.toLowerCase(), user);
    }

    const targets =
      explicitTargets ??
      allUsers.filter((u) => !u.suspended && u.primaryEmail).map((u) => u.primaryEmail as string);
    if (targets.length > MAX_PUSH_TARGETS) {
      return c.json(
        {
          error: "too_many_targets",
          detail: `At most ${MAX_PUSH_TARGETS} targets per call; batch larger runs.`,
        },
        400,
      );
    }

    const results: PushResult[] = [];
    let first = true;
    for (const target of targets) {
      // Sequential with think-time between users — the Worker port of the
      // batch script's Utilities.sleep pacing against per-user rate limits.
      if (!first) await pacing.sleep(USER_PACING_MS);
      first = false;

      const user = byEmail.get(target.toLowerCase());
      if (!user || !user.primaryEmail) {
        results.push({ email: target, sendAs: target, status: "failed", error: "user_not_found" });
        continue;
      }
      if (user.suspended) {
        results.push({
          email: user.primaryEmail,
          sendAs: user.primaryEmail,
          status: "failed",
          error: "user_suspended",
        });
        continue;
      }

      const primary = user.primaryEmail;
      const consoleUser = toConsoleUser(user);

      if (dryRun) {
        // No Google writes, no impersonation: report the addresses that a
        // real run would cover, from the directory's view of the aliases.
        const addresses = [primary, ...(includeAliases ? directoryAliases(user) : [])];
        for (const address of addresses) {
          results.push({ email: primary, sendAs: address, status: "dry-run" });
        }
        continue;
      }

      let accessToken: string;
      try {
        accessToken = await impersonatedAccessToken(sa, primary);
      } catch (error) {
        results.push({
          email: primary,
          sendAs: primary,
          status: "failed",
          error: safeErrorMessage(error),
        });
        continue;
      }

      const sendAsList = await listSendAsAddresses(accessToken);
      const addresses = [
        primary,
        ...(includeAliases
          ? sendAsList.filter((a) => a.toLowerCase() !== primary.toLowerCase())
          : []),
      ];
      for (const address of addresses) {
        // Per-address rendering, like Code.js: the displayed email AND the
        // brand both follow the send-as address, not the primary.
        const html = buildSignatureHtml({
          brand: brandFromEmail(address),
          name: consoleUser.name,
          email: address,
          title: consoleUser.title,
          phone: consoleUser.phone,
        });
        try {
          await patchSendAsSignature(accessToken, address, html);
          results.push({ email: primary, sendAs: address, status: "pushed" });
        } catch (error) {
          results.push({
            email: primary,
            sendAs: address,
            status: "failed",
            error: safeErrorMessage(error),
          });
        }
      }
    }

    const summary = {
      pushed: results.filter((r) => r.status === "pushed").length,
      dryRun: results.filter((r) => r.status === "dry-run").length,
      failed: results.filter((r) => r.status === "failed").length,
    };
    return c.json({ results, summary });
  });
}
