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
- ✅ Flag colors validation (Zimbabwe flag)
- ✅ Division detection (email domain mapping)
- ✅ Signature generation with mock data
- ✅ All users and aliases (requires Admin SDK)
- ✅ Your own signature (requires Admin SDK)

**Expected output**:
```
╔═══════════════════════════════════════════════════════════════════╗
║         NYUCHI EMAIL SIGNATURE - COMPREHENSIVE TEST SUITE         ║
╚═══════════════════════════════════════════════════════════════════╝

[Detailed test results for each function...]

TEST SUMMARY
======================================================================
✓ PASS: Configuration Display
✓ PASS: Flag Colors Validation
✓ PASS: Division Detection
✓ PASS: Signature Generation (Mock Data)
✓ PASS: All Users and Aliases (Admin SDK)
✓ PASS: My Own Signature (Admin SDK)

Total Tests: 6
Passed: 6 (100%)
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
Company: Nyuchi Africa
Tagline: I am because we are
Ubuntu Footer: 🇿🇼 Built with Ubuntu • Powered by Community

Promotional Banner:
  Image URL: https://drive.google.com/uc?export=view&id=...
  Link URL: https://nyuchi.com
  Alt Text: Nyuchi - I am because we are

Divisions (7 total):

  lingo.nyuchi.com:
    Name: Nyuchi Lingo
    Website: lingo.nyuchi.com
    Hide Attribution: false

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
  → Logo: https://raw.githubusercontent.com/nyuchi/nyuchi-brand-assets...
  → Hide Attribution: false

test@mukoko.com
  → Division: Mukoko
  → Website: mukoko.com
  → Logo: https://raw.githubusercontent.com/nyuchi/nyuchi-brand-assets...
  → Hide Attribution: false

...
```

#### 0c. Test Flag Colors (testFlagColors)

**Purpose**: Validate Zimbabwe flag configuration

**How to run**:
```javascript
testFlagColors()
```

**Expected output**:
```
========== TESTING ZIMBABWE FLAG COLORS ==========

Flag configuration (5 equal stripes at 20% each):
1. Green:  #729b63  (0-20%)
2. Yellow: #f6ad55 (20-40%)
3. Red:    #d4634a    (40-60%)
4. Black:  #171717  (60-80%)
5. White:  #ffffff  (80-100%)

Generated CSS gradient:
linear-gradient(to bottom, #729b63 0%, #729b63 20%, ...)

✓ Flag is always 4px vertical left edge
✓ No repeating colors
✓ Equal 20% distribution
```

#### 0d. Test Signature Generation (testSignatureGeneration)

**Purpose**: Generate signatures with mock data and validate content

**How to run**:
```javascript
testSignatureGeneration()
```

**Expected output**:
```
========== TESTING SIGNATURE GENERATION ==========

=== Signature for test@lingo.nyuchi.com ===

Division: Nyuchi Lingo
Logo: https://raw.githubusercontent.com/nyuchi/nyuchi-brand-assets/main/assets/logos/Nyuchi_Lingo_Logo_dark.png

First 500 characters of HTML:
<table cellpadding="0" cellspacing="0" border="0"...

Validation checks:
  ✓ Zimbabwe flag gradient
  ✓ Division logo
  ✓ User name
  ✓ Email address
  ✓ Phone number
  ✓ Ubuntu footer
  ✓ Promotional banner
  ✓ All text black
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
- ✅ The signature HTML includes the correct division logo
- ✅ Zimbabwe flag gradient is present (5 colors)
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

**Expected output**:
```html
<table cellpadding="0" cellspacing="0" border="0" style="font-family: 'Noto Sans'...">
  <tr>
    <td style="width: 4px; background: linear-gradient(to bottom, #729b63 0%..."></td>
    <td style="padding: 20px 0 20px 12px;">
      <div style="margin-bottom: 16px;">
        <img src="https://raw.githubusercontent.com/.../Nyuchi_Lingo_Logo_dark.png"...>
      </div>
      [Rest of signature HTML]
    </td>
  </tr>
</table>
```

**What to check**:
- ✅ Correct division logo URL for the email domain
- ✅ Zimbabwe flag gradient with 5 colors (green, yellow, red, black, white)
- ✅ User's name is populated correctly
- ✅ Job title is present (if user has one in Google Workspace)
- ✅ Phone number is formatted correctly
- ✅ Email address matches the input
- ✅ Division website is correct
- ✅ "A division of Nyuchi Africa" text (unless @nyuchi.com)
- ✅ Ubuntu footer is present
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

| Email Domain | Division Name | Logo File |
|--------------|---------------|-----------|
| `lingo.nyuchi.com` | Nyuchi Lingo | Nyuchi_Lingo_Logo_dark.png |
| `learning.nyuchi.com` | Nyuchi Learning | Nyuchi_Learning_Logo_dark.png |
| `services.nyuchi.com` | Nyuchi Development | Nyuchi_Development_Logo_dark.png |
| `travel-info.co.zw` | Zimbabwe Travel Information | Zimbabwe_Travel_Information_Logo_dark.png |
| `mukoko.com` | Mukoko | Mukoko_Logo_dark.png |
| `hararemetro.co.zw` | Mukoko News | Mukoko_News_Logo_dark.png |
| `news.mukoko.com` | Mukoko News | Mukoko_News_Logo_dark.png |
| `nyuchi.com` | Nyuchi Africa | Nyuchi_Africa_Logo_dark.png |

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

### Issue: "Logo images don't load"
**Solution**: Verify GitHub URLs are correct and logos exist in the repository

### Issue: "Phone number is null"
**Solution**: Add phone numbers to user profiles in Google Admin Console

---

## Deployment Checklist

Before running `updateAllUserSignatures()`:

- [ ] Test with `testMySignature()` - verify your own signature
- [ ] Test with `listAllUsersAndAliases()` - verify all users and divisions
- [ ] Test with `previewSignature()` for 2-3 users - check HTML output
- [ ] Verify all division logos load from GitHub URLs
- [ ] Verify promotional banner image loads from Google Drive
- [ ] Check Zimbabwe flag colors are correct (green, yellow, red, black, white)
- [ ] Confirm all text is black (#000000)
- [ ] Test on one user with `updateSingleUserSignature()` first
- [ ] Review the signature in Gmail to ensure proper rendering
- [ ] Only then run `updateAllUserSignatures()` for everyone

---

## Notes

- **Zimbabwe Flag Rule**: ALWAYS 4px vertical left edge (5 colors: green, yellow, red, black, white - 20% each)
- **Text Color**: All text must be black (#000000) for readability
- **Division Attribution**: Hidden for @nyuchi.com emails, shown for division emails
- **Logos**: All pulled from GitHub raw URLs (120px wide)
- **Banner**: Clickable promotional banner at bottom (max 550px wide)
