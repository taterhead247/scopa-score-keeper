import type { FavoriteGrouping } from '../groupings'
import { queryRows, runStatement } from './connection'

/** SQLite row shape for the `favorite_groupings` table. */
type FavoriteRow = {
  id: string
  profile_ids: string
  name: string | null
  created_at: number
}

/**
 * Convert a row into the app's {@link FavoriteGrouping}, parsing the JSON
 * ids defensively. We write this column ourselves so malformed JSON shouldn't
 * happen in practice — but a single corrupt row throwing here would take down
 * the entire favorites query, so fall back to an empty profileIds list. The
 * QuickStartSection already hides favorites whose profiles can't be resolved,
 * so the corrupt row will simply not render.
 */
function rowToFavorite(row: FavoriteRow): FavoriteGrouping {
  let profileIds: string[] = []
  try {
    const parsed: unknown = JSON.parse(row.profile_ids)
    if (Array.isArray(parsed) && parsed.every(v => typeof v === 'string')) {
      profileIds = parsed
    }
  } catch {
    // Corrupt JSON — fall through to the empty-array default above.
  }
  return {
    id: row.id,
    profileIds,
    name: row.name ?? undefined,
    createdAt: row.created_at,
  }
}

/** Return every favorite grouping, oldest first (creation order). */
export async function listFavorites(): Promise<FavoriteGrouping[]> {
  const rows = await queryRows<FavoriteRow>(
    'SELECT id, profile_ids, name, created_at FROM favorite_groupings ORDER BY created_at ASC',
  )
  return rows.map(rowToFavorite)
}

/**
 * Insert a new favorite. `profileIds` is JSON-encoded into the row so
 * ordering is preserved (matters for seat assignment when loading).
 */
export async function insertFavorite(favorite: FavoriteGrouping): Promise<void> {
  await runStatement(
    'INSERT INTO favorite_groupings (id, profile_ids, name, created_at) VALUES (?, ?, ?, ?)',
    [
      favorite.id,
      JSON.stringify(favorite.profileIds),
      favorite.name ?? null,
      favorite.createdAt,
    ],
  )
}

/** Update an existing favorite's name (only field a user can edit today). */
export async function renameFavorite(id: string, name: string | null): Promise<void> {
  await runStatement('UPDATE favorite_groupings SET name = ? WHERE id = ?', [name, id])
}

/** Remove a favorite grouping by id. */
export async function deleteFavorite(id: string): Promise<void> {
  await runStatement('DELETE FROM favorite_groupings WHERE id = ?', [id])
}
