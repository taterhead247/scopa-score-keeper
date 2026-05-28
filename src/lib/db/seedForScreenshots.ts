/**
 * Deterministic seed used by the `scripts/screenshots.mjs` Playwright
 * automation. NOT shipped to production — the import that triggers this
 * module is gated behind `import.meta.env.DEV` in `src/main.tsx`, so the
 * whole module tree-shakes out of `npm run build`.
 *
 * The data here is calibrated to make every captured screen look "lived in"
 * with a coherent narrative across them (see the shot list in #57):
 *   - Marco leads the leaderboard 4-2 (4 wins, 2 losses)
 *   - Marco vs Giulia head-to-head is 3-2 — good for the H2H tab
 *   - The active mid-game has 4 players with two hands already banked and
 *     fresh category selections pending so the Bank Hand button + Hand
 *     Chart + category pills all render with content
 *   - One favorite quartet is pinned so Quick Start has both flavors
 */

import { runTransaction } from './connection'
import { SETTINGS_KEYS } from './schema'
import * as settings from './settings'

const PROFILES = [
  { id: 'p-marco', name: 'Marco', color: '#3b82f6', emoji: '🦊', createdAt: 1747900000000 },
  { id: 'p-giulia', name: 'Giulia', color: '#ef4444', emoji: '🐱', createdAt: 1747900000001 },
  { id: 'p-federico', name: 'Federico', color: '#10b981', emoji: '🦄', createdAt: 1747900000002 },
  { id: 'p-sofia', name: 'Sofia', color: '#8b5cf6', emoji: '🌟', createdAt: 1747900000003 },
] as const

const FAVORITE_QUARTET_ID = 'p-federico::p-giulia::p-marco::p-sofia'

/** One day in ms, for spacing completed games across the recent past. */
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Completed games per the #57 spec: 8 games spanning the last ~3 weeks
 * giving Marco a slight lead and a real H2H vs Giulia. `daysAgo` is
 * measured from a fixed reference timestamp (1748000000000) so the seeded
 * data is deterministic across runs — Playwright is happier when "Marco's
 * last game" doesn't drift with wall-clock time.
 */
const NOW_REF = 1748000000000
type SeededGame = {
  id: string
  daysAgo: number
  winnerId: string
  players: Array<{ profileId: string; score: number }>
}
const COMPLETED_GAMES: SeededGame[] = [
  { id: 'g1', daysAgo: 20, winnerId: 'p-marco', players: [{ profileId: 'p-marco', score: 11 }, { profileId: 'p-giulia', score: 8 }] },
  { id: 'g2', daysAgo: 18, winnerId: 'p-giulia', players: [{ profileId: 'p-marco', score: 9 }, { profileId: 'p-giulia', score: 11 }] },
  { id: 'g3', daysAgo: 15, winnerId: 'p-marco', players: [{ profileId: 'p-marco', score: 12 }, { profileId: 'p-giulia', score: 9 }, { profileId: 'p-federico', score: 7 }] },
  { id: 'g4', daysAgo: 12, winnerId: 'p-sofia', players: [{ profileId: 'p-marco', score: 8 }, { profileId: 'p-sofia', score: 11 }] },
  { id: 'g5', daysAgo: 8, winnerId: 'p-federico', players: [{ profileId: 'p-marco', score: 9 }, { profileId: 'p-giulia', score: 10 }, { profileId: 'p-federico', score: 11 }, { profileId: 'p-sofia', score: 8 }] },
  { id: 'g6', daysAgo: 5, winnerId: 'p-marco', players: [{ profileId: 'p-marco', score: 11 }, { profileId: 'p-giulia', score: 10 }] },
  { id: 'g7', daysAgo: 3, winnerId: 'p-marco', players: [{ profileId: 'p-marco', score: 12 }, { profileId: 'p-giulia', score: 9 }, { profileId: 'p-federico', score: 10 }, { profileId: 'p-sofia', score: 7 }] },
  { id: 'g8', daysAgo: 1, winnerId: 'p-giulia', players: [{ profileId: 'p-marco', score: 9 }, { profileId: 'p-giulia', score: 13 }, { profileId: 'p-federico', score: 8 }, { profileId: 'p-sofia', score: 10 }] },
]

/** The active mid-game seeded for the gameplay shot. */
const ACTIVE_GAME_ID = 'g-active'

/**
 * Run every seed step in a single transaction so the screenshot run always
 * sees a fully-populated database — never a half-seeded one that would make
 * an automated screenshot capture flaky.
 */
