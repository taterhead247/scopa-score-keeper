import type { Game, HandCategoryDetail, HandHistoryEntry, Player } from '../game'
import { queryRows, runStatement, runTransaction } from './connection'

/** Generate a stable id for a {@link HandHistoryEntry} row. */
function makeHandId(): string {
  return `hand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Row shape for a SELECT on `games`. */
type GameRow = {
  id: string
  created_at: number
  completed_at: number | null
  winner_profile_id: string | null
  winner_name: string | null
  hand_cards_winner_player_id: string | null
  hand_coins_winner_player_id: string | null
  hand_settebello_winner_player_id: string | null
  hand_premiera_winner_player_id: string | null
}

/** Row shape for a SELECT on `game_players`. */
type GamePlayerRow = {
  game_id: string
  player_id: string
  profile_id: string | null
  position: number
  name: string
  color: string
  emoji: string
  total_score: number
  hand_scopa_score: number
}

/** Row shape for the joined SELECT on `hand_history`. */
type HandRow = {
  id: string
  game_id: string
  hand_number: number
  timestamp: number
}

/** Row shape for SELECTs on `hand_scores`. */
type HandScoreRow = {
  hand_id: string
  player_id: string
  score: number
}

/** Row shape for SELECTs on `hand_categories`. */
type HandCategoryRow = {
  hand_id: string
  player_id: string
  cards: number
  coins: number
  settebello: number
  premiera: number
  scopa: number
}

/**
 * Convert a `game_players` row into the app's {@link Player}, dropping
 * non-player fields like position and hand_scopa_score (the latter lives
 * on the game's `handScopaScores` map).
 */
function rowToPlayer(row: GamePlayerRow): Player {
  return {
    id: row.player_id,
    profileId: row.profile_id ?? '',
    name: row.name,
    color: row.color,
    emoji: row.emoji,
    totalScore: row.total_score,
  }
}

/**
 * Hydrate a list of games into the in-memory `Game` shape by joining
 * `game_players`, `hand_history`, `hand_scores`, and `hand_categories`.
 * Done in a few targeted queries rather than one giant JOIN so the result
 * can be assembled with simple grouping rather than messy de-duplication.
 */
async function hydrateGames(gameRows: GameRow[]): Promise<Game[]> {
  if (gameRows.length === 0) return []
  const ids = gameRows.map(g => g.id)
  const placeholders = ids.map(() => '?').join(',')

  const playerRows = await queryRows<GamePlayerRow>(
    `SELECT * FROM game_players WHERE game_id IN (${placeholders}) ORDER BY game_id, position ASC`,
    ids,
  )
  const handRows = await queryRows<HandRow>(
    `SELECT id, game_id, hand_number, timestamp FROM hand_history
       WHERE game_id IN (${placeholders}) ORDER BY game_id, hand_number ASC`,
    ids,
  )
  const handIds = handRows.map(h => h.id)
  const scoreRows = handIds.length === 0
    ? []
    : await queryRows<HandScoreRow>(
        `SELECT * FROM hand_scores WHERE hand_id IN (${handIds.map(() => '?').join(',')})`,
        handIds,
      )
  const categoryRows = handIds.length === 0
    ? []
    : await queryRows<HandCategoryRow>(
        `SELECT * FROM hand_categories WHERE hand_id IN (${handIds.map(() => '?').join(',')})`,
        handIds,
      )

  /** Group helper: list -> map keyed by the value of `key(item)`. */
  function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K): Map<K, T[]> {
    const map = new Map<K, T[]>()
    for (const item of items) {
      const k = key(item)
      const existing = map.get(k)
      if (existing) existing.push(item)
      else map.set(k, [item])
    }
    return map
  }

  const playersByGame = groupBy(playerRows, r => r.game_id)
  const handsByGame = groupBy(handRows, r => r.game_id)
  const scoresByHand = groupBy(scoreRows, r => r.hand_id)
  const categoriesByHand = groupBy(categoryRows, r => r.hand_id)

  return gameRows.map(gameRow => {
    const gamePlayerRows = playersByGame.get(gameRow.id) ?? []
    const players = gamePlayerRows.map(rowToPlayer)
    const handScopaScores: Record<string, number> = {}
    for (const p of gamePlayerRows) handScopaScores[p.player_id] = p.hand_scopa_score

    const gameHands = handsByGame.get(gameRow.id) ?? []
    const handHistory: HandHistoryEntry[] = gameHands.map(handRow => {
      const scores: Record<string, number> = {}
      for (const s of scoresByHand.get(handRow.id) ?? []) scores[s.player_id] = s.score
      const categories: Record<string, HandCategoryDetail> = {}
      for (const c of categoriesByHand.get(handRow.id) ?? []) {
        categories[c.player_id] = {
          cards: c.cards === 1,
          coins: c.coins === 1,
          settebello: c.settebello === 1,
          premiera: c.premiera === 1,
          scopa: c.scopa,
        }
      }
      return {
        handNumber: handRow.hand_number,
        scores,
        categories,
        timestamp: handRow.timestamp,
      }
    })

    return {
      id: gameRow.id,
      players,
      handScopaScores,
      handCardsWinner: gameRow.hand_cards_winner_player_id,
      handCoinsWinner: gameRow.hand_coins_winner_player_id,
      handSettebelloWinner: gameRow.hand_settebello_winner_player_id,
      handPremieraWinner: gameRow.hand_premiera_winner_player_id,
      handHistory,
      createdAt: gameRow.created_at,
    }
  })
}

/** All in-progress games (completed_at IS NULL), oldest first. */
export async function listActiveGames(): Promise<Game[]> {
  const rows = await queryRows<GameRow>(
    'SELECT * FROM games WHERE completed_at IS NULL ORDER BY created_at ASC',
  )
  return hydrateGames(rows)
}

/** Look up a single game by id. Returns null if not found. */
export async function getGameById(id: string): Promise<Game | null> {
  const rows = await queryRows<GameRow>('SELECT * FROM games WHERE id = ?', [id])
  if (rows.length === 0) return null
  const [game] = await hydrateGames(rows)
  return game
}

/**
 * Create a fresh in-progress game from a list of {@link Player} seats. Inserts
 * the games row and the game_players rows atomically.
 */
export async function createGame(game: Game): Promise<void> {
  const statements = [
    {
      statement: `INSERT INTO games (id, created_at) VALUES (?, ?)`,
      values: [game.id, game.createdAt],
    },
    ...game.players.map((player, index) => ({
      statement: `INSERT INTO game_players
          (game_id, player_id, profile_id, position, name, color, emoji, total_score, hand_scopa_score)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        game.id,
        player.id,
        player.profileId || null,
        index,
        player.name,
        player.color,
        player.emoji,
        player.totalScore,
        0,
      ],
    })),
  ]
  await runTransaction(statements)
}

