/* Signature Console API client — typed wrappers over the nyuchi-tools Worker
 * endpoints (the frozen Phase 1 contracts from docs/signature-console-plan.md)
 * plus PURE mapping helpers used by the admin table.
 *
 * The fetch wrappers only ever run in the browser (the signature island is
 * client:only), but this module must stay importable WITHOUT a DOM: the node
 * vitest suite imports the pure helpers (mapDirectoryUserToParams,
 * summarizePush, describePushSummary) directly. Keep all `fetch`/`window`
 * usage inside function bodies.
 *
 * The backends fail closed while unconfigured: non-OK responses carry
 * `{error, detail}` JSON, surfaced verbatim through ApiError so the UI can
 * show them in a muted alert.
 */

import { BRAND_KEYS, type BrandKey, type SignatureParams } from '../../engines/signature'
import { socialDefaults } from './helpers'

/* ── Contract types ── */

/** GET /api/google/status */
export interface GoogleStatus {
  connected: boolean
  email?: string
  scopes?: string[]
}

/** POST /api/self/insert (success body) */
export interface SelfInsertResult {
  ok: boolean
  email: string
  sendAs: string
}

/** One row of GET /api/admin/users. `brand` arrives as a plain string —
 * validate through isBrandKey before treating it as a BrandKey. */
export interface DirectoryUser {
  email: string
  name: string
  title?: string
  phone?: string
  aliases: string[]
  brand: string
}

/** GET /api/admin/users */
export interface AdminUsersResponse {
  users: DirectoryUser[]
  domain: string
}

/** POST /api/admin/push (request body) */
export interface PushRequest {
  targets?: string[]
  dryRun?: boolean
  includeAliases?: boolean
}

export type PushStatus = 'pushed' | 'dry-run' | 'failed'

export interface PushResult {
  email: string
  sendAs: string
  status: PushStatus
  error?: string
}

export interface PushSummary {
  pushed: number
  dryRun: number
  failed: number
}

/** POST /api/admin/push (response body) */
export interface PushResponse {
  results: PushResult[]
  summary: PushSummary
}

/** POST /api/signature */
export interface RenderResponse {
  html: string
}

/* ── Errors ── */

/** Non-OK responses parsed into their fail-closed `{error, detail}` shape.
 * `message` carries the backend's wording verbatim for the muted alerts. */
export class ApiError extends Error {
  readonly status: number
  readonly error: string
  readonly detail?: string

  constructor(status: number, error: string, detail?: string) {
    super(detail ? `${error}: ${detail}` : error)
    this.name = 'ApiError'
    this.status = status
    this.error = error
    this.detail = detail
  }
}

/** True when the failure means "no Google session yet" — the connect-gate
 * fallback. The contract names `google_not_connected`, but any 401 from
 * these endpoints means the same thing. */
export const isNotConnected = (err: unknown): boolean =>
  err instanceof ApiError && err.status === 401

/** Human-readable message for any thrown value. */
export const errorMessage = (err: unknown): string => {
  if (err instanceof ApiError) return err.message
  if (err instanceof Error) return err.message
  return String(err)
}

/* ── Fetch wrappers (browser-only) ── */

const JSON_HEADERS = { 'Content-Type': 'application/json' }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'same-origin', ...init })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* non-JSON body (e.g. a gateway error page) — fall through */
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; detail?: string }
    throw new ApiError(res.status, b.error || `HTTP ${res.status}`, b.detail)
  }
  return body as T
}

export const getGoogleStatus = (): Promise<GoogleStatus> => request<GoogleStatus>('/api/google/status')

/** Login is a browser navigation (OAuth redirect), never a fetch — pass this
 * to window.location.assign. */
export const googleLoginUrl = (mode: 'self' | 'admin'): string => `/api/google/login?mode=${mode}`

export const insertSelfSignature = (params: SignatureParams): Promise<SelfInsertResult> =>
  request<SelfInsertResult>('/api/self/insert', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(params),
  })

export const getAdminUsers = (): Promise<AdminUsersResponse> =>
  request<AdminUsersResponse>('/api/admin/users')

export const pushSignatures = (req: PushRequest): Promise<PushResponse> =>
  request<PushResponse>('/api/admin/push', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(req),
  })

/** Server-side render of the byte-locked signature HTML — used for per-user
 * admin previews so the drawer shows exactly what a push would write. */
export const renderSignature = (params: SignatureParams): Promise<RenderResponse> =>
  request<RenderResponse>('/api/signature', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(params),
  })

/* ── Pure helpers (node-safe, covered by tests/signature-console.test.ts) ── */

/** Narrow a backend-provided brand string to a signature BrandKey
 * (includes the legacy `travel`/`learning` signature identities). */
export const isBrandKey = (value: string): value is BrandKey =>
  (BRAND_KEYS as readonly string[]).includes(value)

/** Directory row → engine params, mirroring the batch script's behavior:
 * identity from the directory, socials from the brand defaults, no photo or
 * promo (those are per-user choices the directory doesn't know). Unknown
 * brands fall back to `nyuchi`. Aliases are push targets, not signature
 * content — they deliberately do not appear in the params. */
export const mapDirectoryUserToParams = (user: DirectoryUser): SignatureParams => {
  const brand: BrandKey = isBrandKey(user.brand) ? user.brand : 'nyuchi'
  return {
    brand,
    name: user.name,
    email: user.email,
    title: user.title ?? '',
    phone: user.phone ?? '',
    whatsapp: '',
    profileImage: '',
    promoBanner: '',
    promoLink: '',
    ...socialDefaults(brand),
  }
}

/** Client-side tally of per-user push results — same shape as the backend's
 * `summary`, used as the fallback when a response omits it. */
export const summarizePush = (results: readonly PushResult[]): PushSummary => {
  const summary: PushSummary = { pushed: 0, dryRun: 0, failed: 0 }
  for (const r of results) {
    if (r.status === 'pushed') summary.pushed += 1
    else if (r.status === 'dry-run') summary.dryRun += 1
    else summary.failed += 1
  }
  return summary
}

/** Mono summary line for the actions bar, e.g. "3 pushed · 2 dry-run · 1 failed". */
export const describePushSummary = (summary: PushSummary): string => {
  const parts: string[] = []
  if (summary.pushed) parts.push(`${summary.pushed} pushed`)
  if (summary.dryRun) parts.push(`${summary.dryRun} dry-run`)
  if (summary.failed) parts.push(`${summary.failed} failed`)
  return parts.length ? parts.join(' · ') : 'no results'
}
