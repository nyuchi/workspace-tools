import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// Static Astro site (no SSR adapter), like apps/nyuchi in bundu-labs/marketing.
// The build output in dist/ is served as static assets by the nyuchi-tools
// Worker (root wrangler.toml) — at cut-over [assets].directory switches here.
export default defineConfig({
  site: 'https://tools.nyuchi.com',
  integrations: [react()],
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
    resolve: {
      alias: {
        // The shared engines/ at the repo root — one copy for the Worker,
        // this site and the legacy signature-generator pages.
        '@engines': fileURLToPath(new URL('../engines', import.meta.url)),
      },
    },
  },
})
