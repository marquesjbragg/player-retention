/**
 * Builds the offline player identity index at data/registry/player-identity-index.json.
 *
 * Reads all D1 and D2 normalized player cache files. For each player ID, collects
 * all known appearances and attempts cross-school / cross-division linking via
 * exact normalized-name matching.
 *
 * Confidence levels assigned:
 *   exact    — appearances share the same stable playerId (backfilled sdrm_id or CBBD ID)
 *   high     — same school, consecutive year, exact name, different name-based ID format
 *   probable — different school, same division, exact name, unique match, position consistent
 *   possible — cross-division (D2↔D1), exact name, unique match
 *
 * For cross-division links, both the D1 playerId and D2 playerId get the full combined
 * appearance list, so either ID can be used to look up the complete history.
 *
 * Usage:
 *   npx tsx scripts/build-player-identity-index.ts
 *   npx tsx scripts/build-player-identity-index.ts --dry-run
 *   npx tsx scripts/build-player-identity-index.ts --no-cross-division
 */

import * as fs   from 'fs'
import * as path from 'path'
import type { PlayerSeason } from '../src/lib/types'
import { normalizePlayerName } from '../src/lib/engine/matching'
import type {
  PlayerIdentityIndex,
  PlayerIdentityEntry,
  IdentityAppearance,
  IdentityConfidence,
} from '../src/lib/identity/PlayerIdentityIndex'

// ─── Config ───────────────────────────────────────────────────────────────────

const D1_CACHE_ROOT = path.resolve(process.cwd(), 'data/cache/d1/cbbd/players')
const D2_CACHE_ROOT = path.resolve(process.cwd(), 'data/cache/d2/sidearm/players')
const OUTPUT_PATH   = path.resolve(process.cwd(), 'data/registry/player-identity-index.json')
const SEASONS       = [2022, 2023, 2024, 2025, 2026]

const args = process.argv.slice(2)
const DRY_RUN           = args.includes('--dry-run')
const NO_CROSS_DIVISION = args.includes('--no-cross-division')

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawAppearance {
  year:           number
  teamSlug:       string
  division:       'D1' | 'D2'
  playerId:       string
  playerName:     string
  normalizedName: string
  position:       string | null
  eligibilityYear: string | null
}

// ─── Cache loading ────────────────────────────────────────────────────────────

function loadDivisionAppearances(cacheRoot: string, division: 'D1' | 'D2'): RawAppearance[] {
  const appearances: RawAppearance[] = []

  for (const season of SEASONS) {
    const yearDir = path.join(cacheRoot, String(season))
    if (!fs.existsSync(yearDir)) continue

    for (const fname of fs.readdirSync(yearDir)) {
      if (!fname.endsWith('.json')) continue
      const teamSlug = fname.replace('.json', '')

      try {
        const raw   = fs.readFileSync(path.join(yearDir, fname), 'utf-8')
        const entry = JSON.parse(raw)
        const players: PlayerSeason[] = entry.data ?? entry

        if (!Array.isArray(players)) continue

        for (const p of players) {
          if (!p.playerId || !p.playerName) continue
          appearances.push({
            year:            season,
            teamSlug,
            division,
            playerId:        p.playerId,
            playerName:      p.playerName,
            normalizedName:  p.normalizedName ?? normalizePlayerName(p.playerName),
            position:        p.position ?? null,
            eligibilityYear: p.eligibilityYear ?? (p.tRankYr ? p.tRankYr.toUpperCase() : null),
          })
        }
      } catch {
        // skip malformed files
      }
    }
  }

  return appearances
}

// ─── Eligibility year ordering ────────────────────────────────────────────────

const ELIG_ORDER: Record<string, number> = {
  FR: 1, SO: 2, JR: 3, SR: 4, GS: 5, RS: 0, // RS = redshirt, ambiguous position
}

function eligAdvancesCorrectly(prev: string | null, next: string | null): boolean {
  if (!prev || !next) return true // can't validate — be permissive
  const pv = ELIG_ORDER[prev.toUpperCase()]
  const nv = ELIG_ORDER[next.toUpperCase()]
  if (pv === undefined || nv === undefined) return true
  if (prev.toUpperCase() === 'RS') return true // redshirt year, anything is valid after
  return nv === pv + 1 || next.toUpperCase() === 'GS' // GS can follow any year
}

// ─── Position compatibility ───────────────────────────────────────────────────

function positionsCompatible(a: string | null, b: string | null): boolean {
  if (!a || !b) return true // can't validate
  const norm = (p: string) => p.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1)
  return norm(a) === norm(b)
}

