import { describe, it, expect } from 'vitest'
import type { CompletedGame, HandHistoryEntry } from '../lib/game'
import {
  computeProfileStats,
  computeCategoryStats,
  computeLeaderboard,
  computeHeadToHead,
  computeHeadToHeadMatrix,
} from '../lib/stats'

/** Build a CompletedGame for tests with minimal boilerplate. */
function makeGame(opts: {
  id: string
  completedAt: number
  players: Array<{ profileId: string; name: string; score: number }>
  winnerProfileId: string
  hands?: Array<Record<string, { cards?: boolean; coins?: boolean; settebello?: boolean; premiera?: boolean; scopa?: number }>>
}): CompletedGame {
  const winnerName = opts.players.find(p => p.profileId === opts.winnerProfileId)?.name ?? ''
  const players = opts.players.map((p, i) => ({
    playerId: `player-${i}`,
    profileId: p.profileId,
    name: p.name,
    score: p.score,
    color: '#000',
    emoji: '🎲',
  }))
  let handHistory: HandHistoryEntry[] | undefined
  if (opts.hands) {
    handHistory = opts.hands.map((hand, handIdx) => {
      const scores: Record<string, number> = {}
      const categories: Record<string, { cards: boolean; coins: boolean; settebello: boolean; premiera: boolean; scopa: number }> = {}
      players.forEach(pl => {
        const c = hand[pl.profileId] ?? {}
        categories[pl.playerId] = {
          cards: c.cards ?? false,
          coins: c.coins ?? false,
          settebello: c.settebello ?? false,
          premiera: c.premiera ?? false,
          scopa: c.scopa ?? 0,
        }
        scores[pl.playerId] = 0 // not used by tested code
      })
      return {
        handNumber: handIdx + 1,
        scores,
        categories,
        timestamp: opts.completedAt + handIdx,
      }
    })
  }
  return {
    id: opts.id,
    players,
    winnerName,
    completedAt: opts.completedAt,
    handHistory,
  }
}

describe('computeProfileStats', () => {
  it('returns null when the profile never played', () => {
    expect(computeProfileStats([], 'A')).toBeNull()
  })

  it('counts wins, losses, win rate, and average score', () => {
    const games = [
      makeGame({
        id: 'g1', completedAt: 1,
        players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 8 }],
        winnerProfileId: 'A',
      }),
      makeGame({
        id: 'g2', completedAt: 2,
        players: [{ profileId: 'A', name: 'A', score: 7 }, { profileId: 'B', name: 'B', score: 11 }],
        winnerProfileId: 'B',
      }),
      makeGame({
        id: 'g3', completedAt: 3,
        players: [{ profileId: 'A', name: 'A', score: 12 }, { profileId: 'B', name: 'B', score: 10 }],
        winnerProfileId: 'A',
      }),
    ]
    const stats = computeProfileStats(games, 'A')!
    expect(stats.gamesPlayed).toBe(3)
    expect(stats.wins).toBe(2)
    expect(stats.losses).toBe(1)
    expect(stats.winRate).toBeCloseTo(2 / 3)
    expect(stats.avgScore).toBeCloseTo((11 + 7 + 12) / 3)
  })

  it('computes positive currentStreak when most recent games are wins', () => {
    const games = [
      makeGame({ id: 'g1', completedAt: 1, players: [{ profileId: 'A', name: 'A', score: 8 }, { profileId: 'B', name: 'B', score: 11 }], winnerProfileId: 'B' }),
      makeGame({ id: 'g2', completedAt: 2, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 9 }], winnerProfileId: 'A' }),
      makeGame({ id: 'g3', completedAt: 3, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 7 }], winnerProfileId: 'A' }),
    ]
    expect(computeProfileStats(games, 'A')!.currentStreak).toBe(2)
  })

  it('computes negative currentStreak when most recent games are losses', () => {
    const games = [
      makeGame({ id: 'g1', completedAt: 1, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 8 }], winnerProfileId: 'A' }),
      makeGame({ id: 'g2', completedAt: 2, players: [{ profileId: 'A', name: 'A', score: 9 }, { profileId: 'B', name: 'B', score: 11 }], winnerProfileId: 'B' }),
      makeGame({ id: 'g3', completedAt: 3, players: [{ profileId: 'A', name: 'A', score: 7 }, { profileId: 'B', name: 'B', score: 11 }], winnerProfileId: 'B' }),
    ]
    expect(computeProfileStats(games, 'A')!.currentStreak).toBe(-2)
  })

  it('tracks longestWinStreak across non-contiguous wins', () => {
    const games = [
      makeGame({ id: 'g1', completedAt: 1, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 8 }], winnerProfileId: 'A' }),
      makeGame({ id: 'g2', completedAt: 2, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 8 }], winnerProfileId: 'A' }),
      makeGame({ id: 'g3', completedAt: 3, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 8 }], winnerProfileId: 'A' }),
      makeGame({ id: 'g4', completedAt: 4, players: [{ profileId: 'A', name: 'A', score: 8 }, { profileId: 'B', name: 'B', score: 11 }], winnerProfileId: 'B' }),
      makeGame({ id: 'g5', completedAt: 5, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 8 }], winnerProfileId: 'A' }),
    ]
    const stats = computeProfileStats(games, 'A')!
    expect(stats.longestWinStreak).toBe(3)
    expect(stats.currentStreak).toBe(1)
  })

  it('uses snapshot from the most recent game for lastKnown fields', () => {
    const games = [
      makeGame({ id: 'g1', completedAt: 1, players: [{ profileId: 'A', name: 'Old Name', score: 11 }, { profileId: 'B', name: 'B', score: 8 }], winnerProfileId: 'A' }),
      makeGame({ id: 'g2', completedAt: 2, players: [{ profileId: 'A', name: 'New Name', score: 11 }, { profileId: 'B', name: 'B', score: 8 }], winnerProfileId: 'A' }),
    ]
    expect(computeProfileStats(games, 'A')!.lastKnownName).toBe('New Name')
  })

  it('returns undefined categoryStats when no games have hand history', () => {
    const games = [
      makeGame({ id: 'g1', completedAt: 1, players: [{ profileId: 'A', name: 'A', score: 11 }], winnerProfileId: 'A' }),
    ]
    expect(computeProfileStats(games, 'A')!.categoryStats).toBeUndefined()
  })
})

