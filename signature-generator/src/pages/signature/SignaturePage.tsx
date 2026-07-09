import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  BRANDS,
  buildSignatureHtml,
  buildSignatureText,
  type BrandKey,
} from '../../engines/signature'
import ControlPanel from './ControlPanel'
import Preview from './Preview'
import {
  BRAND_MINERAL,
  blocksReadout,
  socialDefaults,
  toSignatureParams,
  type SignatureFormData,
} from './helpers'

type ThemeKey = 'light' | 'dark'
type CopyTarget = 'gmail' | 'html' | 'text'

const INITIAL_FORM: SignatureFormData = {
  name: '',
  title: '',
  email: '',
  phone: '',
  whatsapp: '',
  profileImage: '',
  promoBanner: '',
  promoLink: '',
  ...socialDefaults('nyuchi'),
}

function readDomTheme(): ThemeKey {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
}

const SignaturePage = () => {
  const [brand, setBrand] = useState<BrandKey>('nyuchi')
  const [form, setForm] = useState<SignatureFormData>(INITIAL_FORM)
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<CopyTarget | null>(null)
  const [copyError, setCopyError] = useState<string | null>(null)

  /* The white preview card — the execCommand copy fallback selects it. */
  const signatureCardRef = useRef<HTMLDivElement | null>(null)

  /* Initial theme: restore persisted preference (same as studio/banner). */
  useEffect(() => {
    const saved = localStorage.getItem('nyuchi-theme')
    if (saved === 'dark' || saved === 'light') {
      document.documentElement.setAttribute('data-theme', saved)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const next: ThemeKey = readDomTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('nyuchi-theme', next)
  }, [])

  /* Brand switch resets the social links to the brand defaults —
   * identical to the original component's brand effect. */
  useEffect(() => {
    setForm((f) => ({ ...f, ...socialDefaults(brand) }))
  }, [brand])

  /* Reset image errors when the URLs change so new URLs get re-probed. */
  useEffect(() => {
    setImageErrors({})
  }, [form.profileImage, form.promoBanner])

  const handleImageError = useCallback((key: 'profile' | 'banner') => {
    setImageErrors((prev) => (prev[key] ? prev : { ...prev, [key]: true }))
  }, [])

  const setField = useCallback((key: keyof SignatureFormData, value: string) => {
    setForm((f) => ({ ...f, [key]: value }))
  }, [])

  /* Live output — one code path (the pure engine) for preview AND copy.
   * Images that failed to load are dropped from the params, so they vanish
   * from both surfaces at once. */
  const params = useMemo(() => toSignatureParams(brand, form, imageErrors), [brand, form, imageErrors])
  const html = useMemo(() => buildSignatureHtml(params), [params])
  const text = useMemo(() => buildSignatureText(params), [params])

  /* ── Clipboard ── */
  const flagCopied = useCallback((target: CopyTarget) => {
    setCopied(target)
    window.setTimeout(() => setCopied(null), 2000)
  }, [])

  const failCopy = useCallback((err: unknown) => {
    console.error('Failed to copy:', err)
    setCopyError('Failed to copy. Try selecting the signature manually and pressing Ctrl+C.')
    window.setTimeout(() => setCopyError(null), 5000)
  }, [])

  /* Rich copy for Gmail: text/html + text/plain via ClipboardItem, with the
   * legacy selection + execCommand fallback on the visible signature card. */
  const copyForGmail = useCallback(async () => {
    if (!signatureCardRef.current) return
    setCopyError(null)
    try {
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        const htmlBlob = new Blob([html], { type: 'text/html' })
        const textBlob = new Blob([text], { type: 'text/plain' })
        await navigator.clipboard.write([
          new ClipboardItem({ 'text/html': htmlBlob, 'text/plain': textBlob }),
        ])
      } else {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(signatureCardRef.current)
        selection?.removeAllRanges()
        selection?.addRange(range)
        const success = document.execCommand('copy')
        selection?.removeAllRanges()
        if (!success) throw new Error('Copy command failed')
      }
      flagCopied('gmail')
    } catch (err) {
      failCopy(err)
    }
  }, [html, text, flagCopied, failCopy])

  /* Plain-string copies (raw HTML source / plain-text signature). */
  const copyString = useCallback(
    async (value: string, target: CopyTarget) => {
      setCopyError(null)
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value)
        } else {
          const ta = document.createElement('textarea')
          ta.value = value
          ta.setAttribute('readonly', '')
          ta.style.position = 'fixed'
          ta.style.opacity = '0'
          document.body.appendChild(ta)
          ta.select()
          const success = document.execCommand('copy')
          ta.remove()
          if (!success) throw new Error('Copy command failed')
        }
        flagCopied(target)
      } catch (err) {
        failCopy(err)
      }
    },
    [flagCopied, failCopy],
  )

  /* WebMCP: expose the same copy actions the UI buttons already call, so an
   * agent driving the browser can copy the signature without scraping the
   * DOM. Feature-detected — a silent no-op wherever document.modelContext
   * doesn't exist (i.e. every browser in this repo's test matrix today). */
  useEffect(() => {
    if (typeof document === 'undefined' || !('modelContext' in document)) return
    const controller = new AbortController()
    document.modelContext?.registerTool(
      {
        name: 'copy_signature_html',
        description: 'Copy the current Nyuchi email signature as rich HTML to the clipboard.',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          await copyString(html, 'html')
          return { status: 'copied', format: 'html' }
        },
        annotations: { readOnlyHint: false },
      },
      { signal: controller.signal },
    )
    document.modelContext?.registerTool(
      {
        name: 'copy_signature_text',
        description: 'Copy the current Nyuchi email signature as plain text to the clipboard.',
        inputSchema: { type: 'object', properties: {} },
        execute: async () => {
          await copyString(text, 'text')
          return { status: 'copied', format: 'text' }
        },
        annotations: { readOnlyHint: false },
      },
      { signal: controller.signal },
    )
    return () => controller.abort()
  }, [copyString, html, text])

  /* ── Meta strings ── */
  const brandData = BRANDS[brand]
  const mineral = BRAND_MINERAL[brand]
  const blocks = blocksReadout(params)

  const accentStyle = {
    '--sg-accent': `var(--color-${mineral})`,
  } as CSSProperties

  return (
    <>
      <style>{signatureCss}</style>
      <div className="signature-studio" style={accentStyle}>
        <ControlPanel
          brand={brand}
          form={form}
          imageErrors={imageErrors}
          onBrandChange={setBrand}
          onField={setField}
        />
        <div className="sg-stage">
          <div className="sg-topbar">
            <button type="button" className="sg-topbtn" onClick={toggleTheme}>◐ Theme</button>
          </div>
          <Preview
            ref={signatureCardRef}
            html={html}
            profileImage={form.profileImage}
            promoBanner={form.promoBanner}
            onImageError={handleImageError}
          />
          {copyError && (
            <div className="sg-error" role="alert">
              {copyError}
            </div>
          )}
          <div className="sg-meta">
            <div>
              <b>{brandData.name}</b> · <span>&ldquo;{brandData.tagline}&rdquo;</span>
              <br />
              <span>
                <span className="sg-dot" style={{ background: `var(--color-${mineral})` }} />
                {mineral}
              </span>{' '}
              · <span>{blocks}</span>
            </div>
            <div className="sg-actions">
              <button type="button" className="sg-btn-act ghost" onClick={() => copyString(text, 'text')}>
                {copied === 'text' ? '✓ Copied' : 'Copy plain text'}
              </button>
              <button type="button" className="sg-btn-act ghost" onClick={() => copyString(html, 'html')}>
                {copied === 'html' ? '✓ Copied' : 'Copy HTML'}
              </button>
              <button type="button" className="sg-btn-act primary" onClick={copyForGmail}>
                {copied === 'gmail' ? '✓ Copied!' : 'Copy for Gmail'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/* Scoped CSS — mirrors the Nyuchi Studio layout system (fixed sticky panel,
 * stage with checkered preview frame + meta row). The accent mineral follows
 * the active brand via --sg-accent (set inline on the page root); the white
 * signature card is intentionally NOT theme-aware — emitted signatures render
 * in recipients' inboxes, which are light. */
const signatureCss = `
.signature-studio {
  --sg-fg: var(--foreground);
  --sg-fg2: var(--muted-foreground);
  --sg-bg: var(--background);
  --sg-panel: var(--surface);
  --sg-card-check: var(--overlay);
  --sg-line: var(--border);
  --sg-accent: var(--color-gold);
  --sg-input: var(--input);
  display: flex;
  min-height: calc(100dvh - 4rem);
  background: var(--sg-bg);
  color: var(--sg-fg);
  font-family: var(--font-sans);
}
.signature-studio *,
.signature-studio *::before,
.signature-studio *::after { box-sizing: border-box; }

/* Panel */
.signature-studio .sg-panel {
  width: 330px; flex-shrink: 0;
  background: var(--sg-panel);
  border-right: 1px solid var(--sg-line);
  padding: 18px 16px;
  overflow-y: auto;
  max-height: calc(100dvh - 4rem);
  position: sticky; top: 4rem;
}
.signature-studio .sg-panel h1 { font-family: var(--font-serif); font-size: 19px; font-weight: 700; margin: 0 0 2px; }
.signature-studio .sg-tag {
  font-family: var(--font-mono); font-size: 10px; color: var(--sg-fg2);
  margin-bottom: 16px; display: block; letter-spacing: .08em;
}
.signature-studio .sg-grp { margin-bottom: 15px; border-bottom: 1px solid var(--sg-line); padding-bottom: 14px; }
.signature-studio .sg-grp:last-child { border: none; margin-bottom: 0; }
.signature-studio .sg-grp h2 {
  font-size: 10px; text-transform: uppercase; letter-spacing: .14em;
  color: var(--sg-fg2); margin-bottom: 9px; font-family: var(--font-mono); font-weight: 600;
}
.signature-studio .sg-panel label { display: block; font-size: 11px; color: var(--sg-fg2); margin: 9px 0 3px; }
.signature-studio .sg-panel input {
  width: 100%; background: var(--sg-input); border: 1px solid var(--sg-line); color: var(--sg-fg);
  border-radius: 999px; padding: 8px 14px; font-family: var(--font-sans); font-size: 13px;
  outline: none; transition: border-color .15s;
}
.signature-studio .sg-panel input:focus { border-color: var(--sg-accent); }
.signature-studio .sg-panel input.sg-input-error { border-color: var(--error); }
.signature-studio .sg-two { display: flex; gap: 8px; }
.signature-studio .sg-two > div { flex: 1; min-width: 0; }
.signature-studio .sg-req { display: inline; margin: 0; color: var(--error); }
.signature-studio .sg-warn { font-size: 11px; color: var(--error); line-height: 1.4; margin-top: 5px; }

.signature-studio .sg-brands { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 5px; }
.signature-studio .sg-brand-chip {
  display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px;
  background: var(--sg-input); border: 1.5px solid transparent; border-radius: 9px; cursor: pointer;
  font-family: var(--font-sans); color: var(--sg-fg); transition: .12s;
}
.signature-studio .sg-brand-chip .sg-chip-color { width: 100%; height: 22px; border-radius: 5px; }
.signature-studio .sg-brand-chip .sg-chip-name { font-size: 9px; letter-spacing: .02em; }
.signature-studio .sg-brand-chip.active { border-color: var(--sg-accent); }

.signature-studio .sg-hint { font-size: 10px; color: var(--sg-fg2); line-height: 1.5; margin-top: 7px; }
.signature-studio .sg-hint a { color: var(--sg-accent); text-decoration: none; font-weight: 600; }
.signature-studio .sg-hint a:hover { text-decoration: underline; }

/* Stage */
.signature-studio .sg-stage {
  flex: 1; padding: 24px 20px; display: flex; flex-direction: column; align-items: center; gap: 14px;
  overflow-y: auto; min-height: calc(100dvh - 4rem);
}
.signature-studio .sg-topbar { display: flex; gap: 8px; align-items: center; justify-content: flex-end; width: 100%; max-width: 1100px; }
.signature-studio .sg-topbtn {
  background: var(--sg-panel); border: 1px solid var(--sg-line); color: var(--sg-fg2);
  border-radius: 999px; padding: 7px 14px; font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-mono);
}
.signature-studio .sg-topbtn:hover { color: var(--sg-fg); }
.signature-studio .sg-preview-frame {
  width: 100%; max-width: 1100px; flex: 1; min-height: 240px;
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 24px 12px;
  background: repeating-conic-gradient(var(--sg-card-check) 0 25%, transparent 0 50%) 0 0 / 22px 22px;
  border-radius: 10px;
}
.signature-studio .sg-card {
  width: 100%; max-width: 600px; background: #FFFFFF; color: #141413;
  border-radius: 10px; padding: 24px 28px; overflow-x: auto;
  box-shadow: 0 6px 36px rgba(0,0,0,.35);
}
.signature-studio .sg-card-note {
  margin: 0; font-family: var(--font-mono); font-size: 10px; letter-spacing: .08em;
  color: var(--sg-fg2); text-align: center;
}
.signature-studio .sg-probe { display: none; }
.signature-studio .sg-error {
  width: 100%; max-width: 1100px; padding: 10px 14px; border-radius: 10px;
  background: var(--destructive-container); color: var(--error); box-shadow: 0 0 0 1px var(--error);
  font-size: 12px;
}
.signature-studio .sg-meta {
  width: 100%; max-width: 1100px; display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 8px; padding-top: 10px; border-top: 1px solid var(--sg-line);
  font-family: var(--font-mono); font-size: 10px; letter-spacing: .06em; color: var(--sg-fg2); line-height: 1.7;
}
.signature-studio .sg-meta b { color: var(--sg-fg); font-weight: 600; }
.signature-studio .sg-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.signature-studio .sg-dot {
  display: inline-block; width: 8px; height: 8px; border-radius: 99px;
  vertical-align: middle; margin-right: 5px;
}
.signature-studio .sg-btn-act {
  display: inline-flex; align-items: center; height: 34px; padding: 0 16px; border-radius: 999px; border: 0;
  font-family: var(--font-sans); font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity .15s;
}
.signature-studio .sg-btn-act.primary { background: var(--sg-accent); color: var(--primary-foreground); }
.signature-studio .sg-btn-act.ghost { background: transparent; border: 1px solid var(--sg-line); color: var(--sg-fg); }
.signature-studio .sg-btn-act:hover { opacity: .82; }

@media (max-width: 768px) {
  .signature-studio { flex-direction: column; }
  .signature-studio .sg-panel { width: 100%; position: relative; top: 0; max-height: none; border-right: none; border-bottom: 1px solid var(--sg-line); }
  .signature-studio .sg-stage { min-height: 60vh; padding: 14px 12px 28px; }
  .signature-studio .sg-preview-frame { min-height: 200px; flex: none; }
  .signature-studio .sg-meta { flex-direction: column; align-items: stretch; }
  .signature-studio .sg-actions { justify-content: flex-end; }
}
`

export default SignaturePage
