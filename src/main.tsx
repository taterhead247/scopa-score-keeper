import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from 'sonner'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { initDatabase, runDataMigrations } from './lib/db'

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
      .then(() => maybeSeedForScreenshots())
      .then(() => setStatus('ready'))
      .catch(err => {
        setError(err instanceof Error ? err : new Error(String(err)))
        setStatus('error')
      })
  }, [])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        <span className="text-sm">Loading…</span>
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
    <Bootstrap />
   </ErrorBoundary>
)
