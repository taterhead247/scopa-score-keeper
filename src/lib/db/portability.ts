/**
 * Whole-database export/import for issue #45.
 *
 * Produces a single JSON blob containing every user-owned entity (profiles,
 * favorites, active + completed games, language preference). The shape is
 * deliberately *entity-level* (matching `PlayerProfile`, `Game`, etc.) rather
 * than row-level so a human inspecting the file can read it. On import we
 * validate with zod, wipe the existing tables, and re-insert in a single
 * transaction — all-or-nothing, no half-imported DB.
 *
 * The `schemaVersion` field lets a future build refuse a backup whose
 * structure it can't handle. For now we accept anything that passes zod
 * validation; bump `BACKUP_FORMAT_VERSION` if the JSON shape changes
 * incompatibly later on.
 */

import { z } from 'zod'
import type { Game, CompletedGame, HandCategoryDetail } from '../game'
import type { PlayerProfile } from '../profiles'
import type { FavoriteGrouping } from '../groupings'
import * as profilesDb from './profiles'
import * as favoritesDb from './favorites'
import * as gamesDb from './games'
import * as completedGamesDb from './completedGames'
import * as settingsDb from './settings'
import { runTransaction } from './connection'
import { SCHEMA_VERSION, SETTINGS_KEYS } from './schema'

/**
 * Versions the *backup JSON shape* itself, independent of `SCHEMA_VERSION`
 * (which versions the SQLite schema). They will often move together but can
 * diverge — e.g. a schema migration that doesn't change exported fields.
 */
export const BACKUP_FORMAT_VERSION = 1

const zHandCategoryDetail = z.object({
  cards: z.boolean(),
  coins: z.boolean(),
  settebello: z.boolean(),
  premiera: z.boolean(),
  scopa: z.number(),
})

const zHandHistoryEntry = z.object({
  handNumber: z.number(),
  scores: z.record(z.string(), z.number()),
  categories: z.record(z.string(), zHandCategoryDetail),
  timestamp: z.number(),
})

const zPlayerProfile = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  emoji: z.string(),
  createdAt: z.number(),
})

const zFavoriteGrouping = z.object({
  id: z.string(),
  profileIds: z.array(z.string()),
  name: z.string().optional(),
  createdAt: z.number(),
})

const zGamePlayer = z.object({
  id: z.string(),
  profileId: z.string(),
  name: z.string(),
  color: z.string(),
  emoji: z.string(),
  totalScore: z.number(),
})

const zGame = z.object({
  id: z.string(),
  players: z.array(zGamePlayer),
  handScopaScores: z.record(z.string(), z.number()),
  handCardsWinner: z.string().nullable(),
  handCoinsWinner: z.string().nullable(),
  handSettebelloWinner: z.string().nullable(),
  handPremieraWinner: z.string().nullable(),
  handHistory: z.array(zHandHistoryEntry),
  createdAt: z.number(),
})

const zCompletedGamePlayer = z.object({
  playerId: z.string().optional(),
  profileId: z.string(),
  name: z.string(),
  score: z.number(),
  color: z.string(),
  emoji: z.string(),
})

const zCompletedGame = z.object({
  id: z.string(),
  players: z.array(zCompletedGamePlayer),
  winnerName: z.string(),
  winnerProfileId: z.string().optional(),
  completedAt: z.number(),
  handHistory: z.array(zHandHistoryEntry).optional(),
})

export const zBackup = z.object({
  schemaVersion: z.number(),
  formatVersion: z.number(),
  exportedAt: z.number(),
  app: z.object({ name: z.string() }).passthrough().optional(),
  profiles: z.array(zPlayerProfile),
  favorites: z.array(zFavoriteGrouping),
  games: z.array(zGame),
  completedGames: z.array(zCompletedGame),
  settings: z.object({
    language: z.string().optional(),
    activeGameId: z.string().nullable().optional(),
  }),
})

export type BackupJson = z.infer<typeof zBackup>

