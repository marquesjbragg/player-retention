/**
 * Backfills proper Sidearm sdrm_ids from 2026 data into prior-year normalized caches.
 *
 * Problem: The Sidearm API started returning real sdrm_ids in 2026, but returned
 * sdrm_id="0" for earlier seasons. fix-d2-player-ids.ts converted those to name-based
 * IDs (sidearm-name-{team}-{name}). Now the same player has different IDs in different
 * years (proper in 2026, name-based in 2022-2025), breaking:
 *   - buildPlayerPageData: can't find Y1 player by Y2's proper ID → mislabeled newcomer
 *   - seasons/route.ts scanCache: proper ID not in prior-year files → history shows only 2026
 *
 * Fix: for each 2026 player with a proper sdrm_id, find their counterpart in prior years
 * (same team, same playerName) and update the old record to use the proper sdrm_id.
 *
 * This runs after fix-d2-player-ids.ts. The 2026 files are the "source of truth" for IDs.
 *
 * Usage:
 *   npx tsx scripts/backfill-d2-sdrm-ids.ts
 *   npx tsx scripts/backfill-d2-sdrm-ids.ts --dry-run
 *   npx tsx scripts/backfill-d2-sdrm-ids.ts --team northern-michigan
 */

import * as fs   from 'fs'
import * as path from 'path'
import type { PlayerSeason } from '../src/lib/types'

const NORM_ROOT = path.resolve(process.cwd(), 'data/cache/d2/sidearm/players')
const BACKFILL_YEARS = [2025, 2024, 2023, 2022] // years to update (all prior to 2026)

const args     = process.argv.slice(2)
const DRY_RUN  = args.includes('--dry-run')
const teamIdx  = args.indexOf('--team')
const onlyTeam = teamIdx !== -1 ? args[teamIdx + 1] : null

function isProperSdrmId(playerId: string): boolean {
  return playerId.startsWith('sidearm-') &&
    !playerId.startsWith('sidearm-name-') &&
    playerId !== 'sidearm-0'
}

function normName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

let filesUpdated = 0
let playersBackfilled = 0
let filesScanned = 0
let errors = 0

const year26Dir = path.join(NORM_ROOT, '2026')
const teams = fs.readdirSync(year26Dir).filter(f => f.endsWith('.json'))

for (const fname of teams) {
  const teamSlug = fname.replace('.json', '')
  if (onlyTeam && teamSlug !== onlyTeam) continue

  const year26Path = path.join(year26Dir, fname)

  let year26File: { data: PlayerSeason[]; fetchedAt: string; frozen: boolean }
  try {
    year26File = JSON.parse(fs.readFileSync(year26Path, 'utf-8'))
  } catch {
    continue
  }

  const year26Players: PlayerSeason[] = year26File.data ?? []

  // Only care about 2026 players that have proper sdrm_ids — these are the "source of truth"
  const properPlayers = year26Players.filter(p => isProperSdrmId(p.playerId))
  if (properPlayers.length === 0) continue

  // Build name → proper sdrm_id map (normalized name → playerId)
  const nameToProperIdMap = new Map<string, string>()
  for (const p of properPlayers) {
    const key = normName(p.playerName)
    if (nameToProperIdMap.has(key)) {
      // Duplicate name on the same team in 2026 — skip to avoid ambiguity
      nameToProperIdMap.delete(key)
      nameToProperIdMap.set(`__dup__${key}`, p.playerId) // mark as duplicate
    } else if (!nameToProperIdMap.has(`__dup__${key}`)) {
      nameToProperIdMap.set(key, p.playerId)
    }
  }

  // Remove duplicates from lookup
  for (const [k] of nameToProperIdMap) {
    if (k.startsWith('__dup__')) nameToProperIdMap.delete(k)
  }

  if (nameToProperIdMap.size === 0) continue

  // Process each prior year
  for (const year of BACKFILL_YEARS) {
    const yearPath = path.join(NORM_ROOT, String(year), fname)
    if (!fs.existsSync(yearPath)) continue

    filesScanned++

    let yearFile: { data: PlayerSeason[]; fetchedAt: string; frozen: boolean }
    try {
      yearFile = JSON.parse(fs.readFileSync(yearPath, 'utf-8'))
    } catch (err) {
      console.error(`  [ERR] ${year}/${teamSlug}: ${err}`)
      errors++
      continue
    }

    const players: PlayerSeason[] = yearFile.data ?? []
    let changed = false

    for (const player of players) {
      if (isProperSdrmId(player.playerId)) continue // already has proper ID, skip

      const key = normName(player.playerName)
      const properId = nameToProperIdMap.get(key)
      if (!properId) continue // no 2026 match for this name

      if (player.playerId === properId) continue // already correct

      if (DRY_RUN) {
        console.log(`  [DRY] ${year}/${teamSlug}: "${player.playerName}" ${player.playerId} → ${properId}`)
      } else {
        player.playerId = properId
        changed = true
        playersBackfilled++
      }
    }

    if (changed && !DRY_RUN) {
      try {
        fs.writeFileSync(yearPath, JSON.stringify(yearFile, null, 2))
        filesUpdated++
      } catch (err) {
        console.error(`  [ERR] writing ${year}/${teamSlug}: ${err}`)
        errors++
      }
    }
  }
}

console.log(`\nDone.${DRY_RUN ? ' (dry run)' : ''}`)
console.log(`  Prior-year files scanned: ${filesScanned}`)
console.log(`  Players backfilled: ${DRY_RUN ? '(dry run)' : playersBackfilled}`)
console.log(`  Files updated: ${DRY_RUN ? '(dry run)' : filesUpdated}`)
console.log(`  Errors: ${errors}`)