// ─── Cross-school / cross-division linking ────────────────────────────────────

interface NameKey { norm: string; year: number }

function buildNameYearIndex(appearances: RawAppearance[]): Map<string, RawAppearance[]> {
  const idx = new Map<string, RawAppearance[]>()
  for (const a of appearances) {
    const key = `${a.normalizedName}|${a.year}`
    const list = idx.get(key) ?? []
    list.push(a)
    idx.set(key, list)
  }
  return idx
}

interface CrossLink {
  fromId:     string
  toId:       string
  fromApp:    RawAppearance
  toApp:      RawAppearance
  confidence: IdentityConfidence
}

function findCrossLinks(
  d2Appearances: RawAppearance[],
  d1Appearances: RawAppearance[],
  allD2ByNameYear: Map<string, RawAppearance[]>,
): CrossLink[] {
  const links: CrossLink[] = []

  // ── D2 → D2 cross-school ────────────────────────────────────────────────────
  // Group D2 appearances by playerId to find a player's last known season
  const d2ByPlayerId = new Map<string, RawAppearance[]>()
  for (const a of d2Appearances) {
    const list = d2ByPlayerId.get(a.playerId) ?? []
    list.push(a)
    d2ByPlayerId.set(a.playerId, list)
  }

  for (const [playerId, apps] of d2ByPlayerId) {
    const sorted = [...apps].sort((a, b) => b.year - a.year)
    const latest = sorted[0]
    const nextYear = latest.year + 1

    // Look for same name at a DIFFERENT D2 school in the next year
    const candidates = allD2ByNameYear.get(`${latest.normalizedName}|${nextYear}`) ?? []
    const otherTeam  = candidates.filter(c => c.teamSlug !== latest.teamSlug && c.playerId !== playerId)

    if (otherTeam.length === 1) {
      const target = otherTeam[0]
      // Position must be compatible; eligibility can't be checked (D2 always null)
      if (positionsCompatible(latest.position, target.position)) {
        links.push({
          fromId:     playerId,
          toId:       target.playerId,
          fromApp:    latest,
          toApp:      target,
          confidence: 'probable',
        })
      }
    }
  }

  if (NO_CROSS_DIVISION) return links

  // ── D2 → D1 cross-division ──────────────────────────────────────────────────
  const d1ByNameYear = buildNameYearIndex(d1Appearances)

  for (const [d2PlayerId, apps] of d2ByPlayerId) {
    const sorted = [...apps].sort((a, b) => b.year - a.year)
    const latest = sorted[0]
    const nextYear = latest.year + 1

    const d1Candidates = d1ByNameYear.get(`${latest.normalizedName}|${nextYear}`) ?? []
    const uniqueD1     = d1Candidates.filter(c => positionsCompatible(latest.position, c.position))

    if (uniqueD1.length === 1) {
      const target = uniqueD1[0]
      links.push({
        fromId:     d2PlayerId,
        toId:       target.playerId,
        fromApp:    latest,
        toApp:      target,
        confidence: 'possible',
      })
    }
  }

  // ── D1 → D2 cross-division ──────────────────────────────────────────────────
  const d1ByPlayerId = new Map<string, RawAppearance[]>()
  for (const a of d1Appearances) {
    const list = d1ByPlayerId.get(a.playerId) ?? []
    list.push(a)
    d1ByPlayerId.set(a.playerId, list)
  }

  for (const [d1PlayerId, apps] of d1ByPlayerId) {
    const sorted = [...apps].sort((a, b) => b.year - a.year)
    const latest = sorted[0]
    const nextYear = latest.year + 1

    const d2Candidates = allD2ByNameYear.get(`${latest.normalizedName}|${nextYear}`) ?? []
    const uniqueD2     = d2Candidates.filter(c => positionsCompatible(latest.position, c.position))

    if (uniqueD2.length === 1) {
      const target = uniqueD2[0]
      links.push({
        fromId:     d1PlayerId,
        toId:       target.playerId,
        fromApp:    latest,
        toApp:      target,
        confidence: 'possible',
      })
    }
  }

  return links
}

// ─── Index builder ────────────────────────────────────────────────────────────