/**
 * Snapshot every user-owned table into a single JSON object suitable for
 * download. Reads are issued in parallel.
 */
export async function exportData(): Promise<BackupJson> {
  const [profiles, favorites, games, completedGames, language, activeGameId] = await Promise.all([
    profilesDb.listProfiles(),
    favoritesDb.listFavorites(),
    gamesDb.listActiveGames(),
    completedGamesDb.listCompletedGames(),
    settingsDb.getSetting(SETTINGS_KEYS.language),
    settingsDb.getSetting(SETTINGS_KEYS.activeGameId),
  ])
  return {
    schemaVersion: SCHEMA_VERSION,
    formatVersion: BACKUP_FORMAT_VERSION,
    exportedAt: Date.now(),
    app: { name: 'scopa-score-keeper' },
    profiles,
    favorites,
    games,
    completedGames,
    settings: {
      language: language ?? undefined,
      activeGameId: activeGameId ?? undefined,
    },
  }
}

/**
 * Validate, wipe, and replace. Runs in one transaction so a half-imported
 * DB is impossible. Throws on validation failure — the caller surfaces a
 * friendly toast.
 *
 * Version policy: we accept any backup whose `formatVersion` /
 * `schemaVersion` is at or below the values this build supports. Older
 * backups round-trip naturally because the zod schema validates the shape.
 * Newer backups (made by a future build) are rejected outright — their
 * structure may include fields this build doesn't know about, so blindly
 * importing could lose data or hit FK errors mid-transaction.
 */
export async function importData(raw: unknown): Promise<void> {
  const data = zBackup.parse(raw)

  if (data.formatVersion > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Backup format v${data.formatVersion} is newer than this app supports (v${BACKUP_FORMAT_VERSION}). Update the app and try again.`,
    )
  }
  if (data.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      `Backup schema v${data.schemaVersion} is newer than this app supports (v${SCHEMA_VERSION}). Update the app and try again.`,
    )
  }

  const statements: Array<{ statement: string; values?: unknown[] }> = []

  // Wipe order matches FK direction: child tables first.
  statements.push({ statement: 'DELETE FROM hand_categories', values: [] })
  statements.push({ statement: 'DELETE FROM hand_scores', values: [] })
  statements.push({ statement: 'DELETE FROM hand_history', values: [] })
  statements.push({ statement: 'DELETE FROM game_players', values: [] })
  statements.push({ statement: 'DELETE FROM games', values: [] })
  statements.push({ statement: 'DELETE FROM favorite_groupings', values: [] })
  statements.push({ statement: 'DELETE FROM profiles', values: [] })
  // Preserve the `schema_version` row in app_settings; only nuke the
  // user-owned keys so a future build still knows what migrations to run.
  statements.push({
    statement: 'DELETE FROM app_settings WHERE key IN (?, ?)',
    values: [SETTINGS_KEYS.language, SETTINGS_KEYS.activeGameId],
  })

  for (const p of data.profiles) {
    statements.push({
      statement: 'INSERT INTO profiles (id, name, color, emoji, created_at) VALUES (?, ?, ?, ?, ?)',
      values: [p.id, p.name, p.color, p.emoji, p.createdAt],
    })
  }

  for (const f of data.favorites) {
    statements.push({
      statement: 'INSERT INTO favorite_groupings (id, profile_ids, name, created_at) VALUES (?, ?, ?, ?)',
      values: [f.id, JSON.stringify(f.profileIds), f.name ?? null, f.createdAt],
    })
  }

  for (const g of data.games) appendActiveGameStatements(g, statements)
  for (const g of data.completedGames) appendCompletedGameStatements(g, statements)

  if (data.settings.language) {
    statements.push({
      statement: `INSERT INTO app_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      values: [SETTINGS_KEYS.language, data.settings.language],
    })
  }
  if (data.settings.activeGameId) {
    statements.push({
      statement: `INSERT INTO app_settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      values: [SETTINGS_KEYS.activeGameId, data.settings.activeGameId],
    })
  }

  await runTransaction(statements)
}

/** Build INSERT statements for a single active (in-progress) game. */
function appendActiveGameStatements(
  g: Game,
  out: Array<{ statement: string; values?: unknown[] }>,
): void {
  out.push({
    statement: `INSERT INTO games
        (id, created_at, completed_at, winner_profile_id, winner_name,
         hand_cards_winner_player_id, hand_coins_winner_player_id,
         hand_settebello_winner_player_id, hand_premiera_winner_player_id)
      VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?, ?)`,
    values: [
      g.id,
      g.createdAt,
      g.handCardsWinner,
      g.handCoinsWinner,
      g.handSettebelloWinner,
      g.handPremieraWinner,
    ],
  })
  g.players.forEach((p, idx) => {
    out.push({
      statement: `INSERT INTO game_players
          (game_id, player_id, profile_id, position, name, color, emoji, total_score, hand_scopa_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        g.id,
        p.id,
        p.profileId || null,
        idx,
        p.name,
        p.color,
        p.emoji,
        p.totalScore,
        g.handScopaScores[p.id] ?? 0,
      ],
    })
  })
  for (const h of g.handHistory) appendHandStatements(g.id, h, out)
}

