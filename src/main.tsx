import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from 'sonner'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { initDatabase, runDataMigrations } from './lib/db'
import { SETTINGS_KEYS } from './lib/db/schema'
import { getSetting } from './lib/db/settings'
import { setHapticsEnabled } from './lib/haptics'

// Outfit @font-face declarations live in index.html so the woff2 fetches
// parallel-load with the initial HTML rather than waiting for the JS
// bundle (#52). The files are served from public/fonts/outfit/.

import "./main.css"
import "./styles/theme.css"
import "./index.css"

/** Sentinel flag indicating the localStorage→SQLite migration has run. */
const SQLITE_MIGRATED_FLAG = 'scopa-sqlite-migrated'

/**
 * Every `scopa-*` localStorage key produced by Phases 1–3. On first launch
 * with the SQLite build, all of these are dropped (per the wipe-and-start-
 * fresh decision in #23 Phase 4). Listed exhaustively rather than via a
 * key-prefix sweep so we don't accidentally clobber unrelated app storage.
 */
const LEGACY_LOCALSTORAGE_KEYS = [
  'scopa-games',
  'scopa-active-game-id',
  'scopa-completed-games',
  'scopa-language',
  'scopa-player-profiles',
  'scopa-favorite-groupings',
  'scopa-profiles-migrated',
  // Pre-profiles legacy keys (already wiped by an earlier migration, but
  // belt + suspenders in case anyone's localStorage still has them):
  'scopa-players',
  'scopa-hand-scopa',
  'scopa-hand-cards',
  'scopa-hand-coins',
  'scopa-hand-settebello',
  'scopa-hand-premiera',
  'scopa-hand-history',
  'scopa-player-count',
  'scopa-player-names',
  'scopa-premiera-open',
  'scopa-premiera-cards',
]

/**
 * One-time wipe of every legacy localStorage key when the SQLite build is
 * first launched. Gated by {@link SQLITE_MIGRATED_FLAG} so it runs at most
 * once. Per the Phase 4 scoping decision, we discard the prior localStorage
 * state rather than auto-migrating it into the new schema.
 */
function maybeWipeLegacyLocalStorage() {
  if (typeof window === 'undefined') return
  try {
    if (window.localStorage.getItem(SQLITE_MIGRATED_FLAG)) return
    for (const key of LEGACY_LOCALSTORAGE_KEYS) {
      window.localStorage.removeItem(key)
    }
    window.localStorage.setItem(SQLITE_MIGRATED_FLAG, '1')
  } catch {
    // ignore storage errors; app will boot regardless
  }
}

/** Single QueryClient for the app's lifetime. Created at module scope so HMR
 * doesn't lose the in-memory cache between reloads. */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // SQLite is local — there's no network latency to hide. Reads are cheap.
      // Refetch on focus is unhelpful for a card-game app the user is staring at.
      refetchOnWindowFocus: false,
      // Stale-time of 0 means every consumer gets fresh data when a mutation invalidates.
      staleTime: 0,
    },
  },
})

/**
 * Dev-only hook for the screenshot automation in `scripts/screenshots.mjs`.
 * When the URL contains `?seed=playwright` AND we're in a Vite dev build,
 * dynamically load the seed module and replace the DB contents with a
 * deterministic dataset before the app renders. Returns early — and never
 * imports the seed module — in production, so the seed code tree-shakes
 * out of `npm run build` entirely.
 */
async function maybeSeedForScreenshots(): Promise<void> {
  if (!import.meta.env.DEV) return
  if (typeof window === 'undefined') return
  const params = new URLSearchParams(window.location.search)
  if (params.get('seed') !== 'playwright') return
  const { seedForScreenshots } = await import('./lib/db/seedForScreenshots')
  const lang = params.get('lang') ?? 'en'
  await seedForScreenshots(lang)
}

/**
 * Root component that gates rendering on the async SQLite initialization.
 * Shows a minimal loading screen for the (typically <100ms) init time and
 * a friendly error message if the database fails to come up.
 */
function Bootstrap() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    maybeWipeLegacyLocalStorage()
    initDatabase()
      .then(() => runDataMigrations())
      .then(async () => {
        // Apply the persisted haptics preference before any UI renders so
        // the first click of the session sees the correct setting.
        const raw = await getSetting(SETTINGS_KEYS.hapticsEnabled)
        // Default to true — PRD calls out tactile as a baseline quality.
        setHapticsEnabled(raw === null ? true : raw === 'true')
      })
      .then(() => maybeSeedForScreenshots())
      .then(() => setStatus('ready'))
      .catch(err => {
        setError(err instanceof Error ? err : new Error(String(err)))
        setStatus('error')
      })

    // Register the Workbox service worker (#48). The plugin only emits a
    // real worker in production builds, so the dynamic import is gated on
    // `import.meta.env.PROD` to keep dev fast and avoid caching dev assets.
    // `registerType: 'autoUpdate'` in vite.config.ts handles the refresh —
    // we just need to fire-and-forget the registration here.
    if (import.meta.env.PROD && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      import('virtual:pwa-register')
        .then(({ registerSW }) => registerSW({ immediate: true }))
        .catch(() => {
          // Ignore: a missing service worker fails open. The app still works
          // online via the normal Vite build; offline support is the only
          // capability lost.
        })
    }
  }, [])

  if (status === 'loading') {
    /*
      Mirror the static loading shell that index.html paints synchronously
      (#52). Once React mounts it wipes #root, so without this duplicate
      the user would see a half-second flash between the static shell and
      whatever React renders next. Keeping the markup identical means the
      DOM swap is invisible.
    */
    return (
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.25rem',
        }}
      >
        <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Scopa Score" width="112" height="112">
          <rect width="1024" height="1024" rx="180" fill="#2563eb" />
          <rect x="222" y="162" width="560" height="780" rx="56" fill="#faf5eb" />
          <circle cx="502" cy="552" r="220" fill="#d4a017" />
          <circle cx="502" cy="552" r="195" fill="#f0c450" />
          <polygon fill="#5e3a13" transform="translate(502 552)" points="0,-180 29.8,-72.1 127.3,-127.3 72.1,-29.8 180,0 72.1,29.8 127.3,127.3 29.8,72.1 0,180 -29.8,72.1 -127.3,127.3 -72.1,29.8 -180,0 -72.1,-29.8 -127.3,-127.3 -29.8,-72.1" />
          <circle cx="502" cy="552" r="28" fill="#f0c450" />
          <circle cx="502" cy="552" r="18" fill="#e85d4a" />
        </svg>
        <h1 style={{ fontSize: '2.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1, margin: 0 }}>Scopa Score</h1>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-xl font-bold text-destructive">Failed to load database</h1>
          <p className="text-sm text-muted-foreground">{error?.message}</p>
          <p className="text-xs text-muted-foreground">Try restarting the app.</p>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster />
    </QueryClientProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    {/*
      next-themes (#50). `attribute="class"` adds `.dark` to <html> when the
      resolved theme is dark — Tailwind's `dark:` variant keys off that.
      `defaultTheme="system"` lets the OS preference decide on first launch;
      the user can pin Light or Dark via the in-app toggle.
      `disableTransitionOnChange` avoids the flash that otherwise happens
      because we have transitions on most colored surfaces.
    */}
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="scopa-theme"
    >
      <Bootstrap />
    </ThemeProvider>
   </ErrorBoundary>
)
