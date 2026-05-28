import { useCallback, useEffect, useState } from 'react'

/**
 * The shape Chromium fires on `window.beforeinstallprompt`. Not part of
 * the standard `WindowEventMap` yet, so we narrow it here for type safety.
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

/**
 * State exposed by {@link useInstallPrompt} to the UI.
 *
 * - `canInstall`  — Chromium-family browsers only: the user is eligible
 *   and the browser has fired `beforeinstallprompt`. Render the install
 *   CTA, then call `promptInstall()` from its onClick.
 * - `promptInstall` — opens the native install dialog. Promise resolves
 *   once the user accepts or dismisses; `outcome` is forwarded so the
 *   caller can hide the CTA based on the response.
 * - `isInstalled` — best-effort check that the app is already installed
 *   (running in standalone display mode). True when iOS users have done
 *   "Add to Home Screen" too.
 * - `isIOS` — Safari on iPad/iPhone. Use to surface the manual
 *   Add-to-Home-Screen hint, since Safari doesn't fire
 *   `beforeinstallprompt`.
 */
export type InstallPromptState = {
  canInstall: boolean
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>
  isInstalled: boolean
  isIOS: boolean
}

/** Match Safari running on iPhone/iPad (the only browsers that don't fire `beforeinstallprompt`). */
function detectIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const isIPad = /iPad/.test(ua) ||
    // iPadOS 13+ reports as Mac with touch — sniff the platform too.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const isIPhone = /iPhone/.test(ua)
  // Exclude Chrome iOS — it reports CriOS in UA and uses native install UI.
  const isSafari = !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
  return (isIPad || isIPhone) && isSafari
}

/** Detect whether the app is currently running from an installed PWA shell. */
function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false
  // iOS Safari sets `navigator.standalone` when launched from the home screen.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  // Everywhere else: the standardized media query.
  const mqStandalone = window.matchMedia?.('(display-mode: standalone)').matches === true
  return iosStandalone || mqStandalone
}

/**
 * React hook for the web-install affordance (#48).
 *
 * Captures the deferred `beforeinstallprompt` event so we can show our
 * own install CTA at the right moment instead of relying on the
 * browser's mini-info bar (which is hidden on most installs of the
 * current Chromium UI anyway). On iOS Safari — where there's no
 * programmatic install — we expose `isIOS` so the caller can render a
 * manual "tap Share → Add to Home Screen" hint.
 */
export function useInstallPrompt(): InstallPromptState {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone())
  const [isIOS] = useState<boolean>(() => detectIOS())

  useEffect(() => {
    if (typeof window === 'undefined') return

    const onBeforeInstallPrompt = (e: Event) => {
      // Stop the mini-info bar from showing — we'll surface our own CTA.
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
    }
    const onAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)

    // Listen for display-mode changes too (e.g. user "Uninstall PWA" then
    // re-installs without a reload — uncommon but cheap to support).
    const mql = window.matchMedia?.('(display-mode: standalone)')
    const onMQ = () => setIsInstalled(detectStandalone())
    mql?.addEventListener?.('change', onMQ)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
      mql?.removeEventListener?.('change', onMQ)
    }
  }, [])

  const promptInstall = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable'
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    // Whatever the user picked, we can't show the same prompt twice — the
    // browser only fires `beforeinstallprompt` once per session.
    setDeferredPrompt(null)
    return outcome
  }, [deferredPrompt])

  return {
    canInstall: deferredPrompt !== null && !isInstalled,
    promptInstall,
    isInstalled,
    isIOS,
  }
}
