import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useOnboardingFlag, resetAllOnboardingFlags } from '../hooks/use-onboarding'

beforeEach(() => {
  // Pristine localStorage between cases; the hook namespaces under
  // `scopa-onboarding-` so a global wipe is safe.
  window.localStorage.clear()
})

describe('useOnboardingFlag (#51)', () => {
  it('defaults to not-seen on first read', () => {
    const { result } = renderHook(() => useOnboardingFlag('first-bank-tip'))
    expect(result.current[0]).toBe(false)
  })

  it('flips to seen after markSeen() and persists to localStorage', () => {
    const { result } = renderHook(() => useOnboardingFlag('profiles-tip'))
    act(() => result.current[1]())
    expect(result.current[0]).toBe(true)
    expect(window.localStorage.getItem('scopa-onboarding-profiles-tip')).toBe('1')
  })

  it('reads back as seen on a fresh hook mount', () => {
    window.localStorage.setItem('scopa-onboarding-card-values-tip', '1')
    const { result } = renderHook(() => useOnboardingFlag('card-values-tip'))
    expect(result.current[0]).toBe(true)
  })

  it('namespaces keys so different tips do not collide', () => {
    const { result: a } = renderHook(() => useOnboardingFlag('a'))
    const { result: b } = renderHook(() => useOnboardingFlag('b'))
    act(() => a.current[1]())
    expect(a.current[0]).toBe(true)
    expect(b.current[0]).toBe(false)
  })
})

describe('resetAllOnboardingFlags', () => {
  it('removes only scopa-onboarding-* keys, leaving other keys intact', () => {
    window.localStorage.setItem('scopa-onboarding-profiles-tip', '1')
    window.localStorage.setItem('scopa-onboarding-first-bank-tip', '1')
    window.localStorage.setItem('unrelated-key', 'kept')

    resetAllOnboardingFlags()

    expect(window.localStorage.getItem('scopa-onboarding-profiles-tip')).toBeNull()
    expect(window.localStorage.getItem('scopa-onboarding-first-bank-tip')).toBeNull()
    expect(window.localStorage.getItem('unrelated-key')).toBe('kept')
  })
})
