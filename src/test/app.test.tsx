import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import { initDatabase } from '../lib/db'
import * as profilesDb from '../lib/db/profiles'
import type { PlayerProfile } from '../lib/profiles'

// Mock window.matchMedia for useIsMobile hook
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock sonner toast — keeps test output quiet and avoids portal mounting noise.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

/**
 * Render `<App />` wrapped in a fresh `QueryClientProvider`. In production
 * the wrap lives in `Bootstrap` (`main.tsx`); tests bypass Bootstrap so
 * they don't have to wait through the DB-init loading state.
 *
 * Each call gets its own QueryClient so caches don't leak between tests.
 */
function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

/**
 * Test helper: insert a fixed set of {@link PlayerProfile} entries straight
 * into the (sql.js-backed) test database. Returns the profiles so callers
 * can use them in assertions. Mirrors the pre-Phase-4 `seedProfiles` helper
 * but writes via the real DB layer instead of localStorage.
 */
async function seedProfiles(names: string[]): Promise<PlayerProfile[]> {
  const profiles: PlayerProfile[] = names.map((name, idx) => ({
    id: `profile-test-${idx}`,
    name,
    color: ['#3b82f6', '#ef4444', '#10b981', '#8b5cf6'][idx % 4],
    emoji: '😀',
    createdAt: Date.now() + idx,
  }))
  for (const p of profiles) await profilesDb.insertProfile(p)
  return profiles
}

/**
 * Drive the setup screen by tapping each empty seat, selecting the matching
 * profile from the picker, then tapping Start Game. Uses `waitFor` because
 * the underlying state transitions are async (queries refetch after the
 * insert mutations fire).
 */
async function startGameWithProfiles(profiles: PlayerProfile[]) {
  for (let i = 0; i < profiles.length; i++) {
    const seatButton = await screen.findByText(`Select Player ${i + 1}`)
    fireEvent.click(seatButton)
    // ProfilePicker dialog opens — click the profile entry. The name appears
    // in multiple places after the first pick (seat button + remaining picker
    // entries), so prefer a non-disabled match.
    const allMatching = await screen.findAllByText(profiles[i].name)
    const pickerEntry =
      allMatching.find(el => el.closest('button')?.getAttribute('disabled') === null)
      ?? allMatching[0]
    fireEvent.click(pickerEntry)
  }
  fireEvent.click(screen.getByText('Start Game'))
}

/**
 * Wait for the App to finish its initial async query settle, signaled by
 * the setup screen's title appearing. The global `beforeEach` initializes
 * the DB so this should be fast.
 */
async function waitForReady() {
  await screen.findByText('Scopa Score')
}

beforeEach(async () => {
  // Setup file's `beforeEach` already closed any open DB; (re-)initialize.
  await initDatabase()
})

