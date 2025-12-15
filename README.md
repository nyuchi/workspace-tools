# Nyuchi Workspace Tools

<p align="center">
  <img src="https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Africa_Logo_dark.svg" alt="Nyuchi Africa" width="200">
</p>

<p align="center">
  <strong>I am because we are</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#installation">Installation</a> •
  <a href="#usage">Usage</a> •
  <a href="#brands">Brands</a> •
  <a href="#deployment">Deployment</a>
</p>

---

Google Workspace email signature management tools for Nyuchi Africa and affiliated brands. Includes a Gmail Add-on with dual User/Admin interface and a full-featured web dashboard for enterprise signature deployment.

## Features

### Gmail Add-on (Tabbed Interface)

**User Tab** - Self-service signature generation
- Select from 9 Nyuchi brands
- Personal information (name, title, email, phone)
- Profile image support
- Social media links (LinkedIn, X, Facebook, Instagram, WhatsApp)
- Promotional banner with custom links
- One-click Gmail signature application
- Compose trigger for signature insertion

**Admin Tab** - Enterprise signature deployment
- Push signatures to all domain users
- Single user signature preview and update
- List all users and their email aliases
- Bulk signature deployment
- Scheduled daily automatic updates (2 AM)
- Full web dashboard access

### Web Dashboard

Full-scale administrative dashboard with Nyuchi branding:

- **Overview** - Statistics, quick actions, activity logging
- **User Management** - Searchable user table with preview/update actions
- **Signature Templates** - Live preview by brand
- **Brand Configuration** - Visual display of all 9 brands
- **Settings** - Domain config, scheduling, banner management

### Email Signature Generator (Standalone)

Batch deployment script for Google Workspace administrators:
- Domain-wide signature deployment
- Automatic brand detection by email domain
- Support for user aliases
- Zimbabwe flag accent strip
- Job title and phone from Google Directory
- Promotional banner support

## Supported Brands

| Brand | Domain | Logo |
|-------|--------|------|
| **Nyuchi Africa** | nyuchi.com | Parent company |
| **Nyuchi Lingo** | lingo.nyuchi.com | Language learning |
| **Nyuchi Learning** | learning.nyuchi.com | Education platform |
| **Nyuchi Development** | services.nyuchi.com | Software services |
| **Nyuchi Foundation** | foundation.nyuchi.com | Community initiatives |
| **Mukoko** | mukoko.com | Digital ecosystem |
| **Mukoko News** | news.mukoko.com | Pan-African journalism |
| **Zimbabwe Travel** | travel-info.co.zw | Tourism information |
| **Tech Leaders** | techdirectors.africa | Technology leadership |

## Installation

### Prerequisites

