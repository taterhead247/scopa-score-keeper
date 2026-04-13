import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
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

const SUIT_LABELS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
}

export default function App() {
  const [players, setPlayers] = useKV<Player[]>('scopa-players', [])
  const [handScopaScores, setHandScopaScores] = useKV<Record<string, number>>('scopa-hand-scopa', {})
  const [handCardsWinner, setHandCardsWinner] = useKV<string | null>('scopa-hand-cards', null)
  const [handCoinsWinner, setHandCoinsWinner] = useKV<string | null>('scopa-hand-coins', null)
  const [handSettebelloWinner, setHandSettebelloWinner] = useKV<string | null>('scopa-hand-settebello', null)
  const [handPremieraWinner, setHandPremieraWinner] = useKV<string | null>('scopa-hand-premiera', null)
  const [handHistory, setHandHistory] = useKV<HandHistoryEntry[]>('scopa-hand-history', [])
  
  const [playerCount, setPlayerCount] = useState(2)
  const [tempPlayerNames, setTempPlayerNames] = useState(['Player 1', 'Player 2'])
  
  const gameStarted = (players && players.length > 0) || false
  
  const [premieraOpen, setPremieraOpen] = useState(false)
  const [premieraCards, setPremieraCards] = useState<Record<string, PremieraCard[]>>({})
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameTempNames, setRenameTempNames] = useState<string[]>([])

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
    setHandScopaScores((currentScopa) => {
      setHandCardsWinner((currentCardsWinner) => {
        setHandCoinsWinner((currentCoinsWinner) => {
          setHandSettebelloWinner((currentSettebelloWinner) => {
            setHandPremieraWinner((currentPremieraWinner) => {
              setPlayers((currentPlayers) => {
                if (!currentPlayers || currentPlayers.length === 0) return []
                
                const handScores: Record<string, number> = { ...(currentScopa || {}) }
                
                if (currentCardsWinner) handScores[currentCardsWinner] = (handScores[currentCardsWinner] || 0) + 1
                if (currentCoinsWinner) handScores[currentCoinsWinner] = (handScores[currentCoinsWinner] || 0) + 1
                if (currentSettebelloWinner) handScores[currentSettebelloWinner] = (handScores[currentSettebelloWinner] || 0) + 1
                if (currentPremieraWinner) handScores[currentPremieraWinner] = (handScores[currentPremieraWinner] || 0) + 1

                setHandHistory((currentHistory) => {
                  const newEntry = {
                    handNumber: (currentHistory?.length || 0) + 1,
                    scores: handScores,
                    timestamp: Date.now()
                  }
                  return currentHistory ? [...currentHistory, newEntry] : [newEntry]
                })

                toast.success('Hand banked!')
                
                return currentPlayers.map(p => ({
                  ...p,
                  totalScore: p.totalScore + (handScores[p.id] || 0)
                }))
              })
              
              return null
            })
            return null
          })
          return null
        })
        return null
      })
      
      const resetScopa: Record<string, number> = {}
      if (players) {
        players.forEach(p => {
          resetScopa[p.id] = 0
        })
      }
      return resetScopa
    })
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
    
    toast.success('Game reset')
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
      const valueIndex = CARD_VALUES.indexOf(card.value)
      return sum + (valueIndex >= 0 ? valueIndex + 1 : 0)
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
