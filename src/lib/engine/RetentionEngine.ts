/**
 * Calculates the Continuity Index and all component metrics for a team-season pair.
 *
 * Logic ported from V1/src/lib/analytics/retention.ts — rules preserved exactly.
 * Only changes: import paths updated, RetentionAnalysis → RetentionResult.
 *
 * PARTICIPATION THRESHOLD — OPTION B
 * ====================================
 * A Year 1 player qualifies if they meet EITHER:
 *   1. minutesPlayed >= 30  (total season minutes)
 *   2. games >= ceil(teamGames × 0.20)  (appeared in ≥20% of games)
 *
 * STARTS FALLBACK
 * ===============
 * If starts data is unavailable (all null or all zero) for Year 1 qualified players:
 *   CI = (returningMinutesPct + returningPointsPct) / 2
 *   dataQuality = 'partial'
 *
 * CBBD provides starts for all D1 players, so the fallback is not expected to
 * trigger for D1 CBBD data. It will activate for D2 Sidearm teams that don't
 * track starts (same behavior as V1).
 */

import type {
  PlayerSeason,
  RetentionResult,
  BelowThresholdPlayer,
  DataQuality,
  MatchingResult,
} from '@/lib/types'
import { matchPlayerRosters, applyManualOverrides } from './matching'
import type { PlayerOverride } from '@/lib/types'

// ─── Threshold Constants ──────────────────────────────────────────────────────

export const THRESHOLD_MINUTES   = 30
export const THRESHOLD_GAMES_PCT = 0.20

// ─── Threshold Logic ──────────────────────────────────────────────────────────

export function meetsThreshold(player: PlayerSeason, teamGamesPlayed: number): boolean {
  const minGamesRequired = Math.ceil(teamGamesPlayed * THRESHOLD_GAMES_PCT)
  return player.minutesPlayed >= THRESHOLD_MINUTES || player.games >= minGamesRequired
}

export function applyThreshold(
  players: PlayerSeason[],
  teamGamesPlayed: number
): { qualified: PlayerSeason[]; excluded: BelowThresholdPlayer[] } {
  const gamesRequired = Math.ceil(teamGamesPlayed * THRESHOLD_GAMES_PCT)
  const qualified: PlayerSeason[] = []
  const excluded: BelowThresholdPlayer[] = []

  for (const player of players) {
    const meetsMinutes = player.minutesPlayed >= THRESHOLD_MINUTES
    const meetsGames   = player.games >= gamesRequired

    if (meetsMinutes || meetsGames) {
      qualified.push(player)
    } else {
      const parts: string[] = []
      if (!meetsMinutes) parts.push(`${player.minutesPlayed} min < ${THRESHOLD_MINUTES}`)
      if (!meetsGames)   parts.push(`${player.games} GP < ${gamesRequired} (20% of ${teamGamesPlayed} games)`)

      excluded.push({
        player,
        meetsMinutes,
        meetsGames,
        minutesRequired: THRESHOLD_MINUTES,
        gamesRequired,
        exclusionLabel: parts.join(' AND '),
      })
    }
  }

  return { qualified, excluded }
}

// ─── Starts Data Quality ──────────────────────────────────────────────────────

export function startsDataAvailable(players: PlayerSeason[]): boolean {
  if (players.length === 0) return false
  const nullCount = players.filter(p => p.gamesStarted === null).length
  if (nullCount === players.length) return false
  const sumStarts = players.reduce((acc, p) => acc + (p.gamesStarted ?? 0), 0)
  return sumStarts > 0
}

// ─── CI Calculation ───────────────────────────────────────────────────────────

function safePct(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  return Math.round((numerator / denominator) * 10000) / 100
}

/**
 * Calculates the full Continuity Index for a team-season pair.
 *
 * @param matchResult      Output of matchPlayerRosters()
 * @param year1All         Full Year 1 player list (unfiltered)
 * @param teamYear1Games   Number of games played in Year 1
 * @param year1            Year 1 season integer
 * @param year2            Year 2 season integer
 * @param teamId           Team slug
 */
