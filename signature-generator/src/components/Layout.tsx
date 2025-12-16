import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

const Layout = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()

  const navigation = [
    { name: 'Home', href: '/' },
    { name: 'Gmail Add-on', href: '/gmail-addon' },
    { name: 'Signature Generator', href: '/signature-generator' },
    { name: 'Setup Guide', href: '/setup' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/'
    return location.pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <img
                  src="https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Africa_Logo_icon.svg"
                  alt="Nyuchi"
                  className="h-8 w-8"
                />
                <span className="text-lg font-bold text-stone-800" style={{ fontFamily: "'Noto Serif', Georgia, serif" }}>
                  Workspace Tools
                </span>
              </Link>
            </div>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? 'bg-stone-100 text-stone-900'
                      : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <a
                href="https://github.com/nyuchitech/workspace-tools"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-4 px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 transition-colors"
              >
                GitHub
              </a>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-stone-600 hover:bg-stone-100"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2 rounded-lg text-sm font-medium ${
                    isActive(item.href)
                      ? 'bg-stone-100 text-stone-900'
                      : 'text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <a
                href="https://github.com/nyuchitech/workspace-tools"
                target="_blank"
                rel="noopener noreferrer"
                className="block px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 rounded-lg"
              >
                GitHub &rarr;
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-stone-600">
              <img
                src="https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Africa_Logo_icon.svg"
                alt="Nyuchi"
                className="h-6 w-6"
              />
              <span className="font-medium">Nyuchi Africa</span>
              <span className="mx-2">&bull;</span>
              <span className="italic text-stone-500">"Ndiri nekuti tiri" &mdash; I am because we are</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-stone-500">
              <a href="https://nyuchi.com" target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
                nyuchi.com
              </a>
              <a href="https://github.com/nyuchitech" target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
                GitHub
              </a>
              <a href="https://services.nyuchi.com" target="_blank" rel="noopener noreferrer" className="hover:text-stone-900">
                Web Services
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Layout