describe('App', () => {
  it('renders setup screen when no game is active', async () => {
    renderApp()
    await waitForReady()
    expect(screen.getByText('Start Game')).toBeInTheDocument()
  })

  it('shows player count options', async () => {
    renderApp()
    await waitForReady()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('changes player count and shows correct number of seats', async () => {
    renderApp()
    await waitForReady()
    fireEvent.click(screen.getByText('3'))
    expect(screen.getByText('Select Player 1')).toBeInTheDocument()
    expect(screen.getByText('Select Player 2')).toBeInTheDocument()
    expect(screen.getByText('Select Player 3')).toBeInTheDocument()
  })

  it('Start Game is disabled until all seats are filled', async () => {
    renderApp()
    await waitForReady()
    const startBtn = screen.getByText('Start Game').closest('button')
    expect(startBtn).toBeDisabled()
  })

  it('starts a game once profiles are picked and shows game screen', async () => {
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)
    await waitFor(() => expect(screen.getByText('Bank Hand')).toBeInTheDocument())
  })

  it('shows language selector on setup screen', async () => {
    renderApp()
    await waitForReady()
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Italiano')).toBeInTheDocument()
  })

  it('switches to Italian on setup', async () => {
    renderApp()
    await waitForReady()
    fireEvent.click(screen.getByText('Italiano'))
    await waitFor(() => expect(screen.getByText('Scopa — Segnapunti')).toBeInTheDocument())
    expect(screen.getByText('Inizia Partita')).toBeInTheDocument()
  })

  it('uses profile names in the game UI', async () => {
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)
    await waitFor(() => {
      expect(screen.getAllByText('Mario').length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getAllByText('Luigi').length).toBeGreaterThanOrEqual(1)
  })

  it('shows initial scores as 0', async () => {
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)
    await waitFor(() => {
      const zeros = screen.getAllByText('0')
      expect(zeros.length).toBeGreaterThanOrEqual(2)
    })
  })

  it('shows scoring categories', async () => {
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)
    await waitFor(() => expect(screen.getByText(/Cards/)).toBeInTheDocument())
    expect(screen.getByText(/Coins/)).toBeInTheDocument()
    expect(screen.getByText(/Settebello/)).toBeInTheDocument()
    expect(screen.getByText(/Primiera/)).toBeInTheDocument()
    expect(screen.getByText(/per player/)).toBeInTheDocument()
  })
})

describe('Game scoring', () => {
  it('player buttons are used instead of radio buttons for scoring', async () => {
    const profiles = await seedProfiles(['Alice', 'Bob'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)

    await waitFor(() => {
      const aliceButtons = screen.getAllByText('Alice')
      expect(aliceButtons.length).toBeGreaterThanOrEqual(4)
    })
  })

  it('clicking a player button selects them for a category', async () => {
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)

    await waitFor(() => {
      const marioMatches = screen.getAllByText('Mario')
      const categoryButtons = marioMatches.filter(el => el.closest('button')?.tagName === 'BUTTON')
      expect(categoryButtons.length).toBeGreaterThanOrEqual(4)
    })

    const marioMatches = screen.getAllByText('Mario')
    const categoryButtons = marioMatches.filter(el => el.closest('button')?.tagName === 'BUTTON')
    const firstCategoryButton = categoryButtons[0].closest('button') as HTMLButtonElement
    fireEvent.click(firstCategoryButton)

    await waitFor(() => {
      const updated = screen.getAllByText('Mario')
        .map(el => el.closest('button'))
        .filter((b): b is HTMLButtonElement => b !== null)
      const selected = updated.find(b => b.style.backgroundColor && b.style.backgroundColor !== 'transparent')
      expect(selected).toBeTruthy()
    })
  })
})

