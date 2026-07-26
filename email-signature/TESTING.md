# Email Signature Testing Guide

This guide helps you test the Google Apps Script functions before deploying signatures to users.

## Setup

1. Open [script.google.com](https://script.google.com)
2. Create a new project called "Nyuchi Email Signatures"
3. Copy the contents of `Code.js` into the script editor
4. Copy the contents of `appsscript.json` to replace the manifest
5. Enable required APIs:
   - Admin SDK API (directory_v1)
   - Gmail API
6. Set Script Properties (Project Settings > Script Properties) — signature
   HTML now comes from the `tools.nyuchi.com` render API, not a local template:
   - `SIGNATURE_API_KEY` (required) — bearer token for `POST /api/signature`
   - `SIGNATURE_API_URL` (optional) — defaults to `https://tools.nyuchi.com`

## Quick Start: Run All Tests

### Master Test Runner (runAllTests)

**Purpose**: Execute all test functions in sequence and get a comprehensive report

**How to run**:
1. Open the Apps Script IDE: https://script.google.com/d/1fTujgXkM9sguM8gB0QgJdtbUJv5MbMsX2UrVSoLJV1anpm-bHS-bY-jv/edit
2. Select `runAllTests` from the function dropdown
3. Click the Run button (▶)
4. View the execution log

**What it tests**:
- ✅ Configuration display (CONFIG object)
- ✅ Division detection (email domain → API brand slug mapping)
- ✅ Signature generation with mock data (requires `SIGNATURE_API_KEY` — HTML is fetched from the render API)
- ✅ All users and aliases (requires Admin SDK)
- ✅ Your own signature (requires Admin SDK + `SIGNATURE_API_KEY`)

**Expected output**:
```
╔═══════════════════════════════════════════════════════════════════╗
║         NYUCHI EMAIL SIGNATURE - COMPREHENSIVE TEST SUITE         ║
╚═══════════════════════════════════════════════════════════════════╝

[Detailed test results for each function...]

TEST SUMMARY
======================================================================
✓ PASS: Configuration Display
✓ PASS: Division Detection
✓ PASS: Signature Generation (render API)
✓ PASS: All Users and Aliases (Admin SDK)
✓ PASS: My Own Signature (Admin SDK + render API)

Total Tests: 5
Passed: 5 (100%)
Failed: 0 (0%)

🎉 All tests passed! Email signature system is ready for deployment.
```

---

## Testing Functions (Safe to Run)

### Simple Functions (No Admin SDK Required)

These functions work without Admin SDK permissions and use mock data:

#### 0a. Show Configuration (showConfig)

**Purpose**: Display all configuration settings

**How to run**:
```javascript
showConfig()
```

**Expected output**:
```
========== NYUCHI EMAIL SIGNATURE CONFIGURATION ==========

Domain: nyuchi.com
Signature HTML: rendered by the tools.nyuchi.com API (SIGNATURE_API_KEY / SIGNATURE_API_URL in Script Properties)

Promotional Banner:
  Image URL: https://drive.google.com/...
  Link URL: https://www.nyuchi.com
  Alt Text: Ubuntu - I am because we are

Divisions (10 total):

  lingo.nyuchi.com:
    Name: Nyuchi Lingo
    Website: lingo.nyuchi.com
    API brand slug: nyuchi

  ...
```

#### 0b. Test Division Detection (testDivisionDetection)

**Purpose**: Verify email domain to division mapping

**How to run**:
```javascript
testDivisionDetection()
```

**Expected output**:
```
========== TESTING DIVISION DETECTION ==========

test@lingo.nyuchi.com
  → Division: Nyuchi Lingo
  → Website: lingo.nyuchi.com
  → API brand slug: nyuchi

test@mukoko.com
  → Division: Mukoko
  → Website: mukoko.com
  → API brand slug: mukoko

...
PASS: testDivisionDetection
```

#### 0c. Test Signature Generation (testSignatureGeneration)

**Purpose**: Fetch signatures from the render API with mock data and validate content

**Requires**: `SIGNATURE_API_KEY` in Script Properties (calls the live `tools.nyuchi.com` API)

**How to run**:
```javascript
testSignatureGeneration()
```

**Expected output**:
```
========== TESTING SIGNATURE GENERATION (render API) ==========

=== Signature for test@lingo.nyuchi.com ===

Division: Nyuchi Lingo (API brand slug: nyuchi)

First 500 characters of HTML:
<table cellpadding="0" cellspacing="0" style="font-family: 'Plus Jakarta Sans'...

Validation checks:
  ✓ User name
  ✓ Email address
  ✓ Phone number
  ✓ Promotional banner
PASS: testSignatureGeneration
```

---

### Functions Requiring Admin SDK Permissions

These require the Admin SDK API to be enabled and proper admin permissions:

### 1. Test Your Own Signature (testMySignature)

**Purpose**: Preview your signature and see how aliases are detected

**How to run**:
```javascript
testMySignature()
```

**Expected output**:
```
Your primary email: yourname@nyuchi.com
Your aliases: alias1@division.com, alias2@division.com

--- Primary Email Signature ---
<table cellpadding="0"...>
[Full HTML signature for your primary email]

--- First Alias Signature ---
<table cellpadding="0"...>
[Full HTML signature for your first alias]
```

**What to check**:
- ✅ Your email address is detected correctly
- ✅ All your aliases are listed
- ✅ The signature HTML comes back from the render API (canonical engine markup — brand name/tagline/website, no local template)
- ✅ All placeholders are replaced with your actual data

---

### 2. List All Users and Aliases (listAllUsersAndAliases)

**Purpose**: See all users in your domain and their aliases with detected divisions

**How to run**:
```javascript
listAllUsersAndAliases()
```

**Expected output**:
```
========== ALL USERS AND ALIASES ==========

John Doe (john@lingo.nyuchi.com) - Nyuchi Lingo
  └─ john@nyuchi.com - Nyuchi Africa
  └─ support@lingo.nyuchi.com - Nyuchi Lingo

Jane Smith (jane@mukoko.com) - Mukoko
  └─ jane@hararemetro.co.zw - Mukoko News

Bob Wilson (bob@nyuchi.com) - Nyuchi Africa
```

**What to check**:
- ✅ All users in your domain are listed
- ✅ Each user shows their primary email and division
- ✅ Aliases are indented and show their respective divisions
- ✅ Division detection is correct based on email domain
- ✅ Total count matches expected number of users

---

### 3. Preview a Specific User's Signature (previewSignature)

**Purpose**: Generate and preview the signature HTML for any email address

**How to run**:
```javascript
previewSignature('john@lingo.nyuchi.com')
```

**Expected output** (canonical engine markup from the render API):
```html
<table cellpadding="0" cellspacing="0" style="font-family: 'Plus Jakarta Sans', Arial, sans-serif; ...">
  [Name, title, brand name + tagline, email/phone/website links, promo banner]
</table>
```

**What to check**:
- ✅ User's name is populated correctly
- ✅ Job title is present (if user has one in Google Workspace)
- ✅ Phone number is formatted correctly
- ✅ Email address matches the input
- ✅ Brand name/website match the email domain's `brandSlug` mapping
- ✅ Promotional banner is included

---

### 4. Test Division Detection (getDivisionFromEmail)

**Purpose**: Verify that division mapping works correctly

**How to run**:
```javascript
// Test each division
const testEmails = [
  'test@lingo.nyuchi.com',
  'test@learning.nyuchi.com',
  'test@services.nyuchi.com',
  'test@travel-info.co.zw',
  'test@mukoko.com',
  'test@hararemetro.co.zw',
  'test@news.mukoko.com',
  'test@nyuchi.com'
];

testEmails.forEach(email => {
  const division = getDivisionFromEmail(email);
  Logger.log(`${email} → ${division.name} (${division.website})`);
});
```

**Expected output**:
```
test@lingo.nyuchi.com → Nyuchi Lingo (lingo.nyuchi.com)
test@learning.nyuchi.com → Nyuchi Learning (learning.nyuchi.com)
test@services.nyuchi.com → Nyuchi Development (services.nyuchi.com)
test@travel-info.co.zw → Zimbabwe Travel Information (travel-info.co.zw)
test@mukoko.com → Mukoko (mukoko.com)
test@hararemetro.co.zw → Mukoko News (hararemetro.co.zw)
test@news.mukoko.com → Mukoko News (news.mukoko.com)
test@nyuchi.com → Nyuchi Africa (nyuchi.com)
```

**What to check**:
- ✅ Each email domain maps to the correct division
- ✅ Division names are correct
- ✅ Website URLs match the division
- ✅ Unknown domains default to Nyuchi Africa

---

### 5. Test Single User Update (DRY RUN - updateSingleUserSignature)

**Purpose**: Test signature generation for one user without actually updating Gmail

**How to run**:
```javascript
// First, let's just preview without updating
const email = 'yourname@nyuchi.com';
const user = AdminDirectory.Users.get(email, { projection: 'full' });
const aliases = getUserAliases(user);

Logger.log(`User: ${user.name.fullName}`);
Logger.log(`Primary: ${user.primaryEmail}`);
Logger.log(`Aliases: ${aliases.join(', ')}`);
Logger.log('');

// Generate signatures for each address
[user.primaryEmail, ...aliases].forEach(address => {
  const division = getDivisionFromEmail(address);
  Logger.log(`\n=== ${address} (${division.name}) ===`);
  const signature = generateSignatureHtml(user, address);
  Logger.log(signature.substring(0, 200) + '...');  // First 200 chars
});
```

**What to check**:
- ✅ User object is retrieved correctly from Admin SDK
- ✅ Aliases are detected
- ✅ Each email address gets a signature with correct division
- ✅ Signature HTML is valid
- ✅ No errors in the logs

---

## Division Mapping Reference

`brandSlug` is what gets sent to the render API; divisions without their own
engine signature identity render under their parent brand.

| Email Domain | Division Name | API brand slug |
|--------------|---------------|----------------|
| `lingo.nyuchi.com` | Nyuchi Lingo | `nyuchi` |
| `learning.nyuchi.com` | Nyuchi Learning | `learning` |
| `services.nyuchi.com` | Nyuchi Development | `nyuchi` |
| `travel-info.co.zw` | Zimbabwe Travel Information | `travel` |
| `mukoko.com` | Mukoko | `mukoko` |
| `hararemetro.co.zw` | Mukoko News | `mukoko` |
| `news.mukoko.com` | Mukoko News | `mukoko` |
| `nyuchi.com` | Nyuchi Africa | `nyuchi` |
| `bundu.org` | Bundu Foundation | `bundu` |
| `shamwari.ai` | Shamwari AI | `shamwari` |

---

## Common Issues and Solutions

### Issue: "Delegation denied" or "Access restricted to service accounts"
**Error Message**:
```
API call to gmail.users.settings.sendAs.update failed with error:
Delegation denied for bryan@nyuchi.com
```
OR
```
Access restricted to service accounts that have been delegated domain-wide authority
```

**Solution**: Configure domain-wide delegation in Google Workspace Admin Console

**Quick Fix**: Run the helper function `showDelegationSetup()` in the Apps Script IDE to get step-by-step instructions with the exact OAuth scopes to use.

**Manual Steps**:
1. Get OAuth Client ID from: https://console.cloud.google.com/apis/credentials?project=nyuchi-app-script
2. Go to: https://admin.google.com → Security → Access and data control → API controls
3. Click "Manage Domain Wide Delegation" → "Add new"
4. Enter the Client ID and these scopes (comma-separated):
   ```
   https://www.googleapis.com/auth/admin.directory.user.readonly,https://www.googleapis.com/auth/gmail.settings.basic,https://www.googleapis.com/auth/gmail.settings.sharing
   ```
5. Click "Authorize"
6. Re-run the script

### Issue: "Exception: User not found"
**Solution**: Make sure you're using a valid email address from your domain

### Issue: "Exception: Access denied"
**Solution**: Verify domain-wide delegation is configured correctly (see above)

### Issue: "Division shows as Nyuchi Africa for all emails"
**Solution**: Check that the email domain exactly matches the CONFIG.divisions keys

### Issue: "SIGNATURE_API_KEY is not set in Script Properties"
**Solution**: Add `SIGNATURE_API_KEY` (and optionally `SIGNATURE_API_URL`) under Project Settings > Script Properties — signature HTML is fetched from the `tools.nyuchi.com` render API and there is no local fallback

### Issue: "Signature API request failed (HTTP 401/403)"
**Solution**: The bearer token is wrong or revoked — update `SIGNATURE_API_KEY`

### Issue: "Phone number is null"
**Solution**: Add phone numbers to user profiles in Google Admin Console

---

## Deployment Checklist

Before running `updateAllUserSignatures()`:

- [ ] Confirm `SIGNATURE_API_KEY` is set in Script Properties (and `SIGNATURE_API_URL` if not using the default)
- [ ] Test with `testMySignature()` - verify your own signature
- [ ] Test with `listAllUsersAndAliases()` - verify all users and divisions
- [ ] Test with `previewSignature()` for 2-3 users - check HTML output
- [ ] Verify promotional banner image loads
- [ ] Test on one user with `updateSingleUserSignature()` first
- [ ] Review the signature in Gmail to ensure proper rendering
- [ ] Only then run `updateAllUserSignatures()` for everyone

---

## Notes

- **Template ownership**: the emitted markup is byte-locked in the canonical engine (`signature-generator/src/engines/signature`), served via `POST https://tools.nyuchi.com/api/signature`. This script only maps directory data onto API params — to change the signature's look, change the engine.
- **Fail loud**: any API failure (missing key, non-200, bad JSON) throws; there is no local-template fallback.
- **Banner**: the `CONFIG.banner` image/link is passed to the API as `promoBanner`/`promoLink` for every signature.
