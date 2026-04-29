/**
 * Types and server-side loader for the offline player identity index.
 *
 * The index is built by scripts/build-player-identity-index.ts and lives at
 * data/registry/player-identity-index.json. It is loaded lazily and cached
 * in module scope — one disk read per server lifetime.
 *
 * Confidence levels:
 *   exact    — appearances share the same stable playerId (backfilled sdrm_id or CBBD ID)
 *   high     — same school, consecutive year, exact normalized name (ID-gap fallback)
 *   probable — different school, same division, exact name, unique match, position consistent
 *   possible — cross-division (D2↔D1), exact name, unique match (no eligibility data to validate)
 */

import * as fs   from 'fs'
import * as path from 'path'

// ─── Types ────────────────────────────────────────────────────────────────────

export type IdentityConfidence = 'exact' | 'high' | 'probable' | 'possible'

export interface IdentityAppearance {
  year:            number
  teamSlug:        string
  division:        'D1' | 'D2'
  playerId:        string          // the player's actual ID in that year's cache
  eligibilityYear: string | null   // "FR"|"SO"|"JR"|"SR"|"GS"|"RS" — null when unavailable
  confidence:      IdentityConfidence
}

export interface PlayerIdentityEntry {
  appearances: IdentityAppearance[]
}

export interface PlayerIdentityIndex {
  version:  number
  builtAt:  string
  stats: {
    totalIds:       number
    d1Only:         number
    d2Only:         number
    crossDivision:  number
    probableLinks:  number
    possibleLinks:  number
  }
  /** keyed by any known playerId (including cross-division aliases) */
  byId: Record<string, PlayerIdentityEntry>
}

// ─── Loader ───────────────────────────────────────────────────────────────────

const INDEX_PATH = path.resolve(process.cwd(), 'data', 'registry', 'player-identity-index.json')

let _index: PlayerIdentityIndex | null = null

export function loadPlayerIdentityIndex(): PlayerIdentityIndex | null {
  if (_index) return _index
  if (!fs.existsSync(INDEX_PATH)) return null
  try {
    _index = JSON.parse(fs.readFileSync(INDEX_PATH, 'utf-8')) as PlayerIdentityIndex
    return _index
  } catch {
    return null
  }
}

/**
 * Returns all known appearances for a player ID, or null if the index is
 * unavailable or the player has no entry. Sorted newest → oldest.
 */
export function getPlayerAppearances(playerId: string): IdentityAppearance[] | null {
  const index = loadPlayerIdentityIndex()
  if (!index) return null
  const entry = index.byId[playerId]
  if (!entry) return null
  return [...entry.appearances].sort((a, b) => b.year - a.year)
}
