/**
 * Fetches D1 team season stats from CBBD /stats/team/season.
 *
 * Normalized: data/cache/d1/cbbd/team-seasons/{season}/{teamSlug}.json (CacheEntry<TeamSeason>)
 * (No separate raw cache — team stats are fetched per-team and stored directly.)
 *
 * CBBD team field → TeamSeason:
 *   wins                                    → wins
 *   losses                                  → losses
 *   conference                              → conference
 *   games                                   → denominator for per-game stats
 *   teamStats.points.total / games          → ppg
 *   opponentStats.points.total / games      → oppPpg
 *   teamStats.fieldGoals.pct                → fgPct
 *   teamStats.threePointFieldGoals.pct      → threePct
 *   teamStats.freeThrows.pct                → ftPct
 *   opponentStats.fieldGoals.pct            → oppFgPct
 *   opponentStats.threePointFieldGoals.pct  → oppThreePct
 *   teamStats.assists / games               → apg
 *   teamStats.turnovers.total / games       → topg
 *   teamStats.steals / games                → spg
 *   teamStats.blocks / games                → bpg
 *   teamStats.rebounds.offensive / games    → orbpg
 *   teamStats.rebounds.defensive / games    → drbpg
 *   opponentStats.turnovers.total / games   → oppTopg
 */

import type { TeamSeason } from '@/lib/types'
import { TeamRegistry } from '@/lib/registry/TeamRegistry'
import { CacheManager, CachePaths } from '@/lib/cache/CacheManager'

const BASE_URL = 'https://api.collegebasketballdata.com'

interface CbbdStatGroup { made: number; attempted: number; pct: number }
interface CbbdRebounds  { offensive: number; defensive: number; total: number }
interface CbbdTurnovers { total: number; teamTotal: number }
interface CbbdPoints    { total: number; inPaint: number; offTurnovers: number; fastBreak: number }

interface CbbdTeamStats {
  assists: number
  blocks: number
  steals: number
  fieldGoals: CbbdStatGroup
  threePointFieldGoals: CbbdStatGroup
  freeThrows: CbbdStatGroup
  rebounds: CbbdRebounds
  turnovers: CbbdTurnovers
  points: CbbdPoints
}

interface CbbdTeamRaw {
  season: number
  teamId: number
  team: string
  conference: string
  games: number
  wins: number
  losses: number
  teamStats: CbbdTeamStats
  opponentStats: CbbdTeamStats
}

function getKey(): string {
  const key = process.env.CBB_DATA_API_KEY
  if (!key) throw new Error('CBB_DATA_API_KEY not set')
  return key
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function perGame(total: number, games: number): number {
  if (games === 0) return 0
  return round2(total / games)
}

function normalize(raw: CbbdTeamRaw, teamSlug: string): TeamSeason {
  const g = raw.games || 1
  const ts = raw.teamStats
  const os = raw.opponentStats

  return {
    teamId:      teamSlug,
    seasonYear:  raw.season,
    division:    'D1',
    conference:  raw.conference,
    wins:        raw.wins,
    losses:      raw.losses,
    ppg:         perGame(ts.points?.total ?? 0, g),
    oppPpg:      perGame(os.points?.total ?? 0, g),
    fgPct:       round2(ts.fieldGoals?.pct ?? 0),
    threePct:    round2(ts.threePointFieldGoals?.pct ?? 0),
    ftPct:       round2(ts.freeThrows?.pct ?? 0),
    oppFgPct:    round2(os.fieldGoals?.pct ?? 0),
    oppThreePct: round2(os.threePointFieldGoals?.pct ?? 0),
    apg:         perGame(ts.assists ?? 0, g),
    topg:        perGame(ts.turnovers?.total ?? 0, g),
    spg:         perGame(ts.steals ?? 0, g),
    bpg:         perGame(ts.blocks ?? 0, g),
    orbpg:       perGame(ts.rebounds?.offensive ?? 0, g),
    drbpg:       perGame(ts.rebounds?.defensive ?? 0, g),
    oppTopg:     perGame(os.turnovers?.total ?? 0, g),
    source:      'cbbd',
  }
}

export const D1CBBDTeamProvider = {
  async fetchAndCache(teamSlug: string, season: number): Promise<TeamSeason | null> {
    const normPath = CachePaths.teamSeason(season, teamSlug)
    const frozen   = CacheManager.isFrozen(season)

    // Return cached if fresh
    const cached = CacheManager.read<TeamSeason>(normPath)
    if (cached && !CacheManager.isStale(cached)) {
      return cached.data
    }

    // Look up CBBD name from registry
    const entry = TeamRegistry.getBySlug(teamSlug)
    if (!entry) throw new Error(`TeamRegistry: slug "${teamSlug}" not found`)

    const cbbdName = entry.externalIds.cbbdName
    if (!cbbdName) throw new Error(`TeamRegistry: no cbbdName for slug "${teamSlug}"`)

    // Fetch from CBBD
    const url = `${BASE_URL}/stats/team/season?season=${season}&team=${encodeURIComponent(cbbdName)}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${getKey()}` },
    })
    if (!res.ok) throw new Error(`CBBD team stats ${teamSlug} ${season}: HTTP ${res.status}`)

    const body = (await res.json()) as CbbdTeamRaw | CbbdTeamRaw[]
    const raw = Array.isArray(body) ? body[0] : body

    if (!raw) return null

    const teamSeason = normalize(raw, teamSlug)
    CacheManager.write(normPath, teamSeason, frozen)

    return teamSeason
  },

  async getTeamSeason(teamSlug: string, season: number): Promise<TeamSeason | null> {
    return this.fetchAndCache(teamSlug, season)
  },
}
