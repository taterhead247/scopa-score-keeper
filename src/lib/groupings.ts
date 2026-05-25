import type { PlayerProfile } from './profiles'

/**
 * Stable identifier for a player grouping.
 *
 * Built by sorting the profileIds lexicographically and joining them, so two
 * groupings with the same members in different orders share an id. This lets
 * "Mario vs Luigi" and "Luigi vs Mario" be recognized as the same group.
 */
export type GroupingId = string

/**
 * A user-pinned grouping of players that the user wants to start games with
 * quickly. Persisted under {@link FAVORITE_GROUPINGS_STORAGE_KEY}.
 *
 * `name` is optional — when unset, the UI falls back to listing the player
 * names automatically.
 */
export type FavoriteGrouping = {
  id: GroupingId
  /** Profile ids in the order the user originally set them in seats. */
  profileIds: string[]
  /** Optional user-provided label (e.g. "Family Game Night"). */
  name?: string
  /** Unix-ms timestamp the favorite was first created. */
  createdAt: number
}

/**
 * A grouping of players derived from recent completed games. Not persisted on
 * its own — recomputed from `completedGames` each render by
 * {@link computeRecentGroupings}.
 */
export type RecentGrouping = {
  id: GroupingId
  /** Profile ids in the order they appeared in the most recent game. */
  profileIds: string[]
  /** Unix-ms timestamp of the most recent game using this grouping. */
  lastPlayedAt: number
  /** How many completed games used this exact grouping. */
  playCount: number
}

/** localStorage key under which {@link FavoriteGrouping} entries are persisted. */
export const FAVORITE_GROUPINGS_STORAGE_KEY = 'scopa-favorite-groupings'

/**
 * Build a {@link GroupingId} from a set of profile ids.
 *
 * The id is order-insensitive: passing the same ids in any order returns the
 * same id. This is what allows "play with the same group again" to recognize
 * the group regardless of which seat each player sat in last time.
 */
export function groupingId(profileIds: string[]): GroupingId {
  return [...profileIds].sort().join('::')
}

/**
 * Minimal shape of a completed-game record needed for grouping derivation.
 * Kept as a structural subtype so callers can pass either the full
 * `CompletedGame` from `src/lib/game.ts` or test fixtures.
 */
export type GroupingSourceGame = {
  players: { profileId: string }[]
  completedAt: number
}

/**
 * Derive recent player groupings from completed games.
 *
 * - Deduplicates by {@link groupingId} (members ignored of order)
 * - Sorts most-recent first by `completedAt`
 * - Drops any grouping whose members include a deleted profile
 * - Drops groupings with fewer than 2 players (edge case from corrupted data)
 * - Limits to `limit` entries
 *
 * Pure — recompute on every render without caching.
 */
export function computeRecentGroupings(
  completedGames: GroupingSourceGame[],
  profiles: PlayerProfile[],
  limit = 5,
): RecentGrouping[] {
  const liveProfileIds = new Set(profiles.map(p => p.id))
  const byId = new Map<GroupingId, RecentGrouping>()

  for (const game of completedGames) {
    const profileIds = game.players.map(p => p.profileId)
    if (profileIds.length < 2) continue
    if (!profileIds.every(id => liveProfileIds.has(id))) continue
    const id = groupingId(profileIds)
    const existing = byId.get(id)
    if (existing) {
      existing.playCount += 1
      if (game.completedAt > existing.lastPlayedAt) {
        existing.lastPlayedAt = game.completedAt
        existing.profileIds = profileIds
      }
    } else {
      byId.set(id, {
        id,
        profileIds,
        lastPlayedAt: game.completedAt,
        playCount: 1,
      })
    }
  }

  return [...byId.values()]
    .sort((a, b) => b.lastPlayedAt - a.lastPlayedAt)
    .slice(0, limit)
}
