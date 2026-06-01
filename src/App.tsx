import { lazy, Suspense, useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Minus, Calculator, List, Check, Key, UsersThree, DotsThreeVertical, Heart } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { t, LANGUAGES } from '@/i18n'
import { WinnerOverlay } from '@/components/WinnerOverlay'
import { ProfilePicker, ProfileSeatButton } from '@/components/ProfilePicker'
import { QuickStartSection } from '@/components/QuickStartSection'
import { useDataPortability } from '@/components/DataPortabilityActions'
import { OnboardingTip } from '@/components/OnboardingTip'
import { InstallPrompt } from '@/components/InstallPrompt'

/*
  Code-split dialogs that only mount on user action. The initial JS bundle
  was dominated by Statistics (recharts), History (filtering+date-fns),
  About (marked+dompurify), and the players-screen / calculators that
  only show after a tap. Lazy + conditional mount cuts initial parse by
  pushing those chunks behind the click that opens them.

  HandChart is also lazy: although it's a panel (not a dialog), it is
  gated by `handHistory.length > 0`, so the recharts dependency only
  loads after the first hand of a session is banked.
*/
const HandChart = lazy(() =>
  import('@/components/HandChart').then(m => ({ default: m.HandChart })),
)
const PremieraCalc = lazy(() =>
  import('@/components/PremieraCalc').then(m => ({ default: m.PremieraCalc })),
)
const CardValuesLegend = lazy(() =>
  import('@/components/CardValuesLegend').then(m => ({ default: m.CardValuesLegend })),
)
const PlayersScreen = lazy(() =>
  import('@/components/PlayersScreen').then(m => ({ default: m.PlayersScreen })),
)
const StatisticsScreen = lazy(() =>
  import('@/components/StatisticsScreen').then(m => ({ default: m.StatisticsScreen })),
)
const HistoryScreen = lazy(() =>
  import('@/components/HistoryScreen').then(m => ({ default: m.HistoryScreen })),
)
const AboutDialog = lazy(() =>
  import('@/components/AboutDialog').then(m => ({ default: m.AboutDialog })),
)
import { useOnboardingFlag } from '@/hooks/use-onboarding'
import { PROFILE_COLORS } from '@/lib/profiles'
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning, areHapticsEnabled, setHapticsEnabled } from '@/lib/haptics'
import { openSupportPage } from '@/lib/support'
import type { Player, HandCategoryDetail, Game } from '@/lib/game'
import { computeWinOutcome } from '@/lib/game'
import { SETTINGS_KEYS } from '@/lib/db'
import {
  useProfilesQuery,
  useFavoritesQuery,
  useActiveGamesQuery,
  useCompletedGamesQuery,
  useSettingQuery,
  useSetSettingMutation,
  useDeleteSettingMutation,
  useCreateGameMutation,
  useSetHandCategoryWinnerMutation,
  useSetHandScopaScoreMutation,
  useBankHandMutation,
  useUnbankHandMutation,
  useCompleteGameMutation,
  useResetGameMutation,
  useDeleteGameMutation,
  useRenameGamePlayersMutation,
} from '@/lib/db/hooks'

// ── Helpers ────────────────────────────────────────────