export async function seedForScreenshots(language: string): Promise<void> {
  const statements: Array<{ statement: string; values?: unknown[] }> = []

  // Wipe everything first so re-running the seed is idempotent.
  // Each entry must carry a `values` array even when empty — the underlying
  // plugin's executeSet refuses entries without it ("Must provide a set as
  // Array of {statement,values}").
  statements.push({ statement: 'DELETE FROM hand_categories', values: [] })
  statements.push({ statement: 'DELETE FROM hand_scores', values: [] })
  statements.push({ statement: 'DELETE FROM hand_history', values: [] })
  statements.push({ statement: 'DELETE FROM game_players', values: [] })
  statements.push({ statement: 'DELETE FROM games', values: [] })
  statements.push({ statement: 'DELETE FROM favorite_groupings', values: [] })
  statements.push({ statement: 'DELETE FROM profiles', values: [] })

  // Profiles.
  for (const p of PROFILES) {
    statements.push({
      statement: 'INSERT INTO profiles (id, name, color, emoji, created_at) VALUES (?, ?, ?, ?, ?)',
      values: [p.id, p.name, p.color, p.emoji, p.createdAt],
    })
  }

  // One favorite quartet.
  statements.push({
    statement: 'INSERT INTO favorite_groupings (id, profile_ids, name, created_at) VALUES (?, ?, ?, ?)',
    values: [
      FAVORITE_QUARTET_ID,
      JSON.stringify(['p-marco', 'p-giulia', 'p-federico', 'p-sofia']),
      null,
      1747999000000,
    ],
  })

  // Completed games + their players.
  for (const g of COMPLETED_GAMES) {
    const completedAt = NOW_REF - g.daysAgo * DAY_MS
    const winner = g.players.find(p => p.profileId === g.winnerId)
    statements.push({
      statement: `INSERT INTO games
          (id, created_at, completed_at, winner_profile_id, winner_name)
        VALUES (?, ?, ?, ?, ?)`,
      values: [
        g.id,
        completedAt - 60 * 60 * 1000, // created an hour before completion
        completedAt,
        g.winnerId,
        PROFILES.find(p => p.id === g.winnerId)!.name,
      ],
    })
    g.players.forEach((player, idx) => {
      const profile = PROFILES.find(p => p.id === player.profileId)!
      statements.push({
        statement: `INSERT INTO game_players
            (game_id, player_id, profile_id, position, name, color, emoji, total_score, hand_scopa_score)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        values: [
          g.id,
          `player-${idx}`,
          profile.id,
          idx,
          profile.name,
          profile.color,
          profile.emoji,
          player.score,
        ],
      })
    })
  }

  // Active mid-game: 4 players, 2 hands banked, pending category selections.
  const activeCreatedAt = NOW_REF - 30 * 60 * 1000
  statements.push({
    statement: `INSERT INTO games
        (id, created_at, hand_cards_winner_player_id, hand_coins_winner_player_id,
         hand_settebello_winner_player_id, hand_premiera_winner_player_id)
      VALUES (?, ?, ?, ?, NULL, NULL)`,
    values: [
      ACTIVE_GAME_ID,
      activeCreatedAt,
      'player-0', // Marco selected for Cards
      'player-1', // Giulia selected for Coins
    ],
  })
  PROFILES.forEach((profile, idx) => {
    statements.push({
      statement: `INSERT INTO game_players
          (game_id, player_id, profile_id, position, name, color, emoji, total_score, hand_scopa_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        ACTIVE_GAME_ID,
        `player-${idx}`,
        profile.id,
        idx,
        profile.name,
        profile.color,
        profile.emoji,
        [6, 5, 4, 3][idx], // running totals after 2 banked hands
        idx === 0 ? 1 : 0, // Marco has 1 scopa pending
      ],
    })
  })

  // Two banked hands in the active game so the Hand Chart has data.
  for (let handNumber = 1; handNumber <= 2; handNumber++) {
    const handId = `hand-active-${handNumber}`
    statements.push({
      statement: 'INSERT INTO hand_history (id, game_id, hand_number, timestamp) VALUES (?, ?, ?, ?)',
      values: [handId, ACTIVE_GAME_ID, handNumber, activeCreatedAt + handNumber * 60 * 1000],
    })
    // Per-player scores + categories for each hand. Pattern: Marco gets the
    // bigger share so his totals lead going into the snapshot.
    const handScores = [
      [3, 2, 1, 2], // hand 1
      [3, 3, 3, 1], // hand 2
    ][handNumber - 1]
    for (let pidx = 0; pidx < 4; pidx++) {
      statements.push({
        statement: 'INSERT INTO hand_scores (hand_id, player_id, score) VALUES (?, ?, ?)',
        values: [handId, `player-${pidx}`, handScores[pidx]],
      })
      statements.push({
        statement: `INSERT INTO hand_categories
            (hand_id, player_id, cards, coins, settebello, premiera, scopa)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        values: [
          handId, `player-${pidx}`,
          pidx === 0 ? 1 : 0,                                   // Cards → Marco
          pidx === 1 ? 1 : 0,                                   // Coins → Giulia
          handNumber === 1 ? (pidx === 0 ? 1 : 0) : (pidx === 2 ? 1 : 0), // Settebello rotates
          handNumber === 1 ? (pidx === 2 ? 1 : 0) : (pidx === 3 ? 1 : 0), // Primiera rotates
          pidx === 0 && handNumber === 1 ? 1 : 0,               // 1 scopa for Marco in hand 1
        ],
      })
    }
  }

  await runTransaction(statements)

  // Settings. Two writes here are deliberate and order-sensitive:
  //
  //   1. Delete `active_game_id` — the relational wipe above doesn't touch
  //      app_settings, so a previous screenshot run that clicked into the
  //      gameplay screen could leave behind a stale active-game pointer.
  //      Without clearing it, the next run would re-create our seeded game
  //      with the same id (`g-active`) AND find the matching active_game_id
  //      in settings, booting straight into the gameplay screen and
  //      corrupting shot 1 (the setup capture).
  //   2. Set language to the requested value so the i18n layer's
  //      `useSettingQuery` returns the right code before any rendering.
  await settings.deleteSetting(SETTINGS_KEYS.activeGameId)
  await settings.setSetting(SETTINGS_KEYS.language, language)
}
