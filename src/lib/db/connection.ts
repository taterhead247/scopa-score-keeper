import { Capacitor } from '@capacitor/core'
import {
  CapacitorSQLite,
  SQLiteConnection,
  type SQLiteDBConnection,
} from '@capacitor-community/sqlite'
import { DB_NAME, SCHEMA_STATEMENTS, SCHEMA_VERSION, SETTINGS_KEYS } from './schema'
import { runDataMigrations } from './migrations'

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
 * Cached orchestrator promise for {@link ensureAppInit}: init + data
 * migrations. Distinct from {@link initPromise} so the React layer can
 * await both schema *and* row-level migrations before reading data,
 * without exposing the migration step in every call site.
 *
 * Cleared by {@link closeDatabase} so tests get a fresh init each run.
 */
let appInitPromise: Promise<void> | null = null

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
    try {
      const platform = Capacitor.getPlatform()
      isWebPlatform = platform === 'web'
      if (platform === 'web') {
        // Lazy-import so the jeep-sqlite web component isn't bundled into the
        // native build (where it isn't used).
        const { defineCustomElements } = await import('jeep-sqlite/loader')
        defineCustomElements(window)
        // The web store needs a <jeep-sqlite> element in the DOM before init.
        if (!document.querySelector('jeep-sqlite')) {
          const el = document.createElement('jeep-sqlite')
          // jeep-sqlite hardcodes `wasmPath = '/assets'` (absolute, host-rooted)
          // for locating `sql-wasm.wasm`. That works on a root-deploy host
          // (the dev server, a custom domain at `/`) but breaks on sub-path
          // deploys like GitHub Pages, where the file actually lives at
          // `/<repo>/assets/sql-wasm.wasm` — the bare `/assets/...` path
          // returns the SPA's 404 fallback (HTML), which then crashes
          // `WebAssembly.compileStreaming` with an MIME-type error. Setting
          // `wasm-path` to a *relative* `./assets` makes jeep-sqlite resolve
          // the wasm relative to the current document, which works under
          // any deployment base (root OR sub-path).
          // The Stencil component declares this attribute as the lowercase
          // `wasmpath` (no hyphen), not the conventional `wasm-path`.
          el.setAttribute('wasmpath', './assets')
          document.body.appendChild(el)
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
      // SQLite disables foreign key enforcement by default, and the setting
      // is per-connection. Our schema uses ON DELETE CASCADE for game_players
      // and hand_history child rows; without this PRAGMA those cascades
      // silently never fire and deleted games leave orphaned children.
      await dbConnection.execute('PRAGMA foreign_keys = ON;')
      await applySchema(dbConnection)
    } catch (err) {
      // Clear the cached promise so the next caller can retry. Without this
      // a transient init failure (e.g. IndexedDB temporarily unavailable)
      // would permanently brick the app until a full page reload.
      initPromise = null
      throw err
    }
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
 * Resolve once the DB is open AND data migrations have applied.
 *
 * This is the gate that the {@link queryRows} / {@link runStatement} /
 * {@link runTransaction} helpers await internally, which means React
 * components can call those helpers (via TanStack Query hooks) the
 * instant they mount — no need to wait for an upstream `initDatabase()`
 * resolve before rendering. That's the architectural shift that lets the
 * setup screen paint at FCP instead of after sql.js bootstrap.
 *
 * Idempotent and cached: only runs the underlying init+migrations once
 * per process. Subsequent callers get the same promise.
 */
export async function ensureAppInit(): Promise<void> {
  if (appInitPromise) return appInitPromise
  appInitPromise = (async () => {
    await initDatabase()
    // migrations.ts uses the un-gated `getDb` + `flushWrites` from this
    // module. The static cycle is safe because both sides only use the
    // imports inside function bodies, not at top-level execution.
    await runDataMigrations()
  })().catch(err => {
    // Surface the failure to the caller, but clear the cache so a retry
    // (e.g. a manual page reload) can attempt init again.
    appInitPromise = null
    throw err
  })
  return appInitPromise
}

/**
 * Get the open database connection. Throws if {@link initDatabase} hasn't
 * been awaited yet — internal callers (migrations + the gated query
 * helpers) make sure init has resolved before calling this.
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
  appInitPromise = null
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
 * and types the rows. Awaits {@link ensureAppInit} so callers in React land
 * can fire queries the instant they mount, without an upstream init gate.
 */
export async function queryRows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  await ensureAppInit()
  const db = getDb()
  const result = await db.query(sql, params as never[])
  return (result.values ?? []) as T[]
}

/**
 * Convenience wrapper around `db.run` for INSERT / UPDATE / DELETE. Returns
 * `lastId` for cases where we just inserted a row with an AUTOINCREMENT id.
 * Automatically flushes the write to the web store via {@link flushWrites}.
 * Awaits {@link ensureAppInit} so it's safe to call before any explicit init.
 */
export async function runStatement(
  sql: string,
  params: unknown[] = [],
): Promise<{ changes: number; lastId: number }> {
  await ensureAppInit()
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
 * Awaits {@link ensureAppInit} so it's safe to call before any explicit init.
 *
 * Each entry is `[sql, params]`. On any failure the whole set rolls back.
 */
export async function runTransaction(
  statements: Array<{ statement: string; values?: unknown[] }>,
): Promise<void> {
  await ensureAppInit()
  const db = getDb()
  // The plugin's executeSet rejects entries without a `values` field even
  // when the statement has no params, so normalize here. Cheaper than
  // remembering at every call site.
  const normalized = statements.map(s => ({ statement: s.statement, values: s.values ?? [] }))
  await db.executeSet(normalized as never[])
  await flushWrites()
}
