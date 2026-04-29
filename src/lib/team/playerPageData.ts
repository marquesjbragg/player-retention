import type {
  PlayerSeason,
  TeamSeason,
  TeamIdentity,
  RetentionResult,
  RatingsEntry,
  OutlierFlag,
  BelowThresholdPlayer,
  MatchConfidence,
} from '@/lib/types'
import { prisma } from '@/lib/db'
import { buildTeamPageData, dbPlayerToApp } from './teamPageData'
import type { MasseyResult } from '@/lib/providers/d1/D1MasseyProvider'
import type { PlayerStatus, RoleTag } from './roleUtils'
import { computeRoleTag } from './roleUtils'
export type { PlayerStatus, RoleTag } from './roleUtils'

export interface PlayerPageData {
  // Identity
  athleteId: string
  playerName: string
  position: string | null
  teamSlug: string
  year1: number                          // year2 - 1
  year2: number                          // year from URL — the player's active season

  // Status in this team-year context
  status: PlayerStatus
  matchConfidence: MatchConfidence | null  // returners: exact/fuzzy/low
  isQualified: boolean
  belowThresholdInfo: BelowThresholdPlayer | null
  departedAfterYear2: boolean            // true = not found on same team in year2+1

  // Stats
  currentStats: PlayerSeason             // year2 stats (returner/newcomer), year1 if departure
  priorStats: PlayerSeason | null        // year1 stats for returners only

  // Contribution shares (0–100, percentage of team total)
  minShare: number
  ptsShare: number
  priorMinShare: number | null
  priorPtsShare: number | null
  minShareDelta: number | null           // pp change, returners only
  ptsShareDelta: number | null

  // Role classification
  roleTag: RoleTag

  // All active players in the current-stats season (for role profile bars)
  teamActivePlayers: PlayerSeason[]

