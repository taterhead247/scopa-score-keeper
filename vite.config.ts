import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { VitePWA } from "vite-plugin-pwa";

import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    /**
     * jeep-sqlite (the web fallback used by `@capacitor-community/sqlite`)
     * runs sql.js in the browser, which fetches `sql-wasm.wasm` at runtime
     * from a path relative to where the JS is served. Copy the wasm into
     * the output's `assets/` directory so dev + production builds both
     * find it. Without this, the dev server returns the SPA's HTML 404
     * for the wasm request, the browser refuses the bad MIME type, and
     * the app hangs forever on the Loading… state.
     */
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/sql.js/dist/sql-wasm.wasm',
          dest: 'assets',
          // v4 of the plugin preserves the source directory structure
          // under `dest` by default. `stripBase: true` strips every
          // intermediate directory so the file lands at
          // `dist/assets/sql-wasm.wasm` instead of
          // `dist/assets/node_modules/sql.js/dist/sql-wasm.wasm`,
          // which is where the runtime fetcher looks.
          rename: { stripBase: true },
        },
      ],
    }),
    /**
     * PWA support (#48). Generates a Workbox service worker that pre-caches
     * the app shell and lets the app boot offline once installed. We pass
     * `manifest: false` because the project ships a hand-crafted
     * `public/manifest.webmanifest` (added in #53 alongside the icon
     * pipeline); regenerating it here would clobber the careful brand
     * defaults (background color, maskable icon, lang hint).
     *
     * `registerType: 'autoUpdate'` skips the user "Update available" prompt
     * — for a small offline-first app, silently refreshing on next launch
     * is the right call. Users with the app open get the fresh build at
     * the next reload.
     */
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false, // we register manually in src/main.tsx
      manifest: false,
      includeAssets: [
        'favicon-16.png',
        'favicon-32.png',
        'favicon-48.png',
        'apple-touch-icon.png',
        'pwa-192.png',
        'pwa-512.png',
        'manifest.webmanifest',
      ],
      workbox: {
        // Precache everything Vite emits + the static icons above.
        globPatterns: ['**/*.{js,css,html,png,svg,wasm,webmanifest}'],
        // SQLite WASM is loaded lazily from /assets/sql-wasm.wasm; cap
        // chunk size so it's allowed through the precache filter.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Google Fonts are CDN-served — runtime cache them so an offline
        // launch doesn't show fallback text.
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\//,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 365,
                maxEntries: 32,
              },
            },
          },
        ],
        navigateFallback: 'index.html',
      },
      devOptions: {
        // Off in dev: HMR-incompatible and the service worker caches
        // dev bundles in confusing ways. Production build + preview is
        // the right surface for PWA testing.
        enabled: false,
      },
    }),
  ],
  optimizeDeps: {
    /**
     * Vite's dependency pre-bundling rewrites jeep-sqlite's internal asset
     * URLs, which breaks its `sql-wasm.wasm` lookup. Excluding it keeps
     * the runtime asset resolution intact.
     */
    exclude: ['jeep-sqlite'],
  },
  /**
   * Manual vendor chunking (#52). Issue's baseline build emitted a single
   * 940 KB main chunk that tripped Vite's >500 KB warning. Splitting node_modules
   * by library family gives the browser parallel HTTP/2 fetches and lets the
   * cache survive small app-code changes (only the app chunk re-hashes).
   *
   * The split is deliberately coarse — one chunk per "weight class" — because
   * over-splitting hurts more than it helps once each chunk drops under ~200 KB:
   * extra requests + waterfall on slow 3G.
   */
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/scheduler/')) {
            return 'react-vendor'
          }
          if (id.includes('@radix-ui/')) return 'radix-vendor'
          if (id.includes('/recharts/') || id.includes('/d3-') || id.includes('victory-vendor')) {
            return 'chart-vendor'
          }
          if (id.includes('framer-motion') || id.includes('/motion-')) return 'motion-vendor'
          if (id.includes('@tanstack/')) return 'query-vendor'
          if (id.includes('@phosphor-icons') || id.includes('@heroicons') || id.includes('lucide-react')) {
            return 'icon-vendor'
          }
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
});
