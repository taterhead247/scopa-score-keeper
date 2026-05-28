import { useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CompletedGame } from '@/lib/game'
import {
  computeLeaderboard,
  computeHeadToHeadMatrix,
  type ProfileStats,
  type CategoryRecord,
} from '@/lib/stats'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  completedGames: CompletedGame[]
  tr: (key: string, params?: Record<string, string>) => string
}

/**
 * Modal dialog showing aggregated statistics across every completed game.
 *
 * Organized into three tabs:
 * - Leaderboard: one row per profile, ranked by wins / win rate
 * - Categories: per-profile win rate for each scoring category
 * - Head-to-Head: pairwise records between profiles that have played together
 *
 * Pure consumer of {@link computeLeaderboard} and {@link computeHeadToHeadMatrix};
 * does not mutate game data.
 */
export function StatisticsScreen({ open, onOpenChange, completedGames, tr }: Props) {
  const leaderboard = useMemo(() => computeLeaderboard(completedGames), [completedGames])
  const headToHead = useMemo(() => computeHeadToHeadMatrix(completedGames), [completedGames])
  const profileLookup = useMemo(() => {
    const map = new Map<string, { name: string; color: string; emoji: string }>()
    for (const row of leaderboard) {
      map.set(row.profileId, {
        name: row.lastKnownName,
        color: row.lastKnownColor,
        emoji: row.lastKnownEmoji,
      })
    }
    return map
  }, [leaderboard])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tr('stats.title')}</DialogTitle>
        </DialogHeader>

        {leaderboard.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {tr('stats.empty')}
          </p>
        ) : (
          <Tabs defaultValue="leaderboard" className="mt-2">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="leaderboard">{tr('stats.tab.leaderboard')}</TabsTrigger>
              <TabsTrigger value="categories">{tr('stats.tab.categories')}</TabsTrigger>
              <TabsTrigger value="h2h">{tr('stats.tab.h2h')}</TabsTrigger>
            </TabsList>

            <TabsContent value="leaderboard" className="mt-3">
              <LeaderboardTable rows={leaderboard} tr={tr} />
            </TabsContent>

            <TabsContent value="categories" className="mt-3">
              <CategoriesTable rows={leaderboard} tr={tr} />
            </TabsContent>

            <TabsContent value="h2h" className="mt-3">
              <HeadToHeadList records={headToHead} profileLookup={profileLookup} tr={tr} />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Renders the leaderboard: one row per profile with W/L, win rate, avg score, streak. */
function LeaderboardTable({
  rows,
  tr,
}: {
  rows: ProfileStats[]
  tr: (key: string, params?: Record<string, string>) => string
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 text-xs text-muted-foreground px-2">
        <span>{tr('stats.col.player')}</span>
        <span className="text-right w-12">{tr('stats.col.record')}</span>
        <span className="text-right w-10">{tr('stats.col.rate')}</span>
        <span className="text-right w-10">{tr('stats.col.avg')}</span>
        <span className="text-right w-12">{tr('stats.col.streak')}</span>
      </div>
      {rows.map(row => (
        <div
          key={row.profileId}
          className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-center p-2 rounded-md border border-border"
        >
          <span
            className="flex items-center gap-2 truncate font-medium text-profile"
            style={{ '--profile-color': row.lastKnownColor } as React.CSSProperties}
          >
            <span aria-hidden="true">{row.lastKnownEmoji}</span>
            <span className="truncate">{row.lastKnownName}</span>
          </span>
          <span className="text-right text-sm tabular-nums w-12">{row.wins}-{row.losses}</span>
          <span className="text-right text-sm tabular-nums w-10">{Math.round(row.winRate * 100)}%</span>
          <span className="text-right text-sm tabular-nums w-10">{row.avgScore.toFixed(1)}</span>
          <span className="text-right text-sm tabular-nums w-12" title={tr('stats.streak.longest', { n: String(row.longestWinStreak) })}>
            {formatStreak(row.currentStreak)}
          </span>
        </div>
      ))}
    </div>
  )
}

/** Format a signed streak: positive as `W{n}`, negative as `L{n}`, zero as `—`. */
function formatStreak(streak: number): string {
  if (streak > 0) return `W${streak}`
  if (streak < 0) return `L${-streak}`
  return '—'
}

/** Per-profile category win rates. Hides rows for profiles with no hand-history games. */
function CategoriesTable({
  rows,
  tr,
}: {
  rows: ProfileStats[]
  tr: (key: string, params?: Record<string, string>) => string
}) {
  const rowsWithData = rows.filter(r => r.categoryStats !== undefined)
  if (rowsWithData.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {tr('stats.categories.noData')}
      </p>
    )
  }
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-1 text-xs text-muted-foreground px-2">
        <span>{tr('stats.col.player')}</span>
        <span className="text-right w-10">{tr('stats.cat.cards')}</span>
        <span className="text-right w-10">{tr('stats.cat.coins')}</span>
        <span className="text-right w-10">{tr('stats.cat.sette')}</span>
        <span className="text-right w-10">{tr('stats.cat.prim')}</span>
        <span className="text-right w-10">{tr('stats.cat.scopa')}</span>
      </div>
      {rowsWithData.map(row => {
        const c = row.categoryStats!
        return (
          <div
            key={row.profileId}
            className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-1 items-center p-2 rounded-md border border-border"
          >
            <span
              className="flex items-center gap-2 truncate font-medium text-profile"
              style={{ '--profile-color': row.lastKnownColor } as React.CSSProperties}
            >
              <span aria-hidden="true">{row.lastKnownEmoji}</span>
              <span className="truncate">{row.lastKnownName}</span>
            </span>
            <CategoryCell record={c.cards} />
            <CategoryCell record={c.coins} />
            <CategoryCell record={c.settebello} />
            <CategoryCell record={c.primiera} />
            <span className="text-right text-sm tabular-nums w-10">{c.scopaTotal}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Single cell showing a percentage with the raw won/total in a tooltip. */
function CategoryCell({ record }: { record: CategoryRecord }) {
  return (
    <span
      className="text-right text-sm tabular-nums w-10"
      title={`${record.won}/${record.total}`}
    >
      {record.total === 0 ? '—' : `${Math.round(record.rate * 100)}%`}
    </span>
  )
}

/** Pairwise list of head-to-head records. */
function HeadToHeadList({
  records,
  profileLookup,
  tr,
}: {
  records: ReturnType<typeof computeHeadToHeadMatrix>
  profileLookup: Map<string, { name: string; color: string; emoji: string }>
  tr: (key: string, params?: Record<string, string>) => string
}) {
  if (records.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {tr('stats.h2h.empty')}
      </p>
    )
  }
  return (
    <div className="space-y-2">
      {records.map(({ profileIdA, profileIdB, record }) => {
        const a = profileLookup.get(profileIdA)
        const b = profileLookup.get(profileIdB)
        if (!a || !b) return null
        return (
          <div
            key={`${profileIdA}::${profileIdB}`}
            className="flex items-center gap-2 p-2 rounded-md border border-border text-sm"
          >
            <span
              className="flex items-center gap-1 truncate font-medium flex-1 text-profile"
              style={{ '--profile-color': a.color } as React.CSSProperties}
            >
              <span aria-hidden="true">{a.emoji}</span>
              <span className="truncate">{a.name}</span>
            </span>
            <span className="tabular-nums whitespace-nowrap">
              {record.aWins} — {record.bWins}
            </span>
            <span
              className="flex items-center gap-1 truncate font-medium flex-1 justify-end text-profile"
              style={{ '--profile-color': b.color } as React.CSSProperties}
            >
              <span className="truncate">{b.name}</span>
              <span aria-hidden="true">{b.emoji}</span>
            </span>
            {record.otherWins > 0 && (
              <span
                className="text-xs text-muted-foreground"
                title={tr('stats.h2h.otherTooltip', { n: String(record.otherWins) })}
              >
                +{record.otherWins}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
