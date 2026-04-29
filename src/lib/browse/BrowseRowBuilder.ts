import type {
  BrowseRow,
  Division,
  DataStatus,
  DataSource,
  OutlierFlag,
  RatingsBucket,
  TeamSeason as AppTeamSeason,
} from '@/lib/types'
import { prisma } from '@/lib/db'
import { computeRetention } from '@/lib/engine/RetentionEngine'
import { calculateDeltas } from '@/lib/engine/deltas'
import { dbPlayerToApp } from '@/lib/team/teamPageData'
import type {
  TeamSeason as DbTeamSeason,
} from '@prisma/client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function winPct(wins: number, losses: number): number {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 10000) / 100
}

function resolveDataStatus(
  hasYear1Players: boolean,
  hasYear2Players: boolean,
  hasYear1TeamSeason: boolean,
  hasYear2TeamSeason: boolean,
): DataStatus {
  const hasTeamStats = hasYear1TeamSeason && hasYear2TeamSeason
  const hasPlayers   = hasYear1Players && hasYear2Players
  if (hasPlayers && hasTeamStats)   return 'full'
  if (!hasPlayers && hasTeamStats)  return 'stats-only'
  if (!hasPlayers && !hasTeamStats) return 'unavailable'
  return 'no-player-data'
}

function computeOutlierFlag(ci: number, winPctDelta: number): OutlierFlag {
  if (ci >= 70) {
    if (winPctDelta > 5)  return 'high-ci-improve'
    if (winPctDelta < -5) return 'high-ci-decline'
    return 'high-ci-stable'
  } else if (ci >= 40) {
    if (winPctDelta > 5)  return 'mid-ci-improve'
    if (winPctDelta < -5) return 'mid-ci-decline'
    return 'mid-ci-stable'
  } else {
    if (winPctDelta > 5)  return 'low-ci-improve'
    if (winPctDelta < -5) return 'low-ci-decline'
    return 'low-ci-stable'
  }
}

