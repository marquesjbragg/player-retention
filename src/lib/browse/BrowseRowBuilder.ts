/**
 * Assembles BrowseRow objects from cached provider data.
 *
 * For each team in the registry:
 *   1. Read player cache for year1 and year2 (may be absent)
 *   2. Read team season cache for year1 and year2 (may be absent)
 *   3. Read ratings for year2
 *   4. Determine dataStatus
 *   5. Compute CI if both player seasons present
 *   6. Compute deltas if both team seasons present
 *   7. Assemble BrowseRow
 *
 * If player data is missing: continuityIndex = null, dataStatus = 'stats-only'
 *   or 'unavailable'. Never estimates CI from team stats.
 * If team stats are missing: deltas = 0, winPct fields = 0.
 */

import type {
  BrowseRow,
  Division,
  DataStatus,
  DataSource,
  OutlierFlag,
  RatingsBucket,
  PlayerSeason,
  TeamSeason,
  RatingsEntry,
  RatingsSeasonData,
} from '@/lib/types'
import * as fs   from 'fs'
import * as path from 'path'
import { TeamRegistry }                    from '@/lib/registry/TeamRegistry'
import { CacheManager, CachePaths, D2CachePaths } from '@/lib/cache/CacheManager'
import { computeRetention }               from '@/lib/engine/RetentionEngine'
import { calculateDeltas }                from '@/lib/engine/deltas'
import { getMasseyEntry }                 from '@/lib/providers/d1/D1MasseyProvider'

// ─── Logo maps ────────────────────────────────────────────────────────────────
const D1_LOGO_PATH = path.resolve(process.cwd(), 'data', 'registry', 'd1-logos.json')
const D2_LOGO_PATH = path.resolve(process.cwd(), 'data', 'registry', 'd2-logos.json')
let _d1LogoMap: Record<string, string> | null = null
let _d2LogoMap: Record<string, string> | null = null

