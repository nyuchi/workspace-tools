# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Three independent sub-projects for managing Nyuchi Africa email signatures. They share branding/design but **no code** — each maintains its own copy of the brand list.

| Directory | Stack | Purpose | Deploy target |
|-----------|-------|---------|---------------|
| `gmail-addon/` | Google Apps Script (V8) | Gmail Add-on (CardService UI) + admin web dashboard | Apps Script via clasp |
| `email-signature/` | Google Apps Script (V8) | Admin batch script: push signatures to all domain users & aliases | Apps Script via clasp |
| `signature-generator/` | React 19 + TypeScript + Vite | Standalone web app (signature builder + setup docs) | GitHub Pages (`tools.nyuchi.com`) |

The repo root is an npm workspace covering the two Apps Script projects; `signature-generator/` is a separate npm project with its own lockfile.

## Commands

### Apps Script projects (root)
Wrappers around [clasp](https://github.com/google/clasp). Requires `clasp login` first; `gmail-addon/.clasp.json` has an empty `scriptId` that must be filled before pushing.
```bash
npm run push:gmail        # clasp push gmail-addon
npm run push:signature    # clasp push email-signature
npm run push:all
npm run deploy:gmail      # clasp deploy
npm run open:gmail        # open in Apps Script editor
```

### React app (`signature-generator/`)
```bash
cd signature-generator
npm run dev      # vite dev server
npm run build    # tsc -b && vite build  (type-check is part of the build)
npm run lint     # eslint
npm run preview
```

### Tests
There is **no automated test runner**. The Apps Script "tests" are exported functions run manually from the Apps Script editor:
- `email-signature/Code.js`: `runAllTests()`, `testSignatureGeneration()`, `testDivisionDetection()`, `testFlagColors()`, `testMySignature()`, plus dry-run `listAllUsersAndAliases()` and `updateSingleUserSignature(email)` before a full `updateAllUserSignatures()`.
- `gmail-addon/Code.js`: `testSignatureGeneration()`, `testAdminSignature()`.

## Architecture notes

### Brand config is duplicated, not shared
Each project hardcodes its own brand/division list:
- `gmail-addon/Code.js` → `BRANDS` object (keyed by brand slug, e.g. `nyuchi`, `mukoko`).
- `email-signature/Code.js` → `CONFIG.divisions` (keyed by **email domain**, e.g. `lingo.nyuchi.com`).
- `signature-generator/src/components/EmailSignatureGenerator.tsx` → its own brand map.

A brand or social-link change must be applied in all three. The two Apps Script files also differ in shape (slug-keyed vs domain-keyed) and in logo URLs (`assets.nyuchi.com` CDN vs raw GitHub).

### Apps Script global functions are the API contract
In `gmail-addon/`, top-level function names are referenced by string elsewhere, so renaming one silently breaks it:
- `appsscript.json` triggers point to `onHomepage`, `onComposeInsert`, `openDashboard`, `resetSettings`.
- `Dashboard.html` calls server functions via `google.script.run` (e.g. `getDashboardData`, `getSignaturePreview`, `updateSingleUserFromDashboard`, `updateAllFromDashboard`).
- `doGet` serves `Dashboard.html` as a web app (`webapp.executeAs: USER_ACCESSING`, `access: DOMAIN`).

The add-on has two tabs built by `buildTabbedCard`: a **User tab** (self-service, only the user's own signature) and an **Admin tab** (domain-wide, requires Admin SDK access).

### Permission model
- `gmail-addon` User tab: per-user, `gmail.settings.basic`.
- `gmail-addon` Admin tab & `email-signature`: read the directory via `admin.directory.user.readonly` and write other users' send-as signatures via `gmail.settings.sharing`, which requires **domain-wide delegation** configured in the Google Admin Console (see `email-signature/README.md` and `TESTING.md`).
- `email-signature` also handles aliases: for each user it applies a signature to the primary address plus every send-as alias.

### HTML generation & XSS
All signature HTML is assembled from user input by hand. Both Apps Script files have an `escapeHtml()` helper; the React component additionally uses `@braintree/sanitize-url` plus `escapeHtml`/`createMailtoUrl`/`createTelUrl`/`createWhatsAppUrl` helpers. **Preserve this escaping when editing signature templates** — these strings end up as raw HTML in users' mailboxes.

### Shared design tokens (kept in sync manually)
Primary purple `#5f5873`; Zimbabwe-flag accent is a 4px vertical stripe of 5 equal bands (green `#729b63`, yellow `#f6ad55`, red `#d4634a`, black `#171717`, white `#ffffff`). Fonts: Plus Jakarta Sans (headings/body), Noto Serif (brand names).

## Deployment

- `signature-generator/` auto-deploys to GitHub Pages via `.github/workflows/deploy.yml` on push to `main`, but **only when files under `signature-generator/**` change**. Custom domain comes from `signature-generator/public/CNAME`.
- Apps Script projects are deployed manually with the clasp `deploy:*` scripts; there is no CI for them.
