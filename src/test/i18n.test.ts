import { describe, it, expect } from 'vitest'
import { t, LANGUAGES } from '../i18n'

describe('i18n', () => {
  it('returns English text for known keys', () => {
    expect(t('app.title', 'en')).toBe('Scopa Score Tracker')
  })

  it('returns Italian text for known keys', () => {
    expect(t('app.title', 'it')).toBe('Scopa — Segnapunti')
  })

  it('falls back to English for unknown language', () => {
    expect(t('app.title', 'fr')).toBe('Scopa Score Tracker')
  })

  it('returns the key itself when key is unknown', () => {
    expect(t('unknown.key', 'en')).toBe('unknown.key')
  })

  it('substitutes parameters', () => {
    expect(t('winner.wins', 'en', { name: 'Mario' })).toBe('Mario wins!')
    expect(t('winner.wins', 'it', { name: 'Mario' })).toBe('Mario vince!')
  })

  it('substitutes player placeholder', () => {
    expect(t('setup.playerPlaceholder', 'en', { n: '3' })).toBe('Player 3')
    expect(t('setup.playerPlaceholder', 'it', { n: '3' })).toBe('Giocatore 3')
  })

  it('has the same keys in English and Italian', () => {
    // Access translations via the t function — verify every en key exists in it
    const enKeys = [
      'app.title', 'setup.playerCount', 'setup.playerNames',
      'setup.startGame', 'game.handAwards', 'game.cards',
      'game.coins', 'game.settebello', 'game.primiera',
      'game.scopa', 'game.bankHand', 'menu.newGame',
      'menu.language', 'winner.wins', 'winner.tie',
    ]
    for (const key of enKeys) {
      const enVal = t(key, 'en')
      const itVal = t(key, 'it')
      expect(enVal).not.toBe(key) // en should have a value
      expect(itVal).not.toBe(key) // it should have a value
    }
  })

  it('LANGUAGES has en and it', () => {
    expect(LANGUAGES).toEqual([
      { code: 'en', name: 'English' },
      { code: 'it', name: 'Italiano' },
    ])
  })
})
