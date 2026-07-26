import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'

// Static Astro site (no SSR adapter). The build output in dist/ is served
// as static assets by the nyuchi-tools Worker (root wrangler.toml).
//
// NOTE: the React tool pages live under src/pages/{signature,studio}/
// as .tsx/.ts modules next to the .astro routes that mount them as islands.
// Astro only routes .astro/.md/.html files; the router warns about (and
// skips) other extensions, so those modules stay where the vitest suite
// imports them from (tests/signature-page.test.ts → src/pages/signature/helpers.ts).
export default defineConfig({
  site: 'https://tools.nyuchi.com',
  integrations: [react()],
  // The Banner tool was removed (the Studio replaces it); keep old links
  // working with a static meta-refresh redirect page.
  redirects: {
    '/banner': '/studio',
  },
  build: {
    // Emit /studio.html instead of /studio/index.html so the Worker's asset
    // handling serves the historical extension-less URLs (/studio, /help, …)
    // without introducing trailing-slash redirects.
    format: 'file',
  },
  vite: {
    plugins: [tailwindcss()],
  },
})
