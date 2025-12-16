import { Link } from 'react-router-dom'

// Bee icon SVG component - represents "nyuchi" (bee in Shona)
const BeeIcon = ({ className = "h-12 w-12" }: { className?: string }) => (
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

const Home = () => {
  const tools = [
    {
      name: 'Gmail Add-on',
      description: 'A powerful Gmail sidebar add-on with User and Admin tabs for managing email signatures across your organization.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
      href: '/gmail-addon',
      color: '#EA4335',
    },
    {
      name: 'Signature Generator',
      description: 'Interactive web tool for generating branded email signatures. Supports multiple Nyuchi brands with live preview.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      ),
      href: '/signature-generator',
      color: '#5D4037',
    },
    {
      name: 'Web Dashboard',
      description: 'Full-featured admin dashboard for enterprise signature management. Bulk deploy, preview templates, and manage users.',
      icon: (
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      ),
      href: '/gmail-addon#dashboard',
      color: '#4285F4',
    },
  ]

  const brands = [
    { name: 'Nyuchi Africa', domain: 'nyuchi.com', color: '#5D4037' },
    { name: 'Mukoko', domain: 'mukoko.com', color: '#4B0082' },
    { name: 'Zimbabwe Travel', domain: 'travel-info.co.zw', color: '#004D40' },
    { name: 'Nyuchi Learning', domain: 'learning.nyuchi.com', color: '#0047AB' },
    { name: 'Nyuchi Lingo', domain: 'lingo.nyuchi.com', color: '#7B341E' },
    { name: 'Tech Leaders', domain: 'techdirectors.africa', color: '#1A202C' },
  ]

  const features = [
    {
      title: 'Multi-Brand Support',
      description: '9 Nyuchi ecosystem brands with consistent branding and customizable templates.',
    },
    {
      title: 'Domain-Wide Deployment',
      description: 'Push signatures to all users in your Google Workspace domain with one click.',
    },
    {
      title: 'Self-Service Generation',
      description: 'Users can generate their own signatures with the interactive web tool.',
    },
    {
      title: 'Automatic Updates',
      description: 'Schedule daily signature updates to keep user information current.',
    },
  ]

  return (
    <div>
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-amber-50 via-stone-50 to-stone-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center">
            <div className="flex justify-center items-center gap-3 mb-6">
              <BeeIcon className="h-14 w-14 md:h-16 md:w-16" />
              <span
                className="text-4xl md:text-5xl font-bold tracking-tight"
                style={{ fontFamily: "'Noto Serif', Georgia, serif", color: '#5D4037' }}
              >
                nyuchi
              </span>
            </div>
            <h1 className="text-2xl md:text-4xl font-semibold text-stone-800 mb-4" style={{ fontFamily: "'Plus Jakarta Sans', Arial, sans-serif" }}>
              workspace tools
            </h1>
            <p className="text-lg md:text-xl text-stone-600 max-w-2xl mx-auto mb-8">
              Google Workspace email signature management for Nyuchi Africa and the Bundu Family ecosystem.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signature-generator"
                className="px-8 py-4 text-white rounded-xl font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-xl min-h-[56px] text-base md:text-lg"
                style={{ backgroundColor: '#5D4037' }}
              >
                Generate Signature
              </Link>
              <Link
                to="/setup"
                className="px-8 py-4 bg-white text-stone-800 rounded-xl font-semibold border-2 border-stone-200 hover:border-amber-300 hover:bg-amber-50 transition-all min-h-[56px] text-base md:text-lg"
              >
                Setup Guide
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tools Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-stone-900 mb-8 text-center">Available Tools</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <Link
              key={tool.name}
              to={tool.href}
              className="bg-white rounded-2xl border border-stone-200 p-6 hover:shadow-lg hover:border-stone-300 transition-all group"
            >
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 text-white group-hover:scale-110 transition-transform"
                style={{ backgroundColor: tool.color }}
              >
                {tool.icon}
              </div>
              <h3 className="text-lg font-semibold text-stone-900 mb-2">{tool.name}</h3>
              <p className="text-stone-600 text-sm">{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white border-y border-stone-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold text-stone-900 mb-8 text-center">Features</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <div key={feature.title} className="text-center">
                <h3 className="font-semibold text-stone-900 mb-2">{feature.title}</h3>
                <p className="text-stone-600 text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Supported Brands Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-stone-900 mb-8 text-center">Supported Brands</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {brands.map((brand) => (
            <div
              key={brand.name}
              className="bg-white rounded-xl border border-stone-200 p-4 text-center hover:shadow-md transition-shadow"
            >
              <div
                className="w-3 h-3 rounded-full mx-auto mb-3"
                style={{ backgroundColor: brand.color }}
              />
              <h3 className="font-medium text-stone-900 text-sm mb-1">{brand.name}</h3>
              <p className="text-stone-500 text-xs">{brand.domain}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-white" style={{ backgroundColor: '#5D4037' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-amber-100 mb-8 max-w-xl mx-auto">
            Follow our setup guide to install the Gmail Add-on or start generating signatures now.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/setup"
              className="px-8 py-4 bg-white text-stone-900 rounded-xl font-semibold hover:bg-amber-50 transition-colors min-h-[56px] text-base md:text-lg"
            >
              View Setup Guide
            </Link>
            <a
              href="https://github.com/nyuchitech/workspace-tools"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-colors min-h-[56px] text-base md:text-lg border-2 border-amber-200 text-amber-100 hover:bg-amber-900/20"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Home
