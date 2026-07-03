import React, { useState, useRef, useEffect } from 'react';
import {
  BRANDS,
  BRAND_KEYS,
  SIGNATURE_COLORS,
  buildSignatureHtml,
  buildSignatureText,
  createMailtoUrl,
  createTelUrl,
  createWhatsAppUrl,
  sanitizeUrl,
  type BrandKey,
} from '../engines/signature';

// Token-driven pill input used across the SPA form.
// Behavioural props (name/value/onChange/etc.) flow through; visual styling is
// token-only so light/dark switching via [data-theme] just works.
type TokenInputProps = React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean };
const TokenInput = ({ hasError, onFocus, onBlur, ...rest }: TokenInputProps) => (
  <input
    {...rest}
    onFocus={(e) => {
      e.currentTarget.style.boxShadow = hasError
        ? '0 0 0 2px var(--error)'
        : '0 0 0 2px var(--ring)';
      onFocus?.(e);
    }}
    onBlur={(e) => {
      e.currentTarget.style.boxShadow = hasError
        ? '0 0 0 1px var(--error)'
        : 'var(--ring-1)';
      onBlur?.(e);
    }}
    style={{
      width: '100%',
      height: 'var(--h-input-sm)',
      padding: '0 20px',
      borderRadius: 'var(--radius-full)',
      background: hasError ? 'var(--destructive-container)' : 'var(--input)',
      color: 'var(--foreground)',
      fontFamily: 'var(--font-sans)',
      fontSize: 'var(--fs-body)',
      boxShadow: hasError ? '0 0 0 1px var(--error)' : 'var(--ring-1)',
      outline: 'none',
      border: 'none',
      transition: 'box-shadow 120ms ease',
    }}
  />
);

