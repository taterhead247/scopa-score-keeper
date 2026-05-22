import { useState } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Minus, Calculator, List, Check, Key, UsersThree } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { t, LANGUAGES } from '@/i18n'
import { WinnerOverlay } from '@/components/WinnerOverlay'
import { PremieraCalc } from '@/components/PremieraCalc'
import { HandChart } from '@/components/HandChart'
import { CardValuesLegend } from '@/components/CardValuesLegend'
import { PlayersScreen } from '@/components/PlayersScreen'
import { ProfilePicker, ProfileSeatButton } from '@/components/ProfilePicker'
import {
  type PlayerProfile,
  PROFILES_STORAGE_KEY,
  PROFILE_COLORS,
} from '@/lib/profiles'

// ── Types ──────────────────────────────────────────────

type Player = {
  id: string
  profileId: string
  name: string
  color: string
  emoji: string
  totalScore: number
}

type HandCategoryDetail = {
  cards: boolean
  coins: boolean
  settebello: boolean
  premiera: boolean
  scopa: number
}

type HandHistoryEntry = {
  handNumber: number
  scores: Record<string, number>
  categories: Record<string, HandCategoryDetail>
  timestamp: number
}

type Game = {
  id: string
  players: Player[]
  handScopaScores: Record<string, number>
  handCardsWinner: string | null
  handCoinsWinner: string | null
  handSettebelloWinner: string | null
  handPremieraWinner: string | null
  handHistory: HandHistoryEntry[]
  createdAt: number
}

type CompletedGame = {
  id: string
  players: { name: string; score: number; profileId: string; color: string; emoji: string }[]
  winnerName: string
  completedAt: number
}

// ── Helpers ────────────────────────────────────────────