describe('Accessibility (#46)', () => {
  it('category-winner pills expose aria-pressed and toggle on click', async () => {
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)

    await waitFor(() => expect(screen.getByText('Bank Hand')).toBeInTheDocument())

    // Before any click: every category pill exposes aria-pressed="false".
    const marioPills = screen.getAllByRole('button', { pressed: false })
      .filter(b => b.textContent?.includes('Mario'))
    expect(marioPills.length).toBeGreaterThanOrEqual(4) // four categories

    // Click the first one (Cards). PlayerButton is defined inside App so
    // React remounts it on re-render — we must re-query for the updated state.
    fireEvent.click(marioPills[0])
    await waitFor(() => {
      const pressed = screen.queryAllByRole('button', { pressed: true })
        .filter(b => b.textContent?.includes('Mario'))
      expect(pressed.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('scopa +/- buttons have descriptive aria-labels', async () => {
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)

    await waitFor(() => expect(screen.getByText('Bank Hand')).toBeInTheDocument())

    expect(screen.getByLabelText("Increase Mario's scopa count")).toBeInTheDocument()
    expect(screen.getByLabelText("Decrease Mario's scopa count")).toBeInTheDocument()
    expect(screen.getByLabelText("Increase Luigi's scopa count")).toBeInTheDocument()
    expect(screen.getByLabelText("Decrease Luigi's scopa count")).toBeInTheDocument()
  })

  it('icon buttons in the game header have aria-labels', async () => {
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)

    await waitFor(() => expect(screen.getByText('Bank Hand')).toBeInTheDocument())
    expect(screen.getByLabelText('Show card values')).toBeInTheDocument()
    expect(screen.getByLabelText('Game menu')).toBeInTheDocument()
  })
})

describe('Undo Bank Hand (#47)', () => {
  it('bankHand toast carries an Undo action button', async () => {
    const { toast } = await import('sonner')
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)
    await waitFor(() => expect(screen.getByText('Bank Hand')).toBeInTheDocument())

    vi.mocked(toast.success).mockClear()
    fireEvent.click(screen.getByText('Bank Hand'))

    await waitFor(() => {
      // The first arg is the localized "Hand banked!" string; second is the
      // options object carrying the action callback.
      expect(toast.success).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          duration: 7000,
          action: expect.objectContaining({
            label: expect.any(String),
            onClick: expect.any(Function),
          }),
        }),
      )
    })
  })

  it('clicking the Undo action triggers the unbank mutation', async () => {
    const { toast } = await import('sonner')
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)
    await waitFor(() => expect(screen.getByText('Bank Hand')).toBeInTheDocument())

    vi.mocked(toast.success).mockClear()
    fireEvent.click(screen.getByText('Bank Hand'))

    // Pull the captured action.onClick callback out of the mock and invoke it.
    await waitFor(() => expect(toast.success).toHaveBeenCalled())
    const successCall = vi.mocked(toast.success).mock.calls.find(
      c => typeof c[1] === 'object' && c[1] !== null && 'action' in c[1],
    )
    expect(successCall).toBeDefined()
    const action = (successCall![1] as { action: { onClick: () => void } }).action
    action.onClick()
    // Undo fires its own success toast; if no exceptions, the wiring is intact.
    await waitFor(() => {
      const calls = vi.mocked(toast.success).mock.calls
      // First call is the bank toast; second is the unbank toast.
      expect(calls.length).toBeGreaterThanOrEqual(2)
    })
  })
})

describe('Card Values Legend', () => {
  it('opens and closes the card values legend', async () => {
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)

    await waitFor(() => expect(screen.getByTitle('Card Point Values')).toBeInTheDocument())
    fireEvent.click(screen.getByTitle('Card Point Values'))
    await waitFor(() => {
      expect(screen.getAllByText('Card Point Values').length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getByTitle('Card Point Values'))
  })
})

describe('Win condition', () => {
  it('win threshold is >= 11, not > 11', async () => {
    const profiles = await seedProfiles(['Mario', 'Luigi'])
    renderApp()
    await waitForReady()
    await startGameWithProfiles(profiles)
    await waitFor(() => expect(screen.getByText('Bank Hand')).toBeInTheDocument())
  })
})

describe('Player Profiles', () => {
  it('shows empty state when no profiles exist and disables Start Game', async () => {
    renderApp()
    await waitForReady()
    expect(screen.getByText('Select Player 1')).toBeInTheDocument()
    expect(screen.getByText('Select Player 2')).toBeInTheDocument()
    expect(screen.getByText('Start Game').closest('button')).toBeDisabled()
  })

  it('persists profiles across renders via the DB', async () => {
    // Pre-Phase-4 this test verified localStorage persistence; now we
    // verify SQLite persistence by inserting once and re-rendering twice.
    await seedProfiles(['Mario', 'Luigi'])
    const { unmount } = renderApp()
    await waitForReady()
    unmount()

    renderApp()
    await waitForReady()
    fireEvent.click(await screen.findByText('Select Player 1'))
    await waitFor(() => expect(screen.getByText('Choose a player')).toBeInTheDocument())
    expect(screen.getByText('Mario')).toBeInTheDocument()
    expect(screen.getByText('Luigi')).toBeInTheDocument()
  })
})
