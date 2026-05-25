import type { CompletedGame, HandCategoryDetail, HandHistoryEntry } from '../game'
import { queryRows } from './connection'

/** Row shape for a SELECT on completed `games`. */
type GameRow = {
  id: string
  completed_at: number
  winner_profile_id: string | null
  winner_name: string | null
}

type GamePlayerRow = {
  game_id: string
  player_id: string
  profile_id: string | null
  position: number
  name: string
  color: string
  emoji: string
  total_score: number
}

type HandRow = {
  id: string
  game_id: string
  hand_number: number
  timestamp: number
}

type HandScoreRow = { hand_id: string; player_id: string; score: number }

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
 * Read every completed game and hydrate the players + handHistory for each.
 *
 * Same query pattern as `listActiveGames` — separate targeted queries grouped
 * by id, rather than one giant JOIN. Result is sorted oldest-first by
 * `completed_at`; consumers (history view, stats) reorder as needed.
 */
export async function listCompletedGames(): Promise<CompletedGame[]> {
  const gameRows = await queryRows<GameRow>(
    `SELECT id, completed_at, winner_profile_id, winner_name FROM games
       WHERE completed_at IS NOT NULL ORDER BY completed_at ASC`,
  )
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

  const playersByGame = new Map<string, GamePlayerRow[]>()
  for (const r of playerRows) {
    const existing = playersByGame.get(r.game_id)
    if (existing) existing.push(r)
    else playersByGame.set(r.game_id, [r])
  }
  const handsByGame = new Map<string, HandRow[]>()
  for (const r of handRows) {
    const existing = handsByGame.get(r.game_id)
    if (existing) existing.push(r)
    else handsByGame.set(r.game_id, [r])
  }
  const scoresByHand = new Map<string, HandScoreRow[]>()
  for (const r of scoreRows) {
    const existing = scoresByHand.get(r.hand_id)
    if (existing) existing.push(r)
    else scoresByHand.set(r.hand_id, [r])
  }
  const categoriesByHand = new Map<string, HandCategoryRow[]>()
  for (const r of categoryRows) {
    const existing = categoriesByHand.get(r.hand_id)
    if (existing) existing.push(r)
    else categoriesByHand.set(r.hand_id, [r])
  }

  return gameRows.map(gameRow => {
    const players = (playersByGame.get(gameRow.id) ?? []).map(p => ({
      playerId: p.player_id,
      profileId: p.profile_id ?? '',
      name: p.name,
      score: p.total_score,
      color: p.color,
      emoji: p.emoji,
    }))
    const gameHands = handsByGame.get(gameRow.id) ?? []
    const handHistory: HandHistoryEntry[] | undefined = gameHands.length === 0
      ? undefined
      : gameHands.map(handRow => {
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
      winnerName: gameRow.winner_name ?? '',
      winnerProfileId: gameRow.winner_profile_id ?? undefined,
      completedAt: gameRow.completed_at,
      handHistory,
    }
  })
}
