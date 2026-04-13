import { useState } from 'react'
import { useKV } from '@github/spark/hooks'
import { Button } from '@/components/ui/but
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/se
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Plus, Minus, Calculator, ArrowsClock

  id: string
  totalScore: number

  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
}
const CARD_VALUES = [7, 6, 1, 5, 4, 3, 2, 10, 9, 8]
const SUIT_LABELS = {

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
    const new
 

    setPlayers(newPlayers)
    
    newPlayers.f
    })
    
  }
  const bankHand = () => {

    
      handSco

   
 

    })
    setPlayers((currentPlayers) => {
      return currentPlayers.map(p => ({
        totalScore: p.totalScore + (handScores[p.id] || 0)
    })
    setHandCardsWinner(null)
    setHandSettebelloWinner(null)

    players.forEach(p => {
    })

  }
  const adjustScopa = (playerId: string, delta: number) =>
      ...prev,
    }))

    setPlayers((currentPlay
      return currentPlayers.map(p => ({
        totalScore: 0
    })
    setHandCardsWin
    set
    
    players?.forEach(p => 
    })
    
  }
  const openPremieraCalculato
    
    pl
        { suit: 'hearts', value: nul
    
      ]
   

  const updatePremieraCard
      ...prev,

    }))

    const cards = premiera
    
      

  }
  const allPremieraCardsSelected = (): boolean => {
    return players.every(p => {
      return cards && cards.every(c => c.value !== null)
  }
  const awardPremiera = () => {
    
      


    
      return currentPlayers.map(p => ({
        ...p,
    }
    setPr


      tempPlayerNames[i] || 
    setTempPlayerNames(newNa

    return (
    
          
            <div>
              <div classNa
      
                    variant={playe

                    {count}
   

            <div>
              <div className="spa
              
                    placeholder={`Player ${idx + 1}`}
       
   

                ))}
            </div>
            <Button onClick={startGa
            </Button>
        </Car
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
              <Radio
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
              <div cl
                
               
            
     
   

              </div>
          </Sheet
      </div>
  )





































































































































































































































































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
