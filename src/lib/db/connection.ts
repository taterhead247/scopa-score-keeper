import { Capacitor } from '@capacitor/core'
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'
import { DB_NAME, SCHEMA_STATEMENTS, SCHEMA_VERSION, SETTINGS_KEYS } from './schema'

/**
 * Singleton holder for the open SQLite connection.
 *
 * The connection is opened exactly once per app session by {@link initDatabase}.
 * Every entity module ({@link ./profiles}, {@link ./games}, etc.) calls
 * {@link getDb} to obtain the open connection; calling before init throws.
 */
let dbConnection: SQLiteDBConnection | null = null
let initPromise: Promise<void> | null = null

/**
 * Whether the runtime is the web build. On web, every write needs to be
 * followed by `sqlite.saveToStore(...)` to flush the in-memory sql.js
 * database back to its IndexedDB-backed store — otherwise the data is
 * lost on the next page load. On native, writes go straight to disk and
 * `saveToStore` is a no-op (but we skip the call entirely to avoid the
 * round-trip).
 */
let isWebPlatform = false

/** The shared connection manager from the plugin. */
const sqlite = new SQLiteConnection(CapacitorSQLite)

/**
 * Initialize the SQLite layer for the current platform, open the database,
 * and apply the schema. Safe to call multiple times — only runs once.
 *
 * Web path: registers the `jeep-sqlite` web component and mounts the
 * IndexedDB-backed wa-sqlite store before opening the connection.
 *
 * Native path (Android, iOS): opens the platform SQLite database directly.
 */
export async function initDatabase(): Promise<void> {
  if (initPromise) return initPromise
  initPromise = (async () => {
    const platform = Capacitor.getPlatform()
    isWebPlatform = platform === 'web'
    if (platform === 'web') {
      // Lazy-import so the jeep-sqlite web component isn't bundled into the
      // native build (where it isn't used).
      const { defineCustomElements } = await import('jeep-sqlite/loader')
      defineCustomElements(window)
      // The web store needs a <jeep-sqlite> element in the DOM before init.
      if (!document.querySelector('jeep-sqlite')) {
        document.body.appendChild(document.createElement('jeep-sqlite'))
      }
      await customElements.whenDefined('jeep-sqlite')
      await sqlite.initWebStore()
    }

    // Reuse an existing connection if a hot reload left one open.
    const existing = (await sqlite.isConnection(DB_NAME, false)).result
    dbConnection = existing
      ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, 'no-encryption', SCHEMA_VERSION, false)

    await dbConnection.open()
    await applySchema(dbConnection)
  })()
  return initPromise
}

/**
 * Run every statement in {@link SCHEMA_STATEMENTS} (all guarded with
 * `CREATE TABLE IF NOT EXISTS`) and record the current schema version in
 * `app_settings`. Idempotent across launches.
 */
async function applySchema(db: SQLiteDBConnection): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.execute(statement)
  }
  await db.run(
    `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [SETTINGS_KEYS.schemaVersion, String(SCHEMA_VERSION)],
  )
}

/**
 * Get the open database connection. Throws if {@link initDatabase} hasn't
 * been awaited yet — components should never render before the init promise
 * resolves.
 */
export function getDb(): SQLiteDBConnection {
  if (!dbConnection) {
    throw new Error('Database not initialized — call initDatabase() before any DB access.')
  }
  return dbConnection
}

/**
 * Close the database and clear the singleton. Used by tests between cases
 * to ensure isolation; not called in normal app lifecycle.
 */
export async function closeDatabase(): Promise<void> {
  if (dbConnection) {
    await dbConnection.close()
    await sqlite.closeConnection(DB_NAME, false)
    dbConnection = null
  }
  isWebPlatform = false
  initPromise = null
}

/**
 * On web, flush in-memory writes to the IndexedDB-backed store. Called
 * automatically by {@link runStatement} and {@link runTransaction}; safe
 * to call externally if a future code path bypasses those helpers.
 *
 * No-op on native — writes there go straight to disk and the underlying
 * plugin doesn't even implement `saveToStore` on those platforms.
 */
export async function flushWrites(): Promise<void> {
  if (!isWebPlatform) return
  await sqlite.saveToStore(DB_NAME)
}

/**
 * Convenience wrapper around `db.query` that unwraps the `{values}` envelope
 * and types the rows.
 */
export async function queryRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const db = getDb()
  const result = await db.query(sql, params as never[])
  return (result.values ?? []) as T[]
}

/**
 * Convenience wrapper around `db.run` for INSERT / UPDATE / DELETE. Returns
 * `lastId` for cases where we just inserted a row with an AUTOINCREMENT id.
 * Automatically flushes the write to the web store via {@link flushWrites}.
 */
export async function runStatement(
  sql: string,
  params: unknown[] = [],
): Promise<{ changes: number; lastId: number }> {
  const db = getDb()
  const result = await db.run(sql, params as never[])
  const changes = result.changes?.changes ?? 0
  const lastId = result.changes?.lastId ?? 0
  await flushWrites()
  return { changes, lastId }
}

/**
 * Run a set of related statements atomically as a transaction. Used for the
 * multi-table writes that record a banked hand or finalize a completed game.
 * Automatically flushes the write to the web store via {@link flushWrites}.
 *
 * Each entry is `[sql, params]`. On any failure the whole set rolls back.
 */
export async function runTransaction(
  statements: Array<{ statement: string; values?: unknown[] }>,
): Promise<void> {
  const db = getDb()
  await db.executeSet(statements as never[])
  await flushWrites()
}
