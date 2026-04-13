import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Plus, Minus, Calculator, ArrowsClockwise } from '@phosphor-icons/react'
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

const CARD_VALUES = [7, 6, 1, 5, 4, 3, 2, 10, 9, 8]

const SUIT_LABELS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
}

export default function App() {
  const [gameStarted, setGameStarted] = useState(false)
  const [playerCount, setPlayerCount] = useState(2)
  const [tempPlayerNames, setTempPlayerNames] = useState(['Player 1', 'Player 2'])
  const [players, setPlayers] = useKV<Player[]>('scopa-players', [])
  
  const [handScopaScores, setHandScopaScores] = useState<Record<string, number>>({})
  const [handCardsWinner, setHandCardsWinner] = useState<string | null>(null)
  const [handCoinsWinner, setHandCoinsWinner] = useState<string | null>(null)
  const [handSettebelloWinner, setHandSettebelloWinner] = useState<string | null>(null)
  const [handPremieraWinner, setHandPremieraWinner] = useState<string | null>(null)
  
  const [premieraOpen, setPremieraOpen] = useState(false)
  const [premieraCards, setPremieraCards] = useState<Record<string, PremieraCard[]>>({})

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
    
    setGameStarted(true)
  }

  const bankHand = () => {
    if (!players || players.length === 0) return
    
    const handScores: Record<string, number> = { ...handScopaScores }
    
    if (handCardsWinner) handScores[handCardsWinner] = (handScores[handCardsWinner] || 0) + 1
    if (handCoinsWinner) handScores[handCoinsWinner] = (handScores[handCoinsWinner] || 0) + 1
    if (handSettebelloWinner) handScores[handSettebelloWinner] = (handScores[handSettebelloWinner] || 0) + 1
    if (handPremieraWinner) handScores[handPremieraWinner] = (handScores[handPremieraWinner] || 0) + 1

    setPlayers((currentPlayers) => {
      if (!currentPlayers) return []
      return currentPlayers.map(p => ({
        ...p,
        totalScore: p.totalScore + (handScores[p.id] || 0)
      }))
    })

    setHandCardsWinner(null)
    setHandCoinsWinner(null)
    setHandSettebelloWinner(null)
    setHandPremieraWinner(null)
    
    const resetScopa: Record<string, number> = {}
    players.forEach(p => {
      resetScopa[p.id] = 0
    })
    setHandScopaScores(resetScopa)
    
    toast.success('Hand banked!')
  }

  const adjustScopa = (playerId: string, delta: number) => {
    setHandScopaScores(prev => ({
      ...prev,
      [playerId]: Math.max(0, (prev[playerId] || 0) + delta)
    }))
  }

  const resetGame = () => {
    setPlayers((currentPlayers) => {
      if (!currentPlayers) return []
      return currentPlayers.map(p => ({
        ...p,
        totalScore: 0
      }))
    })
    
    setHandCardsWinner(null)
    setHandCoinsWinner(null)
    setHandSettebelloWinner(null)
    setHandPremieraWinner(null)
    
    const resetScopa: Record<string, number> = {}
    players?.forEach(p => {
      resetScopa[p.id] = 0
    })
    setHandScopaScores(resetScopa)
    
    toast.success('Game reset')
  }

  const openPremieraCalculator = () => {
    if (!players) return
    
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
    if (!players) return false
    return players.every(p => {
      const cards = premieraCards[p.id]
      return cards && cards.every(c => c.value !== null)
    })
  }

  const awardPremiera = () => {
    if (!players) return
    
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
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Scopa Score Tracker</h1>
          <Button variant="outline" size="sm" onClick={resetGame}>
            <ArrowsClockwise className="mr-2" />
            Reset
          </Button>
        </div>

        <div className="grid gap-4 mb-6">
          {players?.map(player => (
            <Card key={player.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xl font-bold">{player.name}</h2>
                <div className="text-3xl font-bold text-primary">{player.totalScore}</div>
              </div>
              
              <div className="flex items-center gap-2">
                <Label className="text-sm">Scopa:</Label>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => adjustScopa(player.id, -1)}
                >
                  <Minus />
                </Button>
                <span className="w-8 text-center font-semibold">{handScopaScores[player.id] || 0}</span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => adjustScopa(player.id, 1)}
                >
                  <Plus />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-4 mb-6">
          <h3 className="font-bold mb-3">Hand Awards (1 point each)</h3>
          <div className="grid gap-3">
            <div>
              <Label className="text-sm mb-2 block">Cards (Most cards)</Label>
              <Select value={handCardsWinner || ''} onValueChange={setHandCardsWinner}>
                <SelectTrigger>
                  <SelectValue placeholder="Select winner" />
                </SelectTrigger>
                <SelectContent>
                  {players?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Coins (Most diamonds)</Label>
              <Select value={handCoinsWinner || ''} onValueChange={setHandCoinsWinner}>
                <SelectTrigger>
                  <SelectValue placeholder="Select winner" />
                </SelectTrigger>
                <SelectContent>
                  {players?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Settebello (7 of diamonds)</Label>
              <Select value={handSettebelloWinner || ''} onValueChange={setHandSettebelloWinner}>
                <SelectTrigger>
                  <SelectValue placeholder="Select winner" />
                </SelectTrigger>
                <SelectContent>
                  {players?.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm mb-2 block">Primiera</Label>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={openPremieraCalculator}
                >
                  <Calculator className="mr-2" />
                  Calculate
                </Button>
                <Select value={handPremieraWinner || ''} onValueChange={setHandPremieraWinner}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select winner" />
                  </SelectTrigger>
                  <SelectContent>
                    {players?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </Card>

        <Button onClick={bankHand} size="lg" className="w-full">
          Bank Hand & Add to Scores
        </Button>

        <Sheet open={premieraOpen} onOpenChange={setPremieraOpen}>
          <SheetContent side="bottom" className="h-[90vh]">
            <SheetHeader>
              <SheetTitle>Primiera Calculator</SheetTitle>
            </SheetHeader>
            
            <div className="mt-6 space-y-6 overflow-auto max-h-[calc(90vh-120px)]">
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
      </div>
    </div>
  )
}
