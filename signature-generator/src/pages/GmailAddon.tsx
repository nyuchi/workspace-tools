import { Link } from 'react-router-dom'

const GmailAddon = () => {
  const userFeatures = [
    'Select from 9 Nyuchi ecosystem brands',
    'Personal information (name, title, email, phone)',
    'Profile image support',
    'Social media links (LinkedIn, X, Facebook, Instagram, WhatsApp)',
    'Promotional banner with custom links',
    'One-click Gmail signature application',
    'Compose trigger for signature insertion',
  ]

  const adminFeatures = [
    'Push signatures to all domain users',
    'Single user signature preview and update',
    'List all users and their email aliases',
    'Bulk signature deployment',
    'Scheduled daily automatic updates (2 AM)',
    'Full web dashboard access',
  ]

  const dashboardFeatures = [
    { name: 'Overview', description: 'Statistics, quick actions, activity logging' },
    { name: 'User Management', description: 'Searchable user table with preview/update actions' },
    { name: 'Signature Templates', description: 'Live preview by brand' },
    { name: 'Brand Configuration', description: 'Visual display of all 9 brands' },
    { name: 'Settings', description: 'Domain config, scheduling, banner management' },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-4">
          <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-stone-900 mb-3" style={{ fontFamily: "'Noto Serif', Georgia, serif" }}>
          Gmail Add-on
        </h1>
        <p className="text-lg text-stone-600 max-w-2xl mx-auto">
          A powerful Gmail sidebar add-on with User and Admin interfaces for managing email signatures across your organization.
        </p>
      </div>

      {/* Quick Install */}
      <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-6 mb-8 border border-red-100">
        <h2 className="text-lg font-semibold text-stone-900 mb-3">Quick Install</h2>
        <p className="text-stone-600 mb-4">
          The Gmail Add-on can be installed from your Google Workspace admin console or directly in Gmail.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/setup"
            className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Installation Guide
          </Link>
          <a
            href="https://github.com/nyuchitech/workspace-tools/tree/main/gmail-addon"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white text-stone-700 rounded-lg font-medium border border-stone-300 hover:bg-stone-50 transition-colors"
          >
            View Source
          </a>
        </div>
      </div>

      {/* Tabbed Interface */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        {/* User Tab */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-stone-900">User Tab</h3>
          </div>
          <p className="text-stone-600 text-sm mb-4">Self-service signature generation for individual users.</p>
          <ul className="space-y-2">
            {userFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        {/* Admin Tab */}
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-stone-900">Admin Tab</h3>
          </div>
          <p className="text-stone-600 text-sm mb-4">Enterprise signature deployment for Workspace admins.</p>
          <ul className="space-y-2">
            {adminFeatures.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                <svg className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Web Dashboard */}
      <div id="dashboard" className="mb-12">
        <h2 className="text-2xl font-bold text-stone-900 mb-6" style={{ fontFamily: "'Noto Serif', Georgia, serif" }}>
          Web Dashboard
        </h2>
        <p className="text-stone-600 mb-6">
          Full-scale administrative dashboard with Nyuchi branding for enterprise signature management.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardFeatures.map((feature) => (
            <div key={feature.name} className="bg-white rounded-xl border border-stone-200 p-4">
              <h4 className="font-semibold text-stone-900 mb-1">{feature.name}</h4>
              <p className="text-stone-500 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* OAuth Scopes */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-stone-900 mb-6" style={{ fontFamily: "'Noto Serif', Georgia, serif" }}>
          Required Permissions
        </h2>
        <div className="bg-stone-50 rounded-xl p-4 font-mono text-sm overflow-x-auto">
          <pre className="text-stone-700">{`{
  "oauthScopes": [
    "https://www.googleapis.com/auth/gmail.settings.basic",
    "https://www.googleapis.com/auth/gmail.settings.sharing",
    "https://www.googleapis.com/auth/admin.directory.user.readonly",
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/script.scriptapp",
    "https://www.googleapis.com/auth/userinfo.email"
  ]
}`}</pre>
        </div>
      </div>

      {/* API Reference */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-stone-900 mb-6" style={{ fontFamily: "'Noto Serif', Georgia, serif" }}>
          API Reference
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="text-left py-3 px-4 font-semibold text-stone-900">Function</th>
                <th className="text-left py-3 px-4 font-semibold text-stone-900">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr>
                <td className="py-3 px-4 font-mono text-stone-700">onHomepage(e)</td>
                <td className="py-3 px-4 text-stone-600">Gmail add-on entry point</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-stone-700">buildTabbedCard(tab)</td>
                <td className="py-3 px-4 text-stone-600">Render User/Admin tabs</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-stone-700">generateUserSignatureHtml(settings)</td>
                <td className="py-3 px-4 text-stone-600">User self-service signature</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-stone-700">getAllDomainUsers()</td>
                <td className="py-3 px-4 text-stone-600">Fetch all domain users</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-stone-700">updateAllFromDashboard()</td>
                <td className="py-3 px-4 text-stone-600">Bulk signature deployment</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-stone-900 text-white rounded-2xl p-8 text-center">
        <h2 className="text-xl font-bold mb-3">Ready to Install?</h2>
        <p className="text-stone-300 mb-6">
          Follow our step-by-step guide to deploy the Gmail Add-on to your organization.
        </p>
        <Link
          to="/setup"
          className="inline-block px-6 py-3 bg-white text-stone-900 rounded-xl font-medium hover:bg-stone-100 transition-colors"
        >
          View Setup Guide
        </Link>
      </div>
    </div>
  )
}

export default GmailAddon
