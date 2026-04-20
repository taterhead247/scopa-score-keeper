import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

const PRIMIERA_POINTS: Record<number, number> = {
  7: 21, 6: 18, 1: 16, 5: 15, 4: 14, 3: 13, 2: 12, 10: 10, 9: 10, 8: 10,
}

const CARD_ORDER: { value: number; labelKey: string }[] = [
  { value: 7, labelKey: 'premiera.seven' },
  { value: 6, labelKey: 'premiera.six' },
  { value: 1, labelKey: 'premiera.ace' },
  { value: 5, labelKey: 'premiera.five' },
  { value: 4, labelKey: 'premiera.four' },
  { value: 3, labelKey: 'premiera.three' },
  { value: 2, labelKey: 'premiera.two' },
  { value: 10, labelKey: 'premiera.fante' },
  { value: 9, labelKey: 'premiera.cavallo' },
  { value: 8, labelKey: 'premiera.re' },
]

export function calculatePrimiera(cardCounts: Record<number, number>): number {
  let suitsFilled = 0
  let total = 0
  for (const { value } of CARD_ORDER) {
    const count = cardCounts[value] || 0
    const canFill = Math.min(count, 4 - suitsFilled)
    total += canFill * PRIMIERA_POINTS[value]
    suitsFilled += canFill
    if (suitsFilled >= 4) break
  }
  return total
}

type PremieraCalcProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  tr: (key: string, params?: Record<string, string>) => string
}

export function PremieraCalc({ open, onOpenChange, tr }: PremieraCalcProps) {
  const [cardCounts, setCardCounts] = useState<Record<number, number>>({})

  const setCount = (value: number, count: number) => {
    setCardCounts(prev => ({ ...prev, [value]: count }))
  }

  const total = calculatePrimiera(cardCounts)

  const handleClose = () => {
    setCardCounts({})
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose() }}>
      <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
        <div className="max-w-md mx-auto">
        <SheetHeader>
          <SheetTitle>{tr('premiera.title')}</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground mt-2 mb-4">{tr('premiera.howMany')}</p>

        <div className="space-y-3">
          {CARD_ORDER.map(({ value, labelKey }) => {
            const selected = cardCounts[value] || 0
            return (
              <div key={value} className="flex items-center gap-3">
                <div className="flex items-center gap-2 min-w-0 shrink-0">
                  <span className="font-semibold text-sm w-28">{tr(labelKey)}</span>
                  <span className="text-xs text-muted-foreground">({PRIMIERA_POINTS[value]} pts)</span>
                </div>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map(n => (
                    <button
                      key={n}
                      onClick={() => setCount(value, n)}
                      className={`w-8 h-8 rounded-md text-sm font-medium transition-colors border ${
                        selected === n
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-6 p-4 rounded-lg bg-muted text-center">
          <div className="text-sm text-muted-foreground">{tr('premiera.total')}</div>
          <div className="text-4xl font-bold text-primary">{total}</div>
        </div>

        <div className="mt-4">
          <Button variant="outline" className="w-full" onClick={handleClose}>
            {tr('premiera.close')}
          </Button>
        </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