describe('computeCategoryStats', () => {
  it('returns undefined when no hand-history games exist', () => {
    const games = [
      makeGame({ id: 'g1', completedAt: 1, players: [{ profileId: 'A', name: 'A', score: 11 }], winnerProfileId: 'A' }),
    ]
    expect(computeCategoryStats(games, 'A')).toBeUndefined()
  })

  it('computes per-category win rates against hands where the category was claimed', () => {
    const games = [
      makeGame({
        id: 'g1', completedAt: 1,
        players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 8 }],
        winnerProfileId: 'A',
        hands: [
          { A: { cards: true, coins: true, scopa: 1 }, B: {} },
          { A: { cards: true }, B: { coins: true, settebello: true } },
          { A: {}, B: { cards: true, coins: true } },
        ],
      }),
    ]
    const c = computeCategoryStats(games, 'A')!
    expect(c.gamesWithHandData).toBe(1)
    expect(c.cards).toEqual({ won: 2, total: 3, rate: 2 / 3 })
    expect(c.coins).toEqual({ won: 1, total: 3, rate: 1 / 3 })
    expect(c.settebello).toEqual({ won: 0, total: 1, rate: 0 })
    expect(c.primiera).toEqual({ won: 0, total: 0, rate: 0 })
    expect(c.scopaTotal).toBe(1)
  })
})

describe('computeLeaderboard', () => {
  it('orders by wins desc, then win rate desc, then games desc', () => {
    const games = [
      makeGame({ id: 'g1', completedAt: 1, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 8 }], winnerProfileId: 'A' }),
      makeGame({ id: 'g2', completedAt: 2, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'C', name: 'C', score: 8 }], winnerProfileId: 'A' }),
      makeGame({ id: 'g3', completedAt: 3, players: [{ profileId: 'A', name: 'A', score: 8 }, { profileId: 'B', name: 'B', score: 11 }], winnerProfileId: 'B' }),
    ]
    const lb = computeLeaderboard(games)
    expect(lb.map(r => r.profileId)).toEqual(['A', 'B', 'C'])
  })
})

describe('computeHeadToHead', () => {
  it('counts aWins, bWins, otherWins only across games where both played', () => {
    const games = [
      makeGame({ id: 'g1', completedAt: 1, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 9 }], winnerProfileId: 'A' }),
      makeGame({ id: 'g2', completedAt: 2, players: [{ profileId: 'A', name: 'A', score: 8 }, { profileId: 'B', name: 'B', score: 11 }], winnerProfileId: 'B' }),
      makeGame({
        id: 'g3', completedAt: 3,
        players: [{ profileId: 'A', name: 'A', score: 8 }, { profileId: 'B', name: 'B', score: 9 }, { profileId: 'C', name: 'C', score: 11 }],
        winnerProfileId: 'C',
      }),
      // A vs C only — should not be counted in A vs B
      makeGame({ id: 'g4', completedAt: 4, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'C', name: 'C', score: 8 }], winnerProfileId: 'A' }),
    ]
    const h2h = computeHeadToHead(games, 'A', 'B')
    expect(h2h).toEqual({ gamesTogether: 3, aWins: 1, bWins: 1, otherWins: 1 })
  })
})

describe('computeHeadToHeadMatrix', () => {
  it('returns each unordered pair once, skipping pairs that never met', () => {
    const games = [
      makeGame({ id: 'g1', completedAt: 1, players: [{ profileId: 'A', name: 'A', score: 11 }, { profileId: 'B', name: 'B', score: 8 }], winnerProfileId: 'A' }),
      makeGame({ id: 'g2', completedAt: 2, players: [{ profileId: 'B', name: 'B', score: 11 }, { profileId: 'C', name: 'C', score: 8 }], winnerProfileId: 'B' }),
    ]
    const matrix = computeHeadToHeadMatrix(games)
    expect(matrix.length).toBe(2)
    expect(matrix.find(m => m.profileIdA === 'A' && m.profileIdB === 'B')).toBeTruthy()
    expect(matrix.find(m => m.profileIdA === 'B' && m.profileIdB === 'C')).toBeTruthy()
    // A and C never played together
    expect(matrix.find(m => (m.profileIdA === 'A' && m.profileIdB === 'C') || (m.profileIdA === 'C' && m.profileIdB === 'A'))).toBeUndefined()
  })
})
