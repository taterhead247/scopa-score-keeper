import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Minus, Calculator, ArrowsClockwise, Users, Check } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'

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

function AnimatedScore({ value }: { value: number }) {
  return (
    <motion.span
      key={value}
      initial={{ scale: 1.3, color: 'oklch(0.70 0.18 25)' }}
      animate={{ scale: 1, color: 'oklch(0.25 0.01 270)' }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="text-5xl font-bold"
    >
      {value}
    </motion.span>
  )
}

function App() {
  const [players, setPlayers] = useKV<Player[]>('scopa-players', [])
  const [gameStarted, setGameStarted] = useState(players && players.length > 0)
  
  const [handCardsWinner, setHandCardsWinner] = useState<string | null>(null)
  const [handCoinsWinner, setHandCoinsWinner] = useState<string | null>(null)
  const [handSettebelloWinner, setHandSettebelloWinner] = useState<string | null>(null)
  const [handPremieraWinner, setHandPremieraWinner] = useState<string | null>(null)
  const [handScopaScores, setHandScopaScores] = useState<Record<string, number>>({})

  const [premieraOpen, setPremieraOpen] = useState(false)
  const [premieraCards, setPremieraCards] = useState<Record<string, PremieraCard[]>>({})

  const [setupOpen, setSetupOpen] = useState(!gameStarted)
  const [playerCount, setPlayerCount] = useState<number>(2)
  const [tempPlayerNames, setTempPlayerNames] = useState<string[]>(['Player 1', 'Player 2'])

  const startGame = () => {
    const newPlayers: Player[] = tempPlayerNames.map((name, idx) => ({
      id: `player-${idx}`,
      name: name.trim() || `Player ${idx + 1}`,
      totalScore: 0
    }))
    
    setPlayers(newPlayers)
    setGameStarted(true)
    setSetupOpen(false)
    
    const initialScopa: Record<string, number> = {}
    newPlayers.forEach(p => {
      initialScopa[p.id] = 0
    })
    setHandScopaScores(initialScopa)
    
    toast.success('Game started!')
  }

  const bankHand = () => {
    if (!players) return

    let handScores: Record<string, number> = {}
    
    players.forEach(p => {
      handScores[p.id] = 0
    })

    if (handCardsWinner) handScores[handCardsWinner] += 1
    if (handCoinsWinner) handScores[handCoinsWinner] += 1
    if (handSettebelloWinner) handScores[handSettebelloWinner] += 1
    if (handPremieraWinner) handScores[handPremieraWinner] += 1
    
    Object.entries(handScopaScores).forEach(([playerId, scopaCount]) => {
      handScores[playerId] += scopaCount
    })

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

  const currentHandTotal = (playerId: string): number => {
    let total = 0
    if (handCardsWinner === playerId) total += 1
    if (handCoinsWinner === playerId) total += 1
    if (handSettebelloWinner === playerId) total += 1
    if (handPremieraWinner === playerId) total += 1
    total += handScopaScores[playerId] || 0
    return total
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-6xl mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Scopa Score Tracker</h1>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button variant="outline" size="sm" onClick={openPremieraCalculator}>
              <Calculator className="mr-2" />
              Calculate Primiera
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <ArrowsClockwise className="mr-2" />
                  Reset Game
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reset Game?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will clear all scores and start a new game. Player names will be kept.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={resetGame}>Reset</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button variant="outline" size="sm" onClick={() => { setGameStarted(false); setSetupOpen(true); }}>
              <Users className="mr-2" />
              Change Players
            </Button>
          </div>
        </header>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {players?.map(player => (
            <Card key={player.id} className="p-4 shadow-lg">
              <h2 className="text-xl font-semibold mb-2">{player.name}</h2>
              <div className="text-center mb-3">
                <AnimatedScore value={player.totalScore} />
              </div>
              <div className="text-sm text-muted-foreground text-center">
                This hand: <span className="font-semibold text-accent">{currentHandTotal(player.id)}</span>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-6 shadow-lg">
          <h3 className="text-xl font-bold mb-4">Current Hand</h3>
          
          <div className="space-y-6">
            <div>
              <Label className="text-base font-semibold mb-2 block">Cards (Most Cards)</Label>
              <RadioGroup value={handCardsWinner || ''} onValueChange={setHandCardsWinner}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {players?.map(player => (
                    <div key={player.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={player.id} id={`cards-${player.id}`} />
                      <Label htmlFor={`cards-${player.id}`} className="cursor-pointer">
                        {player.name}
                      </Label>
                    </div>
                  ))}
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="" id="cards-none" />
                    <Label htmlFor="cards-none" className="cursor-pointer">None</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold mb-2 block">Coins (Most Coins)</Label>
              <RadioGroup value={handCoinsWinner || ''} onValueChange={setHandCoinsWinner}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {players?.map(player => (
                    <div key={player.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={player.id} id={`coins-${player.id}`} />
                      <Label htmlFor={`coins-${player.id}`} className="cursor-pointer">
                        {player.name}
                      </Label>
                    </div>
                  ))}
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="" id="coins-none" />
                    <Label htmlFor="coins-none" className="cursor-pointer">None</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold mb-2 block">Settebello (7 of Coins)</Label>
              <RadioGroup value={handSettebelloWinner || ''} onValueChange={setHandSettebelloWinner}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {players?.map(player => (
                    <div key={player.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={player.id} id={`settebello-${player.id}`} />
                      <Label htmlFor={`settebello-${player.id}`} className="cursor-pointer">
                        {player.name}
                      </Label>
                    </div>
                  ))}
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="" id="settebello-none" />
                    <Label htmlFor="settebello-none" className="cursor-pointer">None</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold mb-2 block">Primiera</Label>
              <RadioGroup value={handPremieraWinner || ''} onValueChange={setHandPremieraWinner}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                  {players?.map(player => (
                    <div key={player.id} className="flex items-center space-x-2">
                      <RadioGroupItem value={player.id} id={`primiera-${player.id}`} />
                      <Label htmlFor={`primiera-${player.id}`} className="cursor-pointer">
                        {player.name}
                      </Label>
                    </div>
                  ))}
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="" id="primiera-none" />
                    <Label htmlFor="primiera-none" className="cursor-pointer">None</Label>
                  </div>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div>
              <Label className="text-base font-semibold mb-4 block">Scopa</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {players?.map(player => (
                  <div key={player.id} className="flex flex-col items-center gap-2">
                    <Label className="text-sm">{player.name}</Label>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => adjustScopa(player.id, -1)}
                      >
                        <Minus />
                      </Button>
                      <span className="text-xl font-semibold w-8 text-center">
                        {handScopaScores[player.id] || 0}
                      </span>
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

          <Button onClick={bankHand} className="w-full mt-6" size="lg">
            <Check className="mr-2" />
            Bank Hand
          </Button>
        </Card>

        <Sheet open={premieraOpen} onOpenChange={setPremieraOpen}>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Primiera Calculator</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              {players?.map(player => (
                <div key={player.id}>
                  <h3 className="font-semibold text-lg mb-3">{player.name}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {premieraCards[player.id]?.map((card, idx) => (
                      <div key={card.suit}>
                        <Label className="block text-sm font-medium mb-2">
                          {SUIT_LABELS[card.suit]} {card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}
                        </Label>
                        <Select
                          value={card.value?.toString() || ''}
                          onValueChange={(val) => updatePremieraCard(player.id, idx, val ? parseInt(val) : null)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select card" />
                          </SelectTrigger>
                          <SelectContent>
                            {CARD_VALUES.map(val => (
                              <SelectItem key={val} value={val.toString()}>
                                {val}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                  <Separator className="mt-4" />
                </div>
              ))}

              {allPremieraCardsSelected() && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-muted p-4 rounded-lg"
                >
                  <p className="text-sm font-medium mb-2">Scores:</p>
                  {players?.map(player => (
                    <p key={player.id}>
                      {player.name}: {calculatePremieraForPlayer(player.id)}
                    </p>
                  ))}
                  {(() => {
                    const scores = players?.map(p => ({
                      name: p.name,
                      score: calculatePremieraForPlayer(p.id)
                    })) || []
                    scores.sort((a, b) => b.score - a.score)
                    
                    if (scores.length > 1 && scores[0].score !== scores[1].score) {
                      return (
                        <p className="font-semibold mt-2 text-accent">
                          Winner: {scores[0].name}
                        </p>
                      )
                    } else {
                      return (
                        <p className="font-semibold mt-2 text-muted-foreground">
                          Tie - No points awarded
                        </p>
                      )
                    }
                  })()}
                </motion.div>
              )}

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

export default App
