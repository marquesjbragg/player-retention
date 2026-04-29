/**
 * Regenerates D2 normalized player cache files from existing raw Sidearm data,
 * applying the corrected player ID scheme that treats sdrm_id="0" as invalid.
 *
 * Root cause: Sidearm API returns sdrm_id="0" as a sentinel meaning "no stable ID".
 * The old normalization treated "0" as truthy → every player on affected teams got
 * playerId="sidearm-0", causing wrong-player routing and a massive false season history.
 *
 * Fixed ID scheme:
 *   - If sdrm_id exists and !== "0" → "sidearm-{sdrm_id}"
 *   - Otherwise                     → "sidearm-name-{teamSlug}-{normalizedName}"
 *
 * Usage:
 *   npx tsx scripts/fix-d2-player-ids.ts
 *   npx tsx scripts/fix-d2-player-ids.ts --dry-run
 *   npx tsx scripts/fix-d2-player-ids.ts --season 2025
 */

import * as fs   from 'fs'
import * as path from 'path'
import { parseSidearmName, type SidearmPlayerRow } from '../src/lib/providers/d2/D2SidearmPlayerProvider'
import type { PlayerSeason } from '../src/lib/types'

const RAW_ROOT  = path.resolve(process.cwd(), 'data/cache/d2/sidearm/raw/players')
const NORM_ROOT = path.resolve(process.cwd(), 'data/cache/d2/sidearm/players')
const SEASONS   = [2022, 2023, 2024, 2025, 2026]

const args     = process.argv.slice(2)
const DRY_RUN  = args.includes('--dry-run')
const seasonIdx = args.indexOf('--season')
const onlySeason = seasonIdx !== -1 ? parseInt(args[seasonIdx + 1], 10) : null

function int(val: string | undefined): number {
  return parseInt(val ?? '0', 10) || 0
}

function normalizePlayer(row: SidearmPlayerRow, teamSlug: string, season: number): PlayerSeason {
  const s = row.stats_stats ?? {}
  const playerId = (row.sdrm_id && row.sdrm_id !== '0')
    ? `sidearm-${row.sdrm_id}`
    : `sidearm-name-${teamSlug}-${row.name.replace(/\W/g, '')}`

  return {
    playerId,
    playerName:     parseSidearmName(row.name),
    teamId:         teamSlug,
    seasonYear:     season,
    position:       row.position || undefined,
    games:          int(row.games_played),
    gamesStarted:   row.games_started !== undefined ? int(row.games_started) : null,
    minutesPlayed:  int(s.minutes_played),
    points:         int(s.points_scored),
    assists:        int(s.assists),
    steals:         int(s.steals),
    blocks:         int(s.blocked_shots),
    turnovers:      int(s.turnovers),
    totalRebounds:  int(s.total_rebounds),
    offRebounds:    int(s.offensive_rebounds),
    defRebounds:    int(s.defensive_rebounds),
    fgMade:         int(s.field_goals_made),
    fgAttempted:    int(s.field_goals_attempted),
    threeMade:      int(s.three_points_made),
    threeAttempted: int(s.three_points_attempted),
    ftMade:         int(s.free_throws_made),
    ftAttempted:    int(s.free_throws_attempted),
    source:         'sidearm',
  }
}

let totalFiles = 0
let fixed = 0
let already_ok = 0
let errors = 0

const seasons = onlySeason ? [onlySeason] : SEASONS

for (const season of seasons) {
  const rawDir  = path.join(RAW_ROOT,  String(season))
  const normDir = path.join(NORM_ROOT, String(season))

  if (!fs.existsSync(rawDir)) {
    console.log(`[${season}] No raw directory — skipping`)
    continue
  }

  const files = fs.readdirSync(rawDir).filter(f => f.endsWith('.json'))
  console.log(`[${season}] Processing ${files.length} teams…`)

  for (const file of files) {
    totalFiles++
    const teamSlug = file.replace('.json', '')
    const rawPath  = path.join(rawDir, file)
    const normPath = path.join(normDir, file)

    try {
      const rawArray: SidearmPlayerRow[] = JSON.parse(fs.readFileSync(rawPath, 'utf-8'))

      // Check if this file has the sidearm-0 collision
      const players = rawArray
        .filter(r => r.uniform !== 'TM' && r.name && r.name !== 'TEAM')
        .map(r => normalizePlayer(r, teamSlug, season))

      const hasCollision = players.filter(p => p.playerId === 'sidearm-0').length > 1
      const wasBad = players.some(p => {
        // The old normalization would have produced sidearm-0 for any row with sdrm_id="0"
        const row = rawArray.find(r => parseSidearmName(r.name) === p.playerName)
        return row?.sdrm_id === '0'
      })

      if (!wasBad && !hasCollision) {
        already_ok++
        continue
      }

      const frozen   = season < 2026
      const entry    = {
        data:      players,
        fetchedAt: new Date().toISOString(),
        frozen,
      }

      if (DRY_RUN) {
        console.log(`  [DRY] Would fix ${season}/${teamSlug} — ${players.length} players, ${players.filter(p => !p.playerId.startsWith('sidearm-name')).length} with proper sdrm_id`)
      } else {
        fs.mkdirSync(normDir, { recursive: true })
        fs.writeFileSync(normPath, JSON.stringify(entry, null, 2))
        fixed++
      }
    } catch (err) {
      console.error(`  [ERR] ${season}/${teamSlug}: ${err}`)
      errors++
    }
  }
}

console.log(`\nDone.${DRY_RUN ? ' (dry run)' : ''}`)
console.log(`  Total files scanned: ${totalFiles}`)
console.log(`  Fixed (regenerated): ${fixed}`)
console.log(`  Already OK (skipped): ${already_ok}`)
console.log(`  Errors: ${errors}`)
