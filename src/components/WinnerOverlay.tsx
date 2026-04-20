import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const CONFETTI_COLORS = [
  '#ef4444', '#f59e0b', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#a855f7', '#ec4899', '#f97316', '#14b8a6',
  '#009246', '#ffffff', '#ce2b37', // Italian flag 🇮🇹
]

type WinnerOverlayProps = {
  winnerName: string | null
  isTie: boolean
  tiedPlayerNames: string[]
  onClose: () => void
  onNewGameSamePlayers: () => void
  onNewGameNewPlayers: () => void
  newGameSameLabel: string
  newGameNewLabel: string
  tieMessage: string
  winsMessage: string
}

export function WinnerOverlay({
  winnerName,
  isTie,
  tiedPlayerNames,
  onClose,
  onNewGameSamePlayers,
  onNewGameNewPlayers,
  newGameSameLabel,
  newGameNewLabel,
  tieMessage,
  winsMessage,
}: WinnerOverlayProps) {
  const isOpen = winnerName !== null || isTie

  return (
    <>
      {/* Confetti & solitaire cards */}
      {isOpen && (
        <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden="true">
          {/* 400 confetti pieces */}
          {Array.from({ length: 400 }).map((_, idx) => {
            const left = `${Math.random() * 100}%`
            const delay = `${Math.random() * 1.5}s`
            const duration = `${1.8 + Math.random() * 2.2}s`
            const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
            const size = 6 + Math.floor(Math.random() * 10)
            const rotation = `${Math.floor(Math.random() * 360)}deg`
            return (
              <span
                key={`confetti-${idx}`}
                className="confetti-piece"
                style={{
                  left,
                  animationDelay: delay,
                  animationDuration: duration,
                  backgroundColor: color,
                  width: `${size}px`,
                  height: `${Math.max(4, Math.floor(size * 0.45))}px`,
                  transform: `rotate(${rotation})`,
                }}
              />
            )
          })}

        </div>
      )}

      {/* Winner / Tie dialog */}
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="text-3xl font-bold text-center">
              {isTie ? '🤝' : '🏆'}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            {isTie ? (
              <>
                <p className="text-xl font-bold mb-2">{tieMessage}</p>
                <p className="text-muted-foreground">
                  {tiedPlayerNames.join(' & ')}
                </p>
              </>
            ) : (
              <p className="text-2xl font-bold">{winsMessage}</p>
            )}
          </div>

          {!isTie && (
            <div className="flex flex-col gap-3 pt-2">
              <Button size="lg" onClick={onNewGameSamePlayers}>
                {newGameSameLabel}
              </Button>
              <Button variant="outline" size="lg" onClick={onNewGameNewPlayers}>
                {newGameNewLabel}
              </Button>
            </div>
          )}
          {isTie && (
            <div className="pt-2">
              <Button variant="outline" size="lg" className="w-full" onClick={onClose}>
                OK
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