function getLogoUrl(slug: string, division: 'D1' | 'D2'): string | undefined {
  if (division === 'D2') {
    if (!_d2LogoMap) {
      try { _d2LogoMap = JSON.parse(fs.readFileSync(D2_LOGO_PATH, 'utf-8')) }
      catch { _d2LogoMap = {} }
    }
    return _d2LogoMap![slug]
  }
  if (!_d1LogoMap) {
    try { _d1LogoMap = JSON.parse(fs.readFileSync(D1_LOGO_PATH, 'utf-8')) }
    catch { _d1LogoMap = {} }
  }
  return _d1LogoMap![slug]
}

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
  hasYear2TeamSeason: boolean
): DataStatus {
  const hasTeamStats = hasYear1TeamSeason && hasYear2TeamSeason
  const hasPlayers   = hasYear1Players && hasYear2Players

  if (hasPlayers && hasTeamStats)  return 'full'
  if (!hasPlayers && hasTeamStats) return 'stats-only'
  if (!hasPlayers && !hasTeamStats) return 'unavailable'
  return 'no-player-data'   // has at least one player season but not both, or team stats missing
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

// ─── Single-row builder ───────────────────────────────────────────────────────

export function buildBrowseRow(
  teamSlug: string,
  year1: number,
  year2: number,
  ratingsMap: Map<string, RatingsEntry>
): BrowseRow {
  const entry = TeamRegistry.getBySlug(teamSlug)
  if (!entry) throw new Error(`TeamRegistry: slug "${teamSlug}" not found`)

  // Use division-appropriate cache paths
  const paths = entry.division === 'D2' ? D2CachePaths : CachePaths

  // Load from cache — never fetch live in the row builder
  const p1Entry  = CacheManager.read<PlayerSeason[]>(paths.players(year1, teamSlug))
  const p2Entry  = CacheManager.read<PlayerSeason[]>(paths.players(year2, teamSlug))
  const ts1Entry = CacheManager.read<TeamSeason>(paths.teamSeason(year1, teamSlug))
  const ts2Entry = CacheManager.read<TeamSeason>(paths.teamSeason(year2, teamSlug))

  const year1Players   = p1Entry?.data  ?? null
  const year2Players   = p2Entry?.data  ?? null
  const year1TeamSzn   = ts1Entry?.data ?? null
  const year2TeamSzn   = ts2Entry?.data ?? null

  const hasY1P  = year1Players !== null && year1Players.length > 0
  const hasY2P  = year2Players !== null && year2Players.length > 0
  const hasY1TS = year1TeamSzn !== null
  const hasY2TS = year2TeamSzn !== null

  const dataStatus = resolveDataStatus(hasY1P, hasY2P, hasY1TS, hasY2TS)

  // Determine primary data source (used for source badge in UI)
  const dataSource: DataSource = hasY1P || hasY2P
    ? (p1Entry?.data?.[0]?.source ?? p2Entry?.data?.[0]?.source ?? 'cbbd')
    : hasY1TS || hasY2TS
      ? (ts1Entry?.data?.source ?? ts2Entry?.data?.source ?? 'stats-only')
      : 'stats-only'

  // Ratings (CBBD)
  const rating = ratingsMap.get(teamSlug) ?? null

  // Massey (D1 only; null when no file exists for this season)
  const massey = entry.division === 'D1' ? getMasseyEntry(teamSlug, year2) : null

  // Win pct from team season
  const y1WinPct = year1TeamSzn ? winPct(year1TeamSzn.wins, year1TeamSzn.losses) : 0
  const y2WinPct = year2TeamSzn ? winPct(year2TeamSzn.wins, year2TeamSzn.losses) : 0
  const winPctDelta = Math.round((y2WinPct - y1WinPct) * 100) / 100

  // Deltas (require both team seasons)
  const deltas = hasY1TS && hasY2TS && year1TeamSzn && year2TeamSzn
    ? calculateDeltas(year1TeamSzn, year2TeamSzn)
    : []
  const ppgDelta    = deltas.find(d => d.key === 'ppg')?.delta    ?? 0
  const oppPpgDelta = deltas.find(d => d.key === 'oppPpg')?.delta ?? 0

  // Retention (require both player seasons + year1 game count)
  let continuityIndex: number | null = null
  let returningMinutesPct = 0
  let returningStartsPct: number | null = null
  let returningPointsPct = 0
  let deptMinutesPct = 0
  let deptPointsPct = 0
  let newcomerMinutesPct = 0
  let newcomerPointsPct = 0
  let returningPlayersCount = 0
  let returningStartersCount = 0
  let newPlayersCount = 0
  let dataQuality: 'complete' | 'partial' = 'complete'

  if (hasY1P && hasY2P && year1Players && year2Players) {
    const teamGames = year1TeamSzn
      ? year1TeamSzn.wins + year1TeamSzn.losses
      : year1Players.reduce((max, p) => Math.max(max, p.games), 0)

    const result = computeRetention(year1Players, year2Players, teamGames, year1, year2, teamSlug)

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

  // Outlier flag: full-data teams always get a 9-variant CI flag; stats-only teams
  // get the 'stats-only' signal value; unavailable/partial teams get null.
  const outlierFlag: OutlierFlag = continuityIndex !== null
    ? computeOutlierFlag(continuityIndex, winPctDelta)
    : dataStatus === 'stats-only' ? 'stats-only' : null

  return {
    teamSlug,
    teamName:   entry.displayName,
    shortName:  entry.shortName,
    division:   entry.division as Division,
    conference: entry.conference,
    logoUrl:    getLogoUrl(teamSlug, entry.division as 'D1' | 'D2') ?? entry.logoUrl ?? undefined,
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
    ratingsSource: rating?.source ?? null,
    masseyRank:    massey?.rank   ?? null,
    masseyRating:  massey?.rating ?? null,
    outlierFlag,
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

  // Load ratings map for O(1) lookup — D1 only (D2 has no CBBD adjusted ratings)
  const ratingsMap = new Map<string, RatingsEntry>()
  if (division === 'D1') {
    const ratingsEntry = CacheManager.read<RatingsSeasonData>(CachePaths.ratings(year2))
    if (ratingsEntry?.data?.entries) {
      ratingsEntry.data.entries.forEach(e => ratingsMap.set(e.teamSlug, e))
    }
  }

  // Get teams from registry
  let teams = TeamRegistry.getAll().filter(t => t.division === division)
  if (conference) {
    teams = teams.filter(t => t.conference === conference)
  }

  const rows: BrowseRow[] = []
  for (const team of teams) {
    try {
      rows.push(buildBrowseRow(team.slug, year1, year2, ratingsMap))
    } catch (err) {
      console.error(`[BrowseRowBuilder] error building row for ${team.slug}:`, err)
    }
  }

  // Sort: full data first, then stats-only, then unavailable; within each group by slug
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