/**
 * Set the winner of a hand category for the current (un-banked) hand. Pass
 * `playerId = null` to clear the category (acts as deselect).
 */
export async function setHandCategoryWinner(
  gameId: string,
  category: 'cards' | 'coins' | 'settebello' | 'premiera',
  playerId: string | null,
): Promise<void> {
  const column = `hand_${category}_winner_player_id`
  await runStatement(`UPDATE games SET ${column} = ? WHERE id = ?`, [playerId, gameId])
}

/** Set the per-player scopa count for the current (un-banked) hand. */
export async function setHandScopaScore(
  gameId: string,
  playerId: string,
  count: number,
): Promise<void> {
  await runStatement(
    `UPDATE game_players SET hand_scopa_score = ? WHERE game_id = ? AND player_id = ?`,
    [Math.max(0, count), gameId, playerId],
  )
}

/**
 * Persist a banked hand: insert into hand_history + hand_scores + hand_categories,
 * update each player's `total_score`, reset the hand category winners + scopa
 * scores on the parent game. Single transaction so a banked hand is all-or-nothing.
 */
export async function bankHand(
  gameId: string,
  handNumber: number,
  timestamp: number,
  perPlayer: Array<{ playerId: string; score: number; categories: HandCategoryDetail; newTotal: number }>,
): Promise<void> {
  // Generate the hand id in code so we can reference it in the child rows
  // without a round-trip to the DB. That lets every write below sit in a
  // single atomic transaction — if any one fails, none persist, no dangling
  // hand_history row is left behind.
  const handId = makeHandId()
  const statements = [
    {
      statement: 'INSERT INTO hand_history (id, game_id, hand_number, timestamp) VALUES (?, ?, ?, ?)',
      values: [handId, gameId, handNumber, timestamp],
    },
    ...perPlayer.map(p => ({
      statement: 'INSERT INTO hand_scores (hand_id, player_id, score) VALUES (?, ?, ?)',
      values: [handId, p.playerId, p.score],
    })),
    ...perPlayer.map(p => ({
      statement: `INSERT INTO hand_categories
          (hand_id, player_id, cards, coins, settebello, premiera, scopa)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      values: [
        handId,
        p.playerId,
        p.categories.cards ? 1 : 0,
        p.categories.coins ? 1 : 0,
        p.categories.settebello ? 1 : 0,
        p.categories.premiera ? 1 : 0,
        p.categories.scopa,
      ],
    })),
    ...perPlayer.map(p => ({
      statement: `UPDATE game_players SET total_score = ?, hand_scopa_score = 0
        WHERE game_id = ? AND player_id = ?`,
      values: [p.newTotal, gameId, p.playerId],
    })),
    {
      statement: `UPDATE games SET
          hand_cards_winner_player_id = NULL,
          hand_coins_winner_player_id = NULL,
          hand_settebello_winner_player_id = NULL,
          hand_premiera_winner_player_id = NULL
        WHERE id = ?`,
      values: [gameId],
    },
  ]
  await runTransaction(statements)
}

/**
 * Mark a game as completed. The hand banked that ended it has already been
 * written via {@link bankHand}; this just sets the winner + completion time.
 */
export async function completeGame(
  gameId: string,
  winner: { profileId: string; name: string },
  completedAt: number,
): Promise<void> {
  await runStatement(
    `UPDATE games SET completed_at = ?, winner_profile_id = ?, winner_name = ? WHERE id = ?`,
    [completedAt, winner.profileId, winner.name, gameId],
  )
}

/**
 * Reset every player's totalScore to 0, clear hand state, and drop the
 * hand history. Used by the in-game "Reset Scores" action — preserves the
 * players but discards all hand-level data.
 */
export async function resetGame(gameId: string): Promise<void> {
  await runTransaction([
    {
      statement: `UPDATE game_players SET total_score = 0, hand_scopa_score = 0 WHERE game_id = ?`,
      values: [gameId],
    },
    {
      statement: `UPDATE games SET
          hand_cards_winner_player_id = NULL,
          hand_coins_winner_player_id = NULL,
          hand_settebello_winner_player_id = NULL,
          hand_premiera_winner_player_id = NULL
        WHERE id = ?`,
      values: [gameId],
    },
    { statement: 'DELETE FROM hand_history WHERE game_id = ?', values: [gameId] },
  ])
}

/** Delete a game outright (cascades to game_players, hand_history, etc.). */
export async function deleteGame(gameId: string): Promise<void> {
  await runStatement('DELETE FROM games WHERE id = ?', [gameId])
}

/**
 * Rename the snapshotted player names on a game (used by the per-game
 * rename dialog — does not touch the underlying profile).
 */
export async function renameGamePlayers(
  gameId: string,
  renames: Array<{ playerId: string; name: string }>,
): Promise<void> {
  await runTransaction(
    renames.map(r => ({
      statement: 'UPDATE game_players SET name = ? WHERE game_id = ? AND player_id = ?',
      values: [r.name, gameId, r.playerId],
    })),
  )
}
