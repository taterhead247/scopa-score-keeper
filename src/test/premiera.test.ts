import { describe, it, expect } from 'vitest'
import { calculatePrimiera } from '../components/PremieraCalc'

describe('calculatePrimiera', () => {
  it('returns 0 for empty input', () => {
    expect(calculatePrimiera({})).toBe(0)
  })

  it('returns 0 when all counts are 0', () => {
    expect(calculatePrimiera({ 7: 0, 6: 0, 1: 0 })).toBe(0)
  })

  it('calculates correctly with four sevens (best case)', () => {
    // 4 sevens = 4 * 21 = 84
    expect(calculatePrimiera({ 7: 4 })).toBe(84)
  })

  it('calculates correctly with mixed cards', () => {
    // 2 sevens (21 each) + 1 six (18) + 1 ace (16) = 76
    expect(calculatePrimiera({ 7: 2, 6: 1, 1: 1 })).toBe(76)
  })

  it('fills only 4 suits maximum', () => {
    // Even if we have tons of cards, only 4 suits
    expect(calculatePrimiera({ 7: 10 })).toBe(84) // capped at 4 * 21
  })

  it('uses greedy algorithm - picks highest values first', () => {
    // 3 sevens (3 * 21 = 63) + best remaining is 6 (18) → 81
    expect(calculatePrimiera({ 7: 3, 6: 2, 5: 3 })).toBe(81)
  })

  it('handles only low-value cards', () => {
    // 4 twos = 4 * 12 = 48
    expect(calculatePrimiera({ 2: 4 })).toBe(48)
  })

  it('handles face cards (10, 9, 8 all worth 10)', () => {
    // 4 face cards = 4 * 10 = 40
    expect(calculatePrimiera({ 10: 2, 9: 1, 8: 1 })).toBe(40)
  })

  it('handles a realistic hand', () => {
    // 1 seven (21) + 2 sixes (2*18=36) + 1 five (15) = 72
    expect(calculatePrimiera({ 7: 1, 6: 2, 5: 1 })).toBe(72)
  })

  it('handles fewer than 4 total cards', () => {
    // Only 2 cards: 1 seven (21) + 1 ace (16) = 37
    expect(calculatePrimiera({ 7: 1, 1: 1 })).toBe(37)
  })

  it('handles single card', () => {
    expect(calculatePrimiera({ 7: 1 })).toBe(21)
    expect(calculatePrimiera({ 1: 1 })).toBe(16)
    expect(calculatePrimiera({ 8: 1 })).toBe(10)
  })
})
