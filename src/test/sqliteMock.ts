/**
 * sql.js-backed mock of `@capacitor-community/sqlite` for vitest.
 *
 * The mock is loaded by `src/test/setup.ts` via `vi.mock(...)`. It exposes
 * the same surface area that `src/lib/db/connection.ts` uses — enough to
 * let real SQL execute under jsdom against an in-memory database, so UI
 * integration tests exercise the same code path as production.
 *
 * Reset between tests with {@link resetMockSqlite}; the setup file calls
 * this in `beforeEach`.
 */

import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** Lazy-loaded sql.js module — initSqlJs returns a class factory we keep around. */
let sqlJs: SqlJsStatic | null = null

/** The in-memory SQLite database. Recreated by {@link resetMockSqlite}. */
let mockDb: Database | null = null

/** Get (or initialize) the sql.js module. WASM is loaded from node_modules. */
async function getSqlJs(): Promise<SqlJsStatic> {
  if (sqlJs) return sqlJs
  sqlJs = await initSqlJs({
    /** Resolve the WASM blob from sql.js's distributed build. */
    locateFile: (file: string) => join(process.cwd(), 'node_modules/sql.js/dist', file),
    /** sql.js needs `fetch`-able paths by default; provide synchronous fs in Node. */
    wasmBinary: readFileSync(join(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm')),
  })
  return sqlJs
}

/** Throw the same shape of error the real plugin would. */
function db(): Database {
  if (!mockDb) throw new Error('Mock SQLite database not initialized — did open() run?')
  return mockDb
}

/**
 * Reset the in-memory database — closes the old handle and clears the
 * sql.js cache. Called from the global `beforeEach` in `setup.ts` so every
 * test starts from a clean state.
 */
export async function resetMockSqlite(): Promise<void> {
  if (mockDb) {
    mockDb.close()
    mockDb = null
  }
}

/**
 * Mock implementation of the `SQLiteDBConnection` instance the plugin
 * returns. Only the methods our connection layer actually calls are
 * implemented — others throw to surface mismatches loudly.
 */
class MockSQLiteDBConnection {
  async open(): Promise<void> {
    if (mockDb) return
    const SQL = await getSqlJs()
    mockDb = new SQL.Database()
  }

  async close(): Promise<void> {
    if (mockDb) {
      mockDb.close()
      mockDb = null
    }
  }

  async execute(sql: string): Promise<{ changes: { changes: number } }> {
    db().exec(sql)
    return { changes: { changes: db().getRowsModified() } }
  }

  async query<T = unknown>(
    sql: string,
    values: unknown[] = [],
  ): Promise<{ values: T[] }> {
    const stmt = db().prepare(sql)
    stmt.bind(values as never[])
    const rows: T[] = []
    while (stmt.step()) rows.push(stmt.getAsObject() as T)
    stmt.free()
    return { values: rows }
  }

  async run(
    sql: string,
    values: unknown[] = [],
  ): Promise<{ changes: { changes: number; lastId: number } }> {
    db().run(sql, values as never[])
    const changes = db().getRowsModified()
    // `last_insert_rowid()` returns the id from the most recent INSERT;
    // tables without AUTOINCREMENT will get 0 here, matching the plugin.
    const lastIdRows = db().exec('SELECT last_insert_rowid() AS id')
    const lastId = (lastIdRows[0]?.values?.[0]?.[0] as number | undefined) ?? 0
    return { changes: { changes, lastId } }
  }

  async executeSet(
    statements: Array<{ statement: string; values?: unknown[] }>,
  ): Promise<{ changes: { changes: number } }> {
    db().exec('BEGIN')
    try {
      for (const s of statements) {
        if (s.values && s.values.length > 0) {
          db().run(s.statement, s.values as never[])
        } else {
          db().exec(s.statement)
        }
      }
      db().exec('COMMIT')
    } catch (err) {
      db().exec('ROLLBACK')
      throw err
    }
    return { changes: { changes: db().getRowsModified() } }
  }
}

/**
 * Mock implementation of the `SQLiteConnection` class the plugin exports.
 *
 * The real plugin manages a pool of named connections; the mock keeps a
 * single in-memory DB and returns the same wrapper from every call. Good
 * enough for our use case — production code only opens one connection.
 */
export class MockSQLiteConnection {
  private connection = new MockSQLiteDBConnection()

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async isConnection(_name: string, _readonly: boolean): Promise<{ result: boolean }> {
    return { result: mockDb !== null }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async retrieveConnection(_name: string, _readonly: boolean): Promise<MockSQLiteDBConnection> {
    return this.connection
  }

  async createConnection(
    _name: string,
    _encrypted: boolean,
    _encryption: string,
    _version: number,
    _readonly: boolean,
  ): Promise<MockSQLiteDBConnection> {
    return this.connection
  }

  async closeConnection(_name: string, _readonly: boolean): Promise<void> {
    await this.connection.close()
  }

  async initWebStore(): Promise<void> {
    // No-op in test env — there's no web store to initialize.
  }
}

/** Replaces the `CapacitorSQLite` export from the plugin module. */
export const MockCapacitorSQLite = {}
