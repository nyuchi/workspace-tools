import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Static site, served as assets by the Rust Worker (next/crates/worker);
// the Worker answers /api/* itself. React is only for @bundu/ui's
// server-rendered components (Button inside Hero) — no client islands.
export default defineConfig({
  site: "https://tools.nyuchi.com",
  integrations: [react()],
  build: { format: "file" },
  vite: { plugins: [tailwindcss()] },
});
