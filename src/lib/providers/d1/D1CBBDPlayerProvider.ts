/**
 * Fetches D1 player season stats from CBBD /stats/player/season.
 *
 * Raw cache:  data/cache/d1/cbbd/raw/players/{season}/{teamSlug}.json  (full API array, unwrapped)
 * Normalized: data/cache/d1/cbbd/players/{season}/{teamSlug}.json      (CacheEntry<PlayerSeason[]>)
 *
 * CBBD player field → PlayerSeason:
 *   athleteId (number)              → playerId ("cbbd-{athleteId}")
 *   name                            → playerName
 *   [registry lookup by cbbdTeamId] → teamId  (= teamSlug)
 *   season                          → seasonYear
 *   games                           → games
 *   starts                          → gamesStarted
 *   minutes                         → minutesPlayed
 *   points                          → points
 *   assists                         → assists
 *   steals                          → steals
 *   blocks                          → blocks
 *   turnovers                       → turnovers
 *   fieldGoals.made                 → fgMade
 *   fieldGoals.attempted            → fgAttempted
 *   threePointFieldGoals.made       → threeMade
 *   threePointFieldGoals.attempted  → threeAttempted
 *   freeThrows.made                 → ftMade
 *   freeThrows.attempted            → ftAttempted
 *   rebounds.offensive              → offRebounds
 *   rebounds.defensive              → defRebounds
 *   rebounds.total                  → totalRebounds
 */

import type { PlayerSeason } from '@/lib/types'
import { TeamRegistry } from '@/lib/registry/TeamRegistry'
import { CacheManager, CachePaths } from '@/lib/cache/CacheManager'

const BASE_URL = 'https://api.collegebasketballdata.com'

interface CbbdStatGroup { made: number; attempted: number; pct: number }
interface CbbdRebounds  { offensive: number; defensive: number; total: number }

interface CbbdPlayerRaw {
  season: number
  teamId: number
  team: string
  conference: string
  athleteId: number
  name: string
  position?: string
  games: number
  starts: number
  minutes: number
  points: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  fieldGoals: CbbdStatGroup
  threePointFieldGoals: CbbdStatGroup
  freeThrows: CbbdStatGroup
  rebounds: CbbdRebounds
}

function getKey(): string {
  const key = process.env.CBB_DATA_API_KEY
  if (!key) throw new Error('CBB_DATA_API_KEY not set')
  return key
}

function normalize(raw: CbbdPlayerRaw, teamSlug: string): PlayerSeason {
  return {
    playerId:       `cbbd-${raw.athleteId}`,
    playerName:     raw.name,
    teamId:         teamSlug,
    seasonYear:     raw.season,
    position:       raw.position ?? undefined,
    games:          raw.games ?? 0,
    gamesStarted:   raw.starts ?? null,
    minutesPlayed:  raw.minutes ?? 0,
    points:         raw.points ?? 0,
    assists:        raw.assists ?? 0,
    steals:         raw.steals ?? 0,
    blocks:         raw.blocks ?? 0,
    turnovers:      raw.turnovers ?? 0,
    totalRebounds:  raw.rebounds?.total ?? 0,
    offRebounds:    raw.rebounds?.offensive ?? 0,
    defRebounds:    raw.rebounds?.defensive ?? 0,
    fgMade:         raw.fieldGoals?.made ?? 0,
    fgAttempted:    raw.fieldGoals?.attempted ?? 0,
    threeMade:      raw.threePointFieldGoals?.made ?? 0,
    threeAttempted: raw.threePointFieldGoals?.attempted ?? 0,
    ftMade:         raw.freeThrows?.made ?? 0,
    ftAttempted:    raw.freeThrows?.attempted ?? 0,
    source:         'cbbd',
  }
}

export const D1CBBDPlayerProvider = {
  async fetchAndCache(teamSlug: string, season: number): Promise<PlayerSeason[]> {
    const rawPath  = CachePaths.rawPlayers(season, teamSlug)
    const normPath = CachePaths.players(season, teamSlug)
    const frozen   = CacheManager.isFrozen(season)

    // Return normalized cache if fresh
    const cached = CacheManager.read<PlayerSeason[]>(normPath)
    if (cached && !CacheManager.isStale(cached)) {
      return cached.data
    }

    // Look up CBBD name from registry
    const entry = TeamRegistry.getBySlug(teamSlug)
    if (!entry) throw new Error(`TeamRegistry: slug "${teamSlug}" not found`)

    const cbbdName = entry.externalIds.cbbdName
    if (!cbbdName) throw new Error(`TeamRegistry: no cbbdName for slug "${teamSlug}"`)

    // Fetch from CBBD — use cbbdName for query, never the slug
    const url = `${BASE_URL}/stats/player/season?season=${season}&team=${encodeURIComponent(cbbdName)}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${getKey()}` },
    })
    if (!res.ok) throw new Error(`CBBD players ${teamSlug} ${season}: HTTP ${res.status}`)

    const rawArray = (await res.json()) as CbbdPlayerRaw[]

    // Write raw first (uses teamSlug as filename — never cbbdName)
    CacheManager.writeRaw(rawPath, rawArray)

    // Normalize
    const players = rawArray.map(p => normalize(p, teamSlug))
    CacheManager.write(normPath, players, frozen)

    return players
  },

  async getPlayerSeasons(teamSlug: string, season: number): Promise<PlayerSeason[]> {
    return this.fetchAndCache(teamSlug, season)
  },
}
