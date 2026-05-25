import type { CompletedGame, HandHistoryEntry } from './game'

/**
 * Aggregated statistics for a single profile across all of their completed
 * games. Returned by {@link computeProfileStats} and {@link computeLeaderboard}.
 *
 * `lastKnown*` fields are pulled from the most-recent {@link CompletedGame}
 * the profile participated in, so deleted profiles still render with their
 * last-seen name, color, and emoji.
 *
 * `categoryStats` is undefined if no games with hand-history data have been
 * played by this profile (pre-Phase-2 games). When present, the inner
 * `gamesWithHandData` is the divisor used for the rate calculations.
 */
export type ProfileStats = {
  profileId: string
  lastKnownName: string
  lastKnownColor: string
  lastKnownEmoji: string
  gamesPlayed: number
  wins: number
  losses: number
  /** Win rate as a fraction in `[0, 1]`. Zero if `gamesPlayed === 0`. */
  winRate: number
  /** Mean final score across every game the profile played. */
  avgScore: number
  /**
   * Current streak signed by direction: `+N` = N consecutive wins ending in
   * the most recent game, `-N` = N consecutive losses. Zero means no games
   * played.
   */
  currentStreak: number
  /** Longest run of consecutive wins ever achieved (0 if no wins). */
  longestWinStreak: number
  categoryStats?: CategoryStats
}

/** Per-category breakdown of how often a profile won that category. */
export type CategoryStats = {
  /** Number of completed games with hand-history data the profile played in. */
  gamesWithHandData: number
  cards: CategoryRecord
  coins: CategoryRecord
  settebello: CategoryRecord
  primiera: CategoryRecord
  /** Total scopa scored across all hand-history games (no rate — informational). */
  scopaTotal: number
}

/**
 * Win tally for a single category. `won` is hands the profile won this
 * category, `total` is hands where any player won this category, and
 * `rate = won / total` (0 if `total === 0`).
 */
export type CategoryRecord = {
  won: number
  total: number
  rate: number
}

/** Pairwise head-to-head record between two profiles, returned by {@link computeHeadToHead}. */
export type HeadToHeadRecord = {
  /** Total games where both profiles participated. */
  gamesTogether: number
  /** Games among those won outright by profile A. */
  aWins: number
  /** Games among those won outright by profile B. */
  bWins: number
  /** Games among those won by neither (some third profile won). */
  otherWins: number
}

// ── Internal helpers ──────────────────────────────────────

/**
 * Sort completed games by their `completedAt` timestamp, oldest first.
 * Used as a stable input order for streak computation.
 */
function chronological(games: CompletedGame[]): CompletedGame[] {
  return [...games].sort((a, b) => a.completedAt - b.completedAt)
}

/** Return the profileId of the player whose name matches `winnerName` in this game, or null. */
function winnerProfileId(game: CompletedGame): string | null {
  const winner = game.players.find(p => p.name === game.winnerName)
  return winner?.profileId ?? null
}

// ── Per-profile stats ─────────────────────────────────────

/**
 * Compute the full {@link ProfileStats} for `profileId` across every game in
 * `games`. Games where the profile didn't play are ignored. Returns null if
 * the profile never participated in any completed game.
 */
export function computeProfileStats(
  games: CompletedGame[],
  profileId: string,
): ProfileStats | null {
  const participated = games.filter(g => g.players.some(p => p.profileId === profileId))
  if (participated.length === 0) return null

  const ordered = chronological(participated)
  const mostRecent = ordered[ordered.length - 1]
  const snapshot = mostRecent.players.find(p => p.profileId === profileId)!

  let wins = 0
  let scoreSum = 0
  let currentStreak = 0
  let longestWinStreak = 0
  let runningWinStreak = 0

  for (const game of ordered) {
    const me = game.players.find(p => p.profileId === profileId)!
    scoreSum += me.score
    const won = winnerProfileId(game) === profileId
    if (won) {
      wins += 1
      runningWinStreak += 1
      longestWinStreak = Math.max(longestWinStreak, runningWinStreak)
      currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1
    } else {
      runningWinStreak = 0
      currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1
    }
  }

  const gamesPlayed = participated.length
  const losses = gamesPlayed - wins
  const categoryStats = computeCategoryStats(participated, profileId)

  return {
    profileId,
    lastKnownName: snapshot.name,
    lastKnownColor: snapshot.color,
    lastKnownEmoji: snapshot.emoji,
    gamesPlayed,
    wins,
    losses,
    winRate: gamesPlayed > 0 ? wins / gamesPlayed : 0,
    avgScore: gamesPlayed > 0 ? scoreSum / gamesPlayed : 0,
    currentStreak,
    longestWinStreak,
    categoryStats,
  }
}

/**
 * Compute per-category win rates for `profileId` over the subset of `games`
 * that have hand-history data. Returns undefined when no qualifying games
 * exist so the UI can hide the category section instead of showing zeros.
 */
