/**
 * Loads D1 head coach data from local CSV files in data/coaches/d1/.
 *
 * Current coverage: 2025–2026 (d1-coaches-2025.csv, d1-coaches-2026.csv).
 * Format: School,Head Coach
 *
 * School names in the CSV are display names (e.g. "Michigan", "St. John's").
 * We match against the team registry's displayName and cbbdName fields.
 *
 * Coach continuity (returning vs. new) requires data for multiple seasons —
 * not yet derivable with current coverage.
 */

import * as fs   from 'fs'
import * as path from 'path'
import { TeamRegistry } from '@/lib/registry/TeamRegistry'

const COACHES_DIR = path.resolve(process.cwd(), 'data', 'coaches', 'd1')

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CoachEntry {
  coachName: string
  season: number   // year2 convention (e.g. 2026 = 2025-26 season)
}

// ─── Cache ────────────────────────────────────────────────────────────────────

// slug → season → coach name
let _cache: Map<string, Map<number, string>> | null = null

function buildMap(season: number, filePath: string): Map<string, string> {
  const raw = fs.readFileSync(filePath, 'utf-8')
  const lines = raw.split('\n').filter(l => l.trim())
  const schoolToSlug = new Map<string, string>()

  // Build lookup: displayName → slug, cbbdName → slug
  for (const entry of TeamRegistry.getAll()) {
    schoolToSlug.set(entry.displayName.toLowerCase(), entry.slug)
    if (entry.externalIds.cbbdName) {
      schoolToSlug.set(entry.externalIds.cbbdName.toLowerCase(), entry.slug)
    }
  }

  const result = new Map<string, string>()
  let isHeader = true

  for (const line of lines) {
    if (isHeader) { isHeader = false; continue }
    const comma = line.indexOf(',')
    if (comma === -1) continue
    const school    = line.slice(0, comma).trim()
    const coachName = line.slice(comma + 1).trim()
    const slug = schoolToSlug.get(school.toLowerCase())
    if (slug) result.set(slug, coachName)
  }

  return result
}

function getCache(): Map<string, Map<number, string>> {
  if (_cache) return _cache
  _cache = new Map()

  const files = fs.existsSync(COACHES_DIR)
    ? fs.readdirSync(COACHES_DIR).filter(f => f.endsWith('.csv'))
    : []

  for (const file of files) {
    // Expected filename: d1-coaches-{season}.csv
    const match = file.match(/d1-coaches-(\d{4})\.csv/)
    if (!match) continue
    const season = parseInt(match[1], 10)
    const map = buildMap(season, path.join(COACHES_DIR, file))
    map.forEach((coach, slug) => {
      if (!_cache!.has(slug)) _cache!.set(slug, new Map())
      _cache!.get(slug)!.set(season, coach)
    })
  }

  return _cache
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Returns the head coach name for a given team and season (year2 convention). */
export function getCoach(teamSlug: string, season: number): string | null {
  return getCache().get(teamSlug)?.get(season) ?? null
}

/** Returns true if coach data is available for a given season year. */
export function hasCoachData(season: number): boolean {
  return Array.from(getCache().values()).some(m => m.has(season))
}
