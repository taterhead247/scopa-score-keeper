import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useInstallPrompt } from '../hooks/use-install-prompt'

/**
 * Minimal stub of the Chromium `BeforeInstallPromptEvent`. Carries the
 * `prompt()` + `userChoice` surface the hook touches; nothing else is
 * exposed because the rest of the event interface doesn't matter for the
 * hook's behavior.
 */
function makeBeforeInstallPromptEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const userChoice = Promise.resolve({ outcome, platform: 'web' })
  return Object.assign(new Event('beforeinstallprompt'), {
    platforms: ['web'],
    userChoice,
    prompt: vi.fn(() => Promise.resolve()),
  })
}

/**
 * Stash + restore navigator properties so per-test UA / platform overrides
 * don't leak between cases. JSDOM's navigator is configurable but the
 * stored values stick across `renderHook` calls otherwise.
 */
function stubNavigator(overrides: Partial<Navigator>): () => void {
  const saved: Record<string, PropertyDescriptor | undefined> = {}
  for (const key of Object.keys(overrides)) {
    saved[key] = Object.getOwnPropertyDescriptor(navigator, key)
    Object.defineProperty(navigator, key, {
      configurable: true,
      value: overrides[key as keyof Navigator],
    })
  }
  return () => {
    for (const [key, desc] of Object.entries(saved)) {
      if (desc) Object.defineProperty(navigator, key, desc)
      else delete (navigator as unknown as Record<string, unknown>)[key]
    }
  }
}

/** Mock `matchMedia` to return `matches: true` for the standalone query. */
function stubStandaloneMQ(matches: boolean): () => void {
  const original = window.matchMedia
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('display-mode: standalone') ? matches : false,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
  return () => {
    window.matchMedia = original
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useInstallPrompt (#48)', () => {
  it('starts with canInstall=false and promptInstall=unavailable when no event has fired', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    const outcome = await result.current.promptInstall()
    expect(outcome).toBe('unavailable')
  })

  it('flips canInstall=true after `beforeinstallprompt` fires', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent())
    })
    expect(result.current.canInstall).toBe(true)
  })

  it('fires the native prompt and returns the user outcome', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const evt = makeBeforeInstallPromptEvent('accepted')
    act(() => {
      window.dispatchEvent(evt)
    })
    let outcome: string = ''
    // promptInstall() resolves AFTER the internal `setDeferredPrompt(null)`
    // setState fires — wrap in act so the state flush is flushed before
    // we assert.
    await act(async () => {
      outcome = await result.current.promptInstall()
    })
    expect(evt.prompt).toHaveBeenCalledOnce()
    expect(outcome).toBe('accepted')
    // After firing, canInstall flips back to false — the browser only
    // fires `beforeinstallprompt` once per session.
    expect(result.current.canInstall).toBe(false)
  })

  it('marks installed when `appinstalled` fires', () => {
    const { result } = renderHook(() => useInstallPrompt())
    act(() => {
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(result.current.isInstalled).toBe(true)
    // canInstall must also drop — re-installing is not possible from this state.
    expect(result.current.canInstall).toBe(false)
  })

  it("forwards the 'dismissed' outcome back to the caller", async () => {
    const { result } = renderHook(() => useInstallPrompt())
    const evt = makeBeforeInstallPromptEvent('dismissed')
    act(() => {
      window.dispatchEvent(evt)
    })
    let outcome: string = ''
    await act(async () => {
      outcome = await result.current.promptInstall()
    })
    expect(evt.prompt).toHaveBeenCalledOnce()
    expect(outcome).toBe('dismissed')
    // Same one-fire-per-session rule — canInstall flips to false either way.
    expect(result.current.canInstall).toBe(false)
  })

  it('initializes isInstalled=true when matchMedia reports standalone display mode', () => {
    const restore = stubStandaloneMQ(true)
    try {
      const { result } = renderHook(() => useInstallPrompt())
      expect(result.current.isInstalled).toBe(true)
      // Already-installed users must never see the install CTA.
      expect(result.current.canInstall).toBe(false)
    } finally {
      restore()
    }
  })

  it("initializes isInstalled=true when iOS Safari reports navigator.standalone", () => {
    const restoreNav = stubNavigator({
      standalone: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    } as Partial<Navigator>)
    try {
      const { result } = renderHook(() => useInstallPrompt())
      expect(result.current.isInstalled).toBe(true)
      expect(result.current.canInstall).toBe(false)
    } finally {
      restoreNav()
    }
  })
})

describe('useInstallPrompt — iOS detection', () => {
  it('detects Safari on iPhone as iOS', () => {
    const restore = stubNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    } as Partial<Navigator>)
    try {
      const { result } = renderHook(() => useInstallPrompt())
      expect(result.current.isIOS).toBe(true)
    } finally {
      restore()
    }
  })

  it('detects iPadOS 13+ (reports as MacIntel + touch) as iOS', () => {
    const restore = stubNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      platform: 'MacIntel',
      maxTouchPoints: 5,
    } as Partial<Navigator>)
    try {
      const { result } = renderHook(() => useInstallPrompt())
      expect(result.current.isIOS).toBe(true)
    } finally {
      restore()
    }
  })

  it('does NOT mark Chrome-on-iOS as iOS (browser has its own install UI)', () => {
    // CriOS in the UA string — Chrome iOS — must be excluded because Chrome
    // handles installs natively. Showing our manual hint would be redundant.
    const restore = stubNavigator({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1',
    } as Partial<Navigator>)
    try {
      const { result } = renderHook(() => useInstallPrompt())
      expect(result.current.isIOS).toBe(false)
    } finally {
      restore()
    }
  })

  it('does NOT mark desktop Chrome on macOS as iOS', () => {
    const restore = stubNavigator({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      platform: 'MacIntel',
      maxTouchPoints: 0,
    } as Partial<Navigator>)
    try {
      const { result } = renderHook(() => useInstallPrompt())
      expect(result.current.isIOS).toBe(false)
    } finally {
      restore()
    }
  })
})

describe('useInstallPrompt — listener cleanup', () => {
  it('removes its event listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const { result, unmount } = renderHook(() => useInstallPrompt())

    // Sanity: listeners are wired and the hook responds to events.
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent())
    })
    expect(result.current.canInstall).toBe(true)

    unmount()

    // Effect cleanup must have removed both window listeners.
    const removedEvents = removeSpy.mock.calls.map(c => c[0])
    expect(removedEvents).toContain('beforeinstallprompt')
    expect(removedEvents).toContain('appinstalled')
  })

  it('does not update state after unmount', () => {
    const { result, unmount } = renderHook(() => useInstallPrompt())
    const before = result.current.canInstall
    unmount()
    // Post-unmount events must not throw OR mutate the captured snapshot.
    act(() => {
      window.dispatchEvent(makeBeforeInstallPromptEvent())
      window.dispatchEvent(new Event('appinstalled'))
    })
    expect(result.current.canInstall).toBe(before)
  })
})
