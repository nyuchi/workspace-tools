# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Mukoko Events in the brand list and the release pipeline**
  ([mukoko-dev/nhimbe#155](https://github.com/mukoko-dev/nhimbe/issues/155)).
  Owner decision, 2026-10-04: the nhimbe brand is retired, and the events
  platform is Mukoko Events at events.mukoko.com, in malachite.
  `brands.toml` gains the `mukokoEvents` division under Mukoko, with
  `events` and `nhimbe` as aliases. `nyuchi-imaging` gains a malachite
  `mukoko-events` theme. `releases/channels.toml` maps `mukokoEvents` to the
  Mukoko Blog, so an events release posts through the Mukoko channels.
- **Release marketing pipeline** (#83). `next/crates/release`
  (`nyuchi-release`) and `releases/`: a release that is live in production
  becomes a Sanity draft, one Postiz draft per channel and three images (OG,
  square, story), with a review comment on the tracking issue. Drafts only;
  checks for the live gate, privacy, British spelling and channel limits; a
  ledger keeps re-runs idempotent. The `market-release` skill runs it.
- **Bundu theme and official logos** in `nyuchi-imaging`: a `bundu` theme in
  copper and terracotta, signed with the published Bundu Foundation logo.

### Security

- **The site login reads its WorkOS client ID from configuration.** `/login`
  and `/callback` now use the `WORKOS_CLIENT_ID` Worker secret instead of a
  compiled-in client ID. With it unset, `/login` answers `503`
  "WORKOS_CLIENT_ID is not configured" and `/callback` denies without
  attempting a token exchange; there is no fallback client.
- **`/mcp` fails closed when `AUTHKIT_DOMAIN` is not configured.** It used to
  run without its bearer-token gate ("open mode"), so a missing secret served
  every tool unauthenticated. It now answers `503` "AUTHKIT_DOMAIN is not
  configured", as does the protected-resource metadata. Local development can
  still opt out explicitly with `ALLOW_UNAUTHENTICATED_DEV=true`, honoured only
  for requests to `localhost` and never set in a deployed environment.

### Changed

- **Shamwari AI is the intelligence pillar, not the community pillar**
  ([mzizi-dev/mzizi-registry#543](https://github.com/mzizi-dev/mzizi-registry/issues/543)).
  Aligns the brand registry with Mzizi, which is the rule for brand taxonomy:
  the `mzizi-design` skill names shamwari ai "the intelligence pillar", and
  its colour, sodalite, carries the role "Intelligence" (terracotta is
  "Community"). `PillarRole`'s `'community'` becomes `'intelligence'`, so
  `TOP_BRANDS.shamwari.pillar` and the `nyuchi://brands` MCP resource now
  report `intelligence`. The pillar set (nyuchi, mukoko, shamwari under the
  Bundu Foundation) and every pillar colour (bundu copper, nyuchi gold,
  mukoko tanzanite, shamwari sodalite) already matched `/v1/brand`. The
  signature engine and the Apps Script copies carry no pillar role, so emitted
  signature HTML is unchanged.
- **Dependencies are declared as minimums, and vite-plus is 1.3.0.** Owner
  direction, 2026-10-21. Every dependency, devDependency and override in the
  root `package.json` and in `signature-generator/package.json` is now written
  as `>=x.y.z` with no upper bound. Most `x.y.z` values are the version the
  lockfile already resolved; the security floors in the next entry are higher.
  One exception: owner decision 2026-10-24, typescript stays `~6.0.3` in
  `signature-generator`, so the site is held on TypeScript 6.0.x while the
  root is on TypeScript 7 (resolved 6.0.3). The deliberate tooling move is vite-plus, from `^1.0.0` (resolved 1.0.0) to
  `>=1.3.0` (resolved 1.3.0), which brings oxfmt 0.73.0, oxlint 1.88.0 and
  vitest 5.0.5 into the root tree. It is not the only resolved version that
  moved: in the root lock `@modelcontextprotocol/sdk` goes from 1.29.0 to
  1.32.1, `wrangler` from 4.147.0 to 4.152.0 (with miniflare
  5.20261019.2-beta) and `@cloudflare/workers-types` from 5.20261003.1 to
  5.20261023.1. `signature-generator/package-lock.json` changes too: the new
  overrides below move astro, `@astrojs/react` and vitest onto one vite 8.3.5
  (vite 7.3.6 and 8.1.3, and rollup 4.62.2 with them, are gone), with
  rolldown 1.2.15, postcss 8.5.31, nanoid 3.3.20, picomatch 4.0.7,
  source-map-js 1.2.2, http-cache-semantics 4.3.0 and a second lightningcss
  at 1.33.0; no direct dependency of the site changed its resolved version.
- **Security floors for the audit gate.** Root: `@modelcontextprotocol/sdk`
  `>=1.32.1` (resolved 1.32.1; 1.31.0 and older carry five high advisories),
  `wrangler` `>=4.149.0` (resolved 4.152.0, whose miniflare no longer pulls a
  vulnerable sharp), and new overrides `proxy-addr` `>=2.0.8`, `sharp`
  `>=0.35.5` and `vite@>=8.0.0 <8.3.5` `>=8.3.5` (resolved 8.3.5).
  `signature-generator`: new overrides `http-cache-semantics@<4.3.0`
  `>=4.3.0`, `source-map-js@<1.2.2` `>=1.2.2`, `vite@>=7.0.0 <7.3.7`
  `>=7.3.7` and `vite@>=8.0.0 <8.3.5` `>=8.3.5`, so astro, `@astrojs/react`
  and vitest all resolve vite 8.3.5. Every override is a minimum with no
  maximum. The root lockfile is regenerated with npm 10.9, the npm CI's Node
  22 ships, so `npm ci` there accepts it again (npm 11 had pruned the nested
  `@google/clasp/node_modules/typescript@5.9.3` that npm 10 requires); npm
  11.12.1's `npm ci` accepts it too. The Worker test for an unknown brand now
  asserts on the field name only, because SDK 1.32 words its validation error
  differently.
- **Floors for the advisories published on 2026-10-23.** The org audit blocks
  a high advisory whenever a fixed release exists. Root: `zod` `>=4.6.6`
  (GHSA-mrhx-c7xc-m3w5) as the direct dependency and as a nested override
  under `@google/clasp`, whose own range is `^3.25.76` and so has no fixed
  release on 3.x (clasp 3.3.0 still runs on zod 4: `clasp status` and the
  `clasp mcp` server's `tools/list` both work); `body-parser` `>=2.4.0`
  (GHSA-27r3-jxmh-p828, via the MCP SDK's express); and
  `undici@>=7.0.0 <7.30.1` `>=7.30.1` (GHSA-4qv8-2p9j-2685,
  GHSA-f72v-6w45-q472, GHSA-xjj6-f33q-929c, via miniflare, which pins
  7.29.1). The lockfile holds the patched 7.30.1, miniflare's own major; a
  resolve without the lockfile may pick undici 8.
  `signature-generator`: `undici@>=8.0.0 <8.12.3` `>=8.12.3` (via astro's
  unifont, which asks for `^8`) and `zod@<4.6.6` `>=4.6.6`. Resolved: zod
  4.6.7 in both trees, undici 7.30.1 in the root and 8.12.3 in the site, and
  body-parser 2.4.0 (with content-type 2.1.0, iconv-lite 0.7.3 and qs 6.16.1)
  in the root.
- **Dependabot waits seven days before proposing a new release.** Every
  `updates:` entry in `.github/dependabot.yml` now sets
  `cooldown: { default-days: 7 }`, the org rule, so a freshly published (and
  possibly malicious or broken) version is never proposed on day one.
- **Vite+ for the root checks and Worker tests** (tooling only). `vite-plus`
  1.0 replaces `vitest` as a root dev dependency, `vite.config.ts` carries the
  org format settings and turns on type-aware linting and type checking, and
  `npm run test:worker` runs `vp test`. The org-required `vite-plus / check`
  runs the transitional `ci:check` (`vp lint`) until the sources are
  formatted.

## [2.0.0] - 2025-12-15

### Added

#### Tabbed Interface

- **User Tab**: Self-service signature generation for individual users
- **Admin Tab**: Enterprise signature deployment for administrators
- Tab switching with visual indicators and persistent state

#### Full Web Dashboard

- Complete administrative dashboard (`Dashboard.html`)
- Sidebar navigation with 5 sections: Overview, Users, Signatures, Brands, Settings
- Statistics cards showing total users, signatures, aliases, brands
- Searchable user management table
- Live signature template preview by brand
- Visual brand configuration grid
- Settings for scheduled updates and promotional banners
- Activity logging with timestamps
- Modal confirmations for destructive actions
- Nyuchi design system with Zimbabwe flag accent

#### Admin Features

- List all domain users and their email aliases
- Preview signature for any user
- Update single user signature (including all aliases)
- Bulk update all domain signatures
- Enable/disable daily automatic updates (2 AM)
- Web app deployment (`doGet()` entry point)

#### Dashboard Server Functions

- `getCurrentUserInfo()` - Get logged-in user details
- `getDashboardData()` - Fetch all users and statistics
- `getSignaturePreview(brandKey)` - Preview template by brand
- `getUserSignaturePreview(email)` - Preview specific user's signature
- `updateSingleUserFromDashboard(email)` - Update one user
- `updateAllFromDashboard()` - Bulk deployment
- `createDailyTriggerFromDashboard()` - Enable scheduling
- `removeDailyTriggerFromDashboard()` - Disable scheduling

#### Universal Actions

- "Open Dashboard" action in Gmail add-on menu

#### OAuth & Permissions

- Added Admin SDK Directory API dependency
- Added `gmail.settings.sharing` scope for admin operations
- Added `admin.directory.user.readonly` scope
- Added `script.scriptapp` scope for triggers
- Web app configuration for domain access

### Changed

- Renamed `generateSignatureHtml()` to `generateUserSignatureHtml()` for clarity
- Updated `onHomepage()` to use tabbed interface
- Consolidated brand configurations from both projects
- Unified color system using `COLORS` constant
- Improved signature HTML structure for better email client compatibility

### Fixed

- Brand detection for all 10 supported email domains
- Phone number formatting for international numbers
- HTML escaping for user-provided content

## [1.0.0] - 2025-12-14

### Added

#### Gmail Add-on

- Initial Gmail add-on implementation
- Brand selection dropdown with 9 brands
- Personal information form (name, title, email, phone)
- Profile image URL support
- Social media links (LinkedIn, X, Facebook, Instagram, WhatsApp)
- Promotional banner with custom link
- Signature preview card
- One-click Gmail signature application
- Compose trigger for signature insertion
- Reset settings functionality
- Help link to brand guidelines

#### Email Signature Generator

- Standalone batch deployment script
- Domain-wide signature deployment
- Automatic brand detection by email domain
- User alias support
- Zimbabwe flag accent strip (4px vertical)
- Job title extraction from Google Directory
- Phone number extraction and formatting
- Promotional banner configuration
- Daily trigger for automatic updates
- Comprehensive test suite

#### Brand Support

- Nyuchi Africa (nyuchi.com)
- Nyuchi Lingo (lingo.nyuchi.com)
- Nyuchi Learning (learning.nyuchi.com)
- Nyuchi Development (services.nyuchi.com)
- Nyuchi Foundation (foundation.nyuchi.com)
- Mukoko (mukoko.com)
- Mukoko News (news.mukoko.com, hararemetro.co.zw)
- Zimbabwe Travel Information (travel-info.co.zw)
- Technology Leaders of Africa (techdirectors.africa)

#### Design System

- Nyuchi purple primary color (#5f5873)
- Plus Jakarta Sans typography
- Noto Serif for brand names
- Zimbabwe flag gradient (5 colors, 20% each)
- Consistent spacing and styling

#### Infrastructure

- npm workspace configuration
- clasp deployment scripts
- Apps Script manifests
- Project documentation

### Security

- OAuth scope minimization
- HTML input escaping
- User properties isolation

---

## Version History Summary

| Version | Date       | Highlights                               |
| ------- | ---------- | ---------------------------------------- |
| 2.0.0   | 2025-12-15 | Tabbed UI, Admin features, Web dashboard |
| 1.0.0   | 2025-12-14 | Initial release with Gmail add-on        |

## Upgrade Guide

### From 1.x to 2.x

1. **Pull latest code**:

   ```bash
   git pull origin main
   ```

2. **Push to Apps Script**:

   ```bash
   npm run push:gmail
   ```

3. **Re-authorize** the add-on (new scopes required):
   - Gmail settings sharing
   - Admin directory read
   - Script app triggers

4. **Configure domain-wide delegation** (for Admin features):
   - Add OAuth Client ID to Google Admin Console
   - Grant required scopes

5. **Deploy web app** (for Dashboard):
   - Deploy > New deployment > Web app
   - Set access to domain users

## Links

- [GitHub Repository](https://github.com/nyuchi/workspace-tools)
- [Issue Tracker](https://github.com/nyuchi/workspace-tools/issues)
- [Security Policy](./SECURITY.md)
