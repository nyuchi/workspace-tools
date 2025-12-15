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

**Last Updated:** December 2025
**Version:** 2.0.0
