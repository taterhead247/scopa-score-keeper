import { useEffect, useState } from 'react'

/**
 * React hook for the `prefers-reduced-motion: reduce` user preference.
 *
 * Returns `true` whenever the OS-level reduce-motion setting is on, and
 * subscribes to changes so toggling the setting at runtime updates the
 * UI without a reload. Used to skip animations that would otherwise
 * violate WCAG 2.3.3 (Animation from Interactions) for users with
 * vestibular sensitivities.
 *
 * Defaults to `false` during SSR / before the effect runs — components
 * should render the no-animation path *when this is true* and the
 * animated path otherwise.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return reduced
}
