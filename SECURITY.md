# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 2.x.x   | :white_check_mark: |
| 1.x.x   | :x:                |

## Security Considerations

### OAuth Scopes

This application requires sensitive OAuth scopes to function. These scopes are minimized to only what is necessary:

| Scope | Purpose | Required For |
|-------|---------|--------------|
| `gmail.settings.basic` | Modify user's own Gmail signature | User Tab |
| `gmail.settings.sharing` | Modify other users' signatures | Admin Tab |
| `admin.directory.user.readonly` | Read user directory information | Admin Tab |
| `script.external_request` | Fetch external resources (logos) | All |
| `script.scriptapp` | Create scheduled triggers | Admin Tab |
| `userinfo.email` | Get current user's email | All |

### Data Handling

**Data Accessed:**
- User names, email addresses, and phone numbers from Google Workspace Directory
- Gmail signature settings

**Data Stored:**
- User preferences stored in Google Apps Script Properties Service (per-user)
- No data is stored externally or transmitted to third parties

**Data Not Collected:**
- Email content
- Passwords or authentication tokens
- Personal files or documents

### Domain-Wide Delegation

Admin features require domain-wide delegation. This grants the script the ability to:
- Read user directory information for all domain users
- Modify Gmail signatures for all domain users

**Important:** Only grant these permissions to trusted administrators.

### Best Practices

1. **Limit Admin Access**: Only grant Admin tab access to IT administrators
2. **Review Deployments**: Audit who has access to the deployed add-on
3. **Monitor Activity**: Check Apps Script execution logs regularly
4. **Update Regularly**: Keep the add-on updated with latest security patches

## The `nyuchi-tools` Worker & MCP server

The web/MCP surface (`tools.nyuchi.com` / `tools.nyuchi.dev`, source in `mcp/src/`) has its own security model, separate from the Apps Script projects above:

### Authentication

- **Site pages** sit behind a site-wide login gate: Authorization Code + PKCE against WorkOS AuthKit (`identity.nyuchi.com`), session held in an HMAC-signed cookie. The gate **fails closed** — a missing `SESSION_SECRET` means "no valid session", never "run open".
- **`/mcp`** requires WorkOS-issued bearer JWTs (OAuth 2.1, dynamic client registration) whenever `AUTHKIT_DOMAIN` is set. Audience is pinned to the registered resource (`MCP_RESOURCE`).

### Secrets

Provisioned only via `wrangler secret put`, never committed: `SESSION_SECRET` (login gate), `CF_IMAGES_TOKEN`/`CF_IMAGE_TOKEN` (Cloudflare Images upload), `GITHUB_FEEDBACK_TOKEN` (issue filing). Every dependent feature fails closed with a clear error when its secret is absent.

### Input handling

- All signature/card text is escaped before entering HTML/SVG (`escapeHtml`/`esc`); color params are validated against a hex allowlist before being interpolated into SVG attributes.
- Upload guardrails: image content types only, PNG signature check on caller-supplied bytes, 10 MB cap, upload keys sanitized (`[A-Za-z0-9/_.-]`, no `..`, no leading `/`).
- `report_issue` targets a **server-side configured** repo only — callers cannot direct issues elsewhere.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

### Contact

- **Email**: security@nyuchi.com
- **Subject**: `[SECURITY] workspace-tools vulnerability`

### What to Include

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Potential impact** assessment
4. **Suggested fix** (if any)

### Response Timeline

| Stage | Timeline |
|-------|----------|
| Initial Response | Within 48 hours |
| Vulnerability Assessment | Within 7 days |
| Fix Development | Within 30 days |
| Patch Release | Within 45 days |

### Responsible Disclosure

- Please allow us time to address the issue before public disclosure
- We will credit researchers who report valid vulnerabilities (unless anonymity is requested)
- We do not pursue legal action against researchers acting in good faith

## Security Updates

Security updates are released as patch versions (e.g., 2.0.1). To receive updates:

1. **Watch** this repository for release notifications
2. **Pull** the latest changes regularly
3. **Deploy** updates via `npm run push:all`

## Audit Log

The application logs the following actions (viewable in Apps Script execution logs):

- Signature updates (success/failure)
- Bulk deployment operations
- Trigger creation/removal
- Authentication errors

## Third-Party Dependencies

| Dependency | Purpose | Security Notes |
|------------|---------|----------------|
| Google Apps Script | Runtime environment | Managed by Google |
| Gmail API | Signature management | OAuth 2.0 secured |
| Admin SDK | Directory access | OAuth 2.0 secured |
| Flaticon CDN | Social media icons | Public CDN |
| Nyuchi Assets CDN | Brand logos | Nyuchi-managed |

## Compliance

This application is designed to support compliance with:

- **GDPR**: User data is accessed only when necessary and not stored externally
- **Google Workspace Terms**: Follows Google's API usage policies
- **Corporate Security**: Supports domain-wide deployment controls

## Security Checklist for Deployment

Before deploying to production:

- [ ] Review OAuth scopes are appropriate for your use case
- [ ] Configure domain-wide delegation only for necessary scopes
- [ ] Set web app access to "Anyone within [your domain]" (not public)
- [ ] Test with a single user before bulk deployment
- [ ] Document who has admin access
- [ ] Set up monitoring for Apps Script execution logs

---

**Author:** Nyuchi Web Services
**Developer:** Bryan Fawcett
**Last Updated:** December 2025
**Version:** 2.0.0
