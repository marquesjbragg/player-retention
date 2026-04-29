import { prisma } from '@/lib/db'
import { computeRetention } from '@/lib/engine/RetentionEngine'
import { calculateDeltas } from '@/lib/engine/deltas'
import type {
  TeamIdentity,
  TeamSeason as AppTeamSeason,
  PlayerSeason as AppPlayerSeason,
  RetentionResult,
  StatDelta,
  RatingsEntry,
  DataStatus,
  DataQuality,
  OutlierFlag,
  Division,
  DataSource,
} from '@/lib/types'
import type { MasseyResult } from '@/lib/providers/d1/D1MasseyProvider'
import type {
  PlayerSeason as DbPlayerSeason,
  TeamSeason as DbTeamSeason,
  RatingsEntry as DbRatingsEntry,
  Team as DbTeam,
} from '@prisma/client'

// ─── TeamPageData ─────────────────────────────────────────────────────────────

export interface TeamPageData {
  identity: TeamIdentity
  yearPair: { year1: number; year2: number }
  availableYears: number[]        // year2 values with usable data, newest first
  teamSeason1: AppTeamSeason | null
  teamSeason2: AppTeamSeason | null
  retention: RetentionResult | null
  deltas: StatDelta[]
  ratings1: RatingsEntry | null
  ratings2: RatingsEntry | null
  massey1: MasseyResult | null
  massey2: MasseyResult | null
  outlierFlag: OutlierFlag
  dataStatus: DataStatus
  dataQuality: DataQuality
  coachYear1: string | null
  coachYear2: string | null
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function winPct(wins: number, losses: number): number {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 10000) / 100
}

function computeOutlierFlag(ci: number, winPctDelta: number): OutlierFlag {
  const tier = ci >= 70 ? 'high' : ci >= 40 ? 'mid' : 'low'
  const dir  = winPctDelta > 5 ? 'improve' : winPctDelta < -5 ? 'decline' : 'stable'
  return `${tier}-ci-${dir}` as OutlierFlag
}

function resolveDataStatus(
  hasY1Players: boolean,
  hasY2Players: boolean,
  hasY1TS: boolean,
  hasY2TS: boolean,
): DataStatus {
  const hasTeamStats = hasY1TS && hasY2TS
  const hasPlayers   = hasY1Players && hasY2Players
  if (hasPlayers && hasTeamStats)   return 'full'
  if (!hasPlayers && hasTeamStats)  return 'stats-only'
  if (!hasPlayers && !hasTeamStats) return 'unavailable'
  return 'no-player-data'
}

// ─── DB → App type converters ─────────────────────────────────────────────────

function dbTeamToIdentity(team: DbTeam): TeamIdentity {
  return {
    slug:       team.id,
    name:       team.displayName,
    shortName:  team.shortName,
    division:   team.division as Division,
    conference: team.conference,
    externalIds: {
      cbbdTeamId: team.cbbdTeamId ?? undefined,
      cbbdName:   team.cbbdName   ?? undefined,
      sidearmId:  team.sidearmId  ?? undefined,
      masseyName: team.masseyName ?? undefined,
    },
    logoUrl: team.logoUrl ?? undefined,
  }
}

export function dbPlayerToApp(p: DbPlayerSeason): AppPlayerSeason {
  return {
    playerId:       p.playerId,
    playerName:     p.playerName,
    teamId:         p.teamId,
    seasonYear:     p.year,
    position:       p.position       ?? undefined,
    games:          p.games,
    gamesStarted:   p.gamesStarted,
    minutesPlayed:  p.minutesPlayed,
    points:         p.points,
    assists:        p.assists,
    totalRebounds:  p.totalRebounds,
    offRebounds:    p.offRebounds,
    defRebounds:    p.defRebounds,
    steals:         p.steals,
    blocks:         p.blocks,
    turnovers:      p.turnovers,
    fgMade:         p.fgMade,
    fgAttempted:    p.fgAttempted,
    threeMade:      p.threeMade,
    threeAttempted: p.threeAttempted,
    ftMade:         p.ftMade,
    ftAttempted:    p.ftAttempted,
    source:         p.source         as DataSource,
    tRankPid:          p.tRankPid          ?? undefined,
    tRankPositionRole: p.tRankPositionRole ?? undefined,
    tRankYr:           p.tRankYr           ?? undefined,
    tRankHt:           p.tRankHt           ?? undefined,
    tRankUsg:          p.tRankUsg          ?? undefined,
    tRankOrtg:         p.tRankOrtg         ?? undefined,
    tRankDrtg:         p.tRankDrtg         ?? undefined,
    tRankBpm:          p.tRankBpm          ?? undefined,
    tRankObpm:         p.tRankObpm         ?? undefined,
    tRankDbpm:         p.tRankDbpm         ?? undefined,
  }
}

function dbTeamSeasonToApp(ts: DbTeamSeason): AppTeamSeason {
  return {
    teamId:      ts.teamId,
    seasonYear:  ts.year,
    division:    ts.division    as Division,
    conference:  ts.conference,
    wins:        ts.wins,
    losses:      ts.losses,
    ppg:         ts.ppg         ?? 0,
    oppPpg:      ts.oppPpg      ?? 0,
    fgPct:       ts.fgPct       ?? 0,
    threePct:    ts.threePct    ?? 0,
    ftPct:       ts.ftPct       ?? 0,
    oppFgPct:    ts.oppFgPct    ?? 0,
    oppThreePct: ts.oppThreePct ?? 0,
    apg:         ts.apg         ?? 0,
    topg:        ts.topg        ?? 0,
    spg:         ts.spg         ?? 0,
    bpg:         ts.bpg         ?? 0,
    orbpg:       ts.orbpg       ?? 0,
    drbpg:       ts.drbpg       ?? 0,
    oppTopg:     ts.oppTopg     ?? 0,
    source:      ts.source      as DataSource,
  }
}

