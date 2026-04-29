/**
 * D1MasseyProvider
 *
 * Loads Massey composite ratings for D1 from data/massey-d1/{season}.json
 * and maps team names to V2 registry slugs.
 *
 * Massey serves as a CONTEXT variable alongside CBBD adjusted efficiency.
 * It is NOT a replacement for CBBD net rating.
 *
 * Data availability: only seasons with a corresponding JSON file in
 * data/massey-d1/ are supported. Currently only 2026 exists.
 * All other seasons return null for every team.
 */

import * as fs from 'fs'
import * as path from 'path'
import { TeamRegistry } from '@/lib/registry/TeamRegistry'

interface MasseyFileEntry {
  rank: number
  teamName: string
  conference: string
  wins: number
  losses: number
  rating: number
}

interface MasseyFile {
  season: number
  ratings: MasseyFileEntry[]
}

export interface MasseyResult {
  rank: number
  rating: number
}

export type MasseySeasonMap = Map<string, MasseyResult>

const DATA_DIR = path.resolve(process.cwd(), 'data', 'massey-d1')

// Massey D1 abbreviations / alternate names → V2 registry slugs.
// All teams that fail normalized-name matching, plus explicit overrides that
// prevent shorter team names (e.g. "michigan") from absorbing abbreviated entries
// (e.g. "Michigan St", "E Michigan", "C Michigan") via the substring fallback.
const MASSEY_ALIASES: Record<string, string> = {
  // ── Original alias table ────────────────────────────────────────────────────
  "St Mary's CA":      'saint-marys',
  'St Louis':          'saint-louis',
  "St Joseph's PA":    'saint-josephs',
  'Cal Baptist':       'california-baptist',
  'SF Austin':         'stephen-f-austin',
  'N Dakota St':       'north-dakota-state',
  'Hawaii':            'hawaii',
  'IL Chicago':        'uic',
  'St Thomas MN':      'st-thomas-minnesota',
  'WKU':               'western-kentucky',
  'MTSU':              'middle-tennessee',
  'ETSU':              'east-tennessee-state',
  'Loy Marymount':     'loyola-marymount',
  'CS Northridge':     'cal-state-northridge',
  'UTRGV':             'ut-rio-grande-valley',
  'Appalachian St':    'app-state',
  'Queens NC':         'queens-university',
  'TAM C. Christi':    'texas-am-corpus-christi',
  'CS Fullerton':      'cal-state-fullerton',
  'San Jose St':       'san-jos-state',
  'PFW':               'purdue-fort-wayne',
  'S Dakota St':       'south-dakota-state',
  'LIU Brooklyn':      'long-island-university',
  'W Carolina':        'western-carolina',
  'TN Martin':         'ut-martin',
  "St Peter's":        'saint-peters',
  'FGCU':              'florida-gulf-coast',
  'SIUE':              'siu-edwardsville',
  "Mt St Mary's":      'mount-st-marys',
  'FL Atlantic':       'florida-atlantic',
  'Kent':              'kent-state',
  'Penn':              'pennsylvania',
  'CS Sacramento':     'sacramento-state',
  'SC Upstate':        'south-carolina-upstate',
  'MA Lowell':         'umass-lowell',
  'NC A&T':            'north-carolina-at',
  'UT San Antonio':    'utsa',
  'CS Bakersfield':    'cal-state-bakersfield',
  'SUNY Albany':       'ualbany',
  'Loyola MD':         'loyola-maryland',
  'NC Central':        'north-carolina-central',
  'Ark Pine Bluff':    'arkansas-pine-bluff',
  'IUPUI':             'iu-indianapolis',
  'F Dickinson':       'fairleigh-dickinson',
  'S Carolina St':     'south-carolina-state',
  'MD E Shore':        'maryland-eastern-shore',
  'ULM':               'ul-monroe',
  'MS Valley St':      'mississippi-valley-state',
  // ── Substring-override aliases ──────────────────────────────────────────────
  // "X St" abbreviations whose parent school name is a substring of the
  // abbreviation, causing the wrong team to match first in the fallback loop.
  'Alabama St':        'alabama-state',
  'Arizona St':        'arizona-state',
  'Arkansas St':       'arkansas-state',
  'C Michigan':        'central-michigan',
  'Cent Arkansas':     'central-arkansas',
  'Charleston So':     'charleston-southern',
  'Colorado St':       'colorado-state',
  'Connecticut':       'uconn',
  'Delaware St':       'delaware-state',
  'E Illinois':        'eastern-illinois',
  'E Kentucky':        'eastern-kentucky',
  'E Michigan':        'eastern-michigan',
  'E Washington':      'eastern-washington',
  'Florida Intl':      'florida-international',
  'Florida St':        'florida-state',
  'G Washington':      'george-washington',
  'Ga Southern':       'georgia-southern',
  'Georgia St':        'georgia-state',
  'Houston Chr':       'houston-christian',
  'Idaho St':          'idaho-state',
  'Illinois St':       'illinois-state',
  'Indiana St':        'indiana-state',
  'Jacksonville St':   'jacksonville-state',
  'Kansas St':         'kansas-state',
  'Michigan St':       'michigan-state',
  'Miami FL':          'miami',
  'Mississippi':       'ole-miss',
  'Missouri KC':       'kansas-city',
  'Missouri St':       'missouri-state',
  'Montana St':        'montana-state',
  'N Colorado':        'northern-colorado',
  'N Illinois':        'northern-illinois',
  'N Kentucky':        'northern-kentucky',
  'New Mexico St':     'new-mexico-state',
  'Northwestern LA':   'northwestern-state',
  'Oklahoma St':       'oklahoma-state',
  'Oregon St':         'oregon-state',
  'Portland St':       'portland-state',
  'S Illinois':        'southern-illinois',
  'SE Missouri St':    'southeast-missouri-state',
  'Sam Houston St':    'sam-houston',
  'San Diego St':      'san-diego-state',
  'Tennessee St':      'tennessee-state',
  'Texas St':          'texas-state',
  'TX Southern':       'texas-southern',
  'W Illinois':        'western-illinois',
  'W Michigan':        'western-michigan',
  'Washington St':     'washington-state',
  // ── Non-D1 suppress ─────────────────────────────────────────────────────────
  'New Haven':         '',  // DII transitional — not in D1 registry
}

