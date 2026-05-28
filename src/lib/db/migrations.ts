/**
 * One-shot data migrations that run after {@link initDatabase} completes
 * and before the React tree renders. Schema-level changes belong in
 * {@link SCHEMA_STATEMENTS}; this module is for *data-level* fixes that
 * touch existing user rows (e.g. forward-migrating palette hex values
 * when the accessible-colors revision lands).
 *
 * Each migration is idempotent so running it twice (e.g. across hot
 * reloads in dev) is safe.
 */

import { COLOR_MIGRATION_MAP } from '../profiles'
import { runTransaction } from './connection'

/**
 * Forward-migrate any profile or snapshotted game_player whose `color`
 * matches the pre-AA palette. The migration is idempotent — once a row's
 * color is one of the new values, no UPDATE matches it on the next boot.
 *
 * We deliberately migrate `game_players.color` too (the snapshot on
 * historical games) so completed-game views also display readable colors.
 * That technically rewrites history, but the alternative — leaving low-
 * contrast colors on every past game forever — is the worse choice.
 */
export async function runDataMigrations(): Promise<void> {
  const statements: Array<{ statement: string; values?: unknown[] }> = []
  for (const [oldHex, newHex] of Object.entries(COLOR_MIGRATION_MAP)) {
    statements.push({
      statement: 'UPDATE profiles SET color = ? WHERE color = ?',
      values: [newHex, oldHex],
    })
    statements.push({
      statement: 'UPDATE game_players SET color = ? WHERE color = ?',
      values: [newHex, oldHex],
    })
  }
  await runTransaction(statements)
}
