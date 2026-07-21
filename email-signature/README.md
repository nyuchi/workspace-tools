# Nyuchi Africa Email Signature Generator

Automatically generates and applies branded email signatures for all users **and their aliases** in your Google Workspace domain.

## Features

- Pulls user data (name, title, phone) from Google Workspace directory
- Fetches signature HTML from the `tools.nyuchi.com` render API (`POST /api/signature`), which renders through the one canonical engine — the script no longer carries its own template
- Applies signatures to primary emails AND all aliases
- Can run on a schedule to keep signatures updated

## Setup Instructions

### 1. Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **New Project**
3. Name it "Nyuchi Email Signatures"
4. Delete the default code and paste the contents of `Code.gs`
5. Click **Project Settings** (gear icon)
6. Check **Show "appsscript.json" manifest file**
7. Replace the manifest contents with the provided `appsscript.json`

### 2. Enable APIs

1. In Apps Script, click **Services** (+ icon on left sidebar)
2. Add **Admin SDK API** → Select **directory_v1** → Click Add
3. Add **Gmail API** → Click Add

### 3. Configure Domain-Wide Delegation

Required to set signatures for other users:

1. In Apps Script, go to **Project Settings**
2. Copy the **Script ID**
3. Go to [Google Cloud Console](https://console.cloud.google.com)
4. Create or select a project, then link it to your Apps Script
5. Enable **Admin SDK API** and **Gmail API**
6. Go to **IAM & Admin > Service Accounts**
7. Create a service account with domain-wide delegation enabled
8. Copy the **Client ID**
9. In [Google Admin Console](https://admin.google.com):
   - Go to **Security > API Controls > Domain-wide Delegation**
   - Click **Add new**
   - Paste the Client ID
   - Add these scopes:
     ```
     https://www.googleapis.com/auth/admin.directory.user.readonly
     https://www.googleapis.com/auth/gmail.settings.basic
     https://www.googleapis.com/auth/gmail.settings.sharing
     ```

### 4. Configure the Signature Render API

Signature HTML is fetched from the `nyuchi-tools` Worker, not generated
locally. Set these **Script Properties** (Project Settings > Script
Properties):

| Property | Required | Value |
|----------|----------|-------|
| `SIGNATURE_API_KEY` | yes | Bearer token for `POST /api/signature` |
| `SIGNATURE_API_URL` | no | Base URL; defaults to `https://tools.nyuchi.com` |

Without `SIGNATURE_API_KEY`, every signature function throws — there is
deliberately no local-template fallback.

The `CONFIG` object in `Code.js` now only holds the workspace domain, the
promotional banner passed to the API, and the email-domain → division/brand
mapping (each division carries the `brandSlug` sent to the API).

## Usage

### List All Users & Aliases (Dry Run)

```javascript
listAllUsersAndAliases()
```

Run this first to see all email addresses that will be updated.

### Test Your Signature

```javascript
testMySignature()
```

Preview your own signature and aliases in the logs.

### Update Single User

```javascript
updateSingleUserSignature('user@nyuchi.com')
```

Test on one user (and their aliases) before rolling out.

### Update All Users

```javascript
updateAllUserSignatures()
```

Applies signatures to everyone in the domain, including all aliases.

### Schedule Automatic Updates

```javascript
createDailyTrigger()
```

Run once to set up daily updates at 2 AM.

## How Aliases Work

The script:

1. Fetches all users from the domain
2. For each user, gets their primary email + all aliases
3. Generates a signature for each address (using the specific email in the signature)
4. Applies the signature to each send-as address

Example: If `jane@nyuchi.com` has aliases `support@nyuchi.com` and `info@nyuchi.com`, she'll get three signatures — each showing the correct email address but the same name/title/phone.

## User Data Sources

| Field | Source |
|-------|--------|
| Name | `user.name.fullName` |
| Title | `user.organizations[].title` |
| Phone | `user.phones[]` (prefers work/mobile) |
| Email | Primary email or alias |

**Important:** Populate user profiles in Google Admin with titles and phone numbers for complete signatures.

## Troubleshooting

### "Access denied" errors
- Verify domain-wide delegation is configured correctly
- Ensure OAuth scopes match exactly

### Aliases not updating
- Run `listAllUsersAndAliases()` to verify aliases are detected
- Check if aliases are configured as SendAs addresses in Gmail

### Missing titles/phones
- Update user profiles in Google Admin Console

## Customization

The signature markup lives in the canonical engine
(`signature-generator/src/engines/signature/index.ts`), served through the
`tools.nyuchi.com` Worker. To change the emitted signature, change the engine
— never re-add a local template here.

## License

MIT License - see [LICENSE](../LICENSE) for details.