function buildIndex(
  d2Appearances: RawAppearance[],
  d1Appearances: RawAppearance[],
  crossLinks: CrossLink[],
): PlayerIdentityIndex {
  // 1. Seed byId with all exact same-playerId appearances
  const byId = new Map<string, IdentityAppearance[]>()

  const addAppearance = (playerId: string, app: IdentityAppearance) => {
    const list = byId.get(playerId) ?? []
    // Avoid duplicates (same year + teamSlug + playerId)
    const isDup = list.some(x => x.year === app.year && x.teamSlug === app.teamSlug && x.playerId === app.playerId)
    if (!isDup) list.push(app)
    byId.set(playerId, list)
  }

  for (const a of [...d2Appearances, ...d1Appearances]) {
    addAppearance(a.playerId, {
      year:            a.year,
      teamSlug:        a.teamSlug,
      division:        a.division,
      playerId:        a.playerId,
      eligibilityYear: a.eligibilityYear,
      confidence:      'exact',
    })
  }

  // 2. Apply cross-links: for each link, add the target appearance to source's list
  //    and vice versa, so both IDs can find the complete history
  let probableLinks = 0
  let possibleLinks = 0
  const seenLinks = new Set<string>()

  for (const link of crossLinks) {
    const key = [link.fromId, link.toId].sort().join('|')
    if (seenLinks.has(key)) continue
    seenLinks.add(key)

    if (link.confidence === 'probable') probableLinks++
    else if (link.confidence === 'possible') possibleLinks++

    // Add toApp to fromId's list
    addAppearance(link.fromId, {
      year:            link.toApp.year,
      teamSlug:        link.toApp.teamSlug,
      division:        link.toApp.division,
      playerId:        link.toApp.playerId,
      eligibilityYear: link.toApp.eligibilityYear,
      confidence:      link.confidence,
    })

    // Add fromApp to toId's list
    addAppearance(link.toId, {
      year:            link.fromApp.year,
      teamSlug:        link.fromApp.teamSlug,
      division:        link.fromApp.division,
      playerId:        link.fromApp.playerId,
      eligibilityYear: link.fromApp.eligibilityYear,
      confidence:      link.confidence,
    })
  }

  // 3. Compute stats
  const allIds = Array.from(byId.keys())
  let d1Only = 0, d2Only = 0, crossDivision = 0

  for (const [, apps] of byId) {
    const hasD1 = apps.some(a => a.division === 'D1')
    const hasD2 = apps.some(a => a.division === 'D2')
    if (hasD1 && hasD2)  crossDivision++
    else if (hasD1)      d1Only++
    else                 d2Only++
  }

  // 4. Build final object
  const indexObj: Record<string, PlayerIdentityEntry> = {}
  for (const [id, apps] of byId) {
    indexObj[id] = { appearances: apps.sort((a, b) => b.year - a.year) }
  }

  return {
    version: 1,
    builtAt: new Date().toISOString(),
    stats: {
      totalIds:      allIds.length,
      d1Only,
      d2Only,
      crossDivision,
      probableLinks,
      possibleLinks,
    },
    byId: indexObj,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('Loading D2 appearances…')
const d2Apps = loadDivisionAppearances(D2_CACHE_ROOT, 'D2')
console.log(`  D2: ${d2Apps.length} player-season records`)

console.log('Loading D1 appearances…')
const d1Apps = loadDivisionAppearances(D1_CACHE_ROOT, 'D1')
console.log(`  D1: ${d1Apps.length} player-season records`)

console.log('Building name+year index for cross-school/cross-division linking…')
const d2ByNameYear = buildNameYearIndex(d2Apps)

console.log('Finding cross-school and cross-division links…')
const crossLinks = findCrossLinks(d2Apps, d1Apps, d2ByNameYear)
console.log(`  Cross-school D2→D2 (probable): ${crossLinks.filter(l => l.confidence === 'probable').length}`)
console.log(`  Cross-division D2↔D1 (possible): ${crossLinks.filter(l => l.confidence === 'possible').length}`)

console.log('Building index…')
const index = buildIndex(d2Apps, d1Apps, crossLinks)

console.log(`\nIndex summary:`)
console.log(`  Total IDs indexed: ${index.stats.totalIds}`)
console.log(`  D1-only entries:   ${index.stats.d1Only}`)
console.log(`  D2-only entries:   ${index.stats.d2Only}`)
console.log(`  Cross-division:    ${index.stats.crossDivision}`)
console.log(`  Probable links:    ${index.stats.probableLinks}`)
console.log(`  Possible links:    ${index.stats.possibleLinks}`)

if (DRY_RUN) {
  console.log('\n[DRY RUN] — index not written')
} else {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2))
  const size = fs.statSync(OUTPUT_PATH).size
  console.log(`\nWrote ${OUTPUT_PATH} (${(size / 1024 / 1024).toFixed(1)} MB)`)
}
