import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { computeRoleTag, usageModifier } from '@/lib/team/roleUtils'
import type { PlayerSeason as DbPlayerSeason, Team as DbTeam } from '@prisma/client'

export type PlayerStatus = 'returner' | 'newcomer' | 'departure'
export type RoleTier     = 'lead' | 'core' | 'rotation' | 'bench' | 'fringe'

export interface PlayerBrowseRow {
  athleteId: string
  playerName: string
  teamSlug: string
  teamName: string
  teamShortName: string
  logoUrl: string | null
  conference: string
  year: number

  // Continuity
  status: PlayerStatus
  minShare: number
  ptsShare: number
  minShareDelta: number | null
  ptsShareDelta: number | null

  // Role
  roleTier: RoleTier

  // Core per-game stats
  games: number
  mpg: number
  ppg: number

  // T-Rank enrichment
  positionRole: string | null
  yr: string | null
  ht: string | null
  usg: number | null
  ortg: number | null
  drtg: number | null
  bpm: number | null
  obpm: number | null
  dbpm: number | null
  tsPct: number | null

  // Team context
  teamCi: number | null
  teamFlag: string | null
  teamRatingsRank: number | null
  teamMasseyRank: number | null
}

// ─── Prisma row type ──────────────────────────────────────────────────────────
// PlayerSeason with team included — inferred from the DB query shape.

type PsRow = DbPlayerSeason & { team: DbTeam }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function share(player: PsRow, all: PsRow[], field: 'minutesPlayed' | 'points'): number {
  const total = all.reduce((s, p) => s + p[field], 0)
  return total > 0 ? Math.round((player[field] / total) * 10000) / 100 : 0
}

function tsPct(p: PsRow): number | null {
  const d = 2 * (p.fgAttempted + 0.44 * p.ftAttempted)
  return d > 0 ? Math.round((p.points / d) * 10000) / 100 : null
}

// Simplified CI: (returningMinPct + returningPtsPct) / 2 via exact playerId match.
function simpleCI(y1Players: PsRow[], y2Players: PsRow[]): number | null {
  if (y1Players.length === 0 || y2Players.length === 0) return null
  const y2Ids   = new Set(y2Players.map(p => p.playerId))
  const totalMin = y1Players.reduce((s, p) => s + p.minutesPlayed, 0)
  const totalPts = y1Players.reduce((s, p) => s + p.points, 0)
  if (totalMin === 0) return null
  const retMin = y1Players.filter(p => y2Ids.has(p.playerId)).reduce((s, p) => s + p.minutesPlayed, 0)
  const retPts = y1Players.filter(p => y2Ids.has(p.playerId)).reduce((s, p) => s + p.points, 0)
  const retMinPct = (retMin / totalMin) * 100
  const retPtsPct = totalPts > 0 ? (retPts / totalPts) * 100 : retMinPct
  return Math.round(((retMinPct + retPtsPct) / 2) * 10) / 10
}

