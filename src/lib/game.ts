/**
 * An in-game player.
 *
 * `profileId`/`name`/`color`/`emoji` are snapshotted from the source profile
 * when the game starts. They intentionally do not react to later edits or
 * deletions of that profile so completed games stay stable.
 */
export type Player = {
  /** Stable id local to the game (e.g. "player-0"); not the profile id. */
  id: string
  /** The id of the {@link PlayerProfile} this player was created from. */
  profileId: string
  /** Snapshot of the profile name at game-start. */
  name: string
  /** Snapshot of the profile color at game-start. */
  color: string
  /** Snapshot of the profile emoji at game-start. */
  emoji: string
  /** Running total of points accumulated across banked hands. */
  totalScore: number
}

/** Per-player flags recorded for one banked hand, plus this hand's scopa count. */
export type HandCategoryDetail = {
  cards: boolean
  coins: boolean
  settebello: boolean
  premiera: boolean
  /** Number of scopa scored this hand (each is worth one point). */
  scopa: number
}

/** A single row in a game's hand history. */
export type HandHistoryEntry = {
  /** 1-based hand number within the game. */
  handNumber: number
  /** Points awarded to each player keyed by `Player.id`. */
  scores: Record<string, number>
  /** Which categories each player won this hand, keyed by `Player.id`. */
  categories: Record<string, HandCategoryDetail>
  /** Unix-ms timestamp the hand was banked. */
  timestamp: number
}

/** An active or recently-active game session held in localStorage. */
export type Game = {
  id: string
  players: Player[]
  handScopaScores: Record<string, number>
  handCardsWinner: string | null
  handCoinsWinner: string | null
  handSettebelloWinner: string | null
  handPremieraWinner: string | null
  handHistory: HandHistoryEntry[]
  createdAt: number
}

/**
 * A finished game retained for the history view and statistics.
 *
 * Player metadata (name, color, emoji) is snapshotted so the history view
 * stays correct even if the source profiles are later renamed or deleted.
 * `playerId` is the in-game id used as the key in `handHistory[].scores` and
 * `categories` — keeping it here lets statistics functions map handHistory
 * rows back to specific profiles.
 *
 * `handHistory` is optional because games completed before Phase 2 (issue
 * #23) didn't persist it. Statistics functions must handle the absent case
 * by skipping per-category metrics for those games.
 */
export type CompletedGame = {
  id: string
  players: {
    /**
     * The in-game Player.id (e.g. "player-0"); links to handHistory keys.
     * Optional because legacy (Phase 1) completed games predate this field —
     * statistics consumers must skip per-hand metrics for those games.
     */
    playerId?: string
    /** The id of the profile this player was created from. */
    profileId: string
    /** Snapshot of the profile name at game-end. */
    name: string
    /** Final total score in this game. */
    score: number
    /** Snapshot of the profile color at game-end. */
    color: string
    /** Snapshot of the profile emoji at game-end. */
    emoji: string
  }[]
  winnerName: string
  /**
   * Stable winner identifier. Preferred by stats and history filters over
   * `winnerName` so two profiles that happen to share a display name don't
   * collide. Optional because games completed before this field was
   * introduced won't have it — consumers must fall back to `winnerName` in
   * that case.
   */
  winnerProfileId?: string
  completedAt: number
  /**
   * Full per-hand record. Present on games completed in Phase 2 and later.
   * Absent on legacy completed games — stats consumers must treat this as
   * "category data unknown" rather than as zero.
   */
  handHistory?: HandHistoryEntry[]
}

/**
 * Resolve the profile id of the player who won this completed game.
 *
 * Prefers the authoritative `winnerProfileId` field. Falls back to a
 * name-based lookup for legacy games that predate that field: if exactly
 * one player has that name, returns their profileId; if multiple players
 * share the name, picks the one with the highest final score as a
 * best-effort tiebreak; if no name matches, returns null.
 */
export function resolveWinnerProfileId(game: CompletedGame): string | null {
  if (game.winnerProfileId) return game.winnerProfileId
  const candidates = game.players.filter(p => p.name === game.winnerName)
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0].profileId
  return candidates.reduce((best, p) => (p.score > best.score ? p : best)).profileId
}

/**
 * Result of evaluating end-of-hand win conditions for a Scopa game.
 *
 * - `kind: 'continue'` — no player has reached the threshold yet.
 * - `kind: 'win'` — exactly one player has reached the threshold AND
 *   strictly leads everyone tied for first.
 * - `kind: 'tie'` — multiple players are tied at the same top score and
 *   all are at or above the threshold. The game must continue until the
 *   tie is broken.
 */
export type WinOutcome<P extends { totalScore: number }> =
  | { kind: 'continue' }
  | { kind: 'win'; winner: P }
  | { kind: 'tie'; tied: P[] }

/**
 * Evaluate end-of-hand win conditions.
 *
 * A player wins only when BOTH conditions hold:
 *   a) Their `totalScore` is at or above `threshold`.
 *   b) They have strictly the highest score (no one is tied with them).
 *
 * If 2+ players are tied at the top and at or above the threshold the
 * outcome is `tie` and the game must continue. If no one has reached the
 * threshold the outcome is `continue`.
 *
 * Pure and type-parametric so it can be unit-tested without dragging in
 * the rest of the in-game `Player` shape.
 */
export function computeWinOutcome<P extends { totalScore: number }>(
  players: P[],
  threshold = 11,
): WinOutcome<P> {
  const atOrAboveThreshold = players.filter(p => p.totalScore >= threshold)
  if (atOrAboveThreshold.length === 0) return { kind: 'continue' }
  const maxScore = Math.max(...atOrAboveThreshold.map(p => p.totalScore))
  const top = atOrAboveThreshold.filter(p => p.totalScore === maxScore)
  if (top.length === 1) return { kind: 'win', winner: top[0] }
  return { kind: 'tie', tied: top }
}
