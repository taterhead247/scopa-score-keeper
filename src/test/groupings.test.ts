import { describe, it, expect } from 'vitest'
import { groupingId, computeRecentGroupings, type GroupingSourceGame } from '../lib/groupings'
import type { PlayerProfile } from '../lib/profiles'

/** Minimal profile factory for tests. */
function makeProfile(id: string): PlayerProfile {
  return { id, name: id, color: '#000', emoji: '🎲', createdAt: 0 }
}

/** Minimal completed-game factory for tests. */
function makeGame(profileIds: string[], completedAt: number): GroupingSourceGame {
  return {
    players: profileIds.map(profileId => ({ profileId })),
    completedAt,
  }
}

describe('groupingId', () => {
  it('returns the same id regardless of input order', () => {
    expect(groupingId(['A', 'B', 'C'])).toBe(groupingId(['C', 'A', 'B']))
    expect(groupingId(['A', 'B'])).toBe(groupingId(['B', 'A']))
  })

  it('returns different ids for different member sets', () => {
    expect(groupingId(['A', 'B'])).not.toBe(groupingId(['A', 'C']))
    expect(groupingId(['A', 'B'])).not.toBe(groupingId(['A', 'B', 'C']))
  })
})

describe('computeRecentGroupings', () => {
  const profiles = ['A', 'B', 'C', 'D'].map(makeProfile)

  it('returns an empty list when no completed games exist', () => {
    expect(computeRecentGroupings([], profiles)).toEqual([])
  })

  it('deduplicates by member set regardless of order', () => {
    const games = [
      makeGame(['A', 'B'], 1),
      makeGame(['B', 'A'], 2), // same group, different order
      makeGame(['A', 'C'], 3),
    ]
    const result = computeRecentGroupings(games, profiles)
    expect(result.length).toBe(2)
    const ab = result.find(r => r.id === groupingId(['A', 'B']))!
    expect(ab.playCount).toBe(2)
  })

  it('sorts by most recent lastPlayedAt first', () => {
    const games = [
      makeGame(['A', 'B'], 10),
      makeGame(['A', 'C'], 50),
      makeGame(['A', 'D'], 30),
    ]
    const result = computeRecentGroupings(games, profiles)
    expect(result.map(r => r.profileIds.sort().join(':'))).toEqual([
      'A:C',
      'A:D',
      'A:B',
    ])
  })

  it('drops groupings whose members include a deleted profile', () => {
    const games = [
      makeGame(['A', 'B'], 1),
      makeGame(['A', 'X'], 2), // X has no profile
    ]
    const result = computeRecentGroupings(games, profiles)
    expect(result.length).toBe(1)
    expect(result[0].id).toBe(groupingId(['A', 'B']))
  })

  it('uses the most recent game ordering for profileIds', () => {
    const games = [
      makeGame(['A', 'B', 'C'], 1),
      makeGame(['C', 'A', 'B'], 5), // most recent — its ordering should win
    ]
    const result = computeRecentGroupings(games, profiles)
    expect(result[0].profileIds).toEqual(['C', 'A', 'B'])
  })

  it('respects the limit parameter', () => {
    const games = [
      makeGame(['A', 'B'], 1),
      makeGame(['A', 'C'], 2),
      makeGame(['A', 'D'], 3),
      makeGame(['B', 'C'], 4),
      makeGame(['B', 'D'], 5),
      makeGame(['C', 'D'], 6),
    ]
    const result = computeRecentGroupings(games, profiles, 3)
    expect(result.length).toBe(3)
  })

  it('skips degenerate games with fewer than 2 players', () => {
    const games = [
      makeGame(['A'], 1),
      makeGame(['A', 'B'], 2),
    ]
    const result = computeRecentGroupings(games, profiles)
    expect(result.length).toBe(1)
    expect(result[0].id).toBe(groupingId(['A', 'B']))
  })
})
