import { useState } from 'react'
import { useLocalStorage } from '@/hooks/use-local-storage'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Plus, Minus, Calculator, ArrowsClockwise, PencilSimple } from '@phosphor-icons/react'
import { toast } from 'sonner'

type Player = {
  id: string
  name: string
  totalScore: number
}

type PremieraCard = {
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
  value: number | null
}

type HandHistoryEntry = {
  handNumber: number
  scores: Record<string, number>
  timestamp: number
}

const CARD_VALUES = [7, 6, 1, 5, 4, 3, 2, 10, 9, 8]
const PRIMIERA_POINTS: Record<number, number> = {
  7: 21,
  6: 18,
  1: 16,
  5: 15,
  4: 14,
  3: 13,
  2: 12,
  10: 10,
  9: 10,
  8: 10
}
const STORAGE_KEYS = [
  'scopa-players',
  'scopa-hand-scopa',
  'scopa-hand-cards',
  'scopa-hand-coins',
  'scopa-hand-settebello',
  'scopa-hand-premiera',
  'scopa-hand-history',
  'scopa-player-count',
  'scopa-player-names',
  'scopa-premiera-open',
  'scopa-premiera-cards'
]
const CONFETTI_COLORS = ['#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7']

const SUIT_LABELS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
}

export default function App() {
  const [players, setPlayers] = useLocalStorage<Player[]>('scopa-players', [])
  const [handScopaScores, setHandScopaScores] = useLocalStorage<Record<string, number>>('scopa-hand-scopa', {})
  const [handCardsWinner, setHandCardsWinner] = useLocalStorage<string | null>('scopa-hand-cards', null)
  const [handCoinsWinner, setHandCoinsWinner] = useLocalStorage<string | null>('scopa-hand-coins', null)
  const [handSettebelloWinner, setHandSettebelloWinner] = useLocalStorage<string | null>('scopa-hand-settebello', null)
  const [handPremieraWinner, setHandPremieraWinner] = useLocalStorage<string | null>('scopa-hand-premiera', null)
  const [handHistory, setHandHistory] = useLocalStorage<HandHistoryEntry[]>('scopa-hand-history', [])
  
  const [playerCount, setPlayerCount] = useLocalStorage<number>('scopa-player-count', 2)
  const [tempPlayerNames, setTempPlayerNames] = useLocalStorage<string[]>('scopa-player-names', ['Player 1', 'Player 2'])
  
  const gameStarted = (players && players.length > 0) || false
  
  const [premieraOpen, setPremieraOpen] = useLocalStorage<boolean>('scopa-premiera-open', false)
  const [premieraCards, setPremieraCards] = useLocalStorage<Record<string, PremieraCard[]>>('scopa-premiera-cards', {})
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTempNames, setRenameTempNames] = useState<string[]>([])
  const [confettiBurstId, setConfettiBurstId] = useState<number | null>(null)

  const triggerConfetti = () => {
    const burstId = Date.now()
    setConfettiBurstId(burstId)
    window.setTimeout(() => {
      setConfettiBurstId((current) => (current === burstId ? null : current))
    }, 2300)
  }

  const startGame = () => {
    const newPlayers: Player[] = tempPlayerNames.map((name, idx) => ({
      id: `player-${idx}`,
      name: name || `Player ${idx + 1}`,
      totalScore: 0
    }))
    setPlayers(newPlayers)

    const initialScopa: Record<string, number> = {}
    newPlayers.forEach(p => {
      initialScopa[p.id] = 0
    })
    setHandScopaScores(initialScopa)
    setHandCardsWinner(null)
    setHandCoinsWinner(null)
    setHandSettebelloWinner(null)
    setHandPremieraWinner(null)
    setHandHistory([])
    setPremieraOpen(false)
  }

  const bankHand = () => {
    if (!players || players.length === 0) return

    const handScores: Record<string, number> = {}
    players.forEach((p) => {
      handScores[p.id] = handScopaScores?.[p.id] || 0
    })

    if (handCardsWinner) handScores[handCardsWinner] = (handScores[handCardsWinner] || 0) + 1
    if (handCoinsWinner) handScores[handCoinsWinner] = (handScores[handCoinsWinner] || 0) + 1
    if (handSettebelloWinner) handScores[handSettebelloWinner] = (handScores[handSettebelloWinner] || 0) + 1
    if (handPremieraWinner) handScores[handPremieraWinner] = (handScores[handPremieraWinner] || 0) + 1

    const updatedPlayers = players.map((p) => ({
      ...p,
      totalScore: p.totalScore + (handScores[p.id] || 0)
    }))
    setPlayers(updatedPlayers)

    setHandHistory((currentHistory) => {
      const newEntry = {
        handNumber: (currentHistory?.length || 0) + 1,
        scores: handScores,
        timestamp: Date.now()
      }
      return currentHistory ? [...currentHistory, newEntry] : [newEntry]
    })

    const resetScopa: Record<string, number> = {}
    players.forEach((p) => {
      resetScopa[p.id] = 0
    })

    setHandScopaScores(resetScopa)
    setHandCardsWinner(null)
    setHandCoinsWinner(null)
    setHandSettebelloWinner(null)
    setHandPremieraWinner(null)

    const winners = updatedPlayers.filter((p) => p.totalScore > 11)
    if (winners.length > 0) {
      triggerConfetti()
      const names = winners.map((p) => p.name).join(', ')
      toast.success(`${names} won the game!`)
    } else {
      toast.success('Hand banked!')
    }
  }

  const adjustScopa = (playerId: string, delta: number) => {
    setHandScopaScores(prev => {
      if (!prev) return { [playerId]: Math.max(0, delta) }
      return {
        ...prev,
        [playerId]: Math.max(0, (prev[playerId] || 0) + delta)
      }
    })
  }

  const resetGame = () => {
    setPlayers((currentPlayers) => {
      if (!currentPlayers || currentPlayers.length === 0) return []
      
      const resetScopa: Record<string, number> = {}
      currentPlayers.forEach(p => {
        resetScopa[p.id] = 0
      })
      setHandScopaScores(resetScopa)
      return currentPlayers.map(p => ({
        ...p,
        totalScore: 0
      }))
    })
    
    setHandCardsWinner(null)
    setHandCoinsWinner(null)
    setHandSettebelloWinner(null)
    setHandPremieraWinner(null)
    setHandHistory([])
    setPremieraOpen(false)
    setPremieraCards({})
    
    toast.success('Game reset')
  }

  const endGame = () => {
    if (typeof window !== 'undefined') {
      STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key))
    }

    setPlayers([])
    setHandScopaScores({})
    setHandCardsWinner(null)
    setHandCoinsWinner(null)
    setHandSettebelloWinner(null)
    setHandPremieraWinner(null)
    setHandHistory([])
    setPlayerCount(2)
    setTempPlayerNames(['Player 1', 'Player 2'])
    setPremieraOpen(false)
    setPremieraCards({})
    setRenameOpen(false)
    setRenameTempNames([])

    toast.success('Game ended')
  }

  const openPremieraCalculator = () => {
    if (!players || players.length === 0) return
    
    const initialCards: Record<string, PremieraCard[]> = {}
    players.forEach(p => {
      initialCards[p.id] = [
        { suit: 'hearts', value: null },
        { suit: 'diamonds', value: null },
        { suit: 'clubs', value: null },
        { suit: 'spades', value: null }
      ]
    })
    setPremieraCards(initialCards)
    setPremieraOpen(true)
  }

  const updatePremieraCard = (playerId: string, suitIndex: number, value: number | null) => {
    setPremieraCards(prev => ({
      ...prev,
      [playerId]: prev[playerId].map((card, idx) => 
        idx === suitIndex ? { ...card, value } : card
      )
    }))
  }

  const calculatePremieraForPlayer = (playerId: string): number => {
    const cards = premieraCards[playerId]
    if (!cards) return 0
    
    return cards.reduce((sum, card) => {
      if (card.value === null) return sum
      return sum + (PRIMIERA_POINTS[card.value] || 0)
    }, 0)
  }

  const allPremieraCardsSelected = (): boolean => {
    if (!players || players.length === 0) return false
    return players.every(p => {
      const cards = premieraCards[p.id]
      return cards && cards.every(c => c.value !== null)
    })
  }

  const awardPremiera = () => {
    if (!players || players.length === 0) return
    const scores: Array<{ playerId: string, score: number, name: string }> = players.map(p => ({
      playerId: p.id,
      score: calculatePremieraForPlayer(p.id),
      name: p.name
    }))

    scores.sort((a, b) => b.score - a.score)
    if (scores.length < 2) {
      setPremieraOpen(false)
      return
    }
    
    if (scores[0].score > scores[1].score) {
      setHandPremieraWinner(scores[0].playerId)
      toast.success(`${scores[0].name} wins Primiera!`)
    } else {
      toast.info("It's a tie - no points awarded")
    }

    setPremieraOpen(false)
  }

  const changePlayerCount = (count: number) => {
    setPlayerCount(count)
    const newNames = Array.from({ length: count }, (_, i) => 
      tempPlayerNames[i] || `Player ${i + 1}`
    )
    setTempPlayerNames(newNames)
  }

  const openRenameDialog = () => {
    if (!players) return
    setRenameTempNames(players.map(p => p.name))
    setRenameOpen(true)
  }

  const saveRenamedPlayers = () => {
    setPlayers((currentPlayers) => {
      if (!currentPlayers) return []
      return currentPlayers.map((p, idx) => ({
        ...p,
        name: renameTempNames[idx] || p.name
      }))
    })
    setRenameOpen(false)
    toast.success('Player names updated')
  }

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6">
          <h1 className="text-3xl font-bold text-center mb-6">Scopa Score Tracker</h1>
          
          <div className="space-y-6">
            <div>
              <Label className="text-base font-semibold mb-3 block">Number of Players</Label>
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
              <Label className="text-base font-semibold mb-3 block">Player Names</Label>
              <div className="space-y-2">
                {tempPlayerNames.map((name, idx) => (
                  <Input
                    key={idx}
                    placeholder={`Player ${idx + 1}`}
                    value={name}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const newNames = [...tempPlayerNames]
                      newNames[idx] = e.target.value
                      setTempPlayerNames(newNames)
                    }}
                  />
                ))}
              </div>
            </div>

            <Button onClick={startGame} className="w-full" size="lg">
              Start Game
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4">
      {confettiBurstId && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 120 }).map((_, idx) => {
            const left = `${Math.random() * 100}%`
            const delay = `${Math.random() * 0.3}s`
            const duration = `${1.6 + Math.random() * 1.1}s`
            const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
            const size = 6 + Math.floor(Math.random() * 8)
            const rotation = `${Math.floor(Math.random() * 360)}deg`

            return (
              <span
                key={`${confettiBurstId}-${idx}`}
                className="confetti-piece"
                style={{
                  left,
                  animationDelay: delay,
                  animationDuration: duration,
                  backgroundColor: color,
                  width: `${size}px`,
                  height: `${Math.max(4, Math.floor(size * 0.45))}px`,
                  transform: `rotate(${rotation})`
                }}
              />
            )
          })}
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-bold">Scopa Score Tracker</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={openRenameDialog}>
              <PencilSimple className="mr-2" />
              Rename
            </Button>
            <Button variant="outline" size="sm" onClick={resetGame}>
              <ArrowsClockwise className="mr-2" />
              Reset
            </Button>
            <Button variant="destructive" size="sm" onClick={endGame}>
              End Game
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
          {players?.map(player => (
            <Card key={player.id} className="p-3">
              <div className="text-sm font-medium mb-1">{player.name}</div>
              <div className="text-2xl font-bold text-primary">{player.totalScore}</div>
            </Card>
          ))}
        </div>

        <Card className="p-4 mb-4">
          <h3 className="font-bold mb-3">Hand Awards (1 point each)</h3>
          <div className="grid gap-4">
            <div>
              <Label className="text-sm mb-2 block font-semibold">Cards (Most cards)</Label>
              <RadioGroup value={handCardsWinner || ''} onValueChange={setHandCardsWinner}>
                <div className="grid gap-2">
                  {players?.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={p.id} id={`cards-${p.id}`} />
                      <Label htmlFor={`cards-${p.id}`} className="cursor-pointer flex-1">{p.name}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block font-semibold">Coins (Most diamonds)</Label>
              <RadioGroup value={handCoinsWinner || ''} onValueChange={setHandCoinsWinner}>
                <div className="grid gap-2">
                  {players?.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={p.id} id={`coins-${p.id}`} />
                      <Label htmlFor={`coins-${p.id}`} className="cursor-pointer flex-1">{p.name}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-2 block font-semibold">Settebello (7 of diamonds)</Label>
              <RadioGroup value={handSettebelloWinner || ''} onValueChange={setHandSettebelloWinner}>
                <div className="grid gap-2">
                  {players?.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={p.id} id={`settebello-${p.id}`} />
                      <Label htmlFor={`settebello-${p.id}`} className="cursor-pointer flex-1">{p.name}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-semibold">Primiera</Label>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={openPremieraCalculator}
                >
                  <Calculator className="mr-2" />
                  Calculate
                </Button>
              </div>
              <RadioGroup value={handPremieraWinner || ''} onValueChange={setHandPremieraWinner}>
                <div className="grid gap-2">
                  {players?.map(p => (
                    <div key={p.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={p.id} id={`premiera-${p.id}`} />
                      <Label htmlFor={`premiera-${p.id}`} className="cursor-pointer flex-1">{p.name}</Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>
            </div>

            <div>
              <Label className="text-sm mb-3 block font-semibold">Scopa (per player)</Label>
              <div className="grid gap-3">
                {players?.map(player => (
                  <div key={player.id} className="flex items-center justify-between">
                    <Label className="text-sm">{player.name}:</Label>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => adjustScopa(player.id, -1)}
                      >
                        <Minus />
                      </Button>
                      <span className="w-8 text-center font-semibold">{handScopaScores?.[player.id] || 0}</span>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => adjustScopa(player.id, 1)}
                      >
                        <Plus />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Button onClick={bankHand} size="lg" className="w-full mb-6">
          Bank Hand
        </Button>

        {handHistory && handHistory.length > 0 && (
          <Card className="p-4">
            <h3 className="font-bold mb-3">Hand History</h3>
            <div className="space-y-2">
              {handHistory.slice().reverse().map((entry) => (
                <div key={entry.handNumber} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <div className="font-semibold text-sm min-w-[60px]">Hand {entry.handNumber}</div>
                  <div className="flex-1 text-sm">
                    {players?.map(p => {
                      const points = entry.scores[p.id] || 0
                      if (points === 0) return null
                      return (
                        <div key={p.id} className="text-muted-foreground">
                          {p.name}: <span className="font-semibold text-foreground">{points} {points === 1 ? 'pt' : 'pts'}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Sheet open={premieraOpen} onOpenChange={setPremieraOpen}>
          <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Primiera Calculator</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              {players?.map(player => (
                <Card key={player.id} className="p-4">
                  <h3 className="font-bold mb-3">{player.name}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {premieraCards[player.id]?.map((card, idx) => (
                      <div key={idx}>
                        <Label className="text-sm mb-2 block">
                          {SUIT_LABELS[card.suit]} {card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}
                        </Label>
                        <Select 
                          value={card.value?.toString() || ''} 
                          onValueChange={(v) => updatePremieraCard(player.id, idx, v ? parseInt(v) : null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select card" />
                          </SelectTrigger>
                          <SelectContent>
                            {CARD_VALUES.map(val => (
                              <SelectItem key={val} value={val.toString()}>{val}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-right">
                    <span className="text-sm text-muted-foreground">Score: </span>
                    <span className="font-bold">{calculatePremieraForPlayer(player.id)}</span>
                  </div>
                </Card>
              ))}

              <div className="flex gap-3">
                <Button 
                  onClick={awardPremiera} 
                  disabled={!allPremieraCardsSelected()}
                  className="flex-1"
                >
                  Award Point
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setPremieraOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename Players</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-4">
              {renameTempNames.map((name, idx) => (
                <div key={idx}>
                  <Label className="text-sm mb-2 block">Player {idx + 1}</Label>
                  <Input
                    value={name}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => {
                      const newNames = [...renameTempNames]
                      newNames[idx] = e.target.value
                      setRenameTempNames(newNames)
                    }}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-3">
                <Button onClick={saveRenamedPlayers} className="flex-1">
                  Save Names
                </Button>
                <Button variant="outline" onClick={() => setRenameOpen(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
