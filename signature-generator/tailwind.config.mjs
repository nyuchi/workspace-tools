// Tailwind wiring for @bundu/ui (loaded via `@config` in src/styles/global.css).
// The preset maps the seven-mineral palette, semantic tokens, type scale,
// radius, and timing functions onto the CSS custom properties defined by
// @bundu/ui/styles/tokens.css — so utilities like `bg-gold-container`,
// `text-h2`, `ease-soft`, `rounded-pill` all resolve through CSS vars.
//
// `content` must list @bundu/ui's sources explicitly: its Astro/React
// components use utility classes (e.g. Hero's `text-display`, Button's CVA
// string), and node_modules is outside Tailwind's automatic source scan.
import preset from "@bundu/ui/tailwind-preset";

export default {
  presets: [preset],
  content: [
    "./src/**/*.{astro,html,js,jsx,md,mdx,ts,tsx}",
    "./node_modules/@bundu/ui/src/**/*.{astro,ts,tsx}",
  ],
};
