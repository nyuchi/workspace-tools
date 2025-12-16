import { useState } from 'react'

const Setup = () => {
  const [activeTab, setActiveTab] = useState<'clasp' | 'addon' | 'admin'>('clasp')

  const tabs = [
    { id: 'clasp', label: 'CLASP Setup' },
    { id: 'addon', label: 'Gmail Add-on' },
    { id: 'admin', label: 'Admin Features' },
  ] as const

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold text-stone-900 mb-3" style={{ fontFamily: "'Noto Serif', Georgia, serif" }}>
          Setup Guide
        </h1>
        <p className="text-lg text-stone-600 max-w-2xl mx-auto">
          Step-by-step instructions for installing and configuring Nyuchi Workspace Tools.
        </p>
      </div>

      {/* Prerequisites */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-8">
        <h2 className="text-lg font-semibold text-amber-900 mb-3">Prerequisites</h2>
        <ul className="space-y-2 text-amber-800">
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
            Node.js 18+ installed
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
            Google Account with Apps Script access
          </li>
          <li className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
            Google Workspace admin access (for Admin features)
          </li>
        </ul>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-stone-900 text-white'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-stone-200 p-6">
        {activeTab === 'clasp' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">1. Install Google CLASP CLI</h2>
              <p className="text-stone-600 mb-4">
                CLASP (Command Line Apps Script Projects) is Google's official tool for developing Apps Script projects locally.
              </p>
              <div className="bg-stone-900 rounded-xl p-4 font-mono text-sm text-stone-100 overflow-x-auto">
                <pre>{`# Install clasp globally
npm install -g @google/clasp

# Verify installation
clasp --version`}</pre>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">2. Enable Apps Script API</h2>
              <p className="text-stone-600 mb-4">
                Before using CLASP, you must enable the Apps Script API in your Google account:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-stone-600">
                <li>Go to <a href="https://script.google.com/home/usersettings" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">script.google.com/home/usersettings</a></li>
                <li>Toggle <strong>Google Apps Script API</strong> to <strong>ON</strong></li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">3. Login to CLASP</h2>
              <div className="bg-stone-900 rounded-xl p-4 font-mono text-sm text-stone-100 overflow-x-auto">
                <pre>{`# Login to your Google account
clasp login

# This opens a browser window for OAuth authorization
# Grant permissions and return to your terminal

# Verify login status
clasp login --status`}</pre>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">4. Clone the Repository</h2>
              <div className="bg-stone-900 rounded-xl p-4 font-mono text-sm text-stone-100 overflow-x-auto">
                <pre>{`git clone https://github.com/nyuchitech/workspace-tools.git
cd workspace-tools

# Install dependencies
npm install`}</pre>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">5. Create Apps Script Projects</h2>
              <div className="bg-stone-900 rounded-xl p-4 font-mono text-sm text-stone-100 overflow-x-auto">
                <pre>{`# For Gmail Add-on
cd gmail-addon
clasp create --title "Nyuchi Email Signature" --type standalone
clasp push

# For Email Signature Generator
cd ../email-signature
clasp create --title "Nyuchi Signature Generator" --type standalone
clasp push`}</pre>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'addon' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">1. Push Code to Apps Script</h2>
              <div className="bg-stone-900 rounded-xl p-4 font-mono text-sm text-stone-100 overflow-x-auto">
                <pre>{`cd gmail-addon
clasp push`}</pre>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">2. Test Deployment (Development)</h2>
              <ol className="list-decimal list-inside space-y-3 text-stone-600">
                <li>Open Apps Script editor:
                  <div className="bg-stone-900 rounded-xl p-3 font-mono text-sm text-stone-100 mt-2 ml-6">
                    <code>clasp open</code>
                  </div>
                </li>
                <li>Click <strong>Deploy</strong> &gt; <strong>Test deployments</strong></li>
                <li>Under <strong>Gmail Add-on</strong>, click <strong>Install</strong></li>
                <li>Open Gmail and refresh - the add-on appears in the right sidebar</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">3. Production Deployment</h2>
              <ol className="list-decimal list-inside space-y-2 text-stone-600">
                <li>In Apps Script editor, click <strong>Deploy</strong> &gt; <strong>New deployment</strong></li>
                <li>Click the gear icon, select <strong>Add-on</strong></li>
                <li>Fill in the deployment details (e.g., "Nyuchi Email Signature v1.0")</li>
                <li>Click <strong>Deploy</strong></li>
                <li>Copy the <strong>Deployment ID</strong></li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">4. Install for Google Workspace Domain</h2>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <p className="text-blue-800 font-medium">For Workspace Admins</p>
              </div>
              <ol className="list-decimal list-inside space-y-2 text-stone-600">
                <li>Go to <a href="https://admin.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Admin Console</a></li>
                <li>Navigate to <strong>Apps</strong> &gt; <strong>Google Workspace Marketplace apps</strong> &gt; <strong>Apps list</strong></li>
                <li>Click <strong>Add app</strong> &gt; <strong>Add internal app</strong></li>
                <li>Enter your <strong>Deployment ID</strong></li>
                <li>Configure installation settings (automatic or manual)</li>
                <li>Click <strong>Finish</strong></li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">5. Verify Installation</h2>
              <ol className="list-decimal list-inside space-y-2 text-stone-600">
                <li>Open Gmail in a browser (not mobile)</li>
                <li>Look for the Nyuchi bee icon in the right sidebar</li>
                <li>Click to open and test the User/Admin tabs</li>
              </ol>
            </section>
          </div>
        )}

        {activeTab === 'admin' && (
          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">Configure Google Cloud Project</h2>
              <p className="text-stone-600 mb-4">
                For Gmail Add-on Admin functionality, you need to configure a Google Cloud project:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-stone-600">
                <li>Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Cloud Console</a></li>
                <li>Create or select a project</li>
                <li>Enable these APIs:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li><strong>Gmail API</strong></li>
                    <li><strong>Admin SDK Directory API</strong></li>
                  </ul>
                </li>
                <li>Configure <strong>OAuth consent screen</strong></li>
                <li>Link to Apps Script (Project Settings &gt; GCP Project)</li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">Domain-Wide Delegation</h2>
              <p className="text-stone-600 mb-4">
                Required for setting signatures for other users in your domain:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-stone-600">
                <li>In Apps Script, go to <strong>Project Settings</strong></li>
                <li>Copy the <strong>Script ID</strong></li>
                <li>In <a href="https://admin.google.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Google Admin Console</a>:
                  <ul className="list-disc list-inside ml-6 mt-2 space-y-1">
                    <li>Go to <strong>Security &gt; API Controls &gt; Domain-wide Delegation</strong></li>
                    <li>Click <strong>Add new</strong></li>
                    <li>Paste the Client ID</li>
                    <li>Add the required scopes (see below)</li>
                  </ul>
                </li>
              </ol>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">Required OAuth Scopes</h2>
              <div className="bg-stone-900 rounded-xl p-4 font-mono text-sm text-stone-100 overflow-x-auto">
                <pre>{`https://www.googleapis.com/auth/admin.directory.user.readonly
https://www.googleapis.com/auth/gmail.settings.basic
https://www.googleapis.com/auth/gmail.settings.sharing`}</pre>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-bold text-stone-900 mb-4">Web Dashboard Deployment</h2>
              <ol className="list-decimal list-inside space-y-2 text-stone-600">
                <li>In Apps Script editor, click <strong>Deploy</strong> &gt; <strong>New deployment</strong></li>
                <li>Select type: <strong>Web app</strong></li>
                <li>Execute as: "User accessing the web app"</li>
                <li>Who has access: "Anyone within [your domain]"</li>
                <li>Click <strong>Deploy</strong> and copy the URL</li>
              </ol>
            </section>
          </div>
        )}
      </div>

      {/* CLI Commands Reference */}
      <div className="mt-8">
        <h2 className="text-xl font-bold text-stone-900 mb-4">CLI Commands Reference</h2>
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50">
              <tr className="border-b border-stone-200">
                <th className="text-left py-3 px-4 font-semibold text-stone-900">Command</th>
                <th className="text-left py-3 px-4 font-semibold text-stone-900">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              <tr>
                <td className="py-3 px-4 font-mono text-stone-700">npm run push:gmail</td>
                <td className="py-3 px-4 text-stone-600">Push Gmail Add-on to Apps Script</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-stone-700">npm run push:signature</td>
                <td className="py-3 px-4 text-stone-600">Push Email Signature Generator</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-stone-700">npm run push:all</td>
                <td className="py-3 px-4 text-stone-600">Push both projects</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-stone-700">npm run deploy:gmail</td>
                <td className="py-3 px-4 text-stone-600">Deploy Gmail Add-on</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-mono text-stone-700">npm run open:gmail</td>
                <td className="py-3 px-4 text-stone-600">Open Gmail Add-on in browser</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Help Section */}
      <div className="mt-8 bg-stone-50 rounded-2xl p-6 text-center">
        <h2 className="text-lg font-semibold text-stone-900 mb-2">Need Help?</h2>
        <p className="text-stone-600 mb-4">
          Check out the GitHub repository for more detailed documentation and to report issues.
        </p>
        <a
          href="https://github.com/nyuchitech/workspace-tools/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors"
        >
          Open an Issue
        </a>
      </div>
    </div>
  )
}

export default Setup
