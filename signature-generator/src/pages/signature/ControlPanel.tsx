import type { ChangeEvent } from 'react'
import { BRANDS, BRAND_KEYS, type BrandKey } from '../../engines/signature'
import { CATEGORIES } from '../../engines/nyuchi'
import { BRAND_LABELS, BRAND_MINERAL, type SignatureFormData } from './helpers'

interface Props {
  brand: BrandKey
  form: SignatureFormData
  imageErrors: Record<string, boolean>
  onBrandChange: (brand: BrandKey) => void
  onField: (key: keyof SignatureFormData, value: string) => void
}

const ControlPanel = ({ brand, form, imageErrors, onBrandChange, onField }: Props) => {
  const field = (key: keyof SignatureFormData) => ({
    value: form[key],
    onChange: (e: ChangeEvent<HTMLInputElement>) => onField(key, e.target.value),
  })

  return (
    <aside className="sg-panel">
      <div className="sg-brandhead">
        <img alt="nyuchi" src="/assets/nyuchi-bee.png" />
        <h1>Email Signature</h1>
      </div>
      <span className="sg-tag">signature builder · bundu family · gmail-ready</span>

      <div className="sg-grp">
        <h2>01 · Brand</h2>
        <div className="sg-brands">
          {BRAND_KEYS.map((key) => {
            const def = CATEGORIES[BRAND_MINERAL[key]]
            return (
              <button
                key={key}
                type="button"
                className={'sg-brand-chip' + (key === brand ? ' active' : '')}
                title={`${BRANDS[key].name} · ${BRANDS[key].website}`}
                onClick={() => onBrandChange(key)}
              >
                <span
                  className="sg-chip-color"
                  style={{ background: `linear-gradient(135deg, ${def.dark} 0 50%, ${def.light} 50% 100%)` }}
                />
                <span className="sg-chip-name">{BRAND_LABELS[key]}</span>
              </button>
            )
          })}
        </div>
        <div className="sg-hint">Switching brand reloads that brand&apos;s default social links below.</div>
      </div>

      <div className="sg-grp">
        <h2>02 · Identity</h2>
        <label>
          Full name <span className="sg-req">*</span>
        </label>
        <input type="text" placeholder="Bryan Fawcett" {...field('name')} />
        <label>
          Job title <span className="sg-req">*</span>
        </label>
        <input type="text" placeholder="CEO & Founder" {...field('title')} />
        <label>
          Email <span className="sg-req">*</span>
        </label>
        <input type="email" placeholder="bryan@nyuchi.com" {...field('email')} />
        <div className="sg-two">
          <div>
            <label>Phone</label>
            <input type="tel" placeholder="+65 9814 3374" {...field('phone')} />
          </div>
          <div>
            <label>WhatsApp</label>
            <input type="text" placeholder="263771234567" {...field('whatsapp')} />
          </div>
        </div>
      </div>

      <div className="sg-grp">
        <h2>03 · Images</h2>
        <label>Profile image URL</label>
        <input
          type="url"
          className={imageErrors['profile'] ? 'sg-input-error' : undefined}
          placeholder="https://..."
          {...field('profileImage')}
        />
        {imageErrors['profile'] && (
          <div className="sg-warn">Failed to load image. Please check the URL — it is left out of the signature.</div>
        )}
        <div className="sg-two">
          <div>
            <label>Promo banner URL</label>
            <input
              type="url"
              className={imageErrors['banner'] ? 'sg-input-error' : undefined}
              placeholder="https://..."
              {...field('promoBanner')}
            />
          </div>
          <div>
            <label>Banner link URL</label>
            <input type="url" placeholder="https://..." {...field('promoLink')} />
          </div>
        </div>
        {imageErrors['banner'] && (
          <div className="sg-warn">Failed to load banner — it is left out of the signature.</div>
        )}
      </div>

      <div className="sg-grp">
        <h2>04 · Social links</h2>
        <label>LinkedIn</label>
        <input type="url" placeholder="https://linkedin.com/in/..." {...field('linkedin')} />
        <label>X / Twitter</label>
        <input type="url" placeholder="https://x.com/..." {...field('twitter')} />
        <label>Facebook</label>
        <input type="url" placeholder="https://facebook.com/..." {...field('facebook')} />
        <label>Instagram</label>
        <input type="url" placeholder="https://instagram.com/..." {...field('instagram')} />
      </div>

      <div className="sg-grp">
        <h2>05 · Help</h2>
        <div className="sg-hint">
          The preview updates as you type. &ldquo;Copy for Gmail&rdquo; puts the rich signature on your
          clipboard — paste it into Gmail Settings → General → Signature and save.
        </div>
        <div className="sg-hint">
          <a href="/help#signature">Full setup guide →</a>
        </div>
      </div>
    </aside>
  )
}

export default ControlPanel
