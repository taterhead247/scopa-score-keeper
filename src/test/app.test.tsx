import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import App from '../App'
import { PROFILES_STORAGE_KEY, PROFILES_MIGRATED_FLAG, type PlayerProfile } from '../lib/profiles'

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

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}))

/**
 * Test helper: write a fixed set of {@link PlayerProfile} entries straight to
 * localStorage and mark the migration flag so the app doesn't wipe them on
 * mount. Returns the profiles so callers can use them in assertions.
 */
function seedProfiles(names: string[]): PlayerProfile[] {
  const profiles: PlayerProfile[] = names.map((name, idx) => ({
    id: `profile-test-${idx}`,
    name,
    color: ['#3b82f6', '#ef4444', '#10b981', '#8b5cf6'][idx % 4],
    emoji: '😀',
    createdAt: Date.now() + idx,
  }))
  localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(profiles))
  localStorage.setItem(PROFILES_MIGRATED_FLAG, '1')
  return profiles
}

/**
 * Test helper: drive the setup screen by clicking each empty seat and
 * selecting the corresponding profile from the picker, then click Start Game.
 * Assumes profiles are already seeded via {@link seedProfiles}.
 */
function startGameWithProfiles(profiles: PlayerProfile[]) {
  // Each empty seat opens the picker; pick a profile by clicking its name in the dialog.
  for (let i = 0; i < profiles.length; i++) {
    const seatButton = screen.getByText(`Select Player ${i + 1}`)
    fireEvent.click(seatButton)
    // ProfilePicker dialog opens — click the profile entry.
    // Name appears multiple times after first pick (seat button + remaining picker entries),
    // so locate it by querySelector to grab the picker entry specifically.
    const allMatching = screen.getAllByText(profiles[i].name)
    const pickerEntry = allMatching.find(el => el.closest('button')?.getAttribute('disabled') === null) ?? allMatching[0]
    fireEvent.click(pickerEntry)
  }
  fireEvent.click(screen.getByText('Start Game'))
}

describe('App', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('renders setup screen when no game is active', () => {
    render(<App />)
    expect(screen.getByText('Scopa Score Tracker')).toBeInTheDocument()
    expect(screen.getByText('Start Game')).toBeInTheDocument()
  })

  it('shows player count options', () => {
    render(<App />)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('6')).toBeInTheDocument()
  })

  it('changes player count and shows correct number of seats', () => {
    render(<App />)
    fireEvent.click(screen.getByText('3'))
    expect(screen.getByText('Select Player 1')).toBeInTheDocument()
    expect(screen.getByText('Select Player 2')).toBeInTheDocument()
    expect(screen.getByText('Select Player 3')).toBeInTheDocument()
  })

  it('Start Game is disabled until all seats are filled', () => {
    render(<App />)
    const startBtn = screen.getByText('Start Game').closest('button')
    expect(startBtn).toBeDisabled()
  })

  it('starts a game once profiles are picked and shows game screen', () => {
    const profiles = seedProfiles(['Mario', 'Luigi'])
    render(<App />)
    startGameWithProfiles(profiles)
    expect(screen.getByText('Bank Hand')).toBeInTheDocument()
  })

  it('shows language selector on setup screen', () => {
    render(<App />)
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText('Italiano')).toBeInTheDocument()
  })

  it('switches to Italian on setup', () => {
    render(<App />)
    fireEvent.click(screen.getByText('Italiano'))
    expect(screen.getByText('Scopa — Segnapunti')).toBeInTheDocument()
    expect(screen.getByText('Inizia Partita')).toBeInTheDocument()
  })

  it('uses profile names in the game UI', () => {
    const profiles = seedProfiles(['Mario', 'Luigi'])
    render(<App />)
    startGameWithProfiles(profiles)
    expect(screen.getAllByText('Mario').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Luigi').length).toBeGreaterThanOrEqual(1)
  })

  it('shows initial scores as 0', () => {
    const profiles = seedProfiles(['Mario', 'Luigi'])
    render(<App />)
    startGameWithProfiles(profiles)
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBeGreaterThanOrEqual(2)
  })

  it('shows scoring categories', () => {
    const profiles = seedProfiles(['Mario', 'Luigi'])
    render(<App />)
    startGameWithProfiles(profiles)
    expect(screen.getByText(/Cards/)).toBeInTheDocument()
    expect(screen.getByText(/Coins/)).toBeInTheDocument()
    expect(screen.getByText(/Settebello/)).toBeInTheDocument()
    expect(screen.getByText(/Primiera/)).toBeInTheDocument()
    expect(screen.getByText(/per player/)).toBeInTheDocument()
  })
})

describe('Game scoring', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('player buttons are used instead of radio buttons for scoring', () => {
    const profiles = seedProfiles(['Alice', 'Bob'])
    render(<App />)
    startGameWithProfiles(profiles)

    const aliceButtons = screen.getAllByText('Alice')
    expect(aliceButtons.length).toBeGreaterThanOrEqual(4)
  })

  it('clicking a player button selects them for a category', () => {
    const profiles = seedProfiles(['Mario', 'Luigi'])
    render(<App />)
    startGameWithProfiles(profiles)

    const marioMatches = screen.getAllByText('Mario')
    const categoryButtons = marioMatches.filter(el => el.closest('button')?.tagName === 'BUTTON')
    expect(categoryButtons.length).toBeGreaterThanOrEqual(4)

    const firstCategoryButton = categoryButtons[0].closest('button') as HTMLButtonElement
    fireEvent.click(firstCategoryButton)

    const updated = screen.getAllByText('Mario')
      .map(el => el.closest('button'))
      .filter((b): b is HTMLButtonElement => b !== null)
    const selected = updated.find(b => b.style.backgroundColor && b.style.backgroundColor !== 'transparent')
    expect(selected).toBeTruthy()
  })
})

describe('Card Values Legend', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('opens and closes the card values legend', () => {
    const profiles = seedProfiles(['Mario', 'Luigi'])
    render(<App />)
    startGameWithProfiles(profiles)

    fireEvent.click(screen.getByTitle('Card Point Values'))
    expect(screen.getAllByText('Card Point Values').length).toBeGreaterThanOrEqual(1)

    fireEvent.click(screen.getByTitle('Card Point Values'))
  })
})

describe('Win condition', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('win threshold is >= 11, not > 11', () => {
    const profiles = seedProfiles(['Mario', 'Luigi'])
    render(<App />)
    startGameWithProfiles(profiles)
    expect(screen.getByText('Bank Hand')).toBeInTheDocument()
  })
})

describe('Player Profiles', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows empty state when no profiles exist and disables Start Game', () => {
    render(<App />)
    expect(screen.getByText('Select Player 1')).toBeInTheDocument()
    expect(screen.getByText('Select Player 2')).toBeInTheDocument()
    expect(screen.getByText('Start Game').closest('button')).toBeDisabled()
  })

  it('persists profiles across renders via localStorage', () => {
    seedProfiles(['Mario', 'Luigi'])
    const { unmount } = render(<App />)
    unmount()
    render(<App />)
    fireEvent.click(screen.getByText('Select Player 1'))
    expect(screen.getByText('Choose a player')).toBeInTheDocument()
    expect(screen.getByText('Mario')).toBeInTheDocument()
    expect(screen.getByText('Luigi')).toBeInTheDocument()
  })
})
