/**
 * Normalized SQLite schema for the Scopa Score Tracker.
 *
 * Design notes
 * ------------
 * - **Unified games table**: active and completed games live in the same
 *   row. A game is active while `completed_at IS NULL` and completed once
 *   it's set. This avoids duplication between two near-identical tables.
 * - **Snapshot-on-creation**: `game_players` copies the profile's name,
 *   color, and emoji at game-start. Later edits to the source profile do
 *   not retroactively change historical games. Profile deletion is handled
 *   via `ON DELETE SET NULL` on the FK so games remain readable.
 * - **Hand storage**: each banked hand is one row in `hand_history`, with
 *   per-player score and category records in two child tables. SQL
 *   aggregates can compute leaderboard / category-win-rate stats directly.
 * - **Favorites**: `profile_ids` is stored as a JSON-encoded array because
 *   order matters for seat assignment. Querying members would require a
 *   junction table; that wasn't worth the cost for the current UI.
 * - **App settings**: a generic KV table for language preference, the
 *   currently active game id, and migration sentinel values.
 *
 * Schema versioning is tracked via the `schema_version` key in
 * `app_settings`. Bumping `SCHEMA_VERSION` is how future migrations gate
 * their CREATE / ALTER scripts.
 */

export const SCHEMA_VERSION = 1

/** Statements run idempotently to bring a fresh DB to {@link SCHEMA_VERSION}. */
export const SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );`,

  // Note: no FK on winner_profile_id — when a profile is deleted, the
  // historical winner reference is intentionally preserved so stats can
  // continue attributing the win. Snapshot fields on related rows
  // (winner_name on games, name/color/emoji on game_players) keep
  // human-readable details intact even after the profile is gone.
  `CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY NOT NULL,
    created_at INTEGER NOT NULL,
    completed_at INTEGER,
    winner_profile_id TEXT,
    winner_name TEXT,
    hand_cards_winner_player_id TEXT,
    hand_coins_winner_player_id TEXT,
    hand_settebello_winner_player_id TEXT,
    hand_premiera_winner_player_id TEXT
  );`,

  `CREATE INDEX IF NOT EXISTS idx_games_completed_at ON games(completed_at);`,

  // Note: no FK on profile_id — same rationale as games.winner_profile_id
  // above. Player-centric stats need stable profile attribution across
  // the lifetime of the data, and we already handle missing profiles
  // gracefully at the UI layer (QuickStartSection filters them out;
  // HistoryScreen renders the snapshot fields).
  `CREATE TABLE IF NOT EXISTS game_players (
    game_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    profile_id TEXT,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    emoji TEXT NOT NULL,
    total_score INTEGER NOT NULL DEFAULT 0,
    hand_scopa_score INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (game_id, player_id),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_game_players_profile_id ON game_players(profile_id);`,

  // hand_history.id is a TEXT id generated in code (not AUTOINCREMENT)
  // so the row + its children in hand_scores / hand_categories can be
  // inserted atomically in a single transaction. With an integer
  // AUTOINCREMENT we'd have to insert hand_history first to get its
  // lastId, then insert children separately — a window in which a
  // dangling parent could exist if the child insert fails.
  `CREATE TABLE IF NOT EXISTS hand_history (
    id TEXT PRIMARY KEY NOT NULL,
    game_id TEXT NOT NULL,
    hand_number INTEGER NOT NULL,
    timestamp INTEGER NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
  );`,

  `CREATE INDEX IF NOT EXISTS idx_hand_history_game_id ON hand_history(game_id);`,

  `CREATE TABLE IF NOT EXISTS hand_scores (
    hand_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    PRIMARY KEY (hand_id, player_id),
    FOREIGN KEY (hand_id) REFERENCES hand_history(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS hand_categories (
    hand_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    cards INTEGER NOT NULL DEFAULT 0,
    coins INTEGER NOT NULL DEFAULT 0,
    settebello INTEGER NOT NULL DEFAULT 0,
    premiera INTEGER NOT NULL DEFAULT 0,
    scopa INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (hand_id, player_id),
    FOREIGN KEY (hand_id) REFERENCES hand_history(id) ON DELETE CASCADE
  );`,

  `CREATE TABLE IF NOT EXISTS favorite_groupings (
    id TEXT PRIMARY KEY NOT NULL,
    profile_ids TEXT NOT NULL,
    name TEXT,
    created_at INTEGER NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );`,
]

/** Database name passed to the SQLite plugin. Single DB for the whole app. */
export const DB_NAME = 'scopa'

/** Keys used in the `app_settings` KV table. */
export const SETTINGS_KEYS = {
  schemaVersion: 'schema_version',
  language: 'language',
  activeGameId: 'active_game_id',
  hapticsEnabled: 'haptics_enabled',
} as const
