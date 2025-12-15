# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

| Version | Date | Highlights |
|---------|------|------------|
| 2.0.0 | 2025-12-15 | Tabbed UI, Admin features, Web dashboard |
| 1.0.0 | 2025-12-14 | Initial release with Gmail add-on |

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

- [GitHub Repository](https://github.com/nyuchitech/workspace-tools)
- [Issue Tracker](https://github.com/nyuchitech/workspace-tools/issues)
- [Security Policy](./SECURITY.md)
