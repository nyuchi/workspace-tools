import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  describePushSummary,
  errorMessage,
  getAdminUsers,
  getGoogleStatus,
  googleLoginUrl,
  isBrandKey,
  isNotConnected,
  mapDirectoryUserToParams,
  pushSignatures,
  renderSignature,
  summarizePush,
  type DirectoryUser,
  type PushResult,
  type PushSummary,
} from './api'
import { BRAND_LABELS, BRAND_MINERAL } from './helpers'

/* Admin mode of the Signature Console (Phase 1/2 scaffold of
 * docs/signature-console-plan.md): connect gate → domain user table →
 * dry-run / push actions with per-row results.
 *
 * Humans in the loop (Mzizi doctrine): actions only ever apply to an
 * explicit selection, "Push signatures" states the count and asks for an
 * in-UI confirmation before firing, and dry-run is always available.
 *
 * Previews render through POST /api/signature — the same byte-locked engine
 * output a push would write — inside a sandboxed iframe (scripts blocked;
 * the signature markup is engine-escaped, the iframe is defense in depth). */

type Gate = 'checking' | 'connect' | 'loading-users' | 'ready' | 'error'

interface PreviewState {
  html?: string
  error?: string
}

const AdminPanel = () => {
  const [gate, setGate] = useState<Gate>('checking')
  const [gateError, setGateError] = useState<string | null>(null)
  const [adminEmail, setAdminEmail] = useState<string | null>(null)
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [domain, setDomain] = useState('')

  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [includeAliases, setIncludeAliases] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [running, setRunning] = useState<'dry' | 'push' | null>(null)
  const [results, setResults] = useState<Record<string, PushResult>>({})
  const [summary, setSummary] = useState<PushSummary | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [openPreview, setOpenPreview] = useState<string | null>(null)
  const [previews, setPreviews] = useState<Record<string, PreviewState>>({})

  /* Connect gate: session status first, then the directory. Any 401 along
   * the way means "no admin Google session" → show the connect card. */
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const status = await getGoogleStatus()
        if (cancelled) return
        if (!status.connected) {
          setGate('connect')
          return
        }
        setAdminEmail(status.email ?? null)
        setGate('loading-users')
        const data = await getAdminUsers()
        if (cancelled) return
        setUsers(data.users)
        setDomain(data.domain)
        setGate('ready')
      } catch (err) {
        if (cancelled) return
        if (isNotConnected(err)) {
          setGate('connect')
          return
        }
        setGateError(errorMessage(err))
        setGate('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return users
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q),
    )
  }, [users, search])

  const allFilteredSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.email))

  const toggleRow = useCallback((email: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(email)) next.delete(email)
      else next.add(email)
      return next
    })
    setConfirming(false)
  }, [])

  /* Select-all operates on the current filter result. */
  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const next = new Set(prev)
      const every = filtered.length > 0 && filtered.every((u) => next.has(u.email))
      for (const u of filtered) {
        if (every) next.delete(u.email)
        else next.add(u.email)
      }
      return next
    })
    setConfirming(false)
  }, [filtered])

  const run = useCallback(
    async (dryRun: boolean) => {
      const targets = [...selected]
      if (!targets.length || running) return
      setActionError(null)
      setConfirming(false)
      setRunning(dryRun ? 'dry' : 'push')
      try {
        /* Targets are always sent explicitly — the UI never relies on the
         * backend's "omitted targets = everyone" default. */
        const res = await pushSignatures({ targets, dryRun, includeAliases })
        const byEmail: Record<string, PushResult> = {}
        for (const r of res.results) byEmail[r.email] = r
        setResults(byEmail)
        setSummary(res.summary ?? summarizePush(res.results))
      } catch (err) {
        if (isNotConnected(err)) setGate('connect')
        else setActionError(errorMessage(err))
      } finally {
        setRunning(null)
      }
    },
    [selected, includeAliases, running],
  )

  const togglePreview = useCallback(
    async (user: DirectoryUser) => {
      if (openPreview === user.email) {
        setOpenPreview(null)
        return
      }
      setOpenPreview(user.email)
      if (previews[user.email]?.html) return
      try {
        const { html } = await renderSignature(mapDirectoryUserToParams(user))
        setPreviews((prev) => ({ ...prev, [user.email]: { html } }))
      } catch (err) {
        setPreviews((prev) => ({ ...prev, [user.email]: { error: errorMessage(err) } }))
      }
    },
    [openPreview, previews],
  )

  /* ── Gate screens ── */
  if (gate === 'checking' || gate === 'loading-users') {
    return (
      <div className="sga-wrap">
        <style>{adminCss}</style>
        <div className="sga-gate">
          <h2>Admin console</h2>
          <p className="sga-muted">
            {gate === 'checking' ? 'Checking Google connection…' : 'Loading domain users…'}
          </p>
        </div>
      </div>
    )
  }

  if (gate === 'connect') {
    return (
      <div className="sga-wrap">
        <style>{adminCss}</style>
        <div className="sga-gate">
          <h2>Admin console</h2>
          <p className="sga-muted">
            Connect a Google Workspace admin account to list domain users and push signatures. You
            will be redirected to Google to authorize directory access.
          </p>
          <button
            type="button"
            className="sga-btn primary"
            onClick={() => window.location.assign(googleLoginUrl('admin'))}
          >
            Connect Google
          </button>
        </div>
      </div>
    )
  }

  if (gate === 'error') {
    return (
      <div className="sga-wrap">
        <style>{adminCss}</style>
        <div className="sga-gate">
          <h2>Admin console</h2>
          <div className="sga-alert" role="alert">
            {gateError}
          </div>
        </div>
      </div>
    )
  }

  /* ── Ready: toolbar + table + actions ── */
  const selectedCount = selected.size

  return (
    <div className="sga-wrap">
      <style>{adminCss}</style>

      <div className="sga-toolbar">
        <input
          type="search"
          className="sga-search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search users by name or email"
        />
        <span className="sga-muted sga-toolbar-meta">
          {domain}
          {adminEmail ? ` · connected as ${adminEmail}` : ''}
        </span>
      </div>

      <div className="sga-table-wrap">
        <table className="sga-table">
          <thead>
            <tr>
              <th className="sga-col-check">
                <input
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  aria-label="Select all listed users"
                />
              </th>
              <th>Name</th>
              <th>Email</th>
              <th>Brand</th>
              <th>Title</th>
              <th>Aliases</th>
              <th>Status</th>
              <th className="sga-col-preview" />
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="sga-empty">
                  {users.length === 0 ? 'No users in the directory.' : 'No users match the search.'}
                </td>
              </tr>
            )}
            {filtered.map((user) => {
              const brandKey = isBrandKey(user.brand) ? user.brand : 'nyuchi'
              const mineral = BRAND_MINERAL[brandKey]
              const result: PushResult | undefined = results[user.email]
              const isOpen = openPreview === user.email
              const preview = previews[user.email]
              return (
                <Fragment key={user.email}>
                  <tr className={selected.has(user.email) ? 'sga-row selected' : 'sga-row'}>
                    <td className="sga-col-check">
                      <input
                        type="checkbox"
                        checked={selected.has(user.email)}
                        onChange={() => toggleRow(user.email)}
                        aria-label={`Select ${user.email}`}
                      />
                    </td>
                    <td className="sga-name">{user.name}</td>
                    <td className="sga-email">{user.email}</td>
                    <td>
                      <span className="sga-chip">
                        <span
                          className="sga-chip-dot"
                          style={{ background: `var(--color-${mineral})` }}
                        />
                        {BRAND_LABELS[brandKey]}
                      </span>
                    </td>
                    <td className="sga-title">{user.title || '—'}</td>
                    <td className="sga-aliases">{user.aliases.length}</td>
                    <td>
                      {result ? (
                        <span
                          className={`sga-status ${result.status}`}
                          title={result.error || result.sendAs}
                        >
                          {result.status === 'pushed' && '✓ pushed'}
                          {result.status === 'dry-run' && '◌ dry-run'}
                          {result.status === 'failed' && '✕ failed'}
                        </span>
                      ) : (
                        <span className="sga-muted">—</span>
                      )}
                      {result?.status === 'failed' && result.error && (
                        <div className="sga-row-error">{result.error}</div>
                      )}
                    </td>
                    <td className="sga-col-preview">
                      <button
                        type="button"
                        className="sga-btn row"
                        aria-expanded={isOpen}
                        onClick={() => togglePreview(user)}
                      >
                        {isOpen ? 'Close' : 'Preview'}
                      </button>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="sga-drawer">
                      <td colSpan={8}>
                        {!preview && <div className="sga-muted sga-drawer-note">Rendering preview…</div>}
                        {preview?.error && (
                          <div className="sga-alert" role="alert">
                            {preview.error}
                          </div>
                        )}
                        {preview?.html && (
                          <iframe
                            className="sga-preview-frame"
                            sandbox=""
                            title={`Signature preview for ${user.email}`}
                            srcDoc={wrapPreviewDoc(preview.html)}
                          />
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {actionError && (
        <div className="sga-alert" role="alert">
          {actionError}
        </div>
      )}

      <div className="sga-actions">
        <span className="sga-count">
          {filtered.length} of {users.length} users · {selectedCount} selected
          {summary ? ` · ${describePushSummary(summary)}` : ''}
        </span>
        <label className="sga-toggle">
          <input
            type="checkbox"
            checked={includeAliases}
            onChange={(e) => setIncludeAliases(e.target.checked)}
          />
          Include aliases
        </label>
        <button
          type="button"
          className="sga-btn ghost"
          disabled={!selectedCount || !!running}
          onClick={() => run(true)}
        >
          {running === 'dry' ? 'Running dry run…' : 'Dry run'}
        </button>
        {confirming ? (
          <>
            <span className="sga-confirm">
              Push signatures to {selectedCount} user{selectedCount === 1 ? '' : 's'}
              {includeAliases ? ' (incl. aliases)' : ''}?
            </span>
            <button type="button" className="sga-btn ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="button" className="sga-btn primary" onClick={() => run(false)}>
              Confirm push
            </button>
          </>
        ) : (
          <button
            type="button"
            className="sga-btn primary"
            disabled={!selectedCount || !!running}
            onClick={() => setConfirming(true)}
          >
            {running === 'push' ? 'Pushing…' : 'Push signatures'}
          </button>
        )}
      </div>
    </div>
  )
}

/* Minimal white document for the sandboxed preview iframe — signatures render
 * in recipients' (light) inboxes, matching the self-mode preview card. The
 * html comes straight from the engine via POST /api/signature; the sandbox
 * (no allow-scripts) is defense in depth on top of the engine's escaping. */
const wrapPreviewDoc = (html: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:20px 24px;background:#FFFFFF;color:#141413;">${html}</body></html>`

/* Scoped styles for the admin surface — same idiom as SignaturePage's css:
 * everything hangs off the .signature-studio custom properties, pills for
 * every button/input, 48px touch targets on standalone controls. */
const adminCss = `
.signature-studio .sga-wrap {
  width: 100%; max-width: 1100px; display: flex; flex-direction: column; gap: 14px; flex: 1;
}
.signature-studio .sga-muted { color: var(--sg-fg2); }

/* Gate card */
.signature-studio .sga-gate {
  margin: 40px auto 0; max-width: 460px; width: 100%; text-align: center;
  background: var(--sg-panel); border: 1px solid var(--sg-line); border-radius: 14px;
  padding: 36px 28px; display: flex; flex-direction: column; align-items: center; gap: 12px;
}
.signature-studio .sga-gate h2 { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0; }
.signature-studio .sga-gate p { margin: 0; font-size: 13px; line-height: 1.6; }

/* Buttons — pills; standalone actions keep a 48px touch target. */
.signature-studio .sga-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 48px; padding: 0 22px; border-radius: 999px; border: 0;
  font-family: var(--font-sans); font-size: 13px; font-weight: 600; cursor: pointer; transition: opacity .15s;
}
.signature-studio .sga-btn.primary { background: var(--sg-accent); color: var(--sg-accent-fg, var(--primary-foreground)); }
.signature-studio .sga-btn.ghost { background: transparent; border: 1px solid var(--sg-line); color: var(--sg-fg); }
.signature-studio .sga-btn.row { min-height: 36px; padding: 0 14px; font-size: 12px; background: transparent; border: 1px solid var(--sg-line); color: var(--sg-fg); }
.signature-studio .sga-btn:hover:not(:disabled) { opacity: .82; }
.signature-studio .sga-btn:disabled { opacity: .45; cursor: not-allowed; }

/* Toolbar */
.signature-studio .sga-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.signature-studio .sga-search {
  flex: 1; min-width: 220px; min-height: 48px;
  background: var(--sg-input); border: 1px solid var(--sg-line); color: var(--sg-fg);
  border-radius: 999px; padding: 0 18px; font-family: var(--font-sans); font-size: 13px;
  outline: none; transition: border-color .15s;
}
.signature-studio .sga-search:focus { border-color: var(--sg-accent); }
.signature-studio .sga-toolbar-meta { font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em; }

/* Table */
.signature-studio .sga-table-wrap {
  width: 100%; overflow-x: auto; background: var(--sg-panel);
  border: 1px solid var(--sg-line); border-radius: 14px;
}
.signature-studio .sga-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.signature-studio .sga-table th {
  font-family: var(--font-mono); font-size: 10px; font-weight: 600; text-transform: uppercase;
  letter-spacing: .12em; color: var(--sg-fg2); text-align: left;
  padding: 12px; border-bottom: 1px solid var(--sg-line); white-space: nowrap;
}
.signature-studio .sga-table td { padding: 8px 12px; border-bottom: 1px solid var(--sg-line); vertical-align: middle; }
.signature-studio .sga-row { height: 48px; }
.signature-studio .sga-row.selected { background: var(--sg-card-check); }
.signature-studio .sga-table tbody tr:last-child td { border-bottom: none; }
.signature-studio .sga-table input[type='checkbox'] { width: 18px; height: 18px; accent-color: var(--sg-accent); cursor: pointer; }
.signature-studio .sga-col-check { width: 34px; }
.signature-studio .sga-col-preview { text-align: right; white-space: nowrap; }
.signature-studio .sga-name { font-weight: 600; white-space: nowrap; }
.signature-studio .sga-email { font-family: var(--font-mono); font-size: 11px; color: var(--sg-fg2); white-space: nowrap; }
.signature-studio .sga-title { color: var(--sg-fg2); }
.signature-studio .sga-aliases { font-family: var(--font-mono); font-size: 11px; color: var(--sg-fg2); }
.signature-studio .sga-empty { text-align: center; color: var(--sg-fg2); padding: 28px 12px; }

.signature-studio .sga-chip {
  display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px;
  border: 1px solid var(--sg-line); border-radius: 999px; font-size: 11px; white-space: nowrap;
}
.signature-studio .sga-chip-dot { width: 8px; height: 8px; border-radius: 99px; }

.signature-studio .sga-status { font-family: var(--font-mono); font-size: 11px; white-space: nowrap; }
.signature-studio .sga-status.pushed { color: var(--success); }
.signature-studio .sga-status.dry-run { color: var(--sg-fg2); }
.signature-studio .sga-status.failed { color: var(--error); }
.signature-studio .sga-row-error { font-size: 11px; color: var(--error); line-height: 1.4; margin-top: 2px; max-width: 260px; }

/* Preview drawer */
.signature-studio .sga-drawer td { background: var(--sg-card-check); padding: 12px; }
.signature-studio .sga-drawer-note { font-size: 12px; padding: 6px 2px; }
.signature-studio .sga-preview-frame {
  width: 100%; max-width: 680px; height: 240px; display: block;
  border: 0; border-radius: 10px; background: #FFFFFF; box-shadow: 0 6px 36px rgba(0,0,0,.35);
}

/* Actions bar */
.signature-studio .sga-actions {
  display: flex; align-items: center; justify-content: flex-end; gap: 10px; flex-wrap: wrap;
  padding-top: 10px; border-top: 1px solid var(--sg-line);
}
.signature-studio .sga-count {
  margin-right: auto; font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em;
  color: var(--sg-fg2); line-height: 1.7;
}
.signature-studio .sga-toggle {
  display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 6px;
  font-size: 12px; color: var(--sg-fg); cursor: pointer; user-select: none;
}
.signature-studio .sga-toggle input { width: 18px; height: 18px; accent-color: var(--sg-accent); cursor: pointer; }
.signature-studio .sga-confirm { font-size: 12px; font-weight: 600; color: var(--sg-fg); }

/* Muted alert — backend {error, detail} text lands here verbatim. */
.signature-studio .sga-alert {
  width: 100%; padding: 10px 14px; border-radius: 10px;
  background: var(--sg-input); border: 1px solid var(--sg-line); color: var(--sg-fg2);
  font-size: 12px; line-height: 1.5; overflow-wrap: anywhere;
}

@media (max-width: 768px) {
  .signature-studio .sga-toolbar-meta { display: none; }
  .signature-studio .sga-actions { justify-content: stretch; }
  .signature-studio .sga-actions .sga-btn { flex: 1; }
}
`

export default AdminPanel