export function computeCategoryStats(
  games: CompletedGame[],
  profileId: string,
): CategoryStats | undefined {
  const withHands = games.filter(g => g.handHistory && g.handHistory.length > 0)
  if (withHands.length === 0) return undefined

  let gamesUsed = 0
  let cardsWon = 0, cardsTotal = 0
  let coinsWon = 0, coinsTotal = 0
  let setteWon = 0, setteTotal = 0
  let primWon = 0, primTotal = 0
  let scopaTotal = 0

  for (const game of withHands) {
    const me = game.players.find(p => p.profileId === profileId)
    if (!me) continue
    gamesUsed += 1
    for (const hand of game.handHistory as HandHistoryEntry[]) {
      // Count totals only where someone actually won the category this hand
      let cardsWonByAny = false
      let coinsWonByAny = false
      let setteWonByAny = false
      let primWonByAny = false
      for (const otherPlayerId of Object.keys(hand.categories)) {
        const c = hand.categories[otherPlayerId]
        if (c.cards) cardsWonByAny = true
        if (c.coins) coinsWonByAny = true
        if (c.settebello) setteWonByAny = true
        if (c.premiera) primWonByAny = true
      }
      if (cardsWonByAny) cardsTotal += 1
      if (coinsWonByAny) coinsTotal += 1
      if (setteWonByAny) setteTotal += 1
      if (primWonByAny) primTotal += 1

      // Legacy games may not have playerId — skip category attribution for those.
      const myDetail = me.playerId ? hand.categories[me.playerId] : undefined
      if (myDetail) {
        if (myDetail.cards) cardsWon += 1
        if (myDetail.coins) coinsWon += 1
        if (myDetail.settebello) setteWon += 1
        if (myDetail.premiera) primWon += 1
        scopaTotal += myDetail.scopa
      }
    }
  }

  const rate = (won: number, total: number) => (total > 0 ? won / total : 0)
  return {
    gamesWithHandData: gamesUsed,
    cards: { won: cardsWon, total: cardsTotal, rate: rate(cardsWon, cardsTotal) },
    coins: { won: coinsWon, total: coinsTotal, rate: rate(coinsWon, coinsTotal) },
    settebello: { won: setteWon, total: setteTotal, rate: rate(setteWon, setteTotal) },
    primiera: { won: primWon, total: primTotal, rate: rate(primWon, primTotal) },
    scopaTotal,
  }
}

// ── Leaderboard ───────────────────────────────────────────

/**
 * Compute a leaderboard of every profile that has played at least one
 * completed game in `games`. Sorted by wins descending, then win rate
 * descending, then games-played descending as a tiebreaker.
 */
export function computeLeaderboard(games: CompletedGame[]): ProfileStats[] {
  const seen = new Set<string>()
  for (const game of games) {
    for (const player of game.players) {
      seen.add(player.profileId)
    }
  }
  const rows: ProfileStats[] = []
  for (const profileId of seen) {
    const stats = computeProfileStats(games, profileId)
    if (stats) rows.push(stats)
  }
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.winRate !== a.winRate) return b.winRate - a.winRate
    return b.gamesPlayed - a.gamesPlayed
  })
  return rows
}

// ── Head-to-head ──────────────────────────────────────────

/**
 * Compute the pairwise head-to-head record between two profiles.
 *
 * "A wins" means a game where both profiles participated and profile A was
 * the overall game winner. "Other wins" counts games where neither A nor B
 * won (some third profile took the game).
 */
export function computeHeadToHead(
  games: CompletedGame[],
  profileIdA: string,
  profileIdB: string,
): HeadToHeadRecord {
  let gamesTogether = 0
  let aWins = 0
  let bWins = 0
  let otherWins = 0

  for (const game of games) {
    const hasA = game.players.some(p => p.profileId === profileIdA)
    const hasB = game.players.some(p => p.profileId === profileIdB)
    if (!hasA || !hasB) continue
    gamesTogether += 1
    const winnerId = winnerProfileId(game)
    if (winnerId === profileIdA) aWins += 1
    else if (winnerId === profileIdB) bWins += 1
    else otherWins += 1
  }

  return { gamesTogether, aWins, bWins, otherWins }
}

/**
 * Build a full head-to-head matrix between every pair of profiles that have
 * played together at least once. Returns an array of records keyed by
 * `${profileIdA}::${profileIdB}` (always with A's id sorted lexicographically
 * before B's) so each unordered pair appears at most once.
 */
export function computeHeadToHeadMatrix(
  games: CompletedGame[],
): Array<{ profileIdA: string; profileIdB: string; record: HeadToHeadRecord }> {
  const profileIds = Array.from(
    new Set(games.flatMap(g => g.players.map(p => p.profileId))),
  ).sort()

  const out: Array<{ profileIdA: string; profileIdB: string; record: HeadToHeadRecord }> = []
  for (let i = 0; i < profileIds.length; i++) {
    for (let j = i + 1; j < profileIds.length; j++) {
      const a = profileIds[i]
      const b = profileIds[j]
      const record = computeHeadToHead(games, a, b)
      if (record.gamesTogether > 0) {
        out.push({ profileIdA: a, profileIdB: b, record })
      }
    }
  }
  return out
}
