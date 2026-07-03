import { forwardRef } from 'react'
import { sanitizeUrl } from '../../engines/signature'

interface Props {
  /** Emitted signature markup — produced ONLY by buildSignatureHtml, which
   * escapes every piece of user input. One code path for preview and copy. */
  html: string
  /** Raw form URLs, probed with hidden <img>s to detect broken images. */
  profileImage: string
  promoBanner: string
  onImageError: (key: 'profile' | 'banner') => void
}

/* Live signature preview.
 *
 * The card injects buildSignatureHtml() verbatim, so what you see is exactly
 * what "Copy for Gmail" puts on the clipboard. Signatures are email HTML:
 * they always sit on a white card regardless of the app theme, like a real
 * recipient inbox (the caption below the card says so).
 *
 * The hidden probe <img>s reproduce the old component's image-error
 * detection: when a URL fails to load, the parent drops that image from the
 * engine params, so it disappears from both the preview and the copied HTML.
 * The forwarded ref targets the white card — the execCommand copy fallback
 * selects its contents. */
const Preview = forwardRef<HTMLDivElement, Props>(
  ({ html, profileImage, promoBanner, onImageError }, ref) => (
    <div className="sg-preview-frame">
      <div ref={ref} className="sg-card" dangerouslySetInnerHTML={{ __html: html }} />
      <p className="sg-card-note">
        rendered on white — signatures keep the recipient&apos;s inbox background, not the app theme
      </p>
      {profileImage && (
        <img
          className="sg-probe"
          src={sanitizeUrl(profileImage)}
          alt=""
          aria-hidden="true"
          onError={() => onImageError('profile')}
        />
      )}
      {promoBanner && (
        <img
          className="sg-probe"
          src={sanitizeUrl(promoBanner)}
          alt=""
          aria-hidden="true"
          onError={() => onImageError('banner')}
        />
      )}
    </div>
  ),
)

Preview.displayName = 'SignaturePreview'

export default Preview