  // Team context
  teamIdentity: TeamIdentity | null
  coachYear2: string | null
  teamSeason1: TeamSeason | null
  teamSeason2: TeamSeason | null
  retention: RetentionResult | null
  outlierFlag: OutlierFlag
  ratings1: RatingsEntry | null
  ratings2: RatingsEntry | null
  massey1: MasseyResult | null
  massey2: MasseyResult | null
  y1WinPct: number
  y2WinPct: number
  winPctDelta: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wPct(wins: number, losses: number): number {
  const t = wins + losses
  return t === 0 ? 0 : Math.round((wins / t) * 10000) / 100
}

function computeShares(
  player: PlayerSeason,
  allPlayers: PlayerSeason[],
): { min: number; pts: number } {
  const totalMin = allPlayers.reduce((s, p) => s + p.minutesPlayed, 0)
  const totalPts = allPlayers.reduce((s, p) => s + p.points, 0)
  return {
    min: totalMin > 0 ? Math.round((player.minutesPlayed / totalMin) * 10000) / 100 : 0,
    pts: totalPts > 0 ? Math.round((player.points  / totalPts)  * 10000) / 100 : 0,
  }
}

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Assembles PlayerPageData from DB player data and DB-backed team context.
 *
 * athleteId — for D1: the CBBD numeric athlete ID (e.g. "237" or "cbbd-237").
 *             for D2: the Sidearm ID (e.g. "sidearm-425-2311" or "425-2311").
 * teamSlug  — canonical team slug.
 * year2     — the season year being viewed (e.g. 2026 = 2025-26 season).
 *
 * Returns null if the player is not found for this team and year combination.
 */
export async function buildPlayerPageData(
  athleteId: string,
  teamSlug: string,
  year2: number,
): Promise<PlayerPageData | null> {
  const year1 = year2 - 1

  // Fetch team division + all relevant player seasons in one parallel round-trip.
  // year2+1 is used for departedAfterYear2; missing data returns [] safely.
  const [team, dbPlayers] = await Promise.all([
    prisma.team.findUnique({ where: { id: teamSlug }, select: { division: true } }),
    prisma.playerSeason.findMany({
      where: { teamId: teamSlug, year: { in: [year1, year2, year2 + 1] } },
    }),
  ])

  if (!team) return null

  const isD2 = team.division === 'D2'

  // Normalize athleteId to the stored playerId form
  const playerId = isD2
    ? (athleteId.startsWith('sidearm-') ? athleteId : `sidearm-${athleteId}`)
    : (athleteId.startsWith('cbbd-')    ? athleteId : `cbbd-${athleteId}`)

  // Convert and partition by year
  const y1Players   = dbPlayers.filter(p => p.year === year1).map(dbPlayerToApp)
  const y2Players   = dbPlayers.filter(p => p.year === year2).map(dbPlayerToApp)
  const nextPlayers = dbPlayers.filter(p => p.year === year2 + 1).map(dbPlayerToApp)

  // Locate the specific player
  const foundY2 = y2Players.find(p => p.playerId === playerId) ?? null

  // D2 safety net: name-based fallback for cross-year ID format mismatch.
  // D1 never needs this because CBBD IDs are stable across seasons.
  let foundY1 = y1Players.find(p => p.playerId === playerId) ?? null
  if (foundY1 === null && isD2 && foundY2 !== null) {
    const normY2Name = foundY2.playerName.toLowerCase().trim()
    foundY1 = y1Players.find(p => p.playerName.toLowerCase().trim() === normY2Name) ?? null
  }

  if (!foundY2 && !foundY1) return null

  // ── Determine status ──────────────────────────────────────────────────────
  let status: PlayerStatus
  let currentStats: PlayerSeason
  let priorStats: PlayerSeason | null = null

  if (foundY2 && foundY1) {
    status       = 'returner'
    currentStats = foundY2
    priorStats   = foundY1
  } else if (foundY2) {
    status       = 'newcomer'
    currentStats = foundY2
  } else {
    status       = 'departure'
    currentStats = foundY1!
  }

  // ── Compute shares ────────────────────────────────────────────────────────
  const activeForShare = status === 'departure' ? y1Players : y2Players
  const { min: minShare, pts: ptsShare } = computeShares(currentStats, activeForShare)

  let priorMinShare: number | null = null
  let priorPtsShare: number | null = null
  if (priorStats && y1Players.length > 0) {
    const prior = computeShares(priorStats, y1Players)
    priorMinShare = prior.min
    priorPtsShare = prior.pts
  }

  const minShareDelta = priorMinShare !== null
    ? Math.round((minShare - priorMinShare) * 100) / 100
    : null
  const ptsShareDelta = priorPtsShare !== null
    ? Math.round((ptsShare - priorPtsShare) * 100) / 100
    : null

  // ── Departed after year2? ─────────────────────────────────────────────────
  // nextPlayers is empty when year2+1 data is not yet imported — treated as departed.
  const foundNext        = nextPlayers.some(p => p.playerId === playerId)
  const departedAfterYear2 = !foundNext && status !== 'departure'

  // ── Team context (retention, ratings, identity) ───────────────────────────
  const teamData = await buildTeamPageData(teamSlug, year2)

  let matchConfidence: MatchConfidence | null = null
  let isQualified = true
  let belowThresholdInfo: BelowThresholdPlayer | null = null

  if (teamData?.retention) {
    const rp = teamData.retention.returningPlayers.find(
      r => r.year2Stats.playerId === playerId || r.year1Stats.playerId === playerId
    )
    if (rp) matchConfidence = rp.matchConfidence

    const btMatch = teamData.retention.belowThresholdPlayers.find(
      b => b.player.playerId === playerId ||
           (priorStats && b.player.playerId === priorStats.playerId)
    )
    if (btMatch) {
      isQualified      = false
      belowThresholdInfo = btMatch
    }
  }

  const y1WinPct    = teamData?.teamSeason1 ? wPct(teamData.teamSeason1.wins, teamData.teamSeason1.losses) : 0
  const y2WinPct    = teamData?.teamSeason2 ? wPct(teamData.teamSeason2.wins, teamData.teamSeason2.losses) : 0
  const winPctDelta = Math.round((y2WinPct - y1WinPct) * 100) / 100

  return {
    athleteId,
    playerName:  currentStats.playerName,
    position:    currentStats.position ?? null,
    teamSlug,
    year1,
    year2,
    status,
    matchConfidence,
    isQualified,
    belowThresholdInfo,
    departedAfterYear2,
    currentStats,
    priorStats,
    minShare,
    ptsShare,
    priorMinShare,
    priorPtsShare,
    minShareDelta,
    ptsShareDelta,
    roleTag:            computeRoleTag(minShare, ptsShare, currentStats.gamesStarted ?? null, currentStats.games),
    teamActivePlayers:  activeForShare,
    teamIdentity:       teamData?.identity        ?? null,
    coachYear2:         teamData?.coachYear2       ?? null,
    teamSeason1:        teamData?.teamSeason1      ?? null,
    teamSeason2:        teamData?.teamSeason2      ?? null,
    retention:          teamData?.retention        ?? null,
    outlierFlag:        teamData?.outlierFlag      ?? null,
    ratings1:           teamData?.ratings1         ?? null,
    ratings2:           teamData?.ratings2         ?? null,
    massey1:            teamData?.massey1           ?? null,
    massey2:            teamData?.massey2           ?? null,
    y1WinPct,
    y2WinPct,
    winPctDelta,
  }
}
