import React, { useState, useRef, useEffect } from 'react';

// Sanitize URL to prevent javascript: and other dangerous protocols
const sanitizeUrl = (url: string): string => {
  if (!url) return '';
  const trimmed = url.trim();
  // Only allow http, https, mailto, and tel protocols
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }
  // If no protocol, assume https
  if (!/^[a-z]+:/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  // Block dangerous protocols like javascript:, data:, etc.
  return '';
};

// Escape HTML entities to prevent XSS
const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

const EmailSignatureGenerator = () => {
  const [brand, setBrand] = useState('nyuchi');
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
  const signatureRef = useRef<HTMLDivElement>(null);

  const brands: Record<string, {
    name: string;
    tagline: string;
    website: string;
    websiteUrl: string;
    primaryColor: string;
    primaryColorDark: string;
    socials: Record<string, string>;
  }> = {
    nyuchi: {
      name: 'Nyuchi Africa',
      tagline: 'I am because we are',
      website: 'nyuchi.com',
      websiteUrl: 'https://nyuchi.com',
      primaryColor: '#5D4037',
      primaryColorDark: '#FFD740',
      socials: {
        linkedin: 'https://www.linkedin.com/company/nyuchi/',
        facebook: 'https://facebook.com/nyuchigroup',
        instagram: 'https://instagram.com/nyuchi.africa'
      }
    },
    mukoko: {
      name: 'Mukoko',
      tagline: 'Your Digital Twin Ecosystem',
      website: 'mukoko.com',
      websiteUrl: 'https://mukoko.com',
      primaryColor: '#4B0082',
      primaryColorDark: '#B388FF',
      socials: {
        facebook: 'https://facebook.com/mukokoafrica',
        instagram: 'https://instagram.com/mukoko.africa'
      }
    },
    travel: {
      name: 'Zimbabwe Travel Information',
      tagline: 'Discover the Heart of Africa',
      website: 'travel-info.co.zw',
      websiteUrl: 'https://travel-info.co.zw',
      primaryColor: '#004D40',
      primaryColorDark: '#64FFDA',
      socials: {
        twitter: 'https://x.com/zimbabwetravel',
        instagram: 'https://instagram.com/zimbabwe.travel'
      }
    },
    learning: {
      name: 'Nyuchi Learning',
      tagline: 'Education for Africa\'s Future',
      website: 'learning.nyuchi.com',
      websiteUrl: 'https://learning.nyuchi.com',
      primaryColor: '#0047AB',
      primaryColorDark: '#00B0FF',
      socials: {
        linkedin: 'https://www.linkedin.com/company/nyuchi/',
        instagram: 'https://instagram.com/nyuchi.africa'
      }
    }
  };

  const colors = {
    text: '#141413',
    muted: '#52524E'
  };

  useEffect(() => {
    const brandSocials = brands[brand].socials;
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

  const handleCopy = async () => {
    if (signatureRef.current) {
      try {
        // Use modern Clipboard API with HTML content
        const htmlContent = signatureRef.current.innerHTML;
        const textContent = signatureRef.current.innerText;

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
          // Fallback for older browsers - use selection
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(signatureRef.current);
          selection?.removeAllRanges();
          selection?.addRange(range);
          document.execCommand('copy');
          selection?.removeAllRanges();
        }

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const currentBrand = brands[brand];

  const SocialIcon = ({ url, icon, alt }: { url: string; icon: string; alt: string }) => {
    const safeUrl = sanitizeUrl(url);
    if (!safeUrl) return null;
    return (
      <td style={{ paddingRight: '8px' }}>
        <a href={safeUrl} style={{ textDecoration: 'none' }}>
          <img src={sanitizeUrl(icon)} alt={escapeHtml(alt)} width="24" height="24" style={{ display: 'block', borderRadius: '4px' }} />
        </a>
      </td>
    );
  };

  const brandLabels: Record<string, string> = {
    nyuchi: 'Nyuchi',
    mukoko: 'Mukoko',
    travel: 'Travel',
    learning: 'Learning'
  };

  return (
    <div className="min-h-screen bg-stone-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <span className="text-2xl">&#x1F41D;</span>
            <h1 className="text-2xl md:text-3xl font-bold text-stone-800" style={{ fontFamily: "'Noto Serif', Georgia, serif" }}>
              Email Signature Generator
            </h1>
          </div>
          <p className="text-stone-600">Create your branded email signature for the Bundu Family ecosystem</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Form */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <form onSubmit={handleGenerate}>
              {/* Brand Selection */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-stone-700 mb-3">Select Brand</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(brands).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setBrand(key)}
                      className={`p-3 rounded-xl text-sm font-medium transition-all border-2 ${
                        brand === key
                          ? 'border-current shadow-sm'
                          : 'bg-stone-50 border-transparent text-stone-600 hover:bg-stone-100'
                      }`}
                      style={brand === key ? {
                        backgroundColor: `${value.primaryColor}15`,
                        borderColor: value.primaryColor,
                        color: value.primaryColor
                      } : {}}
                    >
                      {brandLabels[key]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Personal Info */}
              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-stone-800 border-b border-stone-200 pb-2">Personal Information</h3>

                <div>
                  <label className="block text-sm text-stone-600 mb-1">Full Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all outline-none"
                    placeholder="Bryan Fawcett"
                  />
                </div>

                <div>
                  <label className="block text-sm text-stone-600 mb-1">Job Title <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all outline-none"
                    placeholder="CEO & Founder"
                  />
                </div>

                <div>
                  <label className="block text-sm text-stone-600 mb-1">Email <span className="text-red-500">*</span></label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all outline-none"
                    placeholder="bryan@nyuchi.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-stone-600 mb-1">Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all outline-none"
                      placeholder="+65 9814 3374"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-stone-600 mb-1">WhatsApp</label>
                    <input
                      type="text"
                      name="whatsapp"
                      value={formData.whatsapp}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all outline-none"
                      placeholder="263771234567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm text-stone-600 mb-1">Profile Image URL</label>
                  <input
                    type="url"
                    name="profileImage"
                    value={formData.profileImage}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all outline-none"
                    placeholder="https://..."
                  />
                </div>
              </div>

              {/* Social Links */}
              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-stone-800 border-b border-stone-200 pb-2">Social Links</h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-stone-600 mb-1">LinkedIn</label>
                    <input
                      type="url"
                      name="linkedin"
                      value={formData.linkedin}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all text-sm outline-none"
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-stone-600 mb-1">X / Twitter</label>
                    <input
                      type="url"
                      name="twitter"
                      value={formData.twitter}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all text-sm outline-none"
                      placeholder="https://x.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-stone-600 mb-1">Facebook</label>
                    <input
                      type="url"
                      name="facebook"
                      value={formData.facebook}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all text-sm outline-none"
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-stone-600 mb-1">Instagram</label>
                    <input
                      type="url"
                      name="instagram"
                      value={formData.instagram}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all text-sm outline-none"
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                </div>
              </div>

              {/* Promo Banner */}
              <div className="space-y-4 mb-6">
                <h3 className="font-semibold text-stone-800 border-b border-stone-200 pb-2">Promo Banner <span className="text-stone-400 font-normal">(optional)</span></h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-stone-600 mb-1">Banner Image URL</label>
                    <input
                      type="url"
                      name="promoBanner"
                      value={formData.promoBanner}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all text-sm outline-none"
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-stone-600 mb-1">Banner Link URL</label>
                    <input
                      type="url"
                      name="promoLink"
                      value={formData.promoLink}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border border-stone-300 rounded-xl focus:ring-2 focus:ring-stone-400 focus:border-transparent transition-all text-sm outline-none"
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 text-white font-semibold rounded-xl transition-all hover:opacity-90 active:scale-[0.98] cursor-pointer"
                style={{ backgroundColor: currentBrand.primaryColor }}
              >
                Generate Signature
              </button>
            </form>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-stone-800">Preview</h3>
              {showSignature && (
                <button
                  onClick={handleCopy}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer ${
                    copied
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                  }`}
                >
                  {copied ? '✓ Copied!' : 'Copy Signature'}
                </button>
              )}
            </div>

            <div className="border-2 border-dashed border-stone-200 rounded-xl p-4 min-h-64 bg-stone-50/50">
              {!showSignature ? (
                <div className="flex flex-col items-center justify-center h-64 text-stone-400 text-center">
                  <div className="text-4xl mb-3">&#x2709;&#xFE0F;</div>
                  <p>Fill in the form and click<br/>"Generate Signature"</p>
                </div>
              ) : (
                <div ref={signatureRef} className="bg-white p-4 rounded-lg">
                  <table cellPadding="0" cellSpacing="0" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", fontSize: '14px', lineHeight: '1.5', color: colors.text, maxWidth: '500px' }}>
                    <tbody>
                      <tr>
                        {formData.profileImage && (
                          <td style={{ verticalAlign: 'top', paddingRight: '16px' }}>
                            <img
                              src={sanitizeUrl(formData.profileImage)}
                              alt="Profile"
                              width="80"
                              height="80"
                              style={{ borderRadius: '50%', display: 'block', objectFit: 'cover' }}
                            />
                          </td>
                        )}
                        <td style={{ verticalAlign: 'top' }}>
                          <span style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif", fontSize: '17px', fontWeight: 700, color: colors.text }}>
                            {formData.name}
                          </span>
                          <br />
                          <span style={{ fontSize: '13px', fontWeight: 500, color: colors.muted }}>
                            {formData.title}
                          </span>
                          <br /><br />
                          <span style={{ fontFamily: "'Noto Serif', Georgia, serif", fontSize: '15px', fontWeight: 700, color: currentBrand.primaryColor }}>
                            {currentBrand.name}
                          </span>
                          <br />
                          <span style={{ fontSize: '12px', fontStyle: 'italic', color: colors.muted }}>
                            "{currentBrand.tagline}"
                          </span>
                          <br /><br />
                          <table cellPadding="0" cellSpacing="0" style={{ fontSize: '13px', color: colors.muted }}>
                            <tbody>
                              <tr>
                                <td style={{ paddingBottom: '3px' }}>
                                  <a href={sanitizeUrl(`mailto:${formData.email}`)} style={{ color: currentBrand.primaryColor, textDecoration: 'none' }}>
                                    {formData.email}
                                  </a>
                                </td>
                              </tr>
                              {formData.phone && (
                                <tr>
                                  <td style={{ paddingBottom: '3px' }}>
                                    <a href={sanitizeUrl(`tel:${formData.phone.replace(/\s/g, '')}`)} style={{ color: currentBrand.primaryColor, textDecoration: 'none' }}>
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
                                  <SocialIcon url={`https://wa.me/${formData.whatsapp}`} icon="https://cdn-icons-png.flaticon.com/512/3670/3670051.png" alt="WhatsApp" />
                                )}
                              </tr>
                            </tbody>
                          </table>
                        </td>
                      </tr>
                      {formData.promoBanner && (
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
              <div className="mt-4 p-4 rounded-xl" style={{ backgroundColor: `${currentBrand.primaryColor}10` }}>
                <h4 className="font-medium mb-2" style={{ color: currentBrand.primaryColor }}>How to use:</h4>
                <ol className="text-sm space-y-1" style={{ color: currentBrand.primaryColor }}>
                  <li>1. Click "Copy Signature" above</li>
                  <li>2. Open your email app settings</li>
                  <li>3. Go to Signature settings</li>
                  <li>4. Paste the signature</li>
                  <li>5. Save changes</li>
                </ol>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-sm text-stone-500">
          <p className="flex items-center justify-center gap-2">
            <span>&#x1F41D;</span>
            <span>Nyuchi Africa</span>
            <span>&bull;</span>
            <span className="italic">"Ndiri nekuti tiri" &mdash; I am because we are</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailSignatureGenerator;