const _cache = new Map<number, MasseySeasonMap | null>()

function normalize(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildMasseyMap(season: number): MasseySeasonMap | null {
  const filePath = path.join(DATA_DIR, `${season}.json`)
  if (!fs.existsSync(filePath)) return null

  let raw: MasseyFile
  try {
    raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MasseyFile
  } catch {
    return null
  }

  const teams = TeamRegistry.getAll().filter(t => t.division === 'D1')
  const registrySlugs = new Set(teams.map(t => t.slug))

  // Build normalized registry name → slug lookup
  const regMap = new Map<string, string>()
  for (const team of teams) {
    regMap.set(normalize(team.displayName), team.slug)
    regMap.set(normalize(team.shortName), team.slug)
    if (team.externalIds.cbbdName) {
      regMap.set(normalize(team.externalIds.cbbdName), team.slug)
    }
  }

  const result: MasseySeasonMap = new Map()

  for (const entry of raw.ratings) {
    const mname = entry.teamName
    const payload: MasseyResult = { rank: entry.rank, rating: entry.rating }

    // 1. Alias table (direct slug lookup)
    const aliasSlug = MASSEY_ALIASES[mname]
    if (aliasSlug !== undefined) {
      if (aliasSlug && registrySlugs.has(aliasSlug)) {
        result.set(aliasSlug, payload)
      }
      continue
    }

    // 2. Normalized name match
    const norm = normalize(mname)
    const directSlug = regMap.get(norm)
    if (directSlug) {
      result.set(directSlug, payload)
      continue
    }

    // 3. Substring fallback — conservative (both sides ≥ 5 chars)
    if (norm.length >= 5) {
      const regEntries = Array.from(regMap)
      for (let i = 0; i < regEntries.length; i++) {
        const [regNorm, slug] = regEntries[i]
        if (regNorm.length >= 5 && (norm.includes(regNorm) || regNorm.includes(norm))) {
          result.set(slug, payload)
          break
        }
      }
    }
  }

  return result
}

function loadMasseyMap(season: number): MasseySeasonMap | null {
  if (_cache.has(season)) return _cache.get(season) ?? null
  // Try exact season first; fall back to season+1 as best-available data
  // (e.g. Browse 2025 uses 2026.json when 2025.json doesn't exist yet)
  const map = buildMasseyMap(season) ?? buildMasseyMap(season + 1)
  _cache.set(season, map)
  return map
}

export function getMasseyEntry(teamSlug: string, season: number): MasseyResult | null {
  const map = loadMasseyMap(season)
  return map?.get(teamSlug) ?? null
}
