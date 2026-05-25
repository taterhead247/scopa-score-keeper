import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

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
  ],
  optimizeDeps: {
    /**
     * Vite's dependency pre-bundling rewrites jeep-sqlite's internal asset
     * URLs, which breaks its `sql-wasm.wasm` lookup. Excluding it keeps
     * the runtime asset resolution intact.
     */
    exclude: ['jeep-sqlite'],
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
});
