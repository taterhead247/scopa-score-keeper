import { useMemo } from 'react'
import { Star } from '@phosphor-icons/react'
import { Label } from '@/components/ui/label'
import type { PlayerProfile } from '@/lib/profiles'
import {
  computeRecentGroupings,
  groupingId,
  type FavoriteGrouping,
  type GroupingSourceGame,
} from '@/lib/groupings'

type Props = {
  /** All persisted favorite groupings. */
  favoriteGroupings: FavoriteGrouping[]
  /** Setter for the favorites list (typically wired to `useLocalStorage`). */
  setFavoriteGroupings: React.Dispatch<React.SetStateAction<FavoriteGrouping[]>>
  /** Completed-game records used to derive recent groupings. */
  completedGames: GroupingSourceGame[]
  /** All live profiles — used to look up display name/color/emoji per id. */
  profiles: PlayerProfile[]
  /** Called when the user picks a grouping to load into the setup seats. */
  onLoadGrouping: (profileIds: string[]) => void
  /** Translation helper. */
  tr: (key: string, params?: Record<string, string>) => string
}

/**
 * Setup-screen section that surfaces:
 * - Favorite groupings, pinned by the user
 * - Recent groupings, derived from completed games
 *
 * Tapping a row loads that grouping into the seats (adjusts player count and
 * fills in the profile ids). Tapping the star toggles favorite status.
 *
 * Renders nothing if there are no favorites AND no recent groupings — the
 * section is purely additive, never empty.
 */
export function QuickStartSection({
  favoriteGroupings,
  setFavoriteGroupings,
  completedGames,
  profiles,
  onLoadGrouping,
  tr,
}: Props) {
  const recent = useMemo(
    () => computeRecentGroupings(completedGames, profiles, 5),
    [completedGames, profiles],
  )

  const favoriteIds = useMemo(() => new Set(favoriteGroupings.map(f => f.id)), [favoriteGroupings])
  /** Live profile lookup so we can render current name/color/emoji per row. */
  const profileById = useMemo(() => {
    const map = new Map<string, PlayerProfile>()
    for (const p of profiles) map.set(p.id, p)
    return map
  }, [profiles])

  /** Favorites that still reference profiles that exist; deleted-profile favorites are hidden but not deleted. */
  const visibleFavorites = useMemo(
    () => favoriteGroupings.filter(f => f.profileIds.every(id => profileById.has(id))),
    [favoriteGroupings, profileById],
  )

  /** Recent groupings that aren't already pinned as favorites (avoid duplicates). */
  const nonFavoriteRecents = useMemo(
    () => recent.filter(r => !favoriteIds.has(r.id)),
    [recent, favoriteIds],
  )

  if (visibleFavorites.length === 0 && nonFavoriteRecents.length === 0) return null

  /** Add a recent grouping to favorites (no name; user can rename later). */
  const addFavorite = (profileIds: string[]) => {
    const id = groupingId(profileIds)
    if (favoriteIds.has(id)) return
    setFavoriteGroupings(prev => [
      ...prev,
      { id, profileIds: [...profileIds], createdAt: Date.now() },
    ])
  }

  /** Remove a grouping from favorites by id. */
  const removeFavorite = (id: string) => {
    setFavoriteGroupings(prev => prev.filter(f => f.id !== id))
  }

  /** Toggle star icon: favorite a recent, or unfavorite a starred one. */
  const toggleFavorite = (id: string, profileIds: string[]) => {
    if (favoriteIds.has(id)) removeFavorite(id)
    else addFavorite(profileIds)
  }

  return (
    <div>
      <Label className="text-base font-semibold mb-3 block">{tr('quickstart.title')}</Label>
      <div className="space-y-2">
        {visibleFavorites.map(fav => (
          <GroupingRow
            key={fav.id}
            id={fav.id}
            profileIds={fav.profileIds}
            label={fav.name}
            isFavorite
            profileById={profileById}
            onLoad={() => onLoadGrouping(fav.profileIds)}
            onToggleFavorite={() => toggleFavorite(fav.id, fav.profileIds)}
            tr={tr}
          />
        ))}
        {nonFavoriteRecents.map(r => (
          <GroupingRow
            key={r.id}
            id={r.id}
            profileIds={r.profileIds}
            isFavorite={false}
            profileById={profileById}
            onLoad={() => onLoadGrouping(r.profileIds)}
            onToggleFavorite={() => toggleFavorite(r.id, r.profileIds)}
            tr={tr}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * A single grouping row: player chips + an optional label + a star toggle.
 * The whole row is clickable (loads the grouping); only the star button
 * stops propagation so it can toggle without also loading.
 */
function GroupingRow({
  profileIds,
  label,
  isFavorite,
  profileById,
  onLoad,
  onToggleFavorite,
  tr,
}: {
  id: string
  profileIds: string[]
  label?: string
  isFavorite: boolean
  profileById: Map<string, PlayerProfile>
  onLoad: () => void
  onToggleFavorite: () => void
  tr: (key: string, params?: Record<string, string>) => string
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onLoad}
      onKeyDown={e => {
        // Ignore Enter/Space that originated on a nested focusable element
        // (the star button). Otherwise keyboard-toggling a favorite would
        // also load the grouping, since keydown bubbles independently of the
        // click-level stopPropagation we set on the star button.
        if (e.currentTarget !== e.target) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onLoad()
        }
      }}
      className="w-full flex items-center gap-2 p-2 rounded-md border border-border hover:bg-muted/50 cursor-pointer transition-colors"
    >
      <div className="flex-1 min-w-0">
        {label && (
          <div className="text-sm font-semibold truncate mb-1">{label}</div>
        )}
        <div className="flex flex-wrap gap-1">
          {profileIds.map(id => {
            const p = profileById.get(id)
            if (!p) return null
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${p.color}20`,
                  color: p.color,
                }}
              >
                <span>{p.emoji}</span>
                <span>{p.name}</span>
              </span>
            )
          })}
        </div>
      </div>
      <button
        type="button"
        aria-pressed={isFavorite}
        aria-label={isFavorite ? tr('quickstart.unfavorite') : tr('quickstart.favorite')}
        onClick={e => {
          e.stopPropagation()
          onToggleFavorite()
        }}
        onKeyDown={e => e.stopPropagation()}
        className="shrink-0 p-2 rounded-md hover:bg-muted transition-colors"
      >
        <Star
          size={20}
          weight={isFavorite ? 'fill' : 'regular'}
          className={isFavorite ? 'text-yellow-500' : 'text-muted-foreground'}
        />
      </button>
    </div>
  )
}
