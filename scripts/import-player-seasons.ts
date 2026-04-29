/**
 * import-player-seasons.ts
 *
 * Imports D1 player seasons from the local cache into the PlayerSeason table.
 * Currently scoped to D1 only (data/cache/d1/cbbd/players/).
 * D2 will be added in a future pass.
 *
 * Default years: 2025 and 2026 (both needed for 2026 retention comparisons).
 * Override: --year 2024 2025 2026
 *
 * Behavior:
 *   - Reads each CacheEntry<PlayerSeason[]> JSON file and unwraps .data
 *   - Upserts records on (playerId, teamId, year) — safe to rerun
 *   - Skips records whose teamId is not found in the Team table (logs warning)
 *   - Preserves all T-Rank enrichment fields if present
 *   - Writes an ImportLog entry per year when complete
 *
 * Usage:
 *   source .env.local && npx tsx scripts/import-player-seasons.ts
 *   source .env.local && npx tsx scripts/import-player-seasons.ts --year 2026
 *   DATABASE_URL="<url>" npx tsx scripts/import-player-seasons.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import * as fs from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_YEARS = [2025, 2026]
const BATCH_SIZE    = 100   // upserts per transaction
const D1_CACHE_ROOT = path.resolve(process.cwd(), 'data/cache/d1/cbbd/players')

const argYears = process.argv
  .filter(a => /^\d{4}$/.test(a))
  .map(Number)
  .filter(y => y >= 2021 && y <= 2030)

const YEARS = argYears.length > 0 ? argYears : DEFAULT_YEARS

// ─── Types ────────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T
  fetchedAt: string
  frozen: boolean
}

interface RawPlayerSeason {
  playerId:         string
  playerName:       string
  teamId:           string   // = team slug in V2
  seasonYear:       number
  source:           string
  games:            number
  gamesStarted:     number | null
  minutesPlayed:    number
  points:           number
  assists:          number
  totalRebounds:    number
  offRebounds:      number
  defRebounds:      number
  steals:           number
  blocks:           number
  turnovers:        number
  fgMade:           number
  fgAttempted:      number
  threeMade:        number
  threeAttempted:   number
  ftMade:           number
  ftAttempted:      number
  position?:        string
  // T-Rank enrichment (optional — only present if enrich-players-trank.ts was run)
  tRankPid?:           number
  tRankPositionRole?:  string
  tRankYr?:            string
  tRankHt?:            string
  tRankUsg?:           number
  tRankOrtg?:          number
  tRankDrtg?:          number
  tRankBpm?:           number
  tRankObpm?:          number
  tRankDbpm?:          number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapToRecord(p: RawPlayerSeason, year: number) {
  return {
    playerId:          p.playerId,
    playerName:        p.playerName,
    teamId:            p.teamId,
    year,
    division:          'D1',
    source:            p.source,
    games:             p.games,
    gamesStarted:      p.gamesStarted      ?? null,
    minutesPlayed:     p.minutesPlayed,
    points:            p.points,
    assists:           p.assists,
    totalRebounds:     p.totalRebounds,
    offRebounds:       p.offRebounds,
    defRebounds:       p.defRebounds,
    steals:            p.steals,
    blocks:            p.blocks,
    turnovers:         p.turnovers,
    fgMade:            p.fgMade,
    fgAttempted:       p.fgAttempted,
    threeMade:         p.threeMade,
    threeAttempted:    p.threeAttempted,
    ftMade:            p.ftMade,
    ftAttempted:       p.ftAttempted,
    position:          p.position          ?? null,
    tRankPid:          p.tRankPid          ?? null,
    tRankPositionRole: p.tRankPositionRole ?? null,
    tRankYr:           p.tRankYr           ?? null,
    tRankHt:           p.tRankHt           ?? null,
    tRankUsg:          p.tRankUsg          ?? null,
    tRankOrtg:         p.tRankOrtg         ?? null,
    tRankDrtg:         p.tRankDrtg         ?? null,
    tRankBpm:          p.tRankBpm          ?? null,
    tRankObpm:         p.tRankObpm         ?? null,
    tRankDbpm:         p.tRankDbpm         ?? null,
    eligibilityYear:   null,  // D1/CBBD does not provide eligibility year
  }
}

async function upsertBatch(records: ReturnType<typeof mapToRecord>[]) {
  await prisma.$transaction(
    records.map(r =>
      prisma.playerSeason.upsert({
        where: {
          playerId_teamId_year: {
            playerId: r.playerId,
            teamId:   r.teamId,
            year:     r.year,
          },
        },
        create: r,
        update: r,
      })
    )
  )
}

// ─── Per-year import ──────────────────────────────────────────────────────────

interface YearResult {
  year:         number
  filesScanned: number
  recordsFound: number
  upserted:     number
  skipped:      number
  errors:       number
  tRankCount:   number
  skippedTeams: string[]
  errorDetails: string[]
}

async function importYear(year: number, knownTeamIds: Set<string>): Promise<YearResult> {
  const cacheDir = path.join(D1_CACHE_ROOT, String(year))
  const result: YearResult = {
    year, filesScanned: 0, recordsFound: 0, upserted: 0,
    skipped: 0, errors: 0, tRankCount: 0, skippedTeams: [], errorDetails: [],
  }

  if (!fs.existsSync(cacheDir)) {
    console.log(`  [${year}] Cache directory not found: ${cacheDir}`)
    return result
  }

  const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'))
  result.filesScanned = files.length

  const validRecords: ReturnType<typeof mapToRecord>[] = []

  // ── Parse all files ────────────────────────────────────────────────────────
  for (const file of files) {
    const filePath = path.join(cacheDir, file)
    let players: RawPlayerSeason[]

    try {
      const raw = fs.readFileSync(filePath, 'utf-8')
      const entry = JSON.parse(raw) as CacheEntry<RawPlayerSeason[]>
      players = entry.data ?? []
    } catch (err) {
      result.errors++
      result.errorDetails.push(`parse error ${file}: ${String(err)}`)
      continue
    }

    for (const p of players) {
      result.recordsFound++

      // FK guard: skip if teamId not in the Team table
      if (!knownTeamIds.has(p.teamId)) {
        result.skipped++
        if (!result.skippedTeams.includes(p.teamId)) {
          result.skippedTeams.push(p.teamId)
        }
        continue
      }

      if (p.tRankPid != null) result.tRankCount++
      validRecords.push(mapToRecord(p, year))
    }
  }

  // ── Batch upsert ───────────────────────────────────────────────────────────
  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const batch = validRecords.slice(i, i + BATCH_SIZE)
    try {
      await upsertBatch(batch)
      result.upserted += batch.length
    } catch (err) {
      // Retry records individually to isolate the bad one
      for (const record of batch) {
        try {
          await upsertBatch([record])
          result.upserted++
        } catch (innerErr) {
          result.errors++
          result.errorDetails.push(
            `upsert error ${record.playerId} (${record.teamId}): ${String(innerErr)}`
          )
        }
      }
    }

    // Progress tick every 1000 records
    if ((i + BATCH_SIZE) % 1000 < BATCH_SIZE) {
      const done = Math.min(i + BATCH_SIZE, validRecords.length)
      process.stdout.write(`  [${year}] ${done}/${validRecords.length} records...\r`)
    }
  }

  process.stdout.write('\n')
  return result
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Import D1 Player Seasons ─────────────────────────────────')
  console.log(`Years:      ${YEARS.join(', ')}`)
  console.log(`Batch size: ${BATCH_SIZE}`)
  console.log()

  // Load known team IDs from DB (FK guard)
  const teamRows = await prisma.team.findMany({ select: { id: true } })
  const knownTeamIds = new Set(teamRows.map(t => t.id))
  console.log(`Known teams in DB: ${knownTeamIds.size}`)
  console.log()

  const yearResults: YearResult[] = []

  for (const year of YEARS) {
    console.log(`[${year}] Starting...`)
    const result = await importYear(year, knownTeamIds)
    yearResults.push(result)

    console.log(`[${year}] Files scanned:    ${result.filesScanned}`)
    console.log(`[${year}] Records found:    ${result.recordsFound}`)
    console.log(`[${year}] Upserted:         ${result.upserted}`)
    console.log(`[${year}] T-Rank enriched:  ${result.tRankCount} / ${result.recordsFound}`)
    if (result.skipped > 0) {
      console.log(`[${year}] Skipped (no FK):  ${result.skipped} (teams: ${result.skippedTeams.join(', ')})`)
    }
    if (result.errors > 0) {
      console.log(`[${year}] Errors:           ${result.errors}`)
      result.errorDetails.slice(0, 5).forEach(e => console.log(`           ${e}`))
    }
    console.log()

    // Write ImportLog
    await prisma.importLog.create({
      data: {
        importType:   'player-seasons',
        year,
        division:     'D1',
        status:       result.errors === 0 ? 'ok' : 'partial',
        message:      [
          result.skipped > 0 ? `${result.skipped} skipped (unknown teams: ${result.skippedTeams.join(', ')})` : null,
          result.errorDetails.length > 0 ? result.errorDetails.slice(0, 3).join(' | ') : null,
        ].filter(Boolean).join(' — ') || null,
        rowsAffected: result.upserted,
      },
    })
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalUpserted = yearResults.reduce((s, r) => s + r.upserted, 0)
  const totalRecords  = yearResults.reduce((s, r) => s + r.recordsFound, 0)
  const totalTRank    = yearResults.reduce((s, r) => s + r.tRankCount, 0)
  const totalErrors   = yearResults.reduce((s, r) => s + r.errors, 0)
  const totalSkipped  = yearResults.reduce((s, r) => s + r.skipped, 0)

  console.log('── Summary ──────────────────────────────────────────────────')
  console.log(`Total records found:    ${totalRecords}`)
  console.log(`Total upserted:         ${totalUpserted}`)
  console.log(`Total T-Rank enriched:  ${totalTRank} (${Math.round(totalTRank / totalRecords * 100)}%)`)
  if (totalSkipped > 0) console.log(`Total skipped:          ${totalSkipped}`)
  if (totalErrors  > 0) console.log(`Total errors:           ${totalErrors}`)

  if (totalErrors === 0 && totalSkipped === 0) {
    console.log(`\n✓ Done — ${totalUpserted} player seasons in database.`)
  } else if (totalErrors === 0) {
    console.log(`\n✓ Done with warnings — ${totalUpserted} imported, ${totalSkipped} skipped.`)
  } else {
    console.log(`\n⚠ Done with errors — ${totalUpserted} imported, ${totalErrors} errors.`)
    process.exit(1)
  }
}

main()
  .catch(err => {
    console.error('\nFatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
