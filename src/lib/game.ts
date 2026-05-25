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
  completedAt: number
  /**
   * Full per-hand record. Present on games completed in Phase 2 and later.
   * Absent on legacy completed games — stats consumers must treat this as
   * "category data unknown" rather than as zero.
   */
  handHistory?: HandHistoryEntry[]
}
