/**
 * Injects eligibilityYear, normalizedName, and sourceKey into existing D2 normalized
 * player cache files, reading the raw Sidearm data as the source of truth.
 *
 * This is an additive-only migration — it only adds new fields and never modifies
 * existing field values (playerId, playerName, stats, etc.). Safe to re-run.
 *
 * Reads:  data/cache/d2/sidearm/raw/players/{season}/{teamSlug}.json
 * Writes: data/cache/d2/sidearm/players/{season}/{teamSlug}.json  (adds 3 fields per player)
 *
 * Usage:
 *   npx tsx scripts/enrich-d2-player-fields.ts
 *   npx tsx scripts/enrich-d2-player-fields.ts --dry-run
 *   npx tsx scripts/enrich-d2-player-fields.ts --season 2026
 */

import * as fs   from 'fs'
import * as path from 'path'
import { parseSidearmName, type SidearmPlayerRow } from '../src/lib/providers/d2/D2SidearmPlayerProvider'
import { normalizePlayerName } from '../src/lib/engine/matching'
import type { PlayerSeason } from '../src/lib/types'

const RAW_ROOT  = path.resolve(process.cwd(), 'data/cache/d2/sidearm/raw/players')
const NORM_ROOT = path.resolve(process.cwd(), 'data/cache/d2/sidearm/players')
const SEASONS   = [2022, 2023, 2024, 2025, 2026]

const args      = process.argv.slice(2)
const DRY_RUN   = args.includes('--dry-run')
const seasonIdx = args.indexOf('--season')
const onlySeason = seasonIdx !== -1 ? parseInt(args[seasonIdx + 1], 10) : null

function sourceKey(raw: SidearmPlayerRow): string | null {
  return (raw.sdrm_id && raw.sdrm_id !== '0') ? raw.sdrm_id : null
}

// NOTE: Sidearm stats API returns year="0" for all players — the field is not
// supported in /services/conf_stats.ashx. eligibilityYear stays null until
// a roster-page scraping pass can populate it.

let filesUpdated = 0
let playersEnriched = 0
let skipped = 0
let errors = 0

const seasons = onlySeason ? [onlySeason] : SEASONS

for (const season of seasons) {
  const rawDir  = path.join(RAW_ROOT,  String(season))
  const normDir = path.join(NORM_ROOT, String(season))

  if (!fs.existsSync(rawDir) || !fs.existsSync(normDir)) {
    console.log(`[${season}] Missing raw or norm dir — skipping`)
    continue
  }

  const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.json'))
  console.log(`[${season}] Processing ${files.length} teams…`)

  for (const fname of files) {
    const teamSlug = fname.replace('.json', '')
    const rawPath  = path.join(rawDir, fname)
    const normPath = path.join(normDir, fname)

    if (!fs.existsSync(normPath)) { skipped++; continue }

    try {
      const rawArray: SidearmPlayerRow[] = JSON.parse(fs.readFileSync(rawPath, 'utf-8'))
      const normFile: { data: PlayerSeason[]; fetchedAt: string; frozen: boolean } =
        JSON.parse(fs.readFileSync(normPath, 'utf-8'))

      // Build a lookup from normalized playerName → raw row (for injection)
      const rawByName = new Map<string, SidearmPlayerRow>()
      for (const row of rawArray) {
        if (!row.name || row.uniform === 'TM' || row.name === 'TEAM') continue
        rawByName.set(parseSidearmName(row.name).toLowerCase().trim(), row)
      }

      let changed = false
      for (const player of normFile.data) {
        // Skip if already enriched
        if (
          player.eligibilityYear !== undefined &&
          player.normalizedName  !== undefined &&
          player.sourceKey       !== undefined
        ) continue

        const key = player.playerName.toLowerCase().trim()
        const raw = rawByName.get(key)

        const sk   = raw ? sourceKey(raw) : null
        const norm = normalizePlayerName(player.playerName)

        if (DRY_RUN) {
          console.log(`  [DRY] ${season}/${teamSlug}: "${player.playerName}" sourceKey=${sk} norm="${norm}"`)
        } else {
          player.eligibilityYear = null   // stats API does not provide class year
          player.normalizedName  = norm
          player.sourceKey       = sk
          changed = true
          playersEnriched++
        }
      }

      if (changed && !DRY_RUN) {
        fs.writeFileSync(normPath, JSON.stringify(normFile, null, 2))
        filesUpdated++
      }
    } catch (err) {
      console.error(`  [ERR] ${season}/${teamSlug}: ${err}`)
      errors++
    }
  }
}

console.log(`\nDone.${DRY_RUN ? ' (dry run)' : ''}`)
console.log(`  Players enriched: ${DRY_RUN ? '(dry run — not counted)' : playersEnriched}`)
console.log(`  Files updated: ${DRY_RUN ? '(dry run)' : filesUpdated}`)
console.log(`  Skipped (no norm file): ${skipped}`)
console.log(`  Errors: ${errors}`)
