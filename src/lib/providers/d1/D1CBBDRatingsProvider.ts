/**
 * Fetches D1 adjusted efficiency ratings from CBBD /ratings/adjusted.
 *
 * Raw cache: data/cache/d1/cbbd/raw/ratings/{season}.json  (full API array, unwrapped)
 * Normalized: data/cache/d1/cbbd/ratings/{season}.json     (CacheEntry<RatingsEntry[]>)
 *
 * CBBD ratings field → RatingsEntry:
 *   teamId (number) → externalIds.cbbdTeamId (registry lookup → slug)
 *   team            → looked up in TeamRegistry to get slug
 *   conference      → conference
 *   netRating       → rating
 *   offensiveRating → offRating
 *   defensiveRating → defRating
 *   rankings.net    → rank
 */

import type { RatingsEntry, RatingsSeasonData } from '@/lib/types'
import { TeamRegistry } from '@/lib/registry/TeamRegistry'
import { CacheManager, CachePaths } from '@/lib/cache/CacheManager'

const BASE_URL = 'https://api.collegebasketballdata.com'

interface CbbdRatingsRaw {
  season: number
  teamId: number
  team: string
  conference: string
  offensiveRating: number
  defensiveRating: number
  netRating: number
  rankings: { offense: number; defense: number; net: number }
}

function getKey(): string {
  const key = process.env.CBB_DATA_API_KEY
  if (!key) throw new Error('CBB_DATA_API_KEY not set')
  return key
}

function normalize(raw: CbbdRatingsRaw): RatingsEntry | null {
  const entry = TeamRegistry.getByCbbdTeamId(raw.teamId)
  if (!entry) return null   // team not in registry — skip

  return {
    teamSlug:   entry.slug,
    season:     raw.season,
    rank:       raw.rankings?.net ?? null,
    rating:     raw.netRating ?? null,
    offRating:  raw.offensiveRating ?? null,
    defRating:  raw.defensiveRating ?? null,
    conference: raw.conference,
    source:     'cbbd',
  }
}

export const D1CBBDRatingsProvider = {
  async fetchAndCache(season: number): Promise<RatingsSeasonData> {
    const rawPath  = CachePaths.rawRatings(season)
    const normPath = CachePaths.ratings(season)
    const frozen   = CacheManager.isFrozen(season)

    // Return normalized cache if fresh
    const cached = CacheManager.read<RatingsSeasonData>(normPath)
    if (cached && !CacheManager.isStale(cached)) {
      return cached.data
    }

    // Fetch from CBBD
    const url = `${BASE_URL}/ratings/adjusted?season=${season}`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${getKey()}` },
    })
    if (!res.ok) throw new Error(`CBBD ratings ${season}: HTTP ${res.status}`)

    const rawArray = (await res.json()) as CbbdRatingsRaw[]

    // Write raw first
    CacheManager.writeRaw(rawPath, rawArray)

    // Normalize
    const entries = rawArray.map(normalize).filter((e): e is RatingsEntry => e !== null)

    const seasonData: RatingsSeasonData = {
      season,
      fetchedAt: new Date().toISOString(),
      source: 'cbbd',
      entries,
    }

    CacheManager.write(normPath, seasonData, frozen)
    return seasonData
  },

  /** Get ratings for a single team from the season cache. Fetches if not cached. */
  async getRating(teamSlug: string, season: number): Promise<RatingsEntry | null> {
    const data = await this.fetchAndCache(season)
    return data.entries.find(e => e.teamSlug === teamSlug) ?? null
  },
}
