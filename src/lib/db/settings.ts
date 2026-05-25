import { queryRows, runStatement } from './connection'

/**
 * Read a single value from the `app_settings` KV table. Returns null if the
 * key is unset.
 */
export async function getSetting(key: string): Promise<string | null> {
  const rows = await queryRows<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?',
    [key],
  )
  return rows[0]?.value ?? null
}

/**
 * Upsert a single value into the `app_settings` KV table. Used for language
 * preference, active game id, schema version, etc.
 */
export async function setSetting(key: string, value: string): Promise<void> {
  await runStatement(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  )
}

/** Remove a key from `app_settings`. */
export async function deleteSetting(key: string): Promise<void> {
  await runStatement('DELETE FROM app_settings WHERE key = ?', [key])
}
