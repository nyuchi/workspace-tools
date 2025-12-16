import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'

// Bee icon SVG component - represents "nyuchi" (bee in Shona)
const BeeIcon = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Bee body */}
    <ellipse cx="12" cy="13" rx="6" ry="5" fill="#FFD740" />
    {/* Stripes */}
    <path d="M8 11.5h8M8 13.5h8M8 15.5h8" stroke="#5D4037" strokeWidth="1.5" strokeLinecap="round" />
    {/* Head */}
    <circle cx="12" cy="7" r="3" fill="#5D4037" />
    {/* Eyes */}
    <circle cx="10.5" cy="6.5" r="0.75" fill="#FFD740" />
    <circle cx="13.5" cy="6.5" r="0.75" fill="#FFD740" />
    {/* Antennae */}
    <path d="M10 4.5C9 3 8 2.5 7.5 2.5M14 4.5C15 3 16 2.5 16.5 2.5" stroke="#5D4037" strokeWidth="1" strokeLinecap="round" />
    {/* Wings */}
    <ellipse cx="7" cy="10" rx="3" ry="2" fill="#5D4037" fillOpacity="0.2" />
    <ellipse cx="17" cy="10" rx="3" ry="2" fill="#5D4037" fillOpacity="0.2" />
    {/* Stinger */}
    <path d="M12 18v2" stroke="#5D4037" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

// Wordmark component - lowercase "nyuchi"
const NyuchiWordmark = ({ className = "" }: { className?: string }) => (
  <span
    className={`font-bold tracking-tight ${className}`}
    style={{ fontFamily: "'Noto Serif', Georgia, serif", color: '#5D4037' }}
  >
    nyuchi
  </span>
)

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
    <div className="min-h-screen bg-stone-50 flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-stone-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-2">
                <BeeIcon className="h-8 w-8" />
                <div className="flex flex-col leading-none">
                  <NyuchiWordmark className="text-xl" />
                  <span className="text-xs text-stone-500 font-medium" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
                    workspace tools
                  </span>
                </div>
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
                      ? 'bg-amber-50 text-amber-900'
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
                className="ml-4 px-4 py-2 text-white rounded-lg text-sm font-medium hover:opacity-90 transition-colors"
                style={{ backgroundColor: '#5D4037' }}
              >
                GitHub
              </a>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-3 rounded-lg text-stone-600 hover:bg-stone-100 min-h-[48px] min-w-[48px] flex items-center justify-center"
                aria-label="Toggle menu"
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
            <div className="px-4 py-3 space-y-2">
              {navigation.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-lg text-base font-medium min-h-[48px] ${
                    isActive(item.href)
                      ? 'bg-amber-50 text-amber-900'
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
                className="block px-4 py-3 text-base font-medium text-white rounded-lg min-h-[48px] flex items-center"
                style={{ backgroundColor: '#5D4037' }}
              >
                GitHub &rarr;
              </a>
            </div>
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3 text-stone-600">
              <BeeIcon className="h-6 w-6" />
              <NyuchiWordmark className="text-lg" />
              <span className="hidden sm:inline mx-2 text-stone-300">|</span>
              <span className="hidden sm:inline italic text-stone-500 text-sm">"Ndiri nekuti tiri" — I am because we are</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-sm text-stone-500">
              <a href="https://nyuchi.com" target="_blank" rel="noopener noreferrer" className="hover:text-amber-700 transition-colors py-2 px-1">
                nyuchi.com
              </a>
              <a href="https://github.com/nyuchitech" target="_blank" rel="noopener noreferrer" className="hover:text-amber-700 transition-colors py-2 px-1">
                GitHub
              </a>
              <a href="https://services.nyuchi.com" target="_blank" rel="noopener noreferrer" className="hover:text-amber-700 transition-colors py-2 px-1">
                Web Services
              </a>
            </div>
          </div>
          {/* Mobile tagline */}
          <div className="sm:hidden mt-4 text-center">
            <span className="italic text-stone-500 text-sm">"Ndiri nekuti tiri" — I am because we are</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Layout
