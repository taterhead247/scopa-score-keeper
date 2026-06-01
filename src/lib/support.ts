/**
 * Tip-jar / "Support development" link (#24).
 *
 * Single source of truth for the Ko-fi URL so every menu surface and
 * the AboutDialog point at the same handle. Update here if we ever
 * switch to a different platform (Buy Me a Coffee, Patreon, etc.) and
 * the change propagates to every entry point.
 */
export const SUPPORT_URL = 'https://ko-fi.com/devinciscopa'

/**
 * Open the support page in a new tab/window. `noopener,noreferrer`
 * prevents the destination page from controlling `window.opener` or
 * seeing our referrer — standard hardening for outbound links.
 *
 * On Capacitor Android this falls through to the system browser via
 * Chrome Custom Tabs (the default for `_blank` targets in the WebView).
 */
export function openSupportPage(): void {
  if (typeof window === 'undefined') return
  window.open(SUPPORT_URL, '_blank', 'noopener,noreferrer')
}