function dbRatingsToApp(r: DbRatingsEntry): RatingsEntry {
  return {
    teamSlug:   r.teamId,
    season:     r.year,
    rank:       r.rank      ?? null,
    rating:     r.rating    ?? null,
    offRating:  r.offRating ?? null,
    defRating:  r.defRating ?? null,
    conference: r.conference,
    source:     r.source    as 'cbbd' | 'massey',
  }
}

// ─── Available years ──────────────────────────────────────────────────────────

/** Returns year2 values (newest first) where team-season data exists for both year1 and year2. */
export async function getAvailableYears(teamSlug: string): Promise<number[]> {
  const rows = await prisma.teamSeason.findMany({
    where:   { teamId: teamSlug },
    select:  { year: true },
    orderBy: { year: 'desc' },
  })
  const yearSet = new Set(rows.map(r => r.year))
  return rows.map(r => r.year).filter(y => yearSet.has(y - 1))
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export async function buildTeamPageData(teamSlug: string, year2: number): Promise<TeamPageData | null> {
  const team = await prisma.team.findUnique({ where: { id: teamSlug } })
  if (!team) return null

  const year1 = year2 - 1
  const isD2  = team.division === 'D2'

  const identity       = dbTeamToIdentity(team)
  const availableYears = await getAvailableYears(teamSlug)

  // Core data — always needed
  const [dbTs1, dbTs2, dbPlayers, dbCoach1, dbCoach2] = await Promise.all([
    prisma.teamSeason.findFirst({ where: { teamId: teamSlug, year: year1 } }),
    prisma.teamSeason.findFirst({ where: { teamId: teamSlug, year: year2 } }),
    prisma.playerSeason.findMany({ where: { teamId: teamSlug, year: { in: [year1, year2] } } }),
    prisma.coach.findFirst({ where: { teamId: teamSlug, year: year1 } }),
    prisma.coach.findFirst({ where: { teamId: teamSlug, year: year2 } }),
  ])

  // D1-only enrichment
  const [dbRatings1, dbRatings2, dbMassey1, dbMassey2] = isD2
    ? [null, null, null, null]
    : await Promise.all([
        prisma.ratingsEntry.findFirst({ where: { teamId: teamSlug, year: year1 } }),
        prisma.ratingsEntry.findFirst({ where: { teamId: teamSlug, year: year2 } }),
        prisma.masseyEntry.findFirst({ where: { teamId: teamSlug, year: year1 } }),
        prisma.masseyEntry.findFirst({ where: { teamId: teamSlug, year: year2 } }),
      ])

  const teamSeason1  = dbTs1 ? dbTeamSeasonToApp(dbTs1) : null
  const teamSeason2  = dbTs2 ? dbTeamSeasonToApp(dbTs2) : null
  const year1Players = dbPlayers.filter(p => p.year === year1).map(dbPlayerToApp)
  const year2Players = dbPlayers.filter(p => p.year === year2).map(dbPlayerToApp)

  const hasY1P  = year1Players.length > 0
  const hasY2P  = year2Players.length > 0
  const hasY1TS = teamSeason1 !== null
  const hasY2TS = teamSeason2 !== null

  const dataStatus = resolveDataStatus(hasY1P, hasY2P, hasY1TS, hasY2TS)

  const deltas: StatDelta[] = hasY1TS && hasY2TS && teamSeason1 && teamSeason2
    ? calculateDeltas(teamSeason1, teamSeason2)
    : []

  const ratings1: RatingsEntry | null = dbRatings1 ? dbRatingsToApp(dbRatings1) : null
  const ratings2: RatingsEntry | null = dbRatings2 ? dbRatingsToApp(dbRatings2) : null

  const massey1: MasseyResult | null = dbMassey1 ? { rank: dbMassey1.rank, rating: dbMassey1.rating } : null
  const massey2: MasseyResult | null = dbMassey2 ? { rank: dbMassey2.rank, rating: dbMassey2.rating } : null

  let retention: RetentionResult | null = null
  let dataQuality: DataQuality = 'complete'

  if (hasY1P && hasY2P) {
    const teamGames = teamSeason1
      ? teamSeason1.wins + teamSeason1.losses
      : year1Players.reduce((max, p) => Math.max(max, p.games), 0)

    retention   = computeRetention(year1Players, year2Players, teamGames, year1, year2, teamSlug)
    dataQuality = retention.dataQuality
  }

  let outlierFlag: OutlierFlag = null
  if (retention !== null) {
    const y1WinPct    = teamSeason1 ? winPct(teamSeason1.wins, teamSeason1.losses) : 0
    const y2WinPct    = teamSeason2 ? winPct(teamSeason2.wins, teamSeason2.losses) : 0
    const winPctDelta = Math.round((y2WinPct - y1WinPct) * 100) / 100
    outlierFlag = computeOutlierFlag(retention.continuityIndex, winPctDelta)
  } else if (dataStatus === 'stats-only') {
    outlierFlag = 'stats-only'
  }

  return {
    identity,
    yearPair: { year1, year2 },
    availableYears,
    teamSeason1,
    teamSeason2,
    retention,
    deltas,
    ratings1,
    ratings2,
    massey1,
    massey2,
    outlierFlag,
    dataStatus,
    dataQuality,
    coachYear1: dbCoach1?.name ?? null,
    coachYear2: dbCoach2?.name ?? null,
  }
}
