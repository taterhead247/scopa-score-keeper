import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from "react-error-boundary";
import { Toaster } from 'sonner'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'

import App from './App.tsx'
import { Button } from './components/ui/button'
import { ErrorFallback } from './ErrorFallback.tsx'
import { ensureAppInit } from './lib/db/connection'
import { SETTINGS_KEYS } from './lib/db/schema'
import { getSetting } from './lib/db/settings'
import { setHapticsEnabled } from './lib/haptics'
import { t } from './i18n'

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

/**
 * Hard ceiling on how long {@link ensureAppInit} can take before we give
 * up and show the recovery screen. Generous because first-install on slow
 * networks legitimately takes 5–10 s for the sql.js wasm fetch; anything
 * past 20 s almost certainly means a corrupt IndexedDB / stuck SW from
 * an old build and the user needs the "Reset app data" hatch.
 */
const INIT_TIMEOUT_MS = 20_000

/**
 * Detect best-effort language for the error screen before the persisted
 * setting has been (or can be) read. Only honors the two app languages.
 */
function inferLang(): string {
  if (typeof navigator === 'undefined') return 'en'
  return navigator.language?.startsWith('it') ? 'it' : 'en'
}

/**
 * Unblock a stuck install by nuking every storage surface this app uses
 * and reloading. Called from the error screen's "Reset app data" button.
 * Order matters: kill the service worker first so the next load doesn't
 * serve a stale shell, then wipe storage, then reload.
 *
 * Best-effort — each step is wrapped so a failure in one (e.g. Safari
 * lacking `indexedDB.databases()`) doesn't abort the whole reset.
 */
async function resetAppData(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
    if ('caches' in window) {
      const names = await caches.keys()
      await Promise.all(names.map(n => caches.delete(n)))
    }
  } catch { /* keep going */ }
  try { localStorage.clear() } catch { /* keep going */ }
  try {
    // databases() is Chrome/Edge/Android Chrome; Safari throws. Wrap each
    // delete in a promise so onsuccess/onerror/onblocked all resolve and
    // we don't hang.
    const dbs = 'databases' in indexedDB ? await indexedDB.databases() : []
    await Promise.all(dbs.map(d => new Promise<void>(resolve => {
      if (!d.name) return resolve()
      const req = indexedDB.deleteDatabase(d.name)
      req.onsuccess = req.onerror = req.onblocked = () => resolve()
    })))
    // Belt + suspenders for Safari and for the jeep-sqlite store, which
    // may not appear in databases() even on Chrome under some versions.
    ;['scopa', 'jeep-sqlite-store'].forEach(name => indexedDB.deleteDatabase(name))
  } catch { /* keep going */ }
  location.reload()
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
 * Root component. Renders {@link App} synchronously — the DB layer's
 * `ensureAppInit` gate is what every TanStack Query awaits internally,
 * so the setup screen paints at React mount time rather than after
 * SQLite init. That moves the simulated LCP off the sql.js bootstrap
 * dependency chain (#52 follow-up).
 *
 * Only switches away from `<App />` on an init failure — in which case
 * the queries are also rejecting, but the error screen replaces the UI
 * before users see flickering query errors.
 */
function Bootstrap() {
  const [error, setError] = useState<Error | null>(null)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    maybeWipeLegacyLocalStorage()
    /*
      Fire-and-forget orchestrator: init + migrations are gated inside
      ensureAppInit (which the db helpers await). The chained `then`s
      here cover the post-init bookkeeping the app needs *once* per
      session — haptics setting and screenshot seeding — that don't
      otherwise have a natural caller in React land.

      The Promise.race against a 20 s timeout exists specifically for
      the "stuck boot" case (corrupt IndexedDB from a pre-#23 build,
      service worker serving a stale shell, etc.). Without it, callers
      to ensureAppInit would hang forever and the user would never see
      the recovery screen — they did in practice, hence this hatch.
    */
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const initJob = ensureAppInit()
      .then(async () => {
        const raw = await getSetting(SETTINGS_KEYS.hapticsEnabled)
        setHapticsEnabled(raw === null ? true : raw === 'true')
      })
      .then(() => maybeSeedForScreenshots())
      .finally(() => { if (timeoutId !== undefined) clearTimeout(timeoutId) })

    const timeoutJob = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(t('error.dbLoadInitTimeout', inferLang()))),
        INIT_TIMEOUT_MS,
      )
    })

    Promise.race([initJob, timeoutJob]).catch(err => {
      setError(err instanceof Error ? err : new Error(String(err)))
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

  if (error) {
    // DB init failed, so the persisted language setting is unreachable —
    // fall back to navigator.language for the two supported locales.
    const lang = inferLang()
    const handleReset = async () => {
      if (!window.confirm(t('error.dbLoadResetConfirm', lang))) return
      setResetting(true)
      await resetAppData()
    }
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-bold text-destructive">{t('error.dbLoadTitle', lang)}</h1>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <p className="text-xs text-muted-foreground">{t('error.dbLoadRestart', lang)}</p>
          <Button
            onClick={handleReset}
            disabled={resetting}
            variant="destructive"
          >
            {resetting ? t('error.dbLoadResetting', lang) : t('error.dbLoadResetData', lang)}
          </Button>
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
