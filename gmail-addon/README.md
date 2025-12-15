# Nyuchi Email Signature Generator - Gmail Add-on

A self-service Gmail Add-on that allows each user to generate and apply their own branded email signature for Nyuchi Africa brands.

## Features

- **Self-Service**: Each user generates and applies their own signature (no admin required)
- **Multi-Brand Support**: All Nyuchi Africa brands supported
  - Nyuchi Africa (and divisions: Lingo, Learning, Development, Foundation)
  - Mukoko (and Mukoko News)
  - Zimbabwe Travel Information
  - Technology Leaders of Africa
- **Rich Signatures**: Includes profile photos, social links, and promotional banners
- **Persistent Settings**: User preferences saved automatically
- **Compose Integration**: Insert signature directly into email drafts

## Supported Brands

| Brand | Website | Parent |
|-------|---------|--------|
| Nyuchi Africa | nyuchi.com | - |
| Nyuchi Lingo | lingo.nyuchi.com | Nyuchi Africa |
| Nyuchi Learning | learning.nyuchi.com | Nyuchi Africa |
| Nyuchi Development | services.nyuchi.com | Nyuchi Africa |
| Nyuchi Foundation | foundation.nyuchi.com | Nyuchi Africa |
| Mukoko | mukoko.com | - |
| Mukoko News | news.mukoko.com | Mukoko |
| Zimbabwe Travel | travel-info.co.zw | - |
| Tech Leaders of Africa | techdirectors.africa | - |

## Installation

### Option 1: Deploy as Internal Add-on (Recommended for Organizations)

1. **Create Apps Script Project**
   - Go to [script.google.com](https://script.google.com)
   - Click **New Project**
   - Name it "Nyuchi Email Signature"

2. **Copy the Code**
   - Delete default `Code.gs` content
   - Copy contents of `Code.js` into the editor
   - Rename the file from `Code.gs` to `Code.js` (optional)

3. **Configure Manifest**
   - Click **Project Settings** (gear icon)
   - Check **Show "appsscript.json" manifest file in editor**
   - Click **Editor** (< > icon)
   - Select `appsscript.json` from the sidebar
   - Replace contents with the provided `appsscript.json`

4. **Enable Gmail API**
   - In Apps Script, click **Services** (+ icon)
   - Find **Gmail API** and click **Add**

5. **Deploy as Add-on**
   - Click **Deploy** > **Test deployments**
   - Under **Application type**, select **Gmail Add-on**
   - Click **Install** to install for yourself

6. **Publish for Organization** (Google Workspace Admin)
   - Click **Deploy** > **New deployment**
   - Select type: **Add-on**
   - Fill in description
   - Click **Deploy**
   - Share the deployment with your organization via Google Workspace Admin Console

### Option 2: Using clasp CLI

```bash
# Install clasp
npm install -g @google/clasp

# Login to Google
clasp login

# Create new project
clasp create --title "Nyuchi Email Signature" --type standalone

# Push the code
clasp push

# Open in browser to configure
clasp open
```

## Usage

### For End Users

1. **Open Gmail** in your browser
2. **Find the Add-on** in the right sidebar (bee icon)
3. **Click the icon** to open the signature generator
4. **Fill in your details**:
   - Select your brand (Nyuchi, Mukoko, Travel, etc.)
   - Enter your name and job title
   - Add phone number (optional)
   - Add profile image URL (optional)
   - Configure social links (optional)
   - Add promotional banner (optional)
5. **Click "Save & Preview"** to review your signature
6. **Click "Apply to Gmail"** to set as your default signature

### Inserting into Emails

When composing a new email:
1. Click the **three-dot menu** at the bottom of the compose window
2. Select **Nyuchi Email Signature** > **Insert Signature**

## Configuration Fields

### Required Fields
| Field | Description | Example |
|-------|-------------|---------|
| Brand | Your organization/division | Nyuchi Africa |
| Full Name | Your display name | Bryan Fawcett |
| Email | Your email address | bryan@nyuchi.com |

### Optional Fields
| Field | Description | Example |
|-------|-------------|---------|
| Job Title | Your position | CEO & Founder |
| Phone | Contact number | +65 9814 3374 |
| Profile Image | URL to your photo | https://... |
| LinkedIn | LinkedIn profile | https://linkedin.com/in/... |
| X / Twitter | Twitter profile | https://x.com/... |
| Facebook | Facebook page | https://facebook.com/... |
| Instagram | Instagram handle | https://instagram.com/... |
| WhatsApp | WhatsApp number | 6598143374 |
| Promo Banner | Banner image URL | https://... |
| Banner Link | Banner click URL | https://... |

## OAuth Scopes

The add-on requires the following permissions:

| Scope | Purpose |
|-------|---------|
| `gmail.settings.basic` | Apply signature to Gmail settings |
| `script.external_request` | Load social media icons |
| `userinfo.email` | Pre-fill user's email address |

## Signature Design

The generated signature includes:

- **Profile Photo** (optional): 80x80px circular image
- **Name**: Bold, 17px, Plus Jakarta Sans
- **Job Title**: 13px, muted color
- **Brand Name**: 15px, Noto Serif, purple (#5f5873)
- **Brand Tagline**: 12px, italic
- **Contact Info**: Email, phone, website with links
- **Social Icons**: 24x24px icons for LinkedIn, Twitter, Facebook, Instagram, WhatsApp
- **Parent Attribution**: "A division of..." for sub-brands
- **Promo Banner**: Optional promotional image

### Brand Colors
- Primary (Purple): `#5f5873`
- Text: `#2a2a2a`
- Muted: `#737373`

## Troubleshooting

### "Error applying signature"
- Ensure Gmail API is enabled in the Apps Script project
- Check that you've authorized the add-on with all required scopes
- Re-authorize: Go to Project Settings > Clear all authorizations, then run again

### Signature not appearing
- Gmail may cache settings; try refreshing the page
- Compose a new email to test (don't check existing drafts)

### Images not loading
- Ensure image URLs are publicly accessible (no authentication required)
- Use HTTPS URLs
- Check that the URL returns an actual image file

### Add-on not visible in Gmail
- Make sure you've installed it via Deploy > Test deployments
- Refresh Gmail
- Check browser extensions aren't blocking it

## Differences from Admin Script

| Feature | Gmail Add-on | Admin Script (email-signature/) |
|---------|--------------|--------------------------------|
| Who runs it | Each user | Workspace admin |
| Permissions | User's own signature | Domain-wide delegation |
| Deployment | Apps Script add-on | Standalone script |
| User input | Interactive form | Config file |
| Aliases | Not supported | Supported |
| Bulk update | No | Yes |

## Development

### File Structure
```
gmail-addon/
├── appsscript.json    # Add-on manifest
├── Code.js            # Main application code
└── README.md          # This file
```

### Testing Locally
```bash
# Using clasp
clasp push
clasp open

# In Apps Script editor
# Run > testSignatureGeneration
# Run > testApplySignature
```

### Key Functions

| Function | Purpose |
|----------|---------|
| `onHomepage()` | Entry point, builds main card |
| `buildMainCard()` | Creates the configuration form |
| `saveAndPreview()` | Saves settings and shows preview |
| `applyToGmail()` | Applies signature via Gmail API |
| `generateSignatureHtml()` | Generates HTML signature |

## License

MIT License - see [LICENSE](../LICENSE) for details.

## Support

For issues or feature requests:
- Email: support@nyuchi.com
- Documentation: https://brand.nyuchi.com
