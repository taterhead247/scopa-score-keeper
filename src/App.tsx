import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Plus, Calculator, ArrowsClockwise } from '@phosphor-icons/react'
import { motion } from 'framer-motion'

type Player = {
  name: string
  cards: number
  coins: number
  settebello: number
  primiera: number
  scopa: number
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

const DEFAULT_PLAYER_1: Player = {
  name: 'Player 1',
  cards: 0,
  coins: 0,
  settebello: 0,
  primiera: 0,
  scopa: 0
}

const DEFAULT_PLAYER_2: Player = {
  name: 'Player 2',
  cards: 0,
  coins: 0,
  settebello: 0,
  primiera: 0,
  scopa: 0
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
  const [player1, setPlayer1] = useKV<Player>('player1', DEFAULT_PLAYER_1)
  const [player2, setPlayer2] = useKV<Player>('player2', DEFAULT_PLAYER_2)

  const [editingPlayer, setEditingPlayer] = useState<1 | 2 | null>(null)
  const [tempName, setTempName] = useState('')
  const [premieraOpen, setPremieraOpen] = useState(false)
  const [p1Cards, setP1Cards] = useState<PremieraCard[]>([
    { suit: 'hearts', value: null },
    { suit: 'diamonds', value: null },
    { suit: 'clubs', value: null },
    { suit: 'spades', value: null }
  ])
  const [p2Cards, setP2Cards] = useState<PremieraCard[]>([
    { suit: 'hearts', value: null },
    { suit: 'diamonds', value: null },
    { suit: 'clubs', value: null },
    { suit: 'spades', value: null }
  ])

  const addPoint = (player: 1 | 2, category: keyof Omit<Player, 'name'>) => {
    const currentPlayer = player === 1 ? player1 : player2
    const setPlayer = player === 1 ? setPlayer1 : setPlayer2

    setPlayer((prev) => ({
      name: prev?.name || `Player ${player}`,
      cards: prev?.cards || 0,
      coins: prev?.coins || 0,
      settebello: prev?.settebello || 0,
      primiera: prev?.primiera || 0,
      scopa: prev?.scopa || 0,
      [category]: (prev?.[category] || 0) + 1
    }))

    toast.success(`Point added to ${currentPlayer?.name || `Player ${player}`}`)
  }

  const resetGame = () => {
    setPlayer1((prev) => ({
      name: prev?.name || 'Player 1',
      cards: 0,
      coins: 0,
      settebello: 0,
      primiera: 0,
      scopa: 0
    }))

    setPlayer2((prev) => ({
      name: prev?.name || 'Player 2',
      cards: 0,
      coins: 0,
      settebello: 0,
      primiera: 0,
      scopa: 0
    }))

    toast.success('Game reset')
  }

  const startEditingName = (player: 1 | 2) => {
    setEditingPlayer(player)
    const playerData = player === 1 ? player1 : player2
    setTempName(playerData?.name || `Player ${player}`)
  }

  const savePlayerName = () => {
    if (!editingPlayer) return

    const setPlayer = editingPlayer === 1 ? setPlayer1 : setPlayer2
    const prev = editingPlayer === 1 ? player1 : player2
    setPlayer({
      name: tempName.trim() || `Player ${editingPlayer}`,
      cards: prev?.cards || 0,
      coins: prev?.coins || 0,
      settebello: prev?.settebello || 0,
      primiera: prev?.primiera || 0,
      scopa: prev?.scopa || 0
    })

    setEditingPlayer(null)
  }

  const calculateTotal = (player?: Player) => {
    if (!player) return 0
    return player.cards + player.coins + player.settebello + player.primiera + player.scopa
  }

  const calculatePremiera = () => {
    const p1Total = p1Cards.reduce((sum, card) => {
      const value = card.value ?? 0
      return sum + CARD_VALUES.indexOf(value) + 1
    }, 0)

    const p2Total = p2Cards.reduce((sum, card) => {
      const value = card.value ?? 0
      return sum + CARD_VALUES.indexOf(value) + 1
    }, 0)

    return { p1Total, p2Total }
  }

  const awardPremiera = () => {
    const { p1Total, p2Total } = calculatePremiera()

    if (p1Total > p2Total) {
      setPlayer1((prev) => ({
        name: prev?.name || 'Player 1',
        cards: prev?.cards || 0,
        coins: prev?.coins || 0,
        settebello: prev?.settebello || 0,
        primiera: (prev?.primiera || 0) + 1,
        scopa: prev?.scopa || 0
      }))
      toast.success(`${player1?.name || 'Player 1'} wins Primiera!`)
    } else if (p2Total > p1Total) {
      setPlayer2((prev) => ({
        name: prev?.name || 'Player 2',
        cards: prev?.cards || 0,
        coins: prev?.coins || 0,
        settebello: prev?.settebello || 0,
        primiera: (prev?.primiera || 0) + 1,
        scopa: prev?.scopa || 0
      }))
      toast.success(`${player2?.name || 'Player 2'} wins Primiera!`)
    } else {
      toast.info("It's a tie - no points awarded")
    }

    setPremieraOpen(false)
    resetPremieraCards()
  }

  const resetPremieraCards = () => {
    setP1Cards([
      { suit: 'hearts', value: null },
      { suit: 'diamonds', value: null },
      { suit: 'clubs', value: null },
      { suit: 'spades', value: null }
    ])
    setP2Cards([
      { suit: 'hearts', value: null },
      { suit: 'diamonds', value: null },
      { suit: 'clubs', value: null },
      { suit: 'spades', value: null }
    ])
  }

  const allCardsSelected = () => {
    return p1Cards.every(card => card.value !== null) && p2Cards.every(card => card.value !== null)
  }

  return (
    <div className="min-h-screen bg-background p-4 pb-20">
      <div className="max-w-4xl mx-auto">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-foreground mb-2">Scopa Score Tracker</h1>
          <div className="flex gap-3 justify-center flex-wrap">
            <Sheet open={premieraOpen} onOpenChange={setPremieraOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calculator className="mr-2" />
                  Calculate Primiera
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Primiera Calculator</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-3">{player1?.name || 'Player 1'}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {p1Cards.map((card, idx) => (
                        <div key={card.suit}>
                          <label className="block text-sm font-medium mb-2">
                            {SUIT_LABELS[card.suit]} {card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}
                          </label>
                          <select
                            value={card.value ?? ''}
                            onChange={(e) => {
                              const newCards = [...p1Cards]
                              newCards[idx].value = e.target.value ? parseInt(e.target.value) : null
                              setP1Cards(newCards)
                            }}
                            className="w-full p-2 border border-input rounded-md bg-card text-foreground"
                          >
                            <option value="">Select card</option>
                            {CARD_VALUES.map(val => (
                              <option key={val} value={val}>{val}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h3 className="font-semibold text-lg mb-3">{player2?.name || 'Player 2'}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {p2Cards.map((card, idx) => (
                        <div key={card.suit}>
                          <label className="block text-sm font-medium mb-2">
                            {SUIT_LABELS[card.suit]} {card.suit.charAt(0).toUpperCase() + card.suit.slice(1)}
                          </label>
                          <select
                            value={card.value ?? ''}
                            onChange={(e) => {
                              const newCards = [...p2Cards]
                              newCards[idx].value = e.target.value ? parseInt(e.target.value) : null
                              setP2Cards(newCards)
                            }}
                            className="w-full p-2 border border-input rounded-md bg-card text-foreground"
                          >
                            <option value="">Select card</option>
                            {CARD_VALUES.map(val => (
                              <option key={val} value={val}>{val}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  {allCardsSelected() && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-muted p-4 rounded-lg"
                    >
                      <p className="text-sm font-medium mb-2">Scores:</p>
                      <p>{player1?.name || 'Player 1'}: {calculatePremiera().p1Total}</p>
                      <p>{player2?.name || 'Player 2'}: {calculatePremiera().p2Total}</p>
                      {calculatePremiera().p1Total !== calculatePremiera().p2Total && (
                        <p className="font-semibold mt-2 text-accent">
                          Winner: {calculatePremiera().p1Total > calculatePremiera().p2Total ? (player1?.name || 'Player 1') : (player2?.name || 'Player 2')}
                        </p>
                      )}
                      {calculatePremiera().p1Total === calculatePremiera().p2Total && (
                        <p className="font-semibold mt-2 text-muted-foreground">Tie - No points awarded</p>
                      )}
                    </motion.div>
                  )}

                  <div className="flex gap-3">
                    <Button 
                      onClick={awardPremiera} 
                      disabled={!allCardsSelected()}
                      className="flex-1"
                    >
                      Award Point
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        resetPremieraCards()
                        setPremieraOpen(false)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>

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
          </div>
        </header>

        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 shadow-lg">
            <div className="mb-6">
              {editingPlayer === 1 ? (
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={savePlayerName}
                  onKeyDown={(e) => e.key === 'Enter' && savePlayerName()}
                  autoFocus
                  className="text-2xl font-semibold"
                />
              ) : (
                <h2
                  onClick={() => startEditingName(1)}
                  className="text-2xl font-semibold cursor-pointer hover:text-accent transition-colors"
                >
                  {player1?.name || 'Player 1'}
                </h2>
              )}
              <div className="mt-4 text-center">
                <AnimatedScore value={calculateTotal(player1)} />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Cards</Badge>
                  <span className="text-xl font-semibold">{player1?.cards || 0}</span>
                </div>
                <Button onClick={() => addPoint(1, 'cards')} size="sm">
                  <Plus />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Coins</Badge>
                  <span className="text-xl font-semibold">{player1?.coins || 0}</span>
                </div>
                <Button onClick={() => addPoint(1, 'coins')} size="sm">
                  <Plus />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Settebello</Badge>
                  <span className="text-xl font-semibold">{player1?.settebello || 0}</span>
                </div>
                <Button onClick={() => addPoint(1, 'settebello')} size="sm">
                  <Plus />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Primiera</Badge>
                  <span className="text-xl font-semibold">{player1?.primiera || 0}</span>
                </div>
                <Button onClick={() => addPoint(1, 'primiera')} size="sm">
                  <Plus />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Scopa</Badge>
                  <span className="text-xl font-semibold">{player1?.scopa || 0}</span>
                </div>
                <Button onClick={() => addPoint(1, 'scopa')} size="sm">
                  <Plus />
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6 shadow-lg">
            <div className="mb-6">
              {editingPlayer === 2 ? (
                <Input
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={savePlayerName}
                  onKeyDown={(e) => e.key === 'Enter' && savePlayerName()}
                  autoFocus
                  className="text-2xl font-semibold"
                />
              ) : (
                <h2
                  onClick={() => startEditingName(2)}
                  className="text-2xl font-semibold cursor-pointer hover:text-accent transition-colors"
                >
                  {player2?.name || 'Player 2'}
                </h2>
              )}
              <div className="mt-4 text-center">
                <AnimatedScore value={calculateTotal(player2)} />
              </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Cards</Badge>
                  <span className="text-xl font-semibold">{player2?.cards || 0}</span>
                </div>
                <Button onClick={() => addPoint(2, 'cards')} size="sm">
                  <Plus />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Coins</Badge>
                  <span className="text-xl font-semibold">{player2?.coins || 0}</span>
                </div>
                <Button onClick={() => addPoint(2, 'coins')} size="sm">
                  <Plus />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Settebello</Badge>
                  <span className="text-xl font-semibold">{player2?.settebello || 0}</span>
                </div>
                <Button onClick={() => addPoint(2, 'settebello')} size="sm">
                  <Plus />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Primiera</Badge>
                  <span className="text-xl font-semibold">{player2?.primiera || 0}</span>
                </div>
                <Button onClick={() => addPoint(2, 'primiera')} size="sm">
                  <Plus />
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Scopa</Badge>
                  <span className="text-xl font-semibold">{player2?.scopa || 0}</span>
                </div>
                <Button onClick={() => addPoint(2, 'scopa')} size="sm">
                  <Plus />
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default App
