export type PlayerProfile = {
  id: string
  name: string
  color: string
  emoji: string
  createdAt: number
}

export const PROFILE_COLORS = [
  '#3b82f6',
  '#ef4444',
  '#10b981',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
  '#ec4899',
  '#eab308',
  '#6366f1',
  '#84cc16',
]

export const PROFILE_EMOJIS = [
  '😀', '😎', '🤓', '🥳', '🤠',
  '🦊', '🐱', '🐶', '🐼', '🐯',
  '🐸', '🦄', '🐙', '🦁', '🐢',
  '🌟', '🔥', '⚡', '🎲', '🃏',
  '🎯', '🏆', '👑', '💎', '🚀',
  '🍕', '🍔', '🍩', '🌮', '🍦',
]

export const PROFILES_STORAGE_KEY = 'scopa-player-profiles'
export const PROFILES_MIGRATED_FLAG = 'scopa-profiles-migrated'

export function makeProfileId() {
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function pickDefaultColor(existing: PlayerProfile[]): string {
  const used = new Set(existing.map(p => p.color))
  return PROFILE_COLORS.find(c => !used.has(c)) ?? PROFILE_COLORS[0]
}

export function pickDefaultEmoji(existing: PlayerProfile[]): string {
  const used = new Set(existing.map(p => p.emoji))
  return PROFILE_EMOJIS.find(e => !used.has(e)) ?? PROFILE_EMOJIS[0]
}