/** Generate a unique id for a {@link Game} or {@link CompletedGame} record. */
function makeId() {
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Build a zeroed `handScopaScores` map keyed by each player's id. */
function freshScopaScores(players: Player[]): Record<string, number> {
  const s: Record<string, number> = {}
  players.forEach(p => { s[p.id] = 0 })
  return s
}

// ── App ────────────────────────────────────────────────

/**
 * Root component for the Scopa score tracker.
 *
 * Renders the setup screen when no game is active and the gameplay screen
 * when one is. Persists all state (profiles, games, completed games,
 * language) to localStorage via {@link useLocalStorage}.
 */
export default function App() {
  // Persistent state via SQLite-backed queries (TanStack Query reactivity).
  const profilesQuery = useProfilesQuery()
  const favoritesQuery = useFavoritesQuery()
  const gamesQuery = useActiveGamesQuery()
  const completedGamesQuery = useCompletedGamesQuery()
  const activeGameIdQuery = useSettingQuery(SETTINGS_KEYS.activeGameId)
  const languageQuery = useSettingQuery(SETTINGS_KEYS.language)

  const profiles = profilesQuery.data ?? []
  const favoriteGroupings = favoritesQuery.data ?? []
  const games = gamesQuery.data ?? []
  const completedGames = completedGamesQuery.data ?? []
  const activeGameId = activeGameIdQuery.data ?? null
  const language = languageQuery.data ?? 'en'

  // Mutations: each handler below picks the one it needs.
  const setSettingMut = useSetSettingMutation()
  const deleteSettingMut = useDeleteSettingMutation()
  const createGameMut = useCreateGameMutation()
  const setCategoryWinnerMut = useSetHandCategoryWinnerMutation()
  const setScopaScoreMut = useSetHandScopaScoreMutation()
  const bankHandMut = useBankHandMutation()
  const unbankHandMut = useUnbankHandMutation()
  const completeGameMut = useCompleteGameMutation()
  const resetGameMut = useResetGameMutation()
  const deleteGameMut = useDeleteGameMutation()
  const renameGamePlayersMut = useRenameGamePlayersMutation()

  /** Persist the active game id, clearing when null. */
  const setActiveGameId = (id: string | null) => {
    if (id === null) deleteSettingMut.mutate(SETTINGS_KEYS.activeGameId)
    else setSettingMut.mutate({ key: SETTINGS_KEYS.activeGameId, value: id })
  }

  /** Persist the language preference. */
  const setLanguage = (code: string) => {
    setSettingMut.mutate({ key: SETTINGS_KEYS.language, value: code })
  }

  /** Toggle the haptics preference, applying it to the runtime module
   * immediately (so the next tap reflects the change) and persisting it. */
  const toggleHaptics = () => {
    const next = !hapticsOn
    setHapticsOn(next)
    setHapticsEnabled(next)
    setSettingMut.mutate({ key: SETTINGS_KEYS.hapticsEnabled, value: String(next) })
  }

  // Setup state (still in-memory; lost on reload, which is fine for a draft selection)
  const [playerCount, setPlayerCount] = useState(2)
  const [selectedProfileIds, setSelectedProfileIds] = useState<(string | null)[]>([null, null])
  const [pickerSeat, setPickerSeat] = useState<number | null>(null)

  // UI state
  const [premieraOpen, setPremieraOpen] = useState(false)
  const [cardValuesOpen, setCardValuesOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTempNames, setRenameTempNames] = useState<string[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [openGamesOpen, setOpenGamesOpen] = useState(false)
  const [playersScreenOpen, setPlayersScreenOpen] = useState(false)
  const [statisticsOpen, setStatisticsOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  // #49 — haptics toggle. Initial value is whatever boot saw in app_settings.
  // Persisted via the settings hook below.
  const [hapticsOn, setHapticsOn] = useState<boolean>(areHapticsEnabled())

  // #51 — first-run hint flags. Each persists once dismissed OR once the
  // user demonstrates they've understood what the hint was pointing at.
  const [seenProfilesTip, markProfilesTipSeen] = useOnboardingFlag('profiles-tip')
  const [seenFirstBankTip, markFirstBankTipSeen] = useOnboardingFlag('first-bank-tip')
  const [seenCardValuesTip, markCardValuesTipSeen] = useOnboardingFlag('card-values-tip')

  /**
   * Treat "user has at least one profile" as implicit completion of the
   * profiles tip — they've demonstrated they understand the profile model,
   * so even if they later return to zero profiles (deleted all of them) we
   * don't want the hint reappearing as if they were a first-time user.
   */
  useEffect(() => {
    if (profiles.length > 0 && !seenProfilesTip) {
      markProfilesTipSeen()
    }
  }, [profiles.length, seenProfilesTip, markProfilesTipSeen])

  // Winner state
  const [winnerName, setWinnerName] = useState<string | null>(null)
  const [isTie, setIsTie] = useState(false)
  const [tiedPlayerNames, setTiedPlayerNames] = useState<string[]>([])

  /**
   * Screen-reader announcement region content. Updated when a hand is
   * banked so AT users hear the score change — without this they'd only
   * see the toast (which TalkBack/VoiceOver sometimes miss when it
   * dismisses quickly) and have to navigate back to the score cards.
   */
  const [liveAnnouncement, setLiveAnnouncement] = useState('')

  /** Translate `key` using the current language, with optional `{name}`-style interpolation. */
  const tr = (key: string, params?: Record<string, string>) => t(key, language, params)

  /**
   * Keep `<html lang>` in sync with the user's language choice. Screen
   * readers pick the pronunciation engine from this attribute, so without
   * the sync TalkBack/VoiceOver would announce Italian content in an
   * English voice (and vice versa). Matches the WCAG 2.2 guidance in
   * CLAUDE.md ("If you generate localized HTML at runtime, update
   * `document.documentElement.lang` too.").
   */
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language
    }
  }, [language])

  // #50 — theme. next-themes persists to localStorage under "scopa-theme"
  // and applies the `.dark` class to <html> when resolved theme is dark.
  // `theme` is the user choice ("system" | "light" | "dark"); `setTheme`
  // updates it. We don't gate on `resolvedTheme` — Tailwind / CSS does
  // the visual work for us.
  const { theme, setTheme } = useTheme()

  // Data export/import flow (#45). The returned `element` hosts the hidden
  // file input + confirmation dialog and stays mounted across menu opens.
  const dataPortability = useDataPortability(tr)

  // Active game derived
  const activeGame = games.find(g => g.id === activeGameId) ?? null
  const gameStarted = activeGame !== null

  // ── Setup ────────────────────────────────────────────

  /** Resolve a profile id to its current {@link PlayerProfile}, or null if not found. */
  const profileById = (id: string | null) =>
    id ? profiles.find(p => p.id === id) ?? null : null

  /**
   * Change the number of seats on the setup screen, preserving existing
   * selections for seats that still exist and padding with `null` for any new
   * seats added.
   */
  const changePlayerCount = (count: number) => {
    setPlayerCount(count)
    setSelectedProfileIds(prev => Array.from({ length: count }, (_, i) => prev[i] ?? null))
  }

  /** Reset the setup screen to its default state (2 empty seats). */
  const resetSetup = () => {
    setPlayerCount(2)
    setSelectedProfileIds([null, null])
  }

  /**
   * Assign a profile to the given seat and close the picker.
   *
   * @param seatIndex - Zero-based seat index.
   * @param profileId - Id of the profile to assign.
   */
  const assignProfileToSeat = (seatIndex: number, profileId: string) => {
    setSelectedProfileIds(prev => {
      const next = [...prev]
      next[seatIndex] = profileId
      return next
    })
    setPickerSeat(null)
  }

  /**
   * Load an entire grouping into the setup seats: resize playerCount to the
   * grouping size (clamped to 2..6) and fill in the profileIds. Used by the
   * QuickStart section's recent and favorite groupings.
   */
  const loadGrouping = (profileIds: string[]) => {
    const count = Math.max(2, Math.min(6, profileIds.length))
    setPlayerCount(count)
    setSelectedProfileIds(profileIds.slice(0, count))
  }

  /**
   * Whether every seat on the setup screen has a profile assigned that still
   * exists in the profile list. Used to enable the Start Game button.
   */
  const allSeatsFilled =
    selectedProfileIds.length === playerCount &&
    selectedProfileIds.every(id => id !== null && profiles.some(p => p.id === id))

  /**
   * Build a fresh {@link Game} from the seat selections, persist it via
   * {@link useCreateGameMutation}, and make it the active game.
   *
   * The mutation owns both the insert into `games` + `game_players` AND
   * setting the `active_game_id` setting in one atomic flow.
   */
  const startGame = () => {
    if (!allSeatsFilled) return
    const newPlayers: Player[] = selectedProfileIds.map((id, idx) => {
      const profile = profileById(id)!
      return {
        id: `player-${idx}`,
        profileId: profile.id,
        name: profile.name,
        color: profile.color,
        emoji: profile.emoji,
        totalScore: 0,
      }
    })
    const newGame: Game = {
      id: makeId(),
      players: newPlayers,
      handScopaScores: freshScopaScores(newPlayers),
      handCardsWinner: null,
      handCoinsWinner: null,
      handSettebelloWinner: null,
      handPremieraWinner: null,
      handHistory: [],
      createdAt: Date.now(),
    }
    createGameMut.mutate(newGame)
  }

  // ── Game actions ─────────────────────────────────────

  /**
   * Lock in the current hand: compute per-player scores from the current
   * category winners + scopa counts, persist the hand via {@link bankHandMut},
   * then evaluate {@link computeWinOutcome}. On a strict win we keep the
   * game ACTIVE in the DB (completion happens when the user resolves the
   * overlay via "New Game (Same/New Players)") — that keeps the gameplay
   * screen mounted under the overlay rather than flickering to setup.
   */
  const bankHand = () => {
    if (!activeGame) return
    const { players } = activeGame

    const perPlayer = players.map(p => {
      const scopa = activeGame.handScopaScores[p.id] || 0
      const cat: HandCategoryDetail = {
        cards: activeGame.handCardsWinner === p.id,
        coins: activeGame.handCoinsWinner === p.id,
        settebello: activeGame.handSettebelloWinner === p.id,
        premiera: activeGame.handPremieraWinner === p.id,
        scopa,
      }
      const score =
        scopa +
        (cat.cards ? 1 : 0) +
        (cat.coins ? 1 : 0) +
        (cat.settebello ? 1 : 0) +
        (cat.premiera ? 1 : 0)
      return {
        playerId: p.id,
        score,
        categories: cat,
        newTotal: p.totalScore + score,
      }
    })

    bankHandMut.mutate({
      gameId: activeGame.id,
      handNumber: activeGame.handHistory.length + 1,
      timestamp: Date.now(),
      perPlayer,
    })

    const updatedPlayers = players.map(p => {
      const me = perPlayer.find(x => x.playerId === p.id)!
      return { ...p, totalScore: me.newTotal }
    })

    // Build the screen-reader announcement before evaluating win/tie so
    // it fires on every banked hand, not just non-terminal ones.
    const scoreSummary = perPlayer
      .filter(p => p.score > 0)
      .map(p => {
        const name = players.find(pl => pl.id === p.playerId)?.name ?? ''
        return tr('a11y.scoreUpdate', {
          player: name,
          delta: String(p.score),
          total: String(p.newTotal),
        })
      })
      .join('; ')
    setLiveAnnouncement(tr('a11y.handBanked', { scores: scoreSummary }))

    const outcome = computeWinOutcome(updatedPlayers)
    // Medium impact for the commit action; success/warning on overlay open.
    hapticMedium()
    if (outcome.kind === 'win') {
      setWinnerName(outcome.winner.name)
      setIsTie(false)
      setTiedPlayerNames([])
      hapticSuccess()
    } else if (outcome.kind === 'tie') {
      // Defensive: clear any stale winner state so the overlay shows tie, not winner.
      setWinnerName(null)
      setIsTie(true)
      setTiedPlayerNames(outcome.tied.map(p => p.name))
      toast.info(tr('winner.tie'))
      hapticWarning()
    }
    // #47 — Undo affordance. Always show the toast so the user has a clear
    // "out" if they banked by mistake; on win/tie this lives alongside the
    // overlay (Sonner toasts render above dialogs).
    const gameId = activeGame.id
    toast.success(tr('toast.handBanked'), {
      duration: 7000,
      action: {
        label: tr('toast.undo'),
        onClick: () => {
          unbankHandMut.mutate(gameId, {
            onSuccess: () => {
              // Roll back the overlay / live announcement that this hand triggered.
              setWinnerName(null)
              setIsTie(false)
              setTiedPlayerNames([])
              setLiveAnnouncement(tr('a11y.handUnbanked'))
              hapticLight()
              toast.success(tr('toast.handUnbanked'))
            },
          })
        },
      },
    })

    // #51 — first-run hint pointing at the menu. Fires once globally, so
    // even if the user resets the game we don't re-show it. The Sonner
    // stack auto-handles the layout alongside the Undo toast above.
    if (!seenFirstBankTip) {
      toast.info(tr('onboarding.firstBank'), { duration: 6000 })
      markFirstBankTipSeen()
    }
  }

  /** Adjust the in-progress scopa count for one player, clamped at zero. */
  const adjustScopa = (playerId: string, delta: number) => {
    if (!activeGame) return
    const current = activeGame.handScopaScores[playerId] || 0
    setScopaScoreMut.mutate({
      gameId: activeGame.id,
      playerId,
      count: Math.max(0, current + delta),
    })
    hapticLight()
  }

  /**
   * Toggle the winner of a category for the current (un-banked) hand.
   *
   * Selecting the same player again clears the category (acts as deselect).
   */
  const setHandWinner = (
    category: 'cards' | 'coins' | 'settebello' | 'premiera',
    playerId: string | null,
  ) => {
    if (!activeGame) return
    const currentKey = `hand${category.charAt(0).toUpperCase() + category.slice(1)}Winner` as
      'handCardsWinner' | 'handCoinsWinner' | 'handSettebelloWinner' | 'handPremieraWinner'
    const newValue = activeGame[currentKey] === playerId ? null : playerId
    setCategoryWinnerMut.mutate({ gameId: activeGame.id, category, playerId: newValue })
    hapticLight()
  }

  /** Zero every player's totalScore and clear hand state, keeping the same players. */
  const resetScores = () => {
    if (!activeGame) return
    resetGameMut.mutate(activeGame.id)
    toast.success(tr('toast.gameReset'))
  }

  /**
   * Finalize the currently-active game in the DB and clear the winner
   * overlay state. Used by both new-game actions after a win.
   *
   * `await`s the mutation so callers (newGameSamePlayers / newGameNewPlayers)
   * can sequence the subsequent createGame / setActiveGameId(null) safely
   * — otherwise the new game can be created before the old one's
   * `completed_at` is set, leaving a brief window where the cache shows
   * two active games or where the active-games query refetches with the
   * not-yet-completed game still present.
   */
  const finalizeActiveGameIfWon = async () => {
    if (!activeGame || winnerName === null) return
    const winnerPlayer = activeGame.players.find(p => p.name === winnerName)
    if (winnerPlayer) {
      await completeGameMut.mutateAsync({
        gameId: activeGame.id,
        winner: { profileId: winnerPlayer.profileId, name: winnerPlayer.name },
        completedAt: Date.now(),
      })
    }
    setWinnerName(null)
    setIsTie(false)
    setTiedPlayerNames([])
  }

  /** Delete the active game and return to the setup screen. */
  const endGame = () => {
    if (!activeGame) return
    deleteGameMut.mutate(activeGame.id)
    setActiveGameId(null)
    resetSetup()
    toast.success(tr('toast.gameEnded'))
  }

  /** Switch to a different in-progress game from the open-games list. */
  const switchGame = (gameId: string) => {
    setActiveGameId(gameId)
    setOpenGamesOpen(false)
  }

  /**
   * Start a fresh game with the same players as the just-finished game.
   * Completes the won game in the DB (preserves it in history) and creates
   * a new active game with fresh scores.
   */
  const newGameSamePlayers = async () => {
    if (!activeGame) return
    await finalizeActiveGameIfWon()
    const newPlayers: Player[] = activeGame.players.map(p => ({ ...p, totalScore: 0 }))
    const newGame: Game = {
      id: makeId(),
      players: newPlayers,
      handScopaScores: freshScopaScores(newPlayers),
      handCardsWinner: null,
      handCoinsWinner: null,
      handSettebelloWinner: null,
      handPremieraWinner: null,
      handHistory: [],
      createdAt: Date.now(),
    }
    createGameMut.mutate(newGame)
  }

  /**
   * Finalize the just-finished game (preserve in history) and return to the
   * setup screen for a fresh seat selection.
   */
  const newGameNewPlayers = async () => {
    await finalizeActiveGameIfWon()
    setActiveGameId(null)
    resetSetup()
  }

  // ── Rename ───────────────────────────────────────────

  /** Open the per-game rename dialog, pre-filled with the active game's player names. */
  const openRenameDialog = () => {
    if (!activeGame) return
    setRenameTempNames(activeGame.players.map(p => p.name))
    setRenameOpen(true)
  }

  /**
   * Persist the names entered in the rename dialog onto the active game's
   * players. This only mutates the in-game name snapshot — the underlying
   * profiles are not affected, so this can be used for one-off "team" names.
   */
  const saveRenamedPlayers = () => {
    if (!activeGame) return
    const renames = activeGame.players
      .map((p, idx) => ({ playerId: p.id, name: renameTempNames[idx] || p.name }))
      .filter(r => r.name)
    renameGamePlayersMut.mutate({ gameId: activeGame.id, renames })
    setRenameOpen(false)
    toast.success(tr('toast.namesUpdated'))
  }

  // ── Player button component (#18) ────────────────────

  /**
   * Pill-style toggle button used inside each scoring category (cards, coins,
   * settebello, premiera) to mark which player won that category for the
   * current hand. Uses the player's profile color + emoji.
   *
   * `aria-pressed` exposes the toggle state to screen readers and conforms
   * to WCAG 2.2 — without it the button just announces "Marco" with no clue
   * whether tapping it would select or deselect the player.
   */
  const PlayerButton = ({
    player,
    category,
    isSelected,
    onClick,
  }: {
    player: Player
    category: 'cards' | 'coins' | 'settebello' | 'premiera'
    isSelected: boolean
    onClick: () => void
  }) => {
    const color = player.color || PROFILE_COLORS[0]
    // The unselected pill uses the profile color as text on a transparent
    // bg. In dark mode that fails contrast, so we route the color through
    // the `text-profile` class (defined in index.css) which lightens via
    // color-mix when `.dark` is on <html>. The selected pill keeps its
    // white-on-color treatment — those colors all pass ≥4.5:1 vs white.
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={isSelected}
        aria-label={tr('a11y.categoryToggle', {
          player: player.name,
          category: tr(`category.${category === 'premiera' ? 'primiera' : category}`),
        })}
        className={`px-3 py-1.5 min-h-11 rounded-md border-2 font-medium text-sm transition-colors flex items-center gap-1.5 ${isSelected ? '' : 'text-profile'}`}
        style={{
          backgroundColor: isSelected ? color : 'transparent',
          borderColor: color,
          ['--profile-color' as string]: color,
          ...(isSelected ? { color: '#ffffff' } : {}),
        }}
      >
        <span aria-hidden="true">{player.emoji}</span>
        <span>{player.name}</span>
      </button>
    )
  }

  // ── Setup screen ─────────────────────────────────────

  if (!gameStarted) {
    const takenIds = new Set(
      selectedProfileIds
        .filter((id, idx) => id !== null && idx !== pickerSeat)
        .map(id => id as string)
    )

    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6">
          <div className="relative mb-6">
            <h1 className="text-3xl font-bold text-center">{tr('app.title')}</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-1/2 -translate-y-1/2 h-11 w-11"
                  aria-label={tr('menu.dataSettings')}
                >
                  <DotsThreeVertical size={20} aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={dataPortability.onExport}>
                  {tr('menu.exportData')}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={dataPortability.onImport}>
                  {tr('menu.importData')}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={hapticsOn}
                  onCheckedChange={toggleHaptics}
                  onSelect={e => e.preventDefault()}
                >
                  {tr('menu.haptics')}
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAboutOpen(true)}>
                  {tr('menu.about')}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={openSupportPage}
                  className="text-muted-foreground"
                >
                  <Heart size={14} aria-hidden="true" className="mr-1.5" />
                  {tr('support.menu')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="space-y-6">
            <div>
              <Label className="text-base font-semibold mb-3 block">{tr('setup.playerCount')}</Label>
              <div className="grid grid-cols-5 gap-2">
                {[2, 3, 4, 5, 6].map(count => (
                  <Button
                    key={count}
                    variant={playerCount === count ? 'default' : 'outline'}
                    onClick={() => changePlayerCount(count)}
                    className="h-12"
                  >
                    {count}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <Label className="text-base font-semibold">{tr('setup.players')}</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPlayersScreenOpen(true)}
                  className="h-auto py-1"
                >
                  <UsersThree size={16} className="mr-1" />
                  {tr('setup.managePlayers')}
                </Button>
              </div>
              {profiles.length === 0 && !seenProfilesTip && (
                <div className="mb-3">
                  <OnboardingTip
                    body={tr('onboarding.profiles')}
                    onDismiss={markProfilesTipSeen}
                    tr={tr}
                  />
                </div>
              )}
              <div className="space-y-2">
                {Array.from({ length: playerCount }, (_, idx) => (
                  <ProfileSeatButton
                    key={idx}
                    profile={profileById(selectedProfileIds[idx] ?? null)}
                    seatIndex={idx}
                    onClick={() => setPickerSeat(idx)}
                    tr={tr}
                  />
                ))}
              </div>
            </div>

            <QuickStartSection
              favoriteGroupings={favoriteGroupings}
              completedGames={completedGames}
              profiles={profiles}
              onLoadGrouping={loadGrouping}
              tr={tr}
            />

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{tr('menu.language')}:</span>
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setLanguage(lang.code)}
                  aria-pressed={language === lang.code}
                  className={`px-3 py-1 rounded-md border transition-colors ${
                    language === lang.code
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {lang.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{tr('menu.theme')}:</span>
              {(['system', 'light', 'dark'] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  aria-pressed={theme === t}
                  className={`px-3 py-1 rounded-md border transition-colors ${
                    theme === t
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  {tr(`theme.${t}`)}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 text-xs">
              <button
                onClick={() => setAboutOpen(true)}
                className="text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
              >
                {tr('setup.aboutLink')}
              </button>
              <span className="text-muted-foreground/40" aria-hidden="true">·</span>
              <button
                onClick={openSupportPage}
                className="inline-flex items-center gap-1 text-foreground underline underline-offset-2 hover:opacity-80 transition-opacity"
              >
                {/*
                  Keep the heart coral via `text-accent` so the link still reads
                  as a support CTA, but anchor the *text* to the foreground color
                  so AA contrast holds (#52). The accent at this size against the
                  cream bg failed 2.74:1; foreground is the only AA-safe text
                  color per the rules in CLAUDE.md.
                */}
                <Heart size={12} weight="fill" aria-hidden="true" className="text-accent" />
                {tr('support.menu')}
              </button>
            </div>

            <InstallPrompt tr={tr} />
            <Button onClick={startGame} disabled={!allSeatsFilled} className="w-full" size="lg">
              {tr('setup.startGame')}
            </Button>
            {completedGames.length > 0 && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setStatisticsOpen(true)}
              >
                {tr('menu.statistics')}
              </Button>
            )}
            {games.length > 0 && (
              <div className="pt-2 border-t border-border">
                <Label className="text-sm text-muted-foreground mb-2 block">{tr('menu.openGames')}</Label>
                <div className="space-y-2">
                  {games.map(g => (
                    <Button
                      key={g.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setActiveGameId(g.id)}
                    >
                      {g.players.map(p => p.name).join(` ${tr('games.vs')} `)}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <ProfilePicker
          open={pickerSeat !== null}
          onOpenChange={open => !open && setPickerSeat(null)}
          profiles={profiles}
          takenIds={takenIds}
          onPick={profileId => {
            if (pickerSeat !== null) assignProfileToSeat(pickerSeat, profileId)
          }}
          tr={tr}
        />

        {/*
          Lazy-loaded dialogs (setup screen). Each chunk loads on first
          open of its respective control — conditional mount keeps the
          chunk OUT of first-paint, and Suspense fallback is null because
          the user is mid-tap anyway.
        */}
        <Suspense fallback={null}>
          {playersScreenOpen && (
            <PlayersScreen
              open={playersScreenOpen}
              onOpenChange={setPlayersScreenOpen}
              profiles={profiles}
              tr={tr}
            />
          )}
          {statisticsOpen && (
            <StatisticsScreen
              open={statisticsOpen}
              onOpenChange={setStatisticsOpen}
              completedGames={completedGames}
              tr={tr}
            />
          )}
          {aboutOpen && (
            <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} tr={tr} language={language} />
          )}
        </Suspense>

        {dataPortability.element}
      </main>
    )
  }

  // ── Game screen ──────────────────────────────────────

  const { players } = activeGame

  return (
    <main className="min-h-screen bg-background p-3 sm:p-4">
      <WinnerOverlay
        winnerName={winnerName}
        isTie={isTie}
        tiedPlayerNames={tiedPlayerNames}
        onClose={() => { setWinnerName(null); setIsTie(false) }}
        onNewGameSamePlayers={newGameSamePlayers}
        onNewGameNewPlayers={newGameNewPlayers}
        newGameSameLabel={tr('winner.newGameSame')}
        newGameNewLabel={tr('winner.newGameNew')}
        tieMessage={tr('winner.tie')}
        winsMessage={winnerName ? tr('winner.wins', { name: winnerName }) : ''}
      />

      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl sm:text-2xl font-bold truncate">{tr('app.title')}</h1>
          <div className="flex items-center gap-2">
            {/*
              #51 — until the user opens the card-values legend for the
              first time, render the icon button with a text label so
              first-time players can find the Primiera scoring legend.
              Once tapped (legend opens), the label collapses to icon-only.
            */}
            <Button
              variant="outline"
              size={seenCardValuesTip ? 'icon' : 'sm'}
              onClick={() => {
                setCardValuesOpen(true)
                if (!seenCardValuesTip) markCardValuesTipSeen()
              }}
              title={tr('cardValues.title')}
              aria-label={tr('a11y.cardValues')}
              className={seenCardValuesTip ? 'h-11 w-11' : 'h-11 px-3'}
            >
              <Key size={20} aria-hidden="true" />
              {!seenCardValuesTip && (
                <span className="ml-1.5 text-sm">{tr('onboarding.cardValuesLabel')}</span>
              )}
            </Button>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                aria-label={tr('a11y.gameMenu')}
                className="h-11 w-11"
              >
                <List size={20} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => {
                setActiveGameId(null)
                resetSetup()
              }}>
                {tr('menu.newGame')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPlayersScreenOpen(true)}>
                {tr('menu.players')}
              </DropdownMenuItem>
              {games.length > 1 && (
                <DropdownMenuItem onClick={() => setOpenGamesOpen(true)}>
                  {tr('menu.openGames')} ({games.length})
                </DropdownMenuItem>
              )}
              {completedGames.length > 0 && (
                <DropdownMenuItem onClick={() => setHistoryOpen(true)}>
                  {tr('menu.history')}
                </DropdownMenuItem>
              )}
              {completedGames.length > 0 && (
                <DropdownMenuItem onClick={() => setStatisticsOpen(true)}>
                  {tr('menu.statistics')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setAboutOpen(true)}>
                {tr('menu.about')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={hapticsOn}
                onCheckedChange={toggleHaptics}
                onSelect={e => e.preventDefault()}
              >
                {tr('menu.haptics')}
              </DropdownMenuCheckboxItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{tr('menu.language')}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {LANGUAGES.map(lang => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => setLanguage(lang.code)}
                    >
                      {lang.name}
                      {language === lang.code && <Check size={16} className="ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>{tr('menu.theme')}</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {(['system', 'light', 'dark'] as const).map(t => (
                    <DropdownMenuItem key={t} onClick={() => setTheme(t)}>
                      {tr(`theme.${t}`)}
                      {theme === t && <Check size={16} className="ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openRenameDialog}>
                {tr('menu.rename')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={resetScores}>
                {tr('menu.reset')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={dataPortability.onExport}>
                {tr('menu.exportData')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={dataPortability.onImport}>
                {tr('menu.importData')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={openSupportPage}
                className="text-muted-foreground"
              >
                <Heart size={14} aria-hidden="true" className="mr-1.5" />
                {tr('support.menu')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={endGame}
                className="text-destructive focus:text-destructive"
              >
                {tr('menu.endGame')}
              </DropdownMenuItem>
            </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
          {players.map(player => (
            <Card key={player.id} className="p-2 text-center">
              <div
                className="text-xs sm:text-sm font-medium truncate flex items-center justify-center gap-1 text-profile"
                style={{ '--profile-color': player.color } as React.CSSProperties}
              >
                <span aria-hidden="true">{player.emoji}</span>
                <span className="truncate">{player.name}</span>
              </div>
              <div className="text-4xl sm:text-5xl font-bold text-primary leading-tight">
                {player.totalScore}
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-3 sm:p-4 mb-3">
          <h3 className="font-bold mb-3 text-sm">{tr('game.handAwards')}</h3>
          <div className="grid gap-4">
            <div>
              <Label className="text-xs mb-2 block font-semibold">
                {tr('game.scopa')} <span className="font-normal text-muted-foreground">({tr('game.scopaDesc')})</span>
              </Label>
              <div className="grid gap-2">
                {players.map(player => (
                  <div key={player.id} className="flex items-center justify-between">
                    <span
                      className="text-sm font-medium flex items-center gap-1 text-profile"
                      style={{ '--profile-color': player.color } as React.CSSProperties}
                    >
                      <span aria-hidden="true">{player.emoji}</span>
                      <span>{player.name}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => adjustScopa(player.id, -1)}
                        aria-label={tr('a11y.scopaDecrement', { player: player.name })}
                        className="h-11 w-11"
                      >
                        <Minus size={16} aria-hidden="true" />
                      </Button>
                      <span
                        className="w-8 text-center font-semibold text-sm"
                        aria-label={tr('game.scopa') + ': ' + (activeGame.handScopaScores[player.id] || 0)}
                      >
                        {activeGame.handScopaScores[player.id] || 0}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => adjustScopa(player.id, 1)}
                        aria-label={tr('a11y.scopaIncrement', { player: player.name })}
                        className="h-11 w-11"
                      >
                        <Plus size={16} aria-hidden="true" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2 block font-semibold">
                {tr('game.cards')} <span className="font-normal text-muted-foreground">({tr('game.cardsDesc')})</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <PlayerButton key={p.id} player={p} category="cards" isSelected={activeGame.handCardsWinner === p.id} onClick={() => setHandWinner('cards', p.id)} />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2 block font-semibold">
                {tr('game.coins')} <span className="font-normal text-muted-foreground">({tr('game.coinsDesc')})</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <PlayerButton key={p.id} player={p} category="coins" isSelected={activeGame.handCoinsWinner === p.id} onClick={() => setHandWinner('coins', p.id)} />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2 block font-semibold">
                {tr('game.settebello')} <span className="font-normal text-muted-foreground">({tr('game.settebelloDesc')})</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <PlayerButton key={p.id} player={p} category="settebello" isSelected={activeGame.handSettebelloWinner === p.id} onClick={() => setHandWinner('settebello', p.id)} />
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold">{tr('game.primiera')}</Label>
                <Button variant="outline" size="sm" onClick={() => setPremieraOpen(true)}>
                  <Calculator className="mr-1" size={14} />
                  {tr('game.calculate')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <PlayerButton key={p.id} player={p} category="premiera" isSelected={activeGame.handPremieraWinner === p.id} onClick={() => setHandWinner('premiera', p.id)} />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Button onClick={bankHand} size="lg" className="w-full mb-4">
          {tr('game.bankHand')}
        </Button>

        {activeGame.handHistory.length > 0 && (
          <Card className="p-3 sm:p-4">
            <h3 className="font-bold mb-2 text-sm">{tr('game.handHistory')}</h3>
            <Suspense fallback={null}>
              <HandChart
                players={players.map(p => ({ id: p.id, name: p.name }))}
                handHistory={activeGame.handHistory}
                tr={tr}
              />
            </Suspense>
            <div className="space-y-2 mt-4">
              {activeGame.handHistory.slice().reverse().map(entry => (
                <div key={entry.handNumber} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <div className="font-semibold text-xs min-w-[50px]">
                    {tr('game.hand')} {entry.handNumber}
                  </div>
                  <div className="flex-1 text-xs">
                    {players.map(p => {
                      const points = entry.scores[p.id] || 0
                      if (points === 0) return null
                      const cat = entry.categories?.[p.id]
                      const details = cat ? [
                        cat.cards && tr('category.cards'),
                        cat.coins && tr('category.coins'),
                        cat.settebello && tr('category.settebello'),
                        cat.premiera && tr('category.primiera'),
                        cat.scopa > 0 && `${tr('category.scopa')} x${cat.scopa}`,
                      ].filter(Boolean).join(', ') : ''
                      return (
                        <div key={p.id} className="text-muted-foreground">
                          <span
                            style={{ '--profile-color': p.color } as React.CSSProperties}
                            className="font-medium text-profile"
                          >
                            {p.emoji} {p.name}
                          </span>
                          {': '}
                          <span className="font-semibold text-foreground">
                            {points} {points === 1 ? tr('game.pt') : tr('game.pts')}
                          </span>
                          {details && <span className="text-muted-foreground ml-1">({details})</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/*
        Lazy-loaded dialogs (gameplay screen). Same pattern as the setup
        tree above — each chunk loads only when the user opens it.
      */}
      <Suspense fallback={null}>
        {premieraOpen && (
          <PremieraCalc open={premieraOpen} onOpenChange={setPremieraOpen} tr={tr} />
        )}
        {cardValuesOpen && (
          <CardValuesLegend open={cardValuesOpen} onOpenChange={setCardValuesOpen} tr={tr} />
        )}
      </Suspense>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr('rename.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4">
            {renameTempNames.map((name, idx) => (
              <div key={idx}>
                <Label className="text-sm mb-2 block">{tr('setup.playerPlaceholder', { n: String(idx + 1) })}</Label>
                <Input
                  value={name}
                  onFocus={e => e.target.select()}
                  onChange={e => {
                    const newNames = [...renameTempNames]
                    newNames[idx] = e.target.value
                    setRenameTempNames(newNames)
                  }}
                />
              </div>
            ))}
            <div className="flex gap-3 pt-3">
              <Button onClick={saveRenamedPlayers} className="flex-1">{tr('rename.save')}</Button>
              <Button variant="outline" onClick={() => setRenameOpen(false)}>{tr('rename.cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        {historyOpen && (
          <HistoryScreen
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            completedGames={completedGames}
            profiles={profiles}
            language={language}
            tr={tr}
          />
        )}
        {statisticsOpen && (
          <StatisticsScreen
            open={statisticsOpen}
            onOpenChange={setStatisticsOpen}
            completedGames={completedGames}
            tr={tr}
          />
        )}
        {playersScreenOpen && (
          <PlayersScreen
            open={playersScreenOpen}
            onOpenChange={setPlayersScreenOpen}
            profiles={profiles}
            tr={tr}
          />
        )}
        {aboutOpen && (
          <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} tr={tr} language={language} />
        )}
      </Suspense>

      {dataPortability.element}

      {/* Screen-reader-only live region (#46). Updated whenever a hand is
        banked, so AT users hear the score change without having to navigate
        the score cards. Visually hidden via sr-only. */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" role="status">
        {liveAnnouncement}
      </div>

      <Dialog open={openGamesOpen} onOpenChange={setOpenGamesOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tr('menu.openGames')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {games.filter(g => g.id !== activeGameId).length === 0 && (
              <p className="text-sm text-muted-foreground">{tr('games.noOtherGames')}</p>
            )}
            {games.map(g => (
              <Card
                key={g.id}
                className={`p-3 cursor-pointer transition-colors hover:bg-muted ${g.id === activeGameId ? 'ring-2 ring-primary' : ''}`}
                onClick={() => switchGame(g.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {g.players.map(p => p.name).join(` ${tr('games.vs')} `)}
                  </div>
                  {g.id === activeGameId && (
                    <span className="text-xs text-primary font-medium">{tr('games.current')}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {g.players.map(p => `${p.name}: ${p.totalScore}`).join(' | ')}
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
