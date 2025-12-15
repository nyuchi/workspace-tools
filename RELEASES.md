# Release Notes

## v2.0.0 - Admin Dashboard Release

**Release Date:** December 15, 2025

### Overview

This major release transforms the Nyuchi Email Signature tool from a simple user-facing add-on into a comprehensive enterprise signature management platform. It introduces a dual User/Admin interface and a full-featured web dashboard for IT administrators.

---

### What's New

#### Tabbed Gmail Add-on Interface

The Gmail add-on now features two distinct tabs:

**User Tab**
Your familiar self-service signature generator with all existing features:
- Brand selection (9 Nyuchi brands)
- Personal information fields
- Social media links
- Promotional banner support

**Admin Tab**
New administrative controls for domain-wide management:
- View domain configuration
- Update individual user signatures
- List all users and aliases
- Bulk update all signatures
- Schedule automatic daily updates
- Access the full web dashboard

#### Full-Scale Web Dashboard

A comprehensive administrative dashboard accessible via:
- "Open Dashboard" button in Admin tab
- Universal action menu in Gmail
- Direct web app URL

**Dashboard Features:**

| Section | Capabilities |
|---------|--------------|
| **Overview** | Statistics, quick actions, activity log |
| **Users** | Search, preview, update individual users |
| **Signatures** | Live template preview by brand |
| **Brands** | Visual display of all 9 brands |
| **Settings** | Scheduling, banner configuration |

#### Nyuchi Design System

The dashboard implements the complete Nyuchi design system:
- **Colors**: Nyuchi purple (#5f5873) primary
- **Typography**: Plus Jakarta Sans, Noto Serif
- **Accents**: Zimbabwe flag horizontal strip
- **Components**: Cards, tables, modals, buttons
- **Responsive**: Works on desktop and tablet

---

### Screenshots

#### Tabbed Interface
```
┌─────────────────────────────────────────┐
│  Email Signature Manager                │
│  Nyuchi Africa Brands                   │
├─────────────────────────────────────────┤
│  [ User ]  [ Admin ]                    │
│  ─────────────────────                  │
│                                         │
│  Select Your Brand                      │
│  ┌─────────────────────────────────┐   │
│  │ Nyuchi Africa              ▼    │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Personal Information                   │
│  ...                                    │
└─────────────────────────────────────────┘
```

#### Web Dashboard
```
┌──────────┬──────────────────────────────────────────┐
│ Nyuchi   │  Email Signature Dashboard               │
│ Africa   │  Manage branded email signatures         │
│          ├──────────────────────────────────────────┤
│ Overview │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐        │
│ Users    │  │ 25  │ │ 25  │ │ 12  │ │ 9   │        │
│ Signatures│ │Users│ │Sigs │ │Alias│ │Brand│        │
│ Brands   │  └─────┘ └─────┘ └─────┘ └─────┘        │
│ Settings │                                          │
│          │  Quick Actions                           │
│          │  [Update All] [Refresh] [Settings]       │
│──────────│                                          │
│ Admin    │  Recent Activity                         │
│ admin@...│  ...                                     │
└──────────┴──────────────────────────────────────────┘
```

---

### Upgrade Instructions

#### For Existing Users

1. **Pull the latest code:**
   ```bash
   git pull origin main
   ```

2. **Push to Apps Script:**
   ```bash
   npm run push:gmail
   ```

3. **Re-authorize the add-on** in Gmail (new permissions required)

4. **Refresh Gmail** to see the updated add-on

#### For Administrators

Additional steps for Admin features:

1. **Enable Admin SDK** in Google Cloud Console

2. **Configure domain-wide delegation:**
   - Go to Google Admin Console > Security > API Controls
   - Add OAuth Client ID with scopes:
     - `admin.directory.user.readonly`
     - `gmail.settings.basic`
     - `gmail.settings.sharing`

3. **Deploy the web app:**
   - Apps Script Editor > Deploy > New Deployment
   - Type: Web app
   - Execute as: User accessing the web app
   - Access: Anyone within your domain

---

### Breaking Changes

| Change | Impact | Migration |
|--------|--------|-----------|
| Function rename | `generateSignatureHtml` → `generateUserSignatureHtml` | Update any custom scripts calling this function |
| New OAuth scopes | Additional permissions required | Users must re-authorize the add-on |

---

### Known Issues

1. **Dashboard loading**: First load may be slow while fetching user list
2. **Large domains**: Domains with 500+ users may experience timeouts
3. **Alias limits**: Maximum 50 aliases displayed per user in dashboard

---

### Coming Soon

- [ ] Signature analytics (views, clicks)
- [ ] Custom signature templates
- [ ] Approval workflow for signature changes
- [ ] Integration with Google Groups
- [ ] Audit log export

---

### Author

**Nyuchi Web Services** — [services.nyuchi.com](https://services.nyuchi.com)

### Developer

**Bryan Fawcett** — Lead Developer

---

### Support

- **Issues**: [GitHub Issues](https://github.com/nyuchitech/workspace-tools/issues)
- **Documentation**: [README](./README.md)
- **Security**: [SECURITY.md](./SECURITY.md)

---

## Previous Releases

### v1.0.0 - Initial Release (December 14, 2025)

First public release of Nyuchi Email Signature tools:
- Gmail Add-on for self-service signature generation
- Email Signature Generator for batch deployment
- Support for 9 Nyuchi brands
- Zimbabwe flag accent design
- Social media links support
- Promotional banner feature

---

<p align="center">
  <strong>Nyuchi Web Services</strong><br>
  A division of Nyuchi Africa<br>
  <em>I am because we are</em>
</p>
