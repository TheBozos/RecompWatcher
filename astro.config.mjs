// @ts-check
import { defineConfig } from 'astro/config';
import { AstroPWAIntegration } from '@vite-pwa/astro';

// On GitHub Pages the site lives under /<repo>/, so the deploy workflow sets
// SITE_URL and BASE_PATH. Locally both fall back to the root.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: process.env.SITE_URL ?? 'http://localhost:4321',
  base,
  trailingSlash: 'always',
  prefetch: { prefetchAll: true },
  // Screenshots are pulled from the project repos and shrunk at build time.
  image: { domains: ['raw.githubusercontent.com', 'avatars.githubusercontent.com'] },
  // three.js is one ~540 kB lazy chunk (≈130 kB gzipped), loaded after the page.
  vite: { build: { chunkSizeWarningLimit: 700 } },
  integrations: [
    // Installable app: manifest and icons (generated from public/icon.svg) and
    // a service worker. Pages are fetched fresh and fall back to the last copy
    // offline; code, styles and fonts are precached; images are cached as seen.
    AstroPWAIntegration({
      base,
      scope: base,
      registerType: 'autoUpdate',
      injectRegister: false,
      pwaAssets: { image: 'public/icon.svg', preset: 'minimal-2023', overrideManifestIcons: true },
      manifest: {
        name: 'Recomp Watcher',
        short_name: 'Recomp',
        description: 'PlayStation 2 games, recompiled into native PC programs.',
        lang: 'en',
        theme_color: '#01030a',
        background_color: '#01030a',
        display: 'standalone',
        start_url: base,
        scope: base,
      },
      generateSW: {
        globPatterns: ['**/*.{js,css,woff2,svg}'],
        globIgnores: ['og/**'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 5, expiration: { maxEntries: 80 } },
          },
          {
            urlPattern: ({ request, url }) => request.destination === 'image' && url.origin === self.location.origin,
            handler: 'CacheFirst',
            options: { cacheName: 'images', expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 3600 } },
          },
          {
            urlPattern: ({ url }) => url.hostname === 'raw.githubusercontent.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'screenshots', expiration: { maxEntries: 120, maxAgeSeconds: 7 * 24 * 3600 } },
          },
        ],
      },
    }),
  ],
});