function ciFlag(ci: number | null): string | null {
  if (ci === null) return null
  if (ci >= 70) return 'high-ci'
  if (ci >= 40) return 'mid-ci'
  return 'low-ci'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const yearParam     = searchParams.get('year') ?? '2026'
  const divisionParam = searchParams.get('division') ?? 'd1'
  const isD2          = divisionParam === 'd2'
  const year2         = parseInt(yearParam, 10)
  const year1         = year2 - 1

  if (isNaN(year2) || year2 < 2022 || year2 > 2030) {
    return Response.json({ success: false, error: { code: 'INVALID_YEAR' } }, { status: 400 })
  }

  // D2 data has not been imported into the database yet.
  if (isD2) {
    return Response.json({ success: true, data: [] })
  }

  try {
    // ── Single query: all D1 player seasons for year-1 and year ──────────────
    // Uses @@index([year, division]) for fast retrieval.
    const allSeasons = await prisma.playerSeason.findMany({
      where: {
        year:     { in: [year1, year2] },
        division: 'D1',
      },
      include: { team: true },
    })

    // ── Ratings: one query, O(1) lookup per team ──────────────────────────────
    const ratingsRows = await prisma.ratingsEntry.findMany({
      where:  { year: year2 },
      select: { teamId: true, rank: true },
    })
    const ratingsMap = new Map(ratingsRows.map(r => [r.teamId, r.rank]))

    // ── Group player seasons by teamId ────────────────────────────────────────
    const teamMap = new Map<string, { team: DbTeam; y1: PsRow[]; y2: PsRow[] }>()

    for (const ps of allSeasons) {
      if (!teamMap.has(ps.teamId)) {
        teamMap.set(ps.teamId, { team: ps.team, y1: [], y2: [] })
      }
      const bucket = teamMap.get(ps.teamId)!
      if (ps.year === year1) bucket.y1.push(ps)
      else                   bucket.y2.push(ps)
    }

    // ── Build rows ────────────────────────────────────────────────────────────
    const rows: PlayerBrowseRow[] = []

    for (const [slug, { team, y1: y1Players, y2: y2Players }] of Array.from(teamMap.entries())) {
      if (y2Players.length === 0 && y1Players.length === 0) continue

      const teamRatingsRank = ratingsMap.get(slug) ?? null
      const teamCi          = simpleCI(y1Players, y2Players)
      const teamFlag        = ciFlag(teamCi)

      const y2Ids = new Set(y2Players.map(p => p.playerId))
      const y1Ids = new Set(y1Players.map(p => p.playerId))

      // Year2 players (returners + newcomers)
      for (const p of y2Players) {
        const status: PlayerStatus = y1Ids.has(p.playerId) ? 'returner' : 'newcomer'
        const minSh = share(p, y2Players, 'minutesPlayed')
        const ptsSh = share(p, y2Players, 'points')

        let minShDelta: number | null = null
        let ptsShDelta: number | null = null

        if (status === 'returner') {
          const prior = y1Players.find(q => q.playerId === p.playerId)
          if (prior) {
            const priorMin = share(prior, y1Players, 'minutesPlayed')
            const priorPts = share(prior, y1Players, 'points')
            minShDelta = Math.round((minSh - priorMin) * 100) / 100
            ptsShDelta = Math.round((ptsSh - priorPts) * 100) / 100
          }
        }

        const usgMod = usageModifier(p.tRankUsg)
        void usgMod  // available for future use; currently displayed on Player Page

        const athleteId = p.playerId.replace('cbbd-', '')

        rows.push({
          athleteId,
          playerName:    p.playerName,
          teamSlug:      slug,
          teamName:      team.displayName,
          teamShortName: team.shortName,
          logoUrl:       team.logoUrl,
          conference:    team.conference,
          year:          year2,
          status,
          minShare:      minSh,
          ptsShare:      ptsSh,
          minShareDelta: minShDelta,
          ptsShareDelta: ptsShDelta,
          roleTier:      computeRoleTag(minSh, ptsSh, p.gamesStarted, p.games),
          games:         p.games,
          mpg:           p.games > 0 ? Math.round((p.minutesPlayed / p.games) * 10) / 10 : 0,
          ppg:           p.games > 0 ? Math.round((p.points / p.games) * 10) / 10 : 0,
          positionRole:  p.tRankPositionRole,
          yr:            p.tRankYr,
          ht:            p.tRankHt,
          usg:           p.tRankUsg,
          ortg:          p.tRankOrtg,
          drtg:          p.tRankDrtg,
          bpm:           p.tRankBpm,
          obpm:          p.tRankObpm,
          dbpm:          p.tRankDbpm,
          tsPct:         tsPct(p),
          teamCi,
          teamFlag,
          teamRatingsRank,
          teamMasseyRank: null,  // not loaded here for perf — consistent with prior behavior
        })
      }

      // Departures: in year1 but not year2
      for (const p of y1Players) {
        if (y2Ids.has(p.playerId)) continue

        const minSh     = share(p, y1Players, 'minutesPlayed')
        const ptsSh     = share(p, y1Players, 'points')
        const athleteId = p.playerId.replace('cbbd-', '')

        rows.push({
          athleteId,
          playerName:    p.playerName,
          teamSlug:      slug,
          teamName:      team.displayName,
          teamShortName: team.shortName,
          logoUrl:       team.logoUrl,
          conference:    team.conference,
          year:          year2,
          status:        'departure',
          minShare:      minSh,
          ptsShare:      ptsSh,
          minShareDelta: null,
          ptsShareDelta: null,
          roleTier:      computeRoleTag(minSh, ptsSh, p.gamesStarted, p.games),
          games:         p.games,
          mpg:           p.games > 0 ? Math.round((p.minutesPlayed / p.games) * 10) / 10 : 0,
          ppg:           p.games > 0 ? Math.round((p.points / p.games) * 10) / 10 : 0,
          positionRole:  p.tRankPositionRole,
          yr:            p.tRankYr,
          ht:            p.tRankHt,
          usg:           p.tRankUsg,
          ortg:          p.tRankOrtg,
          drtg:          p.tRankDrtg,
          bpm:           p.tRankBpm,
          obpm:          p.tRankObpm,
          dbpm:          p.tRankDbpm,
          tsPct:         tsPct(p),
          teamCi,
          teamFlag,
          teamRatingsRank,
          teamMasseyRank: null,
        })
      }
    }

    return Response.json({ success: true, data: rows })
  } catch (err) {
    console.error('[/api/browse/player-table] error:', err)
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 }
    )
  }
}
