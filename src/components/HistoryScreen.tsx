import { useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { resolveWinnerProfileId, type CompletedGame } from '@/lib/game'
import type { PlayerProfile } from '@/lib/profiles'

/** Sort modes offered by the history screen. */
type SortMode = 'newest' | 'oldest' | 'highest-score'

/**
 * Lightweight profile shape used to drive the participant + winner filters.
 *
 * Built by merging completed-game player snapshots with the live
 * {@link PlayerProfile} list, so deleted profiles remain filterable while
 * still-existing profiles show their current name / color / emoji.
 */
type FilterProfile = { id: string; name: string; color: string; emoji: string }

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  completedGames: CompletedGame[]
  profiles: PlayerProfile[]
  language: string
  tr: (key: string, params?: Record<string, string>) => string
}

/**
 * Dialog listing completed games with filtering and sorting controls.
 *
 * Filters:
 * - Participants: profile chips. A game must include every selected profile.
 * - Winner: dropdown. Restrict to games won by the selected profile.
 *
 * Sort: newest first, oldest first, or highest final score across all
 * players in the game.
 *
 * Filter state is internal to the component and resets on dialog close.
 */
export function HistoryScreen({
  open,
  onOpenChange,
  completedGames,
  profiles,
  language,
  tr,
}: Props) {
  const [participantFilter, setParticipantFilter] = useState<Set<string>>(new Set())
  const [winnerFilter, setWinnerFilter] = useState<string>('any')
  const [sortMode, setSortMode] = useState<SortMode>('newest')

  /**
   * Profiles that have appeared in at least one completed game.
   *
   * Sourced from the completed-game snapshots so deleted profiles still show
   * up as filter options (their games still exist). When a live profile
   * still exists, its current name/color/emoji wins over the snapshot.
   */
  const profilesWithGames = useMemo<FilterProfile[]>(() => {
    const byId = new Map<string, FilterProfile>()
    for (const game of completedGames) {
      for (const player of game.players) {
        if (byId.has(player.profileId)) continue
        const live = profiles.find(p => p.id === player.profileId)
        byId.set(player.profileId, {
          id: player.profileId,
          name: live?.name ?? player.name,
          color: live?.color ?? player.color,
          emoji: live?.emoji ?? player.emoji,
        })
      }
    }
    return [...byId.values()]
  }, [completedGames, profiles])

  const filteredSortedGames = useMemo(() => {
    let out = completedGames
    if (participantFilter.size > 0) {
      out = out.filter(g => {
        const playerIds = new Set(g.players.map(p => p.profileId))
        for (const required of participantFilter) {
          if (!playerIds.has(required)) return false
        }
        return true
      })
    }
    if (winnerFilter !== 'any') {
      out = out.filter(game => resolveWinnerProfileId(game) === winnerFilter)
    }
    const sorted = [...out]
    switch (sortMode) {
      case 'newest':
        sorted.sort((a, b) => b.completedAt - a.completedAt)
        break
      case 'oldest':
        sorted.sort((a, b) => a.completedAt - b.completedAt)
        break
      case 'highest-score':
        sorted.sort((a, b) => maxScore(b) - maxScore(a))
        break
    }
    return sorted
  }, [completedGames, participantFilter, winnerFilter, sortMode])

  /** Toggle a profile in/out of the participant filter set. */
  const toggleParticipant = (profileId: string) => {
    setParticipantFilter(prev => {
      const next = new Set(prev)
      if (next.has(profileId)) next.delete(profileId)
      else next.add(profileId)
      return next
    })
  }

  /** Reset filter and sort state when the dialog closes. */
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setParticipantFilter(new Set())
      setWinnerFilter('any')
      setSortMode('newest')
    }
    onOpenChange(next)
  }

  const hasGames = completedGames.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr('menu.history')}</DialogTitle>
        </DialogHeader>

        {!hasGames && (
          <p className="text-sm text-muted-foreground py-4">{tr('history.noGames')}</p>
        )}

        {hasGames && (
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs mb-2 block">{tr('history.filter.participants')}</Label>
              <div className="flex flex-wrap gap-2">
                {profilesWithGames.map(profile => {
                  const active = participantFilter.has(profile.id)
                  return (
                    <button
                      key={profile.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => toggleParticipant(profile.id)}
                      className="px-2 py-1 rounded-full border-2 text-xs font-medium transition-colors flex items-center gap-1"
                      style={{
                        backgroundColor: active ? profile.color : 'transparent',
                        borderColor: profile.color,
                        color: active ? '#ffffff' : profile.color,
                      }}
                    >
                      <span>{profile.emoji}</span>
                      <span>{profile.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-2 block">{tr('history.filter.winner')}</Label>
                <Select value={winnerFilter} onValueChange={setWinnerFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{tr('history.winner.any')}</SelectItem>
                    {profilesWithGames.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.emoji} {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs mb-2 block">{tr('history.sort.label')}</Label>
                <Select value={sortMode} onValueChange={v => setSortMode(v as SortMode)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{tr('history.sort.newest')}</SelectItem>
                    <SelectItem value="oldest">{tr('history.sort.oldest')}</SelectItem>
                    <SelectItem value="highest-score">{tr('history.sort.highest')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              {filteredSortedGames.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {tr('history.noMatches')}
                </p>
              )}
              {filteredSortedGames.map(game => (
                <Card key={game.id} className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-sm">🏆 {game.winnerName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(game.completedAt).toLocaleDateString(
                        language === 'it' ? 'it-IT' : 'en-US',
                        { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' },
                      )}
                    </span>
                  </div>
                  <div className="text-xs flex flex-wrap gap-x-3 gap-y-1">
                    {game.players.map(p => (
                      <span
                        key={p.playerId ?? p.profileId}
                        style={{ '--profile-color': p.color } as React.CSSProperties}
                        className="font-medium text-profile"
                      >
                        {p.emoji} {p.name} ({p.score})
                      </span>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Highest final score among all players in a completed game; used for sorting. */
function maxScore(game: CompletedGame): number {
  return game.players.reduce((m, p) => (p.score > m ? p.score : m), 0)
}