- Node.js 18+ ([Download](https://nodejs.org/))
- Google Account with Apps Script access
- Google Workspace admin (for Admin features)

### Step 1: Install Google CLASP CLI

CLASP (Command Line Apps Script Projects) is Google's official tool for developing Apps Script projects locally.

```bash
# Install clasp globally
npm install -g @google/clasp

# Verify installation
clasp --version
```

### Step 2: Enable Apps Script API

Before using CLASP, you must enable the Apps Script API in your Google account:

1. Go to [script.google.com/home/usersettings](https://script.google.com/home/usersettings)
2. Toggle **Google Apps Script API** to **ON**

> **Note**: This is a one-time setup per Google account.

### Step 3: Login to CLASP

```bash
# Login to your Google account
clasp login

# This opens a browser window for OAuth authorization
# Grant permissions and return to your terminal
```

To verify you're logged in:
```bash
clasp login --status
```

### Step 4: Clone the Repository

```bash
git clone https://github.com/nyuchitech/workspace-tools.git
cd workspace-tools

# Install dependencies
npm install
```

### Step 5: Create Apps Script Projects

You have two options:

#### Option A: Create New Projects (First Time Setup)

```bash
# For Gmail Add-on
cd gmail-addon
clasp create --title "Nyuchi Email Signature" --type standalone
clasp push

# For Email Signature Generator
cd ../email-signature
clasp create --title "Nyuchi Signature Generator" --type standalone
clasp push
```

#### Option B: Clone Existing Projects

If you already have Apps Script projects, update the `.clasp.json` files:

```bash
# gmail-addon/.clasp.json
{
  "scriptId": "YOUR_GMAIL_ADDON_SCRIPT_ID",
  "rootDir": "."
}

# email-signature/.clasp.json
{
  "scriptId": "YOUR_SIGNATURE_SCRIPT_ID",
  "rootDir": "."
}
```

Then pull or push:
```bash
clasp pull  # Download from Apps Script
clasp push  # Upload to Apps Script
```

### Step 6: Find Your Script ID

To get your Script ID from an existing project:

1. Open [script.google.com](https://script.google.com)
2. Click on your project
3. Go to **Project Settings** (gear icon)
4. Copy the **Script ID** under "IDs"

Or via CLI:
```bash
clasp open
# Opens the project in browser, Script ID is in the URL
```

### Step 7: Configure Google Cloud Project

For Gmail Add-on functionality:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable these APIs:
   - **Gmail API**
   - **Admin SDK Directory API** (for admin features)
4. Configure **OAuth consent screen**:
   - User Type: Internal (for Workspace) or External
   - Add scopes as listed in [Required OAuth Scopes](#required-oauth-scopes)
5. Link to Apps Script:
   - In Apps Script editor, go to **Project Settings**
   - Under "Google Cloud Platform (GCP) Project"
   - Enter your GCP project number

### Configure Script IDs

Update `.clasp.json` in each project folder with your script IDs:

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "."
}
```

## Usage

### Gmail Add-on

1. **Deploy** the add-on to your Google Workspace
2. **Open Gmail** and click the add-on icon in the sidebar
3. **User Tab**: Configure your personal signature
4. **Admin Tab**: Manage domain-wide signatures

### Web Dashboard

1. **Deploy as Web App** from Apps Script editor
2. Access via deployment URL or "Open Dashboard" button
3. Manage users, preview signatures, bulk deploy

### CLI Commands

```bash
# Push to Apps Script
npm run push:gmail          # Push Gmail Add-on
npm run push:signature      # Push Email Signature Generator
npm run push:all            # Push both projects

# Deploy
npm run deploy:gmail        # Deploy Gmail Add-on
npm run deploy:signature    # Deploy Email Signature Generator

# Open in browser
npx clasp open              # Open in Apps Script editor
```

## Project Structure

```
workspace-tools/
├── gmail-addon/
│   ├── Code.js              # Main add-on code (1900+ lines)
│   ├── Dashboard.html       # Web dashboard UI (900+ lines)
│   ├── appsscript.json      # Manifest with scopes
│   ├── .clasp.json          # Deployment config
│   └── README.md            # Add-on documentation
│
├── email-signature/
│   ├── Code.js              # Batch deployment script
│   ├── signature.html       # HTML template
│   ├── preview.html         # Preview page
│   ├── appsscript.json      # Manifest
│   ├── .clasp.json          # Deployment config
│   ├── README.md            # Setup guide
│   └── TESTING.md           # Test procedures
│
├── package.json             # Workspace config
├── README.md                # This file
├── CHANGELOG.md             # Version history
├── SECURITY.md              # Security policy
└── .gitignore
```

## Design System

### Colors

```javascript
const COLORS = {
  primary: '#5f5873',      // Nyuchi Purple
  text: '#2a2a2a',         // Dark text
  muted: '#737373',        // Secondary text
  flagGreen: '#729b63',    // Zimbabwe flag
  flagYellow: '#f6ad55',
  flagRed: '#d4634a',
  flagBlack: '#171717',
  flagWhite: '#ffffff'
};
```

### Typography

- **Headings**: Plus Jakarta Sans (700)
- **Brand Names**: Noto Serif (700)
- **Body**: Plus Jakarta Sans (400, 500)

### Zimbabwe Flag Accent

4px vertical stripe with 5 equal bands (20% each):
```css
linear-gradient(to bottom,
  #729b63 0%, #729b63 20%,     /* Green */
  #f6ad55 20%, #f6ad55 40%,    /* Yellow */
  #d4634a 40%, #d4634a 60%,    /* Red */
  #171717 60%, #171717 80%,    /* Black */
  #ffffff 80%, #ffffff 100%    /* White */
)
```

## Deployment

### Gmail Add-on Setup (Complete Guide)

#### Step 1: Push Code to Apps Script

```bash
cd gmail-addon
clasp push
```

#### Step 2: Configure the Manifest

Verify `appsscript.json` includes the Gmail add-on configuration:

```json
{
  "timeZone": "Africa/Harare",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "addOns": {
    "common": {
      "name": "Nyuchi Email Signature",
      "logoUrl": "https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Africa_Logo_icon.svg",
      "useLocaleFromApp": true,
      "homepageTrigger": {
        "runFunction": "onHomepage"
      }
    },
    "gmail": {
      "contextualTriggers": [],
      "composeTrigger": {
        "selectActions": [{
          "text": "Insert Signature",
          "runFunction": "onCompose"
        }],
        "draftAccess": "NONE"
      }
    }
  }
}
```

#### Step 3: Test Deployment (Development)

1. Open Apps Script editor:
   ```bash
   clasp open
   ```
2. Click **Deploy** > **Test deployments**
3. Under **Gmail Add-on**, click **Install**
4. Open Gmail and refresh - the add-on appears in the right sidebar

#### Step 4: Production Deployment

1. In Apps Script editor, click **Deploy** > **New deployment**
2. Click the gear icon, select **Add-on**
3. Fill in the deployment details:
   - Description: "Nyuchi Email Signature v1.0"
4. Click **Deploy**
5. Copy the **Deployment ID**

#### Step 5: Install for Google Workspace Domain

**For Workspace Admins:**

1. Go to [Google Admin Console](https://admin.google.com)
2. Navigate to **Apps** > **Google Workspace Marketplace apps** > **Apps list**
3. Click **Add app** > **Add internal app**
4. Enter your **Deployment ID** from Step 4
5. Configure installation settings:
   - Automatic installation: Choose domains/OUs
   - Manual installation: Users install themselves
6. Click **Finish**

**For Individual Users (if allowed):**

1. Open Gmail
2. Click the **+** icon in the right sidebar
3. Search for your add-on or paste the deployment link
4. Click **Install** and authorize

#### Step 6: Verify Installation

1. Open Gmail in a browser (not mobile)
2. Look for the Nyuchi bee icon in the right sidebar
3. Click to open and test the User/Admin tabs

### Web App Dashboard Deployment

1. **Deploy** from Apps Script editor:
   - Click **Deploy** > **New deployment**
   - Select type: **Web app**
   - Execute as: "User accessing the web app"
   - Who has access: "Anyone within [your domain]"
2. Click **Deploy** and copy the URL
3. **Access** the dashboard via the deployment URL
4. Or use the "Open Dashboard" button from the Admin tab

### Required OAuth Scopes

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/gmail.settings.basic",
    "https://www.googleapis.com/auth/gmail.settings.sharing",
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}
```

### Domain-Wide Delegation (Admin Features)

For Admin tab functionality:

1. Go to **Google Admin Console** > Security > API Controls
2. Click **Manage Domain Wide Delegation**
3. Add your OAuth Client ID with scopes:
   - `https://www.googleapis.com/auth/admin.directory.user.readonly`
   - `https://www.googleapis.com/auth/gmail.settings.basic`
   - `https://www.googleapis.com/auth/gmail.settings.sharing`

## API Reference

### Key Functions

| Function | Description |
|----------|-------------|
| `onHomepage(e)` | Gmail add-on entry point |
| `buildTabbedCard(tab)` | Render User/Admin tabs |
| `generateUserSignatureHtml(settings)` | User self-service signature |
| `generateAdminSignatureHtml(user, email)` | Admin deployment signature |
| `getAllDomainUsers()` | Fetch all domain users |
| `updateAllFromDashboard()` | Bulk signature deployment |
| `doGet(e)` | Web app entry point |

### Dashboard API

| Function | Returns |
|----------|---------|
| `getCurrentUserInfo()` | `{ email, name }` |
| `getDashboardData()` | `{ users[], totalUsers, totalAliases }` |
| `getSignaturePreview(brandKey)` | HTML signature string |
| `getUserSignaturePreview(email)` | `{ name, email, signatureHtml }` |
| `updateSingleUserFromDashboard(email)` | `{ success, updated, user }` |
| `updateAllFromDashboard()` | `{ success, failed, total }` |

## Testing

### Gmail Add-on Testing

1. **Test deployment**: Deploy as "Head" deployment for testing
2. **Refresh Gmail** to see add-on in sidebar
3. **Test User tab**: Configure and apply personal signature
4. **Test Admin tab**: Preview and update test user

### Email Signature Testing

```javascript
// Run these in Apps Script editor
testSignatureGeneration()    // Test HTML output
testDivisionDetection()      // Test email-to-brand mapping
testFlagColors()             // Verify Zimbabwe flag CSS
testMySignature()            // Preview your own signature
runAllTests()                // Complete test suite
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Related Repositories

- [nyuchi-brand-assets](https://github.com/nyuchitech/nyuchi-brand-assets) - Brand system and design tokens
- [nyuchi-app-script](https://console.cloud.google.com/apis/credentials?project=nyuchi-app-script) - Google Cloud Project

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

**Nyuchi Web Services**
[services.nyuchi.com](https://services.nyuchi.com)

**Developer:** Bryan Fawcett ([@bryanfawcett](https://github.com/bryanfawcett))

## Support

- **Issues**: [GitHub Issues](https://github.com/nyuchitech/workspace-tools/issues)
- **Brand Guidelines**: [brand.nyuchi.com](https://brand.nyuchi.com)
- **Documentation**: [docs.nyuchi.com](https://docs.nyuchi.com)

---

<p align="center">
  <strong>Built with Ubuntu</strong> • Powered by Community
</p>
