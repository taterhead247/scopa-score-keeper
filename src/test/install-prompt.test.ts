import { describe, it, expect, beforeEach, vi } from 'vitest'
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

beforeEach(() => {
  // Reset anything that might persist between tests.
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
})
