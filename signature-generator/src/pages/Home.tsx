import { Link } from 'react-router-dom'

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
      <div className="bg-gradient-to-br from-stone-100 to-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <img
                src="https://assets.nyuchi.com/logos/nyuchi/Nyuchi_Africa_Logo_dark.svg"
                alt="Nyuchi Africa"
                className="h-16 md:h-20"
              />
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-stone-900 mb-4" style={{ fontFamily: "'Noto Serif', Georgia, serif" }}>
              Workspace Tools
            </h1>
            <p className="text-lg md:text-xl text-stone-600 max-w-2xl mx-auto mb-8">
              Google Workspace email signature management for Nyuchi Africa and the Bundu Family ecosystem.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/signature-generator"
                className="px-6 py-3 bg-stone-900 text-white rounded-xl font-medium hover:bg-stone-800 transition-colors"
              >
                Generate Signature
              </Link>
              <Link
                to="/setup"
                className="px-6 py-3 bg-white text-stone-900 rounded-xl font-medium border border-stone-300 hover:bg-stone-50 transition-colors"
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
      <div className="bg-stone-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-stone-300 mb-8 max-w-xl mx-auto">
            Follow our setup guide to install the Gmail Add-on or start generating signatures now.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/setup"
              className="px-6 py-3 bg-white text-stone-900 rounded-xl font-medium hover:bg-stone-100 transition-colors"
            >
              View Setup Guide
            </Link>
            <a
              href="https://github.com/nyuchitech/workspace-tools"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-stone-800 text-white rounded-xl font-medium hover:bg-stone-700 transition-colors"
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
