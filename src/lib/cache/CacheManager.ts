import * as fs from 'fs'
import * as path from 'path'
import type { CacheEntry } from '@/lib/types'

const D1_CACHE_ROOT = path.resolve(process.cwd(), 'data/cache/d1/cbbd')
const D2_CACHE_ROOT = path.resolve(process.cwd(), 'data/cache/d2/sidearm')

// 2025-26 is the current season (ending year 2026).
// Any season ending year <= CURRENT_SEASON_YEAR - 1 is frozen (complete, never re-fetch).
const CURRENT_SEASON_YEAR = 2026
const TTL_CURRENT_MS = 6 * 60 * 60 * 1000   // 6 hours for live season

// ─── Path helpers ─────────────────────────────────────────────────────────────

export const CachePaths = {
  rawPlayers:  (season: number, teamSlug: string) => path.join(D1_CACHE_ROOT, 'raw', 'players', String(season), `${teamSlug}.json`),
  rawRatings:  (season: number)                   => path.join(D1_CACHE_ROOT, 'raw', 'ratings', `${season}.json`),
  players:     (season: number, teamSlug: string) => path.join(D1_CACHE_ROOT, 'players', String(season), `${teamSlug}.json`),
  teamSeason:  (season: number, teamSlug: string) => path.join(D1_CACHE_ROOT, 'team-seasons', String(season), `${teamSlug}.json`),
  ratings:     (season: number)                   => path.join(D1_CACHE_ROOT, 'ratings', `${season}.json`),
  coaches:     (season: number, teamSlug: string) => path.join(D1_CACHE_ROOT, 'coaches', String(season), `${teamSlug}.json`),
}

export const D2CachePaths = {
  rawPlayers:  (season: number, teamSlug: string) => path.join(D2_CACHE_ROOT, 'raw', 'players', String(season), `${teamSlug}.json`),
  rawTeam:     (season: number, teamSlug: string) => path.join(D2_CACHE_ROOT, 'raw', 'team-seasons', String(season), `${teamSlug}.json`),
  players:     (season: number, teamSlug: string) => path.join(D2_CACHE_ROOT, 'players', String(season), `${teamSlug}.json`),
  teamSeason:  (season: number, teamSlug: string) => path.join(D2_CACHE_ROOT, 'team-seasons', String(season), `${teamSlug}.json`),
}

// ─── Core operations ──────────────────────────────────────────────────────────

export const CacheManager = {
  isFrozen(season: number): boolean {
    return season < CURRENT_SEASON_YEAR
  },

  read<T>(filepath: string): CacheEntry<T> | null {
    if (!fs.existsSync(filepath)) return null
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as CacheEntry<T>
    } catch {
      return null
    }
  },

  write<T>(filepath: string, data: T, frozen: boolean): void {
    fs.mkdirSync(path.dirname(filepath), { recursive: true })
    const entry: CacheEntry<T> = {
      data,
      fetchedAt: new Date().toISOString(),
      frozen,
    }
    fs.writeFileSync(filepath, JSON.stringify(entry, null, 2))
  },

  /** Write raw API response with no CacheEntry wrapper — stored as-is for debugging. */
  writeRaw<T>(filepath: string, data: T): void {
    fs.mkdirSync(path.dirname(filepath), { recursive: true })
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  },

  readRaw<T>(filepath: string): T | null {
    if (!fs.existsSync(filepath)) return null
    try {
      return JSON.parse(fs.readFileSync(filepath, 'utf-8')) as T
    } catch {
      return null
    }
  },

  isStale(entry: CacheEntry<unknown>, ttlMs = TTL_CURRENT_MS): boolean {
    if (entry.frozen) return false
    const age = Date.now() - new Date(entry.fetchedAt).getTime()
    return age > ttlMs
  },

  exists(filepath: string): boolean {
    return fs.existsSync(filepath)
  },
}
