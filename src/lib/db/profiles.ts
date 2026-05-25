import type { PlayerProfile } from '../profiles'
import { queryRows, runStatement } from './connection'

/** SQLite row shape for the `profiles` table. */
type ProfileRow = {
  id: string
  name: string
  color: string
  emoji: string
  created_at: number
}

/** Convert a `profiles` table row into the app's {@link PlayerProfile} shape. */
function rowToProfile(row: ProfileRow): PlayerProfile {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    emoji: row.emoji,
    createdAt: row.created_at,
  }
}

/** Return every profile, sorted by `created_at` ascending (creation order). */
export async function listProfiles(): Promise<PlayerProfile[]> {
  const rows = await queryRows<ProfileRow>(
    'SELECT id, name, color, emoji, created_at FROM profiles ORDER BY created_at ASC',
  )
  return rows.map(rowToProfile)
}

/** Insert a new profile. The caller is responsible for generating the id. */
export async function insertProfile(profile: PlayerProfile): Promise<void> {
  await runStatement(
    'INSERT INTO profiles (id, name, color, emoji, created_at) VALUES (?, ?, ?, ?, ?)',
    [profile.id, profile.name, profile.color, profile.emoji, profile.createdAt],
  )
}

/**
 * Update mutable fields on a profile (name, color, emoji). The id and
 * created_at are intentionally not updatable here.
 */
export async function updateProfile(
  id: string,
  patch: { name: string; color: string; emoji: string },
): Promise<void> {
  await runStatement(
    'UPDATE profiles SET name = ?, color = ?, emoji = ? WHERE id = ?',
    [patch.name, patch.color, patch.emoji, id],
  )
}

/**
 * Delete a profile by id. Historical games keep their snapshotted
 * name/color/emoji because the schema's FKs use `ON DELETE SET NULL` —
 * `game_players.profile_id` becomes NULL but the snapshot fields remain.
 */
export async function deleteProfile(id: string): Promise<void> {
  await runStatement('DELETE FROM profiles WHERE id = ?', [id])
}
