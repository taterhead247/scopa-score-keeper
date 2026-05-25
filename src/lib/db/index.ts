/**
 * Barrel re-export for the SQLite layer.
 *
 * UI code imports from `@/lib/db` and gets the typed entity modules + the
 * init hook. Each entity module's functions are kept un-namespaced to match
 * the pattern of the existing `lib/profiles.ts` and `lib/groupings.ts`.
 */

export * from './schema'
export {
  initDatabase,
  closeDatabase,
  getDb,
  queryRows,
  runStatement,
  runTransaction,
} from './connection'

export * as settings from './settings'
export * as profilesDb from './profiles'
export * as favoritesDb from './favorites'
export * as gamesDb from './games'
export * as completedGamesDb from './completedGames'
