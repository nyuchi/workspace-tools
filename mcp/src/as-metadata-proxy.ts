/**
 * Read-only mirror of the WorkOS Connect authorization server's discovery
 * metadata, so agents that only look on the resource server's own domain
 * (tools.nyuchi.com) instead of following `authorization_servers` in the
 * protected-resource metadata still find it.
 *
 * This proxies (fetches + passes through) the real upstream documents from
 * identity.nyuchi.com — it never fabricates metadata. Only wired up when
 * `authConfigured(env)` is true; see index.ts.
 */

type MetadataResult = { ok: true; data: unknown } | { ok: false; status: number; message: string };

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes — soft optimization only;
// Workers isolates are ephemeral, so this is not relied on for correctness.
const FETCH_TIMEOUT_MS = 5000;

/** Module-level, per-isolate cache keyed by the full upstream URL. */
const cache = new Map<string, CacheEntry>();

/**
 * Fetch and cache a JSON discovery document from `url`. Returns the parsed
 * body on success, or an error descriptor (never throws) so callers can
 * respond with a clean 502 instead of fabricating metadata.
 */
export async function fetchMetadata(url: string): Promise<MetadataResult> {
  const cached = cache.get(url);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return { ok: true, data: cached.data };
  }

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (err) {
    return {
      ok: false,
      status: 502,
      message: `Failed to reach ${url}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!response.ok) {
    return { ok: false, status: 502, message: `Upstream ${url} responded with HTTP ${response.status}` };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    return {
      ok: false,
      status: 502,
      message: `Upstream ${url} did not return valid JSON: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  cache.set(url, { data, expiresAt: now + CACHE_TTL_MS });
  return { ok: true, data };
}
