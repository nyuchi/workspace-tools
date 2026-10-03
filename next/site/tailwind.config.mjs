// @bundu/ui (Mzizi) preset + its own sources in the content globs, as in
// the live site: its components use utility classes Tailwind must see.
import preset from "@bundu/ui/tailwind-preset";

export default {
  presets: [preset],
  content: [
    "./src/**/*.{astro,html,js,ts}",
    "./node_modules/@bundu/ui/src/**/*.{astro,ts,tsx}",
  ],
};