const EmailSignatureGenerator = () => {
  const [brand, setBrand] = useState<BrandKey>('nyuchi');
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    email: '',
    phone: '',
    profileImage: '',
    linkedin: 'https://www.linkedin.com/company/nyuchi/',
    twitter: '',
    facebook: 'https://facebook.com/nyuchigroup',
    instagram: 'https://instagram.com/nyuchi.africa',
    whatsapp: '',
    promoBanner: '',
    promoLink: ''
  });
  const [showSignature, setShowSignature] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});
  const signatureRef = useRef<HTMLDivElement>(null);

  // Theme (dark by default, persisted). Sync <html data-theme=…> so token
  // variables in tokens.css flip; the SPA UI reads from those tokens only.
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    return window.localStorage.getItem('nyuchi-theme') === 'light' ? 'light' : 'dark';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dataset.theme = theme;
    try {
      window.localStorage.setItem('nyuchi-theme', theme);
    } catch {
      /* localStorage unavailable — ignore */
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // Handle image load errors
  const handleImageError = (imageKey: string) => {
    setImageErrors(prev => ({ ...prev, [imageKey]: true }));
  };

  // Reset image errors when URLs change
  useEffect(() => {
    setImageErrors({});
  }, [formData.profileImage, formData.promoBanner]);

  useEffect(() => {
    const brandSocials = BRANDS[brand].socials;
    setFormData(prev => {
      return {
        ...prev,
        linkedin: brandSocials.linkedin || '',
        twitter: brandSocials.twitter || '',
        facebook: brandSocials.facebook || '',
        instagram: brandSocials.instagram || ''
      };
    });
    setShowSignature(false);
  }, [brand]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      return { ...prev, [name]: value };
    });
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSignature(true);
    setCopied(false);
  };

  // Signature HTML/text generation lives in the shared pure engine
  // (src/engines/signature) so the MCP Worker emits identical markup.
  // Images that failed to load in the preview are dropped from the copied
  // HTML, matching the preview's behavior.
  const signatureParams = () => ({
    brand,
    ...formData,
    profileImage: imageErrors['profile'] ? '' : formData.profileImage,
    promoBanner: imageErrors['banner'] ? '' : formData.promoBanner,
  });

  const handleCopy = async () => {
    if (!signatureRef.current) return;

    setCopyError(null);

    try {
      // Generate HTML with explicit escaping instead of reading innerHTML
      const htmlContent = buildSignatureHtml(signatureParams());
      const textContent = buildSignatureText(signatureParams());

      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        // Modern browsers with ClipboardItem support
        const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
        const textBlob = new Blob([textContent], { type: 'text/plain' });
        const clipboardItem = new ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob
        });
        await navigator.clipboard.write([clipboardItem]);
      } else {
        // Fallback for older browsers - use selection on the visible element
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(signatureRef.current);
        selection?.removeAllRanges();
        selection?.addRange(range);
        const success = document.execCommand('copy');
        selection?.removeAllRanges();

        if (!success) {
          throw new Error('Copy command failed');
        }
      }

      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      setCopyError('Failed to copy. Try selecting the signature manually and pressing Ctrl+C.');
      setTimeout(() => setCopyError(null), 5000);
    }
  };

  const currentBrand = BRANDS[brand];

  // Brand -> Mzizi mineral. Drives SPA UI accent (chip border, ring, primary
  // button, "How to use" panel). Does NOT affect the emitted signature HTML,
  // which continues to use BRANDS[brand].primaryColor.
  const brandMineral: Record<string, string> = {
    nyuchi: 'gold',
    mukoko: 'tanzanite',
    travel: 'malachite',
    learning: 'cobalt',
    bundu: 'copper',
    shamwari: 'sodalite',
  };
  const activeMineral = brandMineral[brand] || 'cobalt';
  const mineralColor = `var(--color-${activeMineral})`;
  const mineralContainer = `var(--container-${activeMineral})`;

  const SocialIcon = ({ url, icon, alt }: { url: string; icon: string; alt: string }) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) return null;
    return (
      <td style={{ paddingRight: '8px' }}>
        <a href={safeUrl} style={{ textDecoration: 'none' }}>
          <img src={sanitizeUrl(icon)} alt={alt} width="24" height="24" style={{ display: 'block', borderRadius: '4px' }} />
        </a>
      </td>
    );
  };

  const brandLabels: Record<string, string> = {
    nyuchi: 'Nyuchi',
    mukoko: 'Mukoko',
    travel: 'Travel',
    learning: 'Learning',
    bundu: 'Bundu',
    shamwari: 'Shamwari'
  };

  // Reusable inline styles for SPA chrome. Kept inside render so tokens are
  // referenced as CSS vars (no JS-side theme branching needed).
  const captionStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: 'var(--fs-caption)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--muted-foreground)',
    margin: 0,
  };
  const sectionHeadingStyle: React.CSSProperties = {
    ...captionStyle,
    paddingBottom: 'var(--space-sm)',
    borderBottom: '1px solid var(--border)',
  };
  const fieldLabelStyle: React.CSSProperties = {
    display: 'block',
    marginBottom: 'var(--space-xs-plus)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--fs-small)',
    color: 'var(--muted-foreground)',
  };
  const cardStyle: React.CSSProperties = {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--ring-1), var(--shadow-sm)',
  };
  const requiredMark = <span style={{ color: 'var(--error)' }}>*</span>;

  return (
    <div
      className="min-h-screen p-4 md:p-6"
      style={{
        background: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-sans)',
      }}
    >
      <div className="max-w-5xl mx-auto">
        {/* Theme toggle */}
        <div className="flex justify-end mb-4">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="inline-flex items-center gap-2"
            style={{
              minHeight: 'var(--min-touch)',
              padding: '0 var(--space-base)',
              borderRadius: 'var(--radius-full)',
              background: 'var(--surface)',
              color: 'var(--foreground)',
              boxShadow: 'var(--ring-1)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-caption)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '☽'}</span>
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl" aria-hidden="true">&#x1F41D;</span>
            <h1
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: 'var(--fs-h3)',
                lineHeight: 'var(--lh-h3)',
                fontWeight: 700,
                color: 'var(--foreground)',
                margin: 0,
              }}
            >
              Email Signature Generator
            </h1>
          </div>
          <p style={{ color: 'var(--muted-foreground)', fontSize: 'var(--fs-body)', margin: 0 }}>
            Create your branded email signature for the Bundu Family ecosystem
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="p-6" style={cardStyle}>
            <form onSubmit={handleGenerate}>
              {/* Brand Selection */}
              <div className="mb-6">
                <div className="mb-3" style={captionStyle}>Select Brand</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {BRAND_KEYS.map((key) => {
                    const isActive = brand === key;
                    const mineralKey = brandMineral[key] || 'cobalt';
                    const chipColor = `var(--color-${mineralKey})`;
                    const chipContainer = `var(--container-${mineralKey})`;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setBrand(key)}
                        className="transition-all"
                        style={{
                          minHeight: 'var(--h-button-sm)',
                          padding: '0 var(--space-base)',
                          borderRadius: 'var(--radius-full)',
                          fontFamily: 'var(--font-sans)',
                          fontSize: 'var(--fs-small)',
                          fontWeight: 600,
                          background: isActive ? chipContainer : 'var(--muted)',
                          color: isActive ? chipColor : 'var(--muted-foreground)',
                          boxShadow: isActive
                            ? `inset 0 0 0 2px ${chipColor}`
                            : 'var(--ring-1)',
                          border: 'none',
                          cursor: 'pointer',
                        }}
                      >
                        {brandLabels[key]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Personal Info */}
              <div className="space-y-4 mb-6">
                <h3 style={sectionHeadingStyle}>Personal Information</h3>

                <label className="block">
                  <span style={fieldLabelStyle}>Full Name {requiredMark}</span>
                  <TokenInput
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="Bryan Fawcett"
                  />
                </label>

                <label className="block">
                  <span style={fieldLabelStyle}>Job Title {requiredMark}</span>
                  <TokenInput
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    placeholder="CEO & Founder"
                  />
                </label>

                <label className="block">
                  <span style={fieldLabelStyle}>Email {requiredMark}</span>
                  <TokenInput
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    placeholder="bryan@nyuchi.com"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span style={fieldLabelStyle}>Phone</span>
                    <TokenInput
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+65 9814 3374"
                    />
                  </label>
                  <label className="block">
                    <span style={fieldLabelStyle}>WhatsApp</span>
                    <TokenInput
                      type="text"
                      name="whatsapp"
                      value={formData.whatsapp}
                      onChange={handleInputChange}
                      placeholder="263771234567"
                    />
                  </label>
                </div>

                <label className="block">
                  <span style={fieldLabelStyle}>Profile Image URL</span>
                  <TokenInput
                    type="url"
                    name="profileImage"
                    value={formData.profileImage}
                    onChange={handleInputChange}
                    hasError={!!imageErrors['profile']}
                    placeholder="https://..."
                  />
                  {imageErrors['profile'] && (
                    <p
                      style={{
                        color: 'var(--error)',
                        fontSize: 'var(--fs-caption)',
                        marginTop: 'var(--space-xs)',
                      }}
                    >
                      Failed to load image. Please check the URL.
                    </p>
                  )}
                </label>
              </div>

              {/* Social Links */}
              <div className="space-y-4 mb-6">
                <h3 style={sectionHeadingStyle}>Social Links</h3>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span style={fieldLabelStyle}>LinkedIn</span>
                    <TokenInput
                      type="url"
                      name="linkedin"
                      value={formData.linkedin}
                      onChange={handleInputChange}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </label>
                  <label className="block">
                    <span style={fieldLabelStyle}>X / Twitter</span>
                    <TokenInput
                      type="url"
                      name="twitter"
                      value={formData.twitter}
                      onChange={handleInputChange}
                      placeholder="https://x.com/..."
                    />
                  </label>
                  <label className="block">
                    <span style={fieldLabelStyle}>Facebook</span>
                    <TokenInput
                      type="url"
                      name="facebook"
                      value={formData.facebook}
                      onChange={handleInputChange}
                      placeholder="https://facebook.com/..."
                    />
                  </label>
                  <label className="block">
                    <span style={fieldLabelStyle}>Instagram</span>
                    <TokenInput
                      type="url"
                      name="instagram"
                      value={formData.instagram}
                      onChange={handleInputChange}
                      placeholder="https://instagram.com/..."
                    />
                  </label>
                </div>
              </div>

              {/* Promo Banner */}
              <div className="space-y-4 mb-6">
                <h3 style={sectionHeadingStyle}>
                  Promo Banner{' '}
                  <span
                    style={{
                      textTransform: 'none',
                      letterSpacing: 0,
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--muted-foreground)',
                    }}
                  >
                    (optional)
                  </span>
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span style={fieldLabelStyle}>Banner Image URL</span>
                    <TokenInput
                      type="url"
                      name="promoBanner"
                      value={formData.promoBanner}
                      onChange={handleInputChange}
                      hasError={!!imageErrors['banner']}
                      placeholder="https://..."
                    />
                    {imageErrors['banner'] && (
                      <p
                        style={{
                          color: 'var(--error)',
                          fontSize: 'var(--fs-caption)',
                          marginTop: 'var(--space-xs)',
                        }}
                      >
                        Failed to load banner.
                      </p>
                    )}
                  </label>
                  <label className="block">
                    <span style={fieldLabelStyle}>Banner Link URL</span>
                    <TokenInput
                      type="url"
                      name="promoLink"
                      value={formData.promoLink}
                      onChange={handleInputChange}
                      placeholder="https://..."
                    />
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full transition-transform active:scale-[0.98]"
                style={{
                  height: 'var(--h-button-default)',
                  padding: '0 var(--space-lg)',
                  borderRadius: 'var(--radius-full)',
                  background: mineralColor,
                  color: 'var(--primary-foreground)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: 'var(--fs-body)',
                  fontWeight: 700,
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                Generate Signature
              </button>
            </form>
          </div>

          {/* Preview */}
          <div className="p-6" style={cardStyle}>
            <div className="flex justify-between items-center mb-4">
              <h3 style={captionStyle}>Preview</h3>
              {showSignature && (
                <button
                  onClick={handleCopy}
                  className="transition-colors"
                  style={{
                    minHeight: 'var(--h-button-sm)',
                    padding: '0 var(--space-lg)',
                    borderRadius: 'var(--radius-full)',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--fs-small)',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    background: copied
                      ? 'var(--container-malachite)'
                      : copyError
                      ? 'var(--destructive-container)'
                      : 'var(--muted)',
                    color: copied
                      ? 'var(--color-malachite)'
                      : copyError
                      ? 'var(--error)'
                      : 'var(--foreground)',
                    boxShadow: 'var(--ring-1)',
                  }}
                >
                  {copied ? '✓ Copied!' : copyError ? '✕ Error' : 'Copy Signature'}
                </button>
              )}
            </div>

            {/* Error Toast */}
            {copyError && (
              <div
                className="mb-4 p-3"
                style={{
                  background: 'var(--destructive-container)',
                  color: 'var(--error)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 0 0 1px var(--error)',
                  fontSize: 'var(--fs-small)',
                }}
              >
                {copyError}
              </div>
            )}

            <div
              className="p-4 min-h-64"
              style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--muted)',
              }}
            >
              {!showSignature ? (
                <div
                  className="flex flex-col items-center justify-center h-64 text-center"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  <div className="text-4xl mb-3" aria-hidden="true">&#x2709;&#xFE0F;</div>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--fs-body)' }}>
                    Fill in the form and click<br />"Generate Signature"
                  </p>
                </div>
              ) : (
                <div ref={signatureRef} className="bg-white p-4 rounded-lg">
                  <table cellPadding="0" cellSpacing="0" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", fontSize: '14px', lineHeight: '1.5', color: SIGNATURE_COLORS.text, maxWidth: '500px' }}>
                    <tbody>
                      <tr>
                        {formData.profileImage && !imageErrors['profile'] && (
                          <td style={{ verticalAlign: 'top', paddingRight: '16px' }}>
                            <img
                              src={sanitizeUrl(formData.profileImage)}
                              alt="Profile"
                              width="80"
                              height="80"
                              style={{ borderRadius: '50%', display: 'block', objectFit: 'cover' }}
                              onError={() => handleImageError('profile')}
                            />
                          </td>
                        )}
                        <td style={{ verticalAlign: 'top' }}>
                          <span style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", fontSize: '17px', fontWeight: 700, color: SIGNATURE_COLORS.text }}>
                            {formData.name}
                          </span>
                          <br />
                          <span style={{ fontSize: '13px', fontWeight: 500, color: SIGNATURE_COLORS.muted }}>
                            {formData.title}
                          </span>
                          <br /><br />
                          <span style={{ fontFamily: "'Noto Serif', Georgia, serif", fontSize: '15px', fontWeight: 700, color: currentBrand.primaryColor }}>
                            {currentBrand.name}
                          </span>
                          <br />
                          <span style={{ fontSize: '12px', fontStyle: 'italic', color: SIGNATURE_COLORS.muted }}>
                            "{currentBrand.tagline}"
                          </span>
                          <br /><br />
                          <table cellPadding="0" cellSpacing="0" style={{ fontSize: '13px', color: SIGNATURE_COLORS.muted }}>
                            <tbody>
                              <tr>
                                <td style={{ paddingBottom: '3px' }}>
                                  <a href={createMailtoUrl(formData.email)} style={{ color: currentBrand.primaryColor, textDecoration: 'none' }}>
                                    {formData.email}
                                  </a>
                                </td>
                              </tr>
                              {formData.phone && (
                                <tr>
                                  <td style={{ paddingBottom: '3px' }}>
                                    <a href={createTelUrl(formData.phone)} style={{ color: currentBrand.primaryColor, textDecoration: 'none' }}>
                                      {formData.phone}
                                    </a>
                                  </td>
                                </tr>
                              )}
                              <tr>
                                <td>
                                  <a href={currentBrand.websiteUrl} style={{ color: currentBrand.primaryColor, textDecoration: 'none' }}>
                                    {currentBrand.website}
                                  </a>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                          <br />
                          <table cellPadding="0" cellSpacing="0">
                            <tbody>
                              <tr>
                                <SocialIcon url={formData.linkedin} icon="https://cdn-icons-png.flaticon.com/512/3536/3536505.png" alt="LinkedIn" />
                                <SocialIcon url={formData.twitter} icon="https://cdn-icons-png.flaticon.com/512/5969/5969020.png" alt="X" />
                                <SocialIcon url={formData.facebook} icon="https://cdn-icons-png.flaticon.com/512/5968/5968764.png" alt="Facebook" />
                                <SocialIcon url={formData.instagram} icon="https://cdn-icons-png.flaticon.com/512/2111/2111463.png" alt="Instagram" />
                                {formData.whatsapp && (
                                  <SocialIcon url={createWhatsAppUrl(formData.whatsapp)} icon="https://cdn-icons-png.flaticon.com/512/3670/3670051.png" alt="WhatsApp" />
                                )}
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                      {formData.promoBanner && !imageErrors['banner'] && (
                        <>
                          <tr>
                            <td colSpan={2} style={{ paddingTop: '16px' }}></td>
                          </tr>
                          <tr>
                            <td colSpan={2}>
                              <a href={sanitizeUrl(formData.promoLink) || '#'} style={{ textDecoration: 'none' }}>
                                <img
                                  src={sanitizeUrl(formData.promoBanner)}
                                  alt="Promotion"
                                  width="400"
                                  style={{ display: 'block', maxWidth: '100%', height: 'auto', borderRadius: '8px' }}
                                  onError={() => handleImageError('banner')}
                                />
                              </a>
                            </td>
                          </tr>
                        </>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {showSignature && (
              <div
                className="mt-4 p-4"
                style={{
                  background: mineralContainer,
                  color: mineralColor,
                  borderRadius: 'var(--radius-md)',
                  boxShadow: `inset 0 0 0 1px ${mineralColor}`,
                }}
              >
                <h4
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 700,
                    fontSize: 'var(--fs-body)',
                    marginBottom: 'var(--space-sm)',
                  }}
                >
                  How to use:
                </h4>
                <ol
                  style={{
                    fontSize: 'var(--fs-small)',
                    margin: 0,
                    padding: 0,
                    listStyle: 'none',
                  }}
                >
                  <li style={{ marginBottom: 'var(--space-xs)' }}>1. Click "Copy Signature" above</li>
                  <li style={{ marginBottom: 'var(--space-xs)' }}>2. Open your email app settings</li>
                  <li style={{ marginBottom: 'var(--space-xs)' }}>3. Go to Signature settings</li>
                  <li style={{ marginBottom: 'var(--space-xs)' }}>4. Paste the signature</li>
                  <li>5. Save changes</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="text-center mt-8"
          style={{
            fontSize: 'var(--fs-small)',
            color: 'var(--muted-foreground)',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <p className="flex items-center justify-center gap-2">
            <span aria-hidden="true">&#x1F41D;</span>
            <span>Nyuchi Africa</span>
            <span aria-hidden="true">&bull;</span>
            <span style={{ fontStyle: 'italic' }}>
              "Ndiri nekuti tiri" &mdash; I am because we are
            </span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailSignatureGenerator;
