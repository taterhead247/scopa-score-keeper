import { describe, it, expect, beforeEach } from 'vitest'
import { initDatabase, profilesDb, gamesDb } from '../lib/db'
import type { Game } from '../lib/game'

/** Boot a fresh in-memory DB before every test. */
beforeEach(async () => {
  await initDatabase()
})

/** Insert a two-player active game and return its id. */
async function setupGame(): Promise<string> {
  await profilesDb.insertProfile({
    id: 'p-marco', name: 'Marco', color: '#1d4ed8', emoji: '🦊', createdAt: 1,
  })
  await profilesDb.insertProfile({
    id: 'p-giulia', name: 'Giulia', color: '#b91c1c', emoji: '🐱', createdAt: 2,
  })
  const game: Game = {
    id: 'g-1',
    createdAt: 1000,
    players: [
      { id: 'player-0', profileId: 'p-marco', name: 'Marco', color: '#1d4ed8', emoji: '🦊', totalScore: 0 },
      { id: 'player-1', profileId: 'p-giulia', name: 'Giulia', color: '#b91c1c', emoji: '🐱', totalScore: 0 },
    ],
    handScopaScores: { 'player-0': 0, 'player-1': 0 },
    handCardsWinner: null,
    handCoinsWinner: null,
    handSettebelloWinner: null,
    handPremieraWinner: null,
    handHistory: [],
  }
  await gamesDb.createGame(game)
  return game.id
}

describe('unbankHand (#47)', () => {
  it('reverses scores, hand history, category winners, and scopa counters', async () => {
    const gameId = await setupGame()
    // Bank a hand: Marco wins cards + settebello + 1 scopa (3 points); Giulia wins coins (1 point).
    await gamesDb.bankHand(gameId, 1, 2000, [
      {
        playerId: 'player-0',
        score: 3,
        categories: { cards: true, coins: false, settebello: true, premiera: false, scopa: 1 },
        newTotal: 3,
      },
      {
        playerId: 'player-1',
        score: 1,
        categories: { cards: false, coins: true, settebello: false, premiera: false, scopa: 0 },
        newTotal: 1,
      },
    ])

    // Pre-undo: hand history exists and totals are updated.
    let games = await gamesDb.listActiveGames()
    expect(games[0].handHistory).toHaveLength(1)
    expect(games[0].players[0].totalScore).toBe(3)
    expect(games[0].players[1].totalScore).toBe(1)

    // Undo.
    const result = await gamesDb.unbankHand(gameId)
    expect(result).toBe(true)

    // Post-undo: hand history is gone and totals are restored.
    games = await gamesDb.listActiveGames()
    expect(games[0].handHistory).toHaveLength(0)
    expect(games[0].players[0].totalScore).toBe(0)
    expect(games[0].players[1].totalScore).toBe(0)
    // Category-winner pills are restored as pending.
    expect(games[0].handCardsWinner).toBe('player-0')
    expect(games[0].handSettebelloWinner).toBe('player-0')
    expect(games[0].handCoinsWinner).toBe('player-1')
    expect(games[0].handPremieraWinner).toBeNull()
    // Scopa counter restored.
    expect(games[0].handScopaScores['player-0']).toBe(1)
    expect(games[0].handScopaScores['player-1']).toBe(0)
  })

  it('returns false when there is no hand to undo', async () => {
    const gameId = await setupGame()
    const result = await gamesDb.unbankHand(gameId)
    expect(result).toBe(false)
  })

  it('only undoes the most recent hand when multiple hands have been banked', async () => {
    const gameId = await setupGame()
    // Hand 1: Marco +2.
    await gamesDb.bankHand(gameId, 1, 2000, [
      {
        playerId: 'player-0',
        score: 2,
        categories: { cards: true, coins: true, settebello: false, premiera: false, scopa: 0 },
        newTotal: 2,
      },
      {
        playerId: 'player-1',
        score: 0,
        categories: { cards: false, coins: false, settebello: false, premiera: false, scopa: 0 },
        newTotal: 0,
      },
    ])
    // Hand 2: Giulia +3.
    await gamesDb.bankHand(gameId, 2, 3000, [
      {
        playerId: 'player-0',
        score: 0,
        categories: { cards: false, coins: false, settebello: false, premiera: false, scopa: 0 },
        newTotal: 2,
      },
      {
        playerId: 'player-1',
        score: 3,
        categories: { cards: true, coins: true, settebello: true, premiera: false, scopa: 0 },
        newTotal: 3,
      },
    ])

    await gamesDb.unbankHand(gameId)

    // Hand 1 remains; hand 2 is gone. Totals reflect just hand 1.
    const games = await gamesDb.listActiveGames()
    expect(games[0].handHistory).toHaveLength(1)
    expect(games[0].handHistory[0].handNumber).toBe(1)
    expect(games[0].players[0].totalScore).toBe(2)
    expect(games[0].players[1].totalScore).toBe(0)
    // The restored pending winners are from hand 2, not hand 1.
    expect(games[0].handCardsWinner).toBe('player-1')
    expect(games[0].handCoinsWinner).toBe('player-1')
    expect(games[0].handSettebelloWinner).toBe('player-1')
  })

  it('clears completion fields if the hand had also marked the game complete', async () => {
    const gameId = await setupGame()
    // Bank a winning hand.
    await gamesDb.bankHand(gameId, 1, 2000, [
      {
        playerId: 'player-0',
        score: 11,
        categories: { cards: true, coins: true, settebello: true, premiera: true, scopa: 7 },
        newTotal: 11,
      },
      {
        playerId: 'player-1',
        score: 0,
        categories: { cards: false, coins: false, settebello: false, premiera: false, scopa: 0 },
        newTotal: 0,
      },
    ])
    // Simulate the React flow's finalization step.
    await gamesDb.completeGame(gameId, { profileId: 'p-marco', name: 'Marco' }, 3000)

    // The completed game shows up in completed list.
    let completed = await (await import('../lib/db/completedGames')).listCompletedGames()
    expect(completed).toHaveLength(1)

    // Undo.
    await gamesDb.unbankHand(gameId)

    // Game is active again; nothing in completed.
    completed = await (await import('../lib/db/completedGames')).listCompletedGames()
    expect(completed).toHaveLength(0)
    const active = await gamesDb.listActiveGames()
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe(gameId)
  })
})