export function calculateRetention(
  matchResult: MatchingResult,
  year1All: PlayerSeason[],
  teamYear1Games: number,
  year1: number,
  year2: number,
  teamId: string
): RetentionResult {
  const gamesRequired = Math.ceil(teamYear1Games * THRESHOLD_GAMES_PCT)

  const { qualified: year1Qualified, excluded: belowThresholdPlayers } =
    applyThreshold(year1All, teamYear1Games)

  // ── Year 1 denominators ────────────────────────────────────────────────────
  const totalYear1Minutes = year1Qualified.reduce((s, p) => s + p.minutesPlayed, 0)
  const totalYear1Starts  = year1Qualified.reduce((s, p) => s + (p.gamesStarted ?? 0), 0)
  const totalYear1Points  = year1Qualified.reduce((s, p) => s + p.points, 0)

  // ── Returning Year 1 contributions ────────────────────────────────────────
  const returningMinutes = matchResult.returning.reduce((s, r) => s + r.year1Stats.minutesPlayed, 0)
  const returningStarts  = matchResult.returning.reduce((s, r) => s + (r.year1Stats.gamesStarted ?? 0), 0)
  const returningPoints  = matchResult.returning.reduce((s, r) => s + r.year1Stats.points, 0)

  // ── Component percentages ─────────────────────────────────────────────────
  const returningMinutesPct = safePct(returningMinutes, totalYear1Minutes)
  const returningPointsPct  = safePct(returningPoints,  totalYear1Points)

  const startsOk = startsDataAvailable(year1Qualified)
  const returningStartsPct: number | null = startsOk
    ? safePct(returningStarts, totalYear1Starts)
    : null

  // ── Continuity Index ──────────────────────────────────────────────────────
  let continuityIndex: number
  let dataQuality: DataQuality

  if (startsOk && returningStartsPct !== null) {
    continuityIndex = Math.round(
      ((returningMinutesPct + returningStartsPct + returningPointsPct) / 3) * 10
    ) / 10
    dataQuality = 'complete'
  } else {
    continuityIndex = Math.round(
      ((returningMinutesPct + returningPointsPct) / 2) * 10
    ) / 10
    dataQuality = 'partial'
  }

  // ── Departed player metrics ────────────────────────────────────────────────
  const deptMinutes = matchResult.nonReturning.reduce((s, p) => s + p.minutesPlayed, 0)
  const deptPoints  = matchResult.nonReturning.reduce((s, p) => s + p.points, 0)
  const deptMinutesPct = safePct(deptMinutes, totalYear1Minutes)
  const deptPointsPct  = safePct(deptPoints,  totalYear1Points)

  // ── Newcomer metrics ──────────────────────────────────────────────────────
  const totalYear2Minutes =
    matchResult.returning.reduce((s, r) => s + r.year2Stats.minutesPlayed, 0) +
    matchResult.newPlayers.reduce((s, p) => s + p.minutesPlayed, 0)
  const totalYear2Points =
    matchResult.returning.reduce((s, r) => s + r.year2Stats.points, 0) +
    matchResult.newPlayers.reduce((s, p) => s + p.points, 0)
  const newcomerMinutes = matchResult.newPlayers.reduce((s, p) => s + p.minutesPlayed, 0)
  const newcomerPoints  = matchResult.newPlayers.reduce((s, p) => s + p.points, 0)
  const newcomerMinutesPct = safePct(newcomerMinutes, totalYear2Minutes)
  const newcomerPointsPct  = safePct(newcomerPoints,  totalYear2Points)

  // ── Display counts ────────────────────────────────────────────────────────
  const returningPlayersCount  = matchResult.returning.length
  const returningStartersCount = matchResult.returning.filter(
    r => (r.year1Stats.gamesStarted ?? 0) > 0
  ).length
  const newPlayersCount = matchResult.newPlayers.length

  // ── Warnings ──────────────────────────────────────────────────────────────
  const warnings: string[] = [...matchResult.warnings]

  if (dataQuality === 'partial') {
    warnings.unshift(
      `Starts data not available for ${teamId} ${year1} — ` +
      `Continuity Index calculated from Minutes % and Points % only.`
    )
  }
  if (belowThresholdPlayers.length > 0) {
    warnings.push(
      `${belowThresholdPlayers.length} player(s) excluded from CI denominator (below participation threshold).`
    )
  }

  return {
    teamId,
    year1,
    year2,
    continuityIndex,
    dataQuality,
    returningMinutesPct,
    returningStartsPct,
    returningPointsPct,
    deptMinutesPct,
    deptPointsPct,
    newcomerMinutesPct,
    newcomerPointsPct,
    returningPlayersCount,
    returningStartersCount,
    newPlayersCount,
    returningPlayers:      matchResult.returning,
    nonReturningPlayers:   matchResult.nonReturning,
    newPlayers:            matchResult.newPlayers,
    lowConfidenceExcluded: matchResult.lowConfidenceExcluded,
    belowThresholdPlayers,
    warnings,
    thresholdMinutes:       THRESHOLD_MINUTES,
    thresholdGamesPct:      THRESHOLD_GAMES_PCT,
    thresholdGamesRequired: gamesRequired,
  }
}

// ─── Top-level helper ─────────────────────────────────────────────────────────

/**
 * Full pipeline: threshold → match → CI.
 * Pass overrides=[] if no manual corrections exist.
 */
export function computeRetention(
  year1Players: PlayerSeason[],
  year2Players: PlayerSeason[],
  teamYear1Games: number,
  year1: number,
  year2: number,
  teamId: string,
  overrides: PlayerOverride[] = []
): RetentionResult {
  const { qualified: year1Qualified } = applyThreshold(year1Players, teamYear1Games)
  let matchResult = matchPlayerRosters(year1Qualified, year2Players)
  if (overrides.length > 0) {
    matchResult = applyManualOverrides(matchResult, overrides)
  }
  return calculateRetention(matchResult, year1Players, teamYear1Games, year1, year2, teamId)
}
