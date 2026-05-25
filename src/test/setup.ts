import '@testing-library/jest-dom/vitest'
import { beforeEach, vi } from 'vitest'
import {
  MockCapacitorSQLite,
  MockSQLiteConnection,
  resetMockSqlite,
} from './sqliteMock'
import { closeDatabase } from '@/lib/db/connection'

/**
 * Mock `@capacitor/core` so `Capacitor.getPlatform()` reports a native
 * platform under jsdom. This short-circuits the jeep-sqlite web-store
 * initialization in `connection.ts` (which would otherwise try to mount
 * a web component into the DOM and call into a real wa-sqlite WASM
 * library — neither plays well with vitest).
 */
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: () => 'android',
    isNativePlatform: () => true,
  },
}))

/**
 * Mock `@capacitor-community/sqlite` with our sql.js-backed shim. Tests
 * exercise the real `lib/db/connection.ts` code path; only the underlying
 * native plugin is swapped out.
 */
vi.mock('@capacitor-community/sqlite', () => ({
  CapacitorSQLite: MockCapacitorSQLite,
  SQLiteConnection: MockSQLiteConnection,
}))

/**
 * Mock the `jeep-sqlite/loader` import too, since `connection.ts` lazy-
 * imports it in the web init branch. We mock `Capacitor.getPlatform` to
 * 'android' above so this branch shouldn't actually be hit, but having
 * the mock here means the module resolution doesn't blow up even if it
 * were imported transitively.
 */
vi.mock('jeep-sqlite/loader', () => ({
  defineCustomElements: () => {},
}))

/**
 * Reset between every test: close the open connection (also clears the
 * connection.ts singleton) and dispose of the in-memory database. The
 * next test's `initDatabase()` call rebuilds the schema from scratch.
 */
beforeEach(async () => {
  await closeDatabase()
  await resetMockSqlite()
})
