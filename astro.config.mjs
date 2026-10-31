// @ts-check
import { defineConfig } from 'astro/config';

// On GitHub Pages the site lives under /<repo>/, so the deploy workflow sets
// SITE_URL and BASE_PATH. Locally both fall back to the root.
export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'always',
  prefetch: { prefetchAll: true },
  // Screenshots are pulled from the project repos and shrunk at build time.
  image: { domains: ['raw.githubusercontent.com'] },
  // three.js is one ~540 kB lazy chunk (≈130 kB gzipped), loaded after the page.
  vite: { build: { chunkSizeWarningLimit: 700 } },
});
