import { useCallback, useEffect, useState } from 'react'

/**
 * Prefix applied to every onboarding-hint flag in localStorage. Centralized
 * here so future cleanup (e.g. nuking all onboarding flags via "Show tips
 * again") can sweep by prefix without listing each key.
 */
const PREFIX = 'scopa-onboarding-'

/**
 * Hook for a one-shot UI hint (#51). Tracks whether the user has dismissed
 * a specific tip; once dismissed, it never reappears on the same device.
 *
 * Returns `[seen, markSeen]`. Components should render the hint only when
 * `seen === false` and call `markSeen()` from the dismiss button (and from
 * any natural interaction that supersedes the hint, e.g. "user opened the
 * thing we were pointing at — they got it").
 *
 * State persists via localStorage. We deliberately do NOT use the SQLite
 * `app_settings` table for this: the flags are pure device-local UI
 * preference with no portability requirement, and avoiding the DB roundtrip
 * keeps the first-render path snappy.
 *
 * SSR-safe via the `typeof window` guard, so this hook can be imported into
 * server-rendered modules without crashing — defaults to `seen=false` until
 * the effect runs.
 */
export function useOnboardingFlag(key: string): [seen: boolean, markSeen: () => void] {
  const storageKey = PREFIX + key
  // Hydrate from localStorage on the first render to avoid a "tip flashes
  // then disappears" effect when the user has already dismissed it. SSR
  // returns the SSR-safe default (`false` = not seen).
  const [seen, setSeen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      return window.localStorage.getItem(storageKey) === '1'
    } catch {
      return false
    }
  })

  // Subscribe to cross-tab updates so dismissing a tip in one tab doesn't
  // leave it open in another. `storage` event only fires on OTHER tabs, so
  // this won't double-update the writing tab.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key === storageKey) setSeen(e.newValue === '1')
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [storageKey])

  const markSeen = useCallback(() => {
    setSeen(true)
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch {
      // Storage quota or private-mode — fail silently; the in-memory state
      // still suppresses the hint for this session.
    }
  }, [storageKey])

  return [seen, markSeen]
}

/**
 * Test/debug helper: clear every onboarding flag in localStorage. Not
 * called from production code today but exposed in case we add a "Reset
 * tips" link in a future Settings dialog.
 */
export function resetAllOnboardingFlags(): void {
  if (typeof window === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k)
    }
    for (const k of keys) window.localStorage.removeItem(k)
  } catch {
    // ignore
  }
}
