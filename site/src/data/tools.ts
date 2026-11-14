/**
 * The tools-site nav and tool catalogue, data-driven like
 * apps/nyuchi's src/data/products.ts (the pattern this site follows).
 */

export interface NavItem {
  name: string
  href: string
}

export const NAV: NavItem[] = [
  { name: 'Home', href: '/' },
  { name: 'Signature', href: '/signature-generator' },
  { name: 'Studio', href: '/studio' },
  { name: 'Gmail Add-on', href: '/gmail-addon' },
  { name: 'Setup', href: '/setup' },
  { name: 'Help', href: '/help' },
]

export interface Tool {
  name: string
  description: string
  href: string
  /** Literal class strings (not composed) so Tailwind generates them. */
  tint: string
  icon: string
}

export const TOOLS: Tool[] = [
  {
    name: 'Signature Generator',
    description:
      'Interactive web tool for generating branded email signatures. Supports every ecosystem brand with live preview.',
    href: '/signature-generator',
    tint: 'bg-gold-container text-gold',
    icon: 'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
  },
  {
    name: 'Nyuchi Studio',
    description:
      'Generative social cards in the Bundu mineral design language. Seven mineral palettes, five formats, five layouts — export as SVG or PNG.',
    href: '/studio',
    tint: 'bg-tanzanite-container text-tanzanite',
    icon: 'M12 3l7 6-7 12L5 9l7-6z M5 9h14 M12 3l-3 6 3 12 3-12-3-6z',
  },
  {
    name: 'Gmail Add-on',
    description:
      'A Gmail sidebar add-on with User and Admin tabs for managing signatures across the organisation, plus the admin dashboard.',
    href: '/gmail-addon',
    tint: 'bg-terracotta-container text-terracotta',
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    name: 'Web Dashboard',
    description:
      'Full-featured admin dashboard for enterprise signature management. Bulk deploy, preview templates, and manage users.',
    // The #dashboard anchor is load-bearing (see gmail-addon.astro).
    href: '/gmail-addon#dashboard',
    tint: 'bg-cobalt-container text-cobalt',
    icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
  },
  {
    name: 'MCP Server',
    description:
      'Connect AI agents like Claude to these tools via the Model Context Protocol at tools.nyuchi.dev/mcp — generate signatures and design assets from a conversation.',
    href: '/help#mcp',
    tint: 'bg-sodalite-container text-sodalite',
    icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 5h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V7a2 2 0 012-2z M9.5 12l1.75 1.75L14.5 10.5',
  },
]