function ratingsBucket(rank: number | null): RatingsBucket {
  if (rank === null) return null
  if (rank <= 50)   return 'high'
  if (rank <= 175)  return 'mid'
  return 'low'
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

// ─── Batch builder ────────────────────────────────────────────────────────────

export interface BrowseBuildOptions {
  division?: Division
  conference?: string
  year1: number
  year2: number
}

export async function buildBrowseRows(options: BrowseBuildOptions): Promise<BrowseRow[]> {
  const { division = 'D1', conference, year1, year2 } = options

  // D2 data has not been imported into the database yet.
  if (division === 'D2') return []

  // Five parallel bulk queries — no N+1.
  const [dbTeams, dbPlayerSeasons, dbTeamSeasons, dbRatings, dbMassey] = await Promise.all([
    prisma.team.findMany({ where: { division } }),
    prisma.playerSeason.findMany({ where: { year: { in: [year1, year2] }, division } }),
    prisma.teamSeason.findMany({ where: { year: { in: [year1, year2] }, division } }),
    prisma.ratingsEntry.findMany({ where: { year: year2 } }),
    prisma.masseyEntry.findMany({ where: { year: year2, teamId: { not: null } } }),
  ])

  // Optional conference filter applied in memory (avoids a separate query per conference).
  const teams = conference
    ? dbTeams.filter(t => t.conference === conference)
    : dbTeams

  // Group player seasons by teamId and year.
  const playersByTeam = new Map<string, { y1: typeof dbPlayerSeasons; y2: typeof dbPlayerSeasons }>()
  for (const ps of dbPlayerSeasons) {
    if (!playersByTeam.has(ps.teamId)) playersByTeam.set(ps.teamId, { y1: [], y2: [] })
    const bucket = playersByTeam.get(ps.teamId)!
    if (ps.year === year1) bucket.y1.push(ps)
    else bucket.y2.push(ps)
  }

  // Group team seasons by teamId and year.
  const seasonsByTeam = new Map<string, { y1: DbTeamSeason | null; y2: DbTeamSeason | null }>()
  for (const ts of dbTeamSeasons) {
    if (!seasonsByTeam.has(ts.teamId)) seasonsByTeam.set(ts.teamId, { y1: null, y2: null })
    const bucket = seasonsByTeam.get(ts.teamId)!
    if (ts.year === year1) bucket.y1 = ts
    else bucket.y2 = ts
  }

  // O(1) lookup maps.
  const ratingsMap = new Map(dbRatings.map(r => [r.teamId, r]))
  const masseyMap  = new Map(dbMassey.map(m => [m.teamId!, m]))

  const rows: BrowseRow[] = []

  for (const team of teams) {
    const slug = team.id
    const { y1: y1DbPlayers, y2: y2DbPlayers } = playersByTeam.get(slug) ?? { y1: [], y2: [] }
    const { y1: ts1Db, y2: ts2Db }              = seasonsByTeam.get(slug) ?? { y1: null, y2: null }

    const hasY1P  = y1DbPlayers.length > 0
    const hasY2P  = y2DbPlayers.length > 0
    const hasY1TS = ts1Db !== null
    const hasY2TS = ts2Db !== null

    const dataStatus = resolveDataStatus(hasY1P, hasY2P, hasY1TS, hasY2TS)

    const dataSource: DataSource = hasY1P || hasY2P
      ? ((y1DbPlayers[0]?.source ?? y2DbPlayers[0]?.source ?? 'cbbd') as DataSource)
      : hasY1TS || hasY2TS
        ? ((ts1Db?.source ?? ts2Db?.source ?? 'cbbd') as DataSource)
        : 'stats-only'

    const rating = ratingsMap.get(slug) ?? null
    const massey = masseyMap.get(slug)  ?? null

    const ts1 = ts1Db ? dbTeamSeasonToApp(ts1Db) : null
    const ts2 = ts2Db ? dbTeamSeasonToApp(ts2Db) : null

    const y1WinPct    = ts1 ? winPct(ts1.wins, ts1.losses) : 0
    const y2WinPct    = ts2 ? winPct(ts2.wins, ts2.losses) : 0
    const winPctDelta = Math.round((y2WinPct - y1WinPct) * 100) / 100

    const deltas      = hasY1TS && hasY2TS && ts1 && ts2 ? calculateDeltas(ts1, ts2) : []
    const ppgDelta    = deltas.find(d => d.key === 'ppg')?.delta    ?? 0
    const oppPpgDelta = deltas.find(d => d.key === 'oppPpg')?.delta ?? 0

    let continuityIndex:        number | null = null
    let returningMinutesPct     = 0
    let returningStartsPct:     number | null = null
    let returningPointsPct      = 0
    let deptMinutesPct          = 0
    let deptPointsPct           = 0
    let newcomerMinutesPct      = 0
    let newcomerPointsPct       = 0
    let returningPlayersCount   = 0
    let returningStartersCount  = 0
    let newPlayersCount         = 0
    let dataQuality: 'complete' | 'partial' = 'complete'

    if (hasY1P && hasY2P) {
      const y1Players = y1DbPlayers.map(dbPlayerToApp)
      const y2Players = y2DbPlayers.map(dbPlayerToApp)

      const teamGames = ts1
        ? ts1.wins + ts1.losses
        : y1Players.reduce((max, p) => Math.max(max, p.games), 0)

      const result = computeRetention(y1Players, y2Players, teamGames, year1, year2, slug)

      continuityIndex       = result.continuityIndex
      returningMinutesPct   = result.returningMinutesPct
      returningStartsPct    = result.returningStartsPct
      returningPointsPct    = result.returningPointsPct
      deptMinutesPct        = result.deptMinutesPct
      deptPointsPct         = result.deptPointsPct
      newcomerMinutesPct    = result.newcomerMinutesPct
      newcomerPointsPct     = result.newcomerPointsPct
      returningPlayersCount = result.returningPlayersCount
      returningStartersCount = result.returningStartersCount
      newPlayersCount       = result.newPlayersCount
      dataQuality           = result.dataQuality
    }

    const outlierFlag: OutlierFlag = continuityIndex !== null
      ? computeOutlierFlag(continuityIndex, winPctDelta)
      : dataStatus === 'stats-only' ? 'stats-only' : null

    rows.push({
      teamSlug:              slug,
      teamName:              team.displayName,
      shortName:             team.shortName,
      division:              team.division as Division,
      conference:            team.conference,
      logoUrl:               team.logoUrl ?? undefined,
      year1,
      year2,
      dataStatus,
      dataSource,
      dataQuality,
      continuityIndex,
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
      year1WinPct:   y1WinPct,
      year2WinPct:   y2WinPct,
      winPctDelta,
      ppgDelta,
      oppPpgDelta,
      ratingsRank:   rating?.rank   ?? null,
      ratingsRating: rating?.rating ?? null,
      ratingsBucket: ratingsBucket(rating?.rank ?? null),
      ratingsSource: rating ? 'cbbd' : null,
      masseyRank:    massey?.rank   ?? null,
      masseyRating:  massey?.rating ?? null,
      outlierFlag,
    })
  }

  // Sort: full data first, then stats-only, then no-player-data, then unavailable.
  const statusOrder: Record<DataStatus, number> = {
    full: 0, 'stats-only': 1, 'no-player-data': 2, unavailable: 3,
  }
  rows.sort((a, b) => {
    const sd = statusOrder[a.dataStatus] - statusOrder[b.dataStatus]
    if (sd !== 0) return sd
    return a.teamSlug.localeCompare(b.teamSlug)
  })

  return rows
}
