import { describe, it, expect, beforeEach } from 'vitest'
import { initDatabase } from '../lib/db'
import * as profilesDb from '../lib/db/profiles'
import * as favoritesDb from '../lib/db/favorites'
import * as gamesDb from '../lib/db/games'
import * as settingsDb from '../lib/db/settings'
import { SETTINGS_KEYS } from '../lib/db/schema'
import { exportData, importData, BACKUP_FORMAT_VERSION } from '../lib/db/portability'
import type { Game } from '../lib/game'

/** Boot a fresh in-memory DB before every test. */
beforeEach(async () => {
  await initDatabase()
})

/** Build a synthetic in-progress game we can hand to {@link gamesDb.createGame}. */
function buildActiveGame(): Game {
  return {
    id: 'g-active',
    players: [
      { id: 'player-0', profileId: 'p-marco', name: 'Marco', color: '#3b82f6', emoji: '🦊', totalScore: 7 },
      { id: 'player-1', profileId: 'p-giulia', name: 'Giulia', color: '#ef4444', emoji: '🐱', totalScore: 5 },
    ],
    handScopaScores: { 'player-0': 1, 'player-1': 0 },
    handCardsWinner: 'player-0',
    handCoinsWinner: null,
    handSettebelloWinner: null,
    handPremieraWinner: null,
    handHistory: [],
    createdAt: 1748000000000,
  } as Game
}

describe('portability — round trip', () => {
  it('preserves profiles, favorites, games, completed games, and settings', async () => {
    // Profiles
    await profilesDb.insertProfile({
      id: 'p-marco', name: 'Marco', color: '#3b82f6', emoji: '🦊', createdAt: 1747900000000,
    })
    await profilesDb.insertProfile({
      id: 'p-giulia', name: 'Giulia', color: '#ef4444', emoji: '🐱', createdAt: 1747900000001,
    })
    // Favorite grouping
    await favoritesDb.insertFavorite({
      id: 'p-giulia::p-marco',
      profileIds: ['p-marco', 'p-giulia'],
      name: 'Family',
      createdAt: 1747999000000,
    })
    // Active game with a banked hand
    const game = buildActiveGame()
    await gamesDb.createGame(game)
    await gamesDb.bankHand(game.id, 1, 1748000600000, [
      {
        playerId: 'player-0',
        score: 4,
        categories: { cards: true, coins: false, settebello: true, premiera: false, scopa: 1 },
        newTotal: 11,
      },
      {
        playerId: 'player-1',
        score: 1,
        categories: { cards: false, coins: true, settebello: false, premiera: false, scopa: 0 },
        newTotal: 6,
      },
    ])
    await gamesDb.completeGame(
      game.id,
      { profileId: 'p-marco', name: 'Marco' },
      1748000900000,
    )
    // Settings
    await settingsDb.setSetting(SETTINGS_KEYS.language, 'it')

    const exported = await exportData()
    expect(exported.profiles).toHaveLength(2)
    expect(exported.favorites).toHaveLength(1)
    expect(exported.completedGames).toHaveLength(1)
    expect(exported.settings.language).toBe('it')
    expect(exported.formatVersion).toBe(BACKUP_FORMAT_VERSION)

    // Wipe and re-import
    await importData(exported)

    const reProfiles = await profilesDb.listProfiles()
    expect(reProfiles).toHaveLength(2)
    expect(reProfiles.map(p => p.id).sort()).toEqual(['p-giulia', 'p-marco'])

    const reFavorites = await favoritesDb.listFavorites()
    expect(reFavorites).toHaveLength(1)
    expect(reFavorites[0].profileIds).toEqual(['p-marco', 'p-giulia'])
    expect(reFavorites[0].name).toBe('Family')

    // listActiveGames returns nothing because the game was completed before export
    const reActive = await gamesDb.listActiveGames()
    expect(reActive).toHaveLength(0)

    const reLanguage = await settingsDb.getSetting(SETTINGS_KEYS.language)
    expect(reLanguage).toBe('it')
  })

  it('preserves an active (uncompleted) game with hand history through round trip', async () => {
    await profilesDb.insertProfile({
      id: 'p-marco', name: 'Marco', color: '#3b82f6', emoji: '🦊', createdAt: 1,
    })
    await profilesDb.insertProfile({
      id: 'p-giulia', name: 'Giulia', color: '#ef4444', emoji: '🐱', createdAt: 2,
    })
    const game = buildActiveGame()
    await gamesDb.createGame(game)
    await gamesDb.bankHand(game.id, 1, 1748000600000, [
      {
        playerId: 'player-0',
        score: 3,
        categories: { cards: true, coins: false, settebello: false, premiera: true, scopa: 0 },
        newTotal: 10,
      },
      {
        playerId: 'player-1',
        score: 1,
        categories: { cards: false, coins: true, settebello: false, premiera: false, scopa: 0 },
        newTotal: 6,
      },
    ])

    const exported = await exportData()
    expect(exported.games).toHaveLength(1)
    expect(exported.games[0].handHistory).toHaveLength(1)

    await importData(exported)

    const reActive = await gamesDb.listActiveGames()
    expect(reActive).toHaveLength(1)
    expect(reActive[0].id).toBe('g-active')
    expect(reActive[0].handHistory).toHaveLength(1)
    expect(reActive[0].handHistory[0].scores['player-0']).toBe(3)
    expect(reActive[0].handHistory[0].categories['player-0'].cards).toBe(true)
    expect(reActive[0].handHistory[0].categories['player-0'].premiera).toBe(true)
    expect(reActive[0].players[0].totalScore).toBe(10)
  })

  it('preserves the activeGameId setting so the player resumes on the right screen', async () => {
    await profilesDb.insertProfile({
      id: 'p-marco', name: 'Marco', color: '#3b82f6', emoji: '🦊', createdAt: 1,
    })
    await profilesDb.insertProfile({
      id: 'p-giulia', name: 'Giulia', color: '#ef4444', emoji: '🐱', createdAt: 2,
    })
    const game = buildActiveGame()
    await gamesDb.createGame(game)
    // gamesDb.createGame doesn't set active_game_id — that's the hook's job
    // in real flow. Set it manually so the export contains it.
    await settingsDb.setSetting(SETTINGS_KEYS.activeGameId, game.id)

    const exported = await exportData()
    expect(exported.settings.activeGameId).toBe('g-active')

    await importData(exported)
    const reActive = await settingsDb.getSetting(SETTINGS_KEYS.activeGameId)
    expect(reActive).toBe('g-active')
  })

  it('importing wipes the existing DB rather than merging', async () => {
    await profilesDb.insertProfile({
      id: 'p-old', name: 'Old', color: '#000', emoji: '🦊', createdAt: 1,
    })
    const exported = await exportData()
    // Insert a record that should be wiped on import.
    await profilesDb.insertProfile({
      id: 'p-extra', name: 'Extra', color: '#111', emoji: '🐱', createdAt: 2,
    })
    expect((await profilesDb.listProfiles())).toHaveLength(2)

    await importData(exported)
    const after = await profilesDb.listProfiles()
    expect(after).toHaveLength(1)
    expect(after[0].id).toBe('p-old')
  })
})

