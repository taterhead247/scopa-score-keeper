import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { PlayerProfile } from '../profiles'
import type { FavoriteGrouping } from '../groupings'
import type { Game, HandCategoryDetail } from '../game'
import * as profilesDb from './profiles'
import * as favoritesDb from './favorites'
import * as gamesDb from './games'
import * as completedGamesDb from './completedGames'
import * as settings from './settings'
import { SETTINGS_KEYS } from './schema'

/**
 * Stable React Query keys used by both the reads and the mutations'
 * invalidation calls. Keep them centralized so a mutation never invalidates
 * a key that no read subscribes to (which would silently break reactivity).
 */
const KEYS = {
  profiles: ['profiles'] as const,
  favorites: ['favorites'] as const,
  activeGames: ['games', 'active'] as const,
  game: (id: string) => ['games', 'one', id] as const,
  completedGames: ['games', 'completed'] as const,
  setting: (key: string) => ['setting', key] as const,
}

// ── Reads ───────────────────────────────────────────────

/** All player profiles, oldest first. */
export function useProfilesQuery() {
  return useQuery({ queryKey: KEYS.profiles, queryFn: profilesDb.listProfiles })
}

/** All user-pinned favorite groupings. */
export function useFavoritesQuery() {
  return useQuery({ queryKey: KEYS.favorites, queryFn: favoritesDb.listFavorites })
}

/** Every in-progress game (one row per Game, fully hydrated with players + hands). */
export function useActiveGamesQuery() {
  return useQuery({ queryKey: KEYS.activeGames, queryFn: gamesDb.listActiveGames })
}

/** A single game by id. Returns `null` when no id is provided or the game is gone. */
export function useGameQuery(id: string | null) {
  return useQuery({
    queryKey: id ? KEYS.game(id) : ['games', 'one', 'null'],
    queryFn: () => (id ? gamesDb.getGameById(id) : Promise.resolve(null)),
    enabled: id !== null,
  })
}

/** Every completed game, fully hydrated with players + hand history. */
export function useCompletedGamesQuery() {
  return useQuery({
    queryKey: KEYS.completedGames,
    queryFn: completedGamesDb.listCompletedGames,
  })
}

/**
 * Read a value from the `app_settings` KV. Used for language and the
 * currently-active game id.
 */
export function useSettingQuery(key: string) {
  return useQuery({ queryKey: KEYS.setting(key), queryFn: () => settings.getSetting(key) })
}

// ── Mutations ───────────────────────────────────────────

/** Invalidate every cached query so the next read pulls fresh data from SQLite. */
function useInvalidateAll() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries()
}

/** Insert a new profile. Existing reads of `useProfilesQuery` refetch on success. */
export function useInsertProfileMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: profilesDb.insertProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.profiles }),
  })
}

/** Update name/color/emoji on an existing profile. */
export function useUpdateProfileMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; name: string; color: string; emoji: string }) =>
      profilesDb.updateProfile(vars.id, { name: vars.name, color: vars.color, emoji: vars.emoji }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.profiles }),
  })
}

/**
 * Delete a profile. Snapshots on existing games are preserved by the schema
 * (FK uses ON DELETE SET NULL), so this also invalidates game-related caches
 * so any displayed profile_id-based links refresh.
 */
export function useDeleteProfileMutation() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: profilesDb.deleteProfile,
    onSuccess: invalidate,
  })
}

/** Add a favorite grouping. */
export function useInsertFavoriteMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (favorite: FavoriteGrouping) => favoritesDb.insertFavorite(favorite),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.favorites }),
  })
}

/** Remove a favorite grouping by id. */
export function useDeleteFavoriteMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => favoritesDb.deleteFavorite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEYS.favorites }),
  })
}

// ── Game lifecycle mutations ────────────────────────────

/**
 * Create a new game from a list of seats, set it as active, and return its id.
 * Invalidates active-games and the active-game-id setting so the UI flips
 * straight into the gameplay screen.
 */
export function useCreateGameMutation() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: async (game: Game) => {
      await gamesDb.createGame(game)
      await settings.setSetting(SETTINGS_KEYS.activeGameId, game.id)
      return game.id
    },
    onSuccess: invalidate,
  })
}

/** Toggle a category winner on the currently-banked hand. */
export function useSetHandCategoryWinnerMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      gameId: string
      category: 'cards' | 'coins' | 'settebello' | 'premiera'
      playerId: string | null
    }) => gamesDb.setHandCategoryWinner(vars.gameId, vars.category, vars.playerId),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.game(vars.gameId) })
      qc.invalidateQueries({ queryKey: KEYS.activeGames })
    },
  })
}

/** Set a player's scopa count for the currently-banked hand. */
export function useSetHandScopaScoreMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { gameId: string; playerId: string; count: number }) =>
      gamesDb.setHandScopaScore(vars.gameId, vars.playerId, vars.count),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: KEYS.game(vars.gameId) })
      qc.invalidateQueries({ queryKey: KEYS.activeGames })
    },
  })
}

/**
 * Persist a banked hand + update totals. The caller computes the per-player
 * `score`, `categories`, and `newTotal` from the current game state.
 */
export function useBankHandMutation() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (vars: {
      gameId: string
      handNumber: number
      timestamp: number
      perPlayer: Array<{
        playerId: string
        score: number
        categories: HandCategoryDetail
        newTotal: number
      }>
    }) => gamesDb.bankHand(vars.gameId, vars.handNumber, vars.timestamp, vars.perPlayer),
    onSuccess: invalidate,
  })
}

/** Finalize a game by recording winner + completion time. */
export function useCompleteGameMutation() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (vars: {
      gameId: string
      winner: { profileId: string; name: string }
      completedAt: number
    }) => gamesDb.completeGame(vars.gameId, vars.winner, vars.completedAt),
    onSuccess: invalidate,
  })
}

/** Reset every player's score on a game (preserves players, drops hands). */
export function useResetGameMutation() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: gamesDb.resetGame,
    onSuccess: invalidate,
  })
}

/** Delete a game outright (cascades to game_players + hand_history). */
export function useDeleteGameMutation() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: gamesDb.deleteGame,
    onSuccess: invalidate,
  })
}

/** Rename the snapshotted player names on a game (does not touch profiles). */
export function useRenameGamePlayersMutation() {
  const invalidate = useInvalidateAll()
  return useMutation({
    mutationFn: (vars: {
      gameId: string
      renames: Array<{ playerId: string; name: string }>
    }) => gamesDb.renameGamePlayers(vars.gameId, vars.renames),
    onSuccess: invalidate,
  })
}

// ── Settings mutations ──────────────────────────────────

/** Upsert a value into `app_settings`. */
export function useSetSettingMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { key: string; value: string }) => settings.setSetting(vars.key, vars.value),
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: KEYS.setting(vars.key) }),
  })
}

/** Delete a key from `app_settings`. */
export function useDeleteSettingMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: settings.deleteSetting,
    onSuccess: (_data, key) => qc.invalidateQueries({ queryKey: KEYS.setting(key) }),
  })
}

// Re-export the legacy type for convenience.
export type { PlayerProfile }