function makeId() {
  return `game-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function freshScopaScores(players: Player[]): Record<string, number> {
  const s: Record<string, number> = {}
  players.forEach(p => { s[p.id] = 0 })
  return s
}

// ── App ────────────────────────────────────────────────

export default function App() {
  // Persistent state
  const [games, setGames] = useLocalStorage<Game[]>('scopa-games', [])
  const [activeGameId, setActiveGameId] = useLocalStorage<string | null>('scopa-active-game-id', null)
  const [completedGames, setCompletedGames] = useLocalStorage<CompletedGame[]>('scopa-completed-games', [])
  const [language, setLanguage] = useLocalStorage<string>('scopa-language', 'en')
  const [profiles, setProfiles] = useLocalStorage<PlayerProfile[]>(PROFILES_STORAGE_KEY, [])

  // Setup state
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

  // Winner state
  const [winnerName, setWinnerName] = useState<string | null>(null)
  const [isTie, setIsTie] = useState(false)
  const [tiedPlayerNames, setTiedPlayerNames] = useState<string[]>([])

  // Translation helper
  const tr = (key: string, params?: Record<string, string>) => t(key, language, params)

  // Active game derived
  const activeGame = games.find(g => g.id === activeGameId) ?? null
  const gameStarted = activeGame !== null

  // Update active game helper
  const updateGame = (updater: (game: Game) => Game) => {
    setGames(prev => prev.map(g => g.id === activeGameId ? updater(g) : g))
  }

  // ── Setup ────────────────────────────────────────────

  const profileById = (id: string | null) =>
    id ? profiles.find(p => p.id === id) ?? null : null

  const changePlayerCount = (count: number) => {
    setPlayerCount(count)
    setSelectedProfileIds(prev => Array.from({ length: count }, (_, i) => prev[i] ?? null))
  }

  const resetSetup = () => {
    setPlayerCount(2)
    setSelectedProfileIds([null, null])
  }

  const assignProfileToSeat = (seatIndex: number, profileId: string) => {
    setSelectedProfileIds(prev => {
      const next = [...prev]
      next[seatIndex] = profileId
      return next
    })
    setPickerSeat(null)
  }

  const allSeatsFilled =
    selectedProfileIds.length === playerCount &&
    selectedProfileIds.every(id => id !== null && profiles.some(p => p.id === id))

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
    setGames(prev => [...prev, newGame])
    setActiveGameId(newGame.id)
  }

  // ── Game actions ─────────────────────────────────────

  const bankHand = () => {
    if (!activeGame) return
    const { players } = activeGame

    const handScores: Record<string, number> = {}
    const categories: Record<string, HandCategoryDetail> = {}

    players.forEach(p => {
      const scopa = activeGame.handScopaScores[p.id] || 0
      let score = scopa
      const cat: HandCategoryDetail = {
        cards: false,
        coins: false,
        settebello: false,
        premiera: false,
        scopa,
      }

      if (activeGame.handCardsWinner === p.id) { score += 1; cat.cards = true }
      if (activeGame.handCoinsWinner === p.id) { score += 1; cat.coins = true }
      if (activeGame.handSettebelloWinner === p.id) { score += 1; cat.settebello = true }
      if (activeGame.handPremieraWinner === p.id) { score += 1; cat.premiera = true }

      handScores[p.id] = score
      categories[p.id] = cat
    })

    const updatedPlayers = players.map(p => ({
      ...p,
      totalScore: p.totalScore + (handScores[p.id] || 0),
    }))

    const newEntry: HandHistoryEntry = {
      handNumber: activeGame.handHistory.length + 1,
      scores: handScores,
      categories,
      timestamp: Date.now(),
    }

    const updatedGame: Game = {
      ...activeGame,
      players: updatedPlayers,
      handScopaScores: freshScopaScores(updatedPlayers),
      handCardsWinner: null,
      handCoinsWinner: null,
      handSettebelloWinner: null,
      handPremieraWinner: null,
      handHistory: [...activeGame.handHistory, newEntry],
    }

    setGames(prev => prev.map(g => g.id === activeGameId ? updatedGame : g))

    // Check for winner / tie (>= 11)
    const playersOver11 = updatedPlayers.filter(p => p.totalScore >= 11)
    if (playersOver11.length > 0) {
      const maxScore = Math.max(...playersOver11.map(p => p.totalScore))
      const topPlayers = playersOver11.filter(p => p.totalScore === maxScore)

      if (topPlayers.length === 1) {
        setWinnerName(topPlayers[0].name)
        setIsTie(false)
        setCompletedGames(prev => [...prev, {
          id: makeId(),
          players: updatedPlayers.map(p => ({
            name: p.name,
            score: p.totalScore,
            profileId: p.profileId,
            color: p.color,
            emoji: p.emoji,
          })),
          winnerName: topPlayers[0].name,
          completedAt: Date.now(),
        }])
      } else {
        setIsTie(true)
        setTiedPlayerNames(topPlayers.map(p => p.name))
        toast.info(tr('winner.tie'))
      }
    } else {
      toast.success(tr('toast.handBanked'))
    }
  }

  const adjustScopa = (playerId: string, delta: number) => {
    updateGame(game => ({
      ...game,
      handScopaScores: {
        ...game.handScopaScores,
        [playerId]: Math.max(0, (game.handScopaScores[playerId] || 0) + delta),
      },
    }))
  }

  const setHandWinner = (category: 'cards' | 'coins' | 'settebello' | 'premiera', playerId: string | null) => {
    updateGame(game => {
      const key = `hand${category.charAt(0).toUpperCase() + category.slice(1)}Winner` as
        'handCardsWinner' | 'handCoinsWinner' | 'handSettebelloWinner' | 'handPremieraWinner'
      const newValue = game[key] === playerId ? null : playerId
      return { ...game, [key]: newValue }
    })
  }

  const resetScores = () => {
    updateGame(game => ({
      ...game,
      players: game.players.map(p => ({ ...p, totalScore: 0 })),
      handScopaScores: freshScopaScores(game.players),
      handCardsWinner: null,
      handCoinsWinner: null,
      handSettebelloWinner: null,
      handPremieraWinner: null,
      handHistory: [],
    }))
    toast.success(tr('toast.gameReset'))
  }

  const endGame = () => {
    setGames(prev => prev.filter(g => g.id !== activeGameId))
    setActiveGameId(null)
    resetSetup()
    toast.success(tr('toast.gameEnded'))
  }

  const switchGame = (gameId: string) => {
    setActiveGameId(gameId)
    setOpenGamesOpen(false)
  }

  const newGameSamePlayers = () => {
    if (!activeGame) return
    setGames(prev => prev.filter(g => g.id !== activeGameId))
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
    setGames(prev => [...prev, newGame])
    setActiveGameId(newGame.id)
    setWinnerName(null)
    setIsTie(false)
  }

  const newGameNewPlayers = () => {
    setGames(prev => prev.filter(g => g.id !== activeGameId))
    setActiveGameId(null)
    resetSetup()
    setWinnerName(null)
    setIsTie(false)
  }

  // ── Rename ───────────────────────────────────────────

  const openRenameDialog = () => {
    if (!activeGame) return
    setRenameTempNames(activeGame.players.map(p => p.name))
    setRenameOpen(true)
  }

  const saveRenamedPlayers = () => {
    updateGame(game => ({
      ...game,
      players: game.players.map((p, idx) => ({
        ...p,
        name: renameTempNames[idx] || p.name,
      })),
    }))
    setRenameOpen(false)
    toast.success(tr('toast.namesUpdated'))
  }

  // ── Player button component (#18) ────────────────────

  const PlayerButton = ({
    player,
    isSelected,
    onClick,
  }: {
    player: Player
    isSelected: boolean
    onClick: () => void
  }) => {
    const color = player.color || PROFILE_COLORS[0]
    return (
      <button
        onClick={onClick}
        className="px-3 py-1.5 rounded-md border-2 font-medium text-sm transition-colors flex items-center gap-1.5"
        style={{
          backgroundColor: isSelected ? color : 'transparent',
          borderColor: color,
          color: isSelected ? '#ffffff' : color,
        }}
      >
        <span>{player.emoji}</span>
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
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-3xl font-bold text-center mb-6">{tr('app.title')}</h1>
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

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{tr('menu.language')}:</span>
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => setLanguage(lang.code)}
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
            <Button onClick={startGame} disabled={!allSeatsFilled} className="w-full" size="lg">
              {tr('setup.startGame')}
            </Button>
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
          setProfiles={setProfiles}
          takenIds={takenIds}
          onPick={profileId => {
            if (pickerSeat !== null) assignProfileToSeat(pickerSeat, profileId)
          }}
          tr={tr}
        />

        <PlayersScreen
          open={playersScreenOpen}
          onOpenChange={setPlayersScreenOpen}
          profiles={profiles}
          setProfiles={setProfiles}
          tr={tr}
        />
      </div>
    )
  }

  // ── Game screen ──────────────────────────────────────

  const { players } = activeGame

  return (
    <div className="min-h-screen bg-background p-3 sm:p-4">
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
            <Button variant="outline" size="icon" onClick={() => setCardValuesOpen(true)} title={tr('cardValues.title')}>
              <Key size={20} />
            </Button>
            <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <List size={20} />
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
              <DropdownMenuSeparator />
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={openRenameDialog}>
                {tr('menu.rename')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={resetScores}>
                {tr('menu.reset')}
              </DropdownMenuItem>
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
                className="text-xs sm:text-sm font-medium truncate flex items-center justify-center gap-1"
                style={{ color: player.color }}
              >
                <span>{player.emoji}</span>
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
                    <span className="text-sm font-medium flex items-center gap-1" style={{ color: player.color }}>
                      <span>{player.emoji}</span>
                      <span>{player.name}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => adjustScopa(player.id, -1)}>
                        <Minus size={14} />
                      </Button>
                      <span className="w-8 text-center font-semibold text-sm">
                        {activeGame.handScopaScores[player.id] || 0}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => adjustScopa(player.id, 1)}>
                        <Plus size={14} />
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
                  <PlayerButton key={p.id} player={p} isSelected={activeGame.handCardsWinner === p.id} onClick={() => setHandWinner('cards', p.id)} />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2 block font-semibold">
                {tr('game.coins')} <span className="font-normal text-muted-foreground">({tr('game.coinsDesc')})</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <PlayerButton key={p.id} player={p} isSelected={activeGame.handCoinsWinner === p.id} onClick={() => setHandWinner('coins', p.id)} />
                ))}
              </div>
            </div>

            <div>
              <Label className="text-xs mb-2 block font-semibold">
                {tr('game.settebello')} <span className="font-normal text-muted-foreground">({tr('game.settebelloDesc')})</span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {players.map(p => (
                  <PlayerButton key={p.id} player={p} isSelected={activeGame.handSettebelloWinner === p.id} onClick={() => setHandWinner('settebello', p.id)} />
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
                  <PlayerButton key={p.id} player={p} isSelected={activeGame.handPremieraWinner === p.id} onClick={() => setHandWinner('premiera', p.id)} />
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
            <HandChart
              players={players.map(p => ({ id: p.id, name: p.name }))}
              handHistory={activeGame.handHistory}
              tr={tr}
            />
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
                          <span style={{ color: p.color }} className="font-medium">
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

      <PremieraCalc open={premieraOpen} onOpenChange={setPremieraOpen} tr={tr} />

      <CardValuesLegend open={cardValuesOpen} onOpenChange={setCardValuesOpen} tr={tr} />

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

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{tr('menu.history')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {completedGames.length === 0 && (
              <p className="text-sm text-muted-foreground">{tr('history.noGames')}</p>
            )}
            {completedGames.slice().reverse().map(game => (
              <Card key={game.id} className="p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-sm">🏆 {game.winnerName}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(game.completedAt).toLocaleDateString(language === 'it' ? 'it-IT' : 'en-US', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {game.players.map(p => `${p.name} (${p.score})`).join(', ')}
                </div>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <PlayersScreen
        open={playersScreenOpen}
        onOpenChange={setPlayersScreenOpen}
        profiles={profiles}
        setProfiles={setProfiles}
        tr={tr}
      />

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
    </div>
  )
}