describe('portability — validation', () => {
  it('rejects a non-object payload', async () => {
    await expect(importData('not a backup')).rejects.toThrow()
  })

  it('rejects a payload missing required fields', async () => {
    await expect(importData({ schemaVersion: 1 })).rejects.toThrow()
  })

  it('rejects a payload whose games have malformed players', async () => {
    const bogus = {
      schemaVersion: 1,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: Date.now(),
      profiles: [],
      favorites: [],
      games: [
        {
          id: 'g1',
          // players field has a non-string color which will fail validation
          players: [{ id: 'p0', profileId: '', name: 'X', color: 123, emoji: '🦊', totalScore: 0 }],
          handScopaScores: {},
          handCardsWinner: null,
          handCoinsWinner: null,
          handSettebelloWinner: null,
          handPremieraWinner: null,
          handHistory: [],
          createdAt: 0,
        },
      ],
      completedGames: [],
      settings: {},
    }
    await expect(importData(bogus)).rejects.toThrow()
  })

  it('accepts a minimal valid backup (empty arrays)', async () => {
    await importData({
      schemaVersion: 1,
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: Date.now(),
      profiles: [],
      favorites: [],
      games: [],
      completedGames: [],
      settings: {},
    })
    expect(await profilesDb.listProfiles()).toEqual([])
  })

  it('rejects a backup whose formatVersion is newer than this build supports', async () => {
    await expect(
      importData({
        schemaVersion: 1,
        formatVersion: BACKUP_FORMAT_VERSION + 1,
        exportedAt: Date.now(),
        profiles: [],
        favorites: [],
        games: [],
        completedGames: [],
        settings: {},
      }),
    ).rejects.toThrow(/newer than this app supports/)
  })

  it('rejects a backup whose schemaVersion is newer than this build supports', async () => {
    await expect(
      importData({
        schemaVersion: 999,
        formatVersion: BACKUP_FORMAT_VERSION,
        exportedAt: Date.now(),
        profiles: [],
        favorites: [],
        games: [],
        completedGames: [],
        settings: {},
      }),
    ).rejects.toThrow(/newer than this app supports/)
  })

  it('accepts a backup whose formatVersion is older than this build supports', async () => {
    // The shape still has to pass zod — but the version itself is fine if it's
    // older. This guards the "current build keeps reading legacy backups" path.
    await importData({
      schemaVersion: 1,
      formatVersion: Math.max(0, BACKUP_FORMAT_VERSION - 1),
      exportedAt: Date.now(),
      profiles: [],
      favorites: [],
      games: [],
      completedGames: [],
      settings: {},
    })
    expect(await profilesDb.listProfiles()).toEqual([])
  })
})
