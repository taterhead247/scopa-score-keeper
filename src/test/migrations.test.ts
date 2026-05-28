import { describe, it, expect, beforeEach } from 'vitest'
import { initDatabase, profilesDb, gamesDb, runDataMigrations } from '../lib/db'
import { queryRows } from '../lib/db/connection'
import { COLOR_MIGRATION_MAP } from '../lib/profiles'
import type { Game } from '../lib/game'

beforeEach(async () => {
  await initDatabase()
})

describe('runDataMigrations — palette forward-migration (#46)', () => {
  it('rewrites old profile colors to the new AA-compliant palette', async () => {
    // Insert a profile with the old (low-contrast) blue.
    await profilesDb.insertProfile({
      id: 'p-1', name: 'Marco', color: '#3b82f6', emoji: '🦊', createdAt: 1,
    })
    await runDataMigrations()
    const profiles = await profilesDb.listProfiles()
    expect(profiles[0].color).toBe(COLOR_MIGRATION_MAP['#3b82f6'])
    expect(profiles[0].color).toBe('#1d4ed8')
  })

  it('rewrites snapshotted game_player colors too', async () => {
    await profilesDb.insertProfile({
      id: 'p-1', name: 'Marco', color: '#3b82f6', emoji: '🦊', createdAt: 1,
    })
    await profilesDb.insertProfile({
      id: 'p-2', name: 'Giulia', color: '#ef4444', emoji: '🐱', createdAt: 2,
    })
    const game: Game = {
      id: 'g-1',
      createdAt: 1000,
      players: [
        { id: 'player-0', profileId: 'p-1', name: 'Marco', color: '#3b82f6', emoji: '🦊', totalScore: 0 },
        { id: 'player-1', profileId: 'p-2', name: 'Giulia', color: '#ef4444', emoji: '🐱', totalScore: 0 },
      ],
      handScopaScores: { 'player-0': 0, 'player-1': 0 },
      handCardsWinner: null,
      handCoinsWinner: null,
      handSettebelloWinner: null,
      handPremieraWinner: null,
      handHistory: [],
    }
    await gamesDb.createGame(game)

    await runDataMigrations()
    const rows = await queryRows<{ color: string }>(
      'SELECT color FROM game_players WHERE game_id = ? ORDER BY position',
      ['g-1'],
    )
    expect(rows.map(r => r.color)).toEqual(['#1d4ed8', '#b91c1c'])
  })

  it('is idempotent — running twice does not double-rewrite', async () => {
    await profilesDb.insertProfile({
      id: 'p-1', name: 'Marco', color: '#3b82f6', emoji: '🦊', createdAt: 1,
    })
    await runDataMigrations()
    await runDataMigrations()
    const profiles = await profilesDb.listProfiles()
    expect(profiles[0].color).toBe('#1d4ed8')
  })

  it('leaves new-palette colors untouched', async () => {
    await profilesDb.insertProfile({
      id: 'p-1', name: 'New', color: '#1d4ed8', emoji: '🦊', createdAt: 1,
    })
    await runDataMigrations()
    const profiles = await profilesDb.listProfiles()
    expect(profiles[0].color).toBe('#1d4ed8')
  })

  it('every old-palette color has a new-palette replacement', () => {
    const newColors = new Set(Object.values(COLOR_MIGRATION_MAP))
    expect(newColors.size).toBe(Object.keys(COLOR_MIGRATION_MAP).length)
  })
})