/** Build INSERT statements for a single completed game. */
function appendCompletedGameStatements(
  g: CompletedGame,
  out: Array<{ statement: string; values?: unknown[] }>,
): void {
  out.push({
    statement: `INSERT INTO games
        (id, created_at, completed_at, winner_profile_id, winner_name)
      VALUES (?, ?, ?, ?, ?)`,
    // The DB stores created_at and completed_at separately; the in-memory
    // CompletedGame type only carries completed_at. Re-using it for both is
    // fine — we never display created_at for completed games.
    values: [g.id, g.completedAt, g.completedAt, g.winnerProfileId ?? null, g.winnerName],
  })
  g.players.forEach((p, idx) => {
    out.push({
      statement: `INSERT INTO game_players
          (game_id, player_id, profile_id, position, name, color, emoji, total_score, hand_scopa_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      values: [
        g.id,
        // Pre-Phase-2 completed games predate `playerId`; default to
        // position-based id so legacy backups still round-trip.
        p.playerId ?? `player-${idx}`,
        p.profileId || null,
        idx,
        p.name,
        p.color,
        p.emoji,
        p.score,
      ],
    })
  })
  if (g.handHistory) {
    for (const h of g.handHistory) appendHandStatements(g.id, h, out)
  }
}

/** Build INSERT statements for one hand of a game (hand_history + children). */
function appendHandStatements(
  gameId: string,
  h: {
    handNumber: number
    scores: Record<string, number>
    categories: Record<string, HandCategoryDetail>
    timestamp: number
  },
  out: Array<{ statement: string; values?: unknown[] }>,
): void {
  // hand_history.id is text — generate a deterministic one so a backup
  // import always produces the same ids (helps debug if a re-import drifts).
  const handId = `hand-${gameId}-${h.handNumber}`
  out.push({
    statement: 'INSERT INTO hand_history (id, game_id, hand_number, timestamp) VALUES (?, ?, ?, ?)',
    values: [handId, gameId, h.handNumber, h.timestamp],
  })
  for (const [playerId, score] of Object.entries(h.scores)) {
    out.push({
      statement: 'INSERT INTO hand_scores (hand_id, player_id, score) VALUES (?, ?, ?)',
      values: [handId, playerId, score],
    })
  }
  for (const [playerId, cat] of Object.entries(h.categories ?? {})) {
    out.push({
      statement: `INSERT INTO hand_categories
          (hand_id, player_id, cards, coins, settebello, premiera, scopa)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values: [
        handId,
        playerId,
        cat.cards ? 1 : 0,
        cat.coins ? 1 : 0,
        cat.settebello ? 1 : 0,
        cat.premiera ? 1 : 0,
        cat.scopa,
      ],
    })
  }
}

// Re-export for convenience.
export type { PlayerProfile, FavoriteGrouping, Game, CompletedGame }
