/**
 * import-player-seasons.ts
 *
 * Imports D1 and D2 player seasons from the local cache into the PlayerSeason table.
 *
 * Default: D1, years 2025 and 2026.
 * Override division: --division D2
 * Override years:    --year 2024 2025 2026
 *
 * Behavior:
 *   - Reads each CacheEntry<PlayerSeason[]> JSON file and unwraps .data
 *   - Upserts records on (playerId, teamId, year) — safe to rerun
 *   - Skips records whose teamId is not found in the Team table (logs warning)
 *   - D1: preserves all T-Rank enrichment fields if present
 *   - D2: uses p.seasonYear as the DB year (D2 folder naming is off by one for
 *         some years); only imports records whose seasonYear is in YEARS
 *   - Writes an ImportLog entry per year when complete
 *
 * Usage:
 *   source .env.local && npx tsx scripts/import-player-seasons.ts
 *   source .env.local && npx tsx scripts/import-player-seasons.ts --division D2
 *   source .env.local && npx tsx scripts/import-player-seasons.ts --division D2 --year 2025 2026
 *   DATABASE_URL="<url>" npx tsx scripts/import-player-seasons.ts --division D2
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
const D2_CACHE_ROOT = path.resolve(process.cwd(), 'data/cache/d2/sidearm/players')

// --division D1|D2 (case-insensitive, default D1)
const divisionArg = (() => {
  const idx = process.argv.indexOf('--division')
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1].toUpperCase()
  }
  return 'D1'
})()
const DIVISION: 'D1' | 'D2' = divisionArg === 'D2' ? 'D2' : 'D1'

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
  // T-Rank enrichment (D1 only — optional, only present if enrich-players-trank.ts was run)
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
  // D2-only fields (ignored by D1 import)
  eligibilityYear?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapToRecord(p: RawPlayerSeason, year: number, division: 'D1' | 'D2') {
  return {
    playerId:          p.playerId,
    playerName:        p.playerName,
    teamId:            p.teamId,
    year,
    division,
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
    // T-Rank enrichment — D1 only; always null for D2
    tRankPid:          division === 'D1' ? (p.tRankPid          ?? null) : null,
    tRankPositionRole: division === 'D1' ? (p.tRankPositionRole ?? null) : null,
    tRankYr:           division === 'D1' ? (p.tRankYr           ?? null) : null,
    tRankHt:           division === 'D1' ? (p.tRankHt           ?? null) : null,
    tRankUsg:          division === 'D1' ? (p.tRankUsg          ?? null) : null,
    tRankOrtg:         division === 'D1' ? (p.tRankOrtg         ?? null) : null,
    tRankDrtg:         division === 'D1' ? (p.tRankDrtg         ?? null) : null,
    tRankBpm:          division === 'D1' ? (p.tRankBpm          ?? null) : null,
    tRankObpm:         division === 'D1' ? (p.tRankObpm         ?? null) : null,
    tRankDbpm:         division === 'D1' ? (p.tRankDbpm         ?? null) : null,
    eligibilityYear:   division === 'D2' ? (p.eligibilityYear   ?? null) : null,
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

// D1: scan the folder matching the year (same as before).
async function importD1Year(year: number, knownTeamIds: Set<string>): Promise<YearResult> {
  const cacheDir = path.join(D1_CACHE_ROOT, String(year))
  const result: YearResult = {
    year, filesScanned: 0, recordsFound: 0, upserted: 0,
    skipped: 0, errors: 0, tRankCount: 0, skippedTeams: [], errorDetails: [],
  }

  if (!fs.existsSync(cacheDir)) {
    console.log(`  [D1/${year}] Cache directory not found: ${cacheDir}`)
    return result
  }

  const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'))
  result.filesScanned = files.length

  const validRecords: ReturnType<typeof mapToRecord>[] = []

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
      if (!knownTeamIds.has(p.teamId)) {
        result.skipped++
        if (!result.skippedTeams.includes(p.teamId)) result.skippedTeams.push(p.teamId)
        continue
      }
      if (p.tRankPid != null) result.tRankCount++
      validRecords.push(mapToRecord(p, year, 'D1'))
    }
  }

  await runBatchUpsert(validRecords, year, result)
  process.stdout.write('\n')
  return result
}

// D2: scan ALL available folders; use p.seasonYear as the DB year.
// Only imports records where p.seasonYear is in targetYears.
// This handles the off-by-one folder naming in the D2 sidearm cache.
async function importD2Years(targetYears: number[], knownTeamIds: Set<string>): Promise<YearResult[]> {
  const resultMap = new Map<number, YearResult>()
  for (const y of targetYears) {
    resultMap.set(y, {
      year: y, filesScanned: 0, recordsFound: 0, upserted: 0,
      skipped: 0, errors: 0, tRankCount: 0, skippedTeams: [], errorDetails: [],
    })
  }

  const yearSet = new Set(targetYears)

  // Gather all folder years present in the D2 cache root
  if (!fs.existsSync(D2_CACHE_ROOT)) {
    console.log(`D2 cache root not found: ${D2_CACHE_ROOT}`)
    return Array.from(resultMap.values())
  }

  const folderYears = fs.readdirSync(D2_CACHE_ROOT)
    .filter(d => /^\d{4}$/.test(d) && fs.statSync(path.join(D2_CACHE_ROOT, d)).isDirectory())
    .map(Number)
    .sort()

  // Per-year accumulator for valid records
  const recordsByYear = new Map<number, ReturnType<typeof mapToRecord>[]>()
  for (const y of targetYears) recordsByYear.set(y, [])

  let totalFilesScanned = 0

  for (const folderYear of folderYears) {
    const cacheDir = path.join(D2_CACHE_ROOT, String(folderYear))
    const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'))
    totalFilesScanned += files.length

    for (const file of files) {
      const filePath = path.join(cacheDir, file)
      let players: RawPlayerSeason[]
      try {
        const raw = fs.readFileSync(filePath, 'utf-8')
        const entry = JSON.parse(raw) as CacheEntry<RawPlayerSeason[]>
        players = entry.data ?? []
      } catch (err) {
        // Attribute parse errors to the earliest target year for logging
        const firstY = targetYears[0]
        if (firstY) {
          const r = resultMap.get(firstY)!
          r.errors++
          r.errorDetails.push(`parse error ${folderYear}/${file}: ${String(err)}`)
        }
        continue
      }

      for (const p of players) {
        const dbYear = p.seasonYear
        if (!yearSet.has(dbYear)) continue   // not a requested year

        const yr = resultMap.get(dbYear)!
        yr.recordsFound++

        if (!knownTeamIds.has(p.teamId)) {
          yr.skipped++
          if (!yr.skippedTeams.includes(p.teamId)) yr.skippedTeams.push(p.teamId)
          continue
        }

        recordsByYear.get(dbYear)!.push(mapToRecord(p, dbYear, 'D2'))
      }
    }
  }

  // Distribute filesScanned across all years (cosmetic — one scan for all years)
  for (const y of targetYears) resultMap.get(y)!.filesScanned = totalFilesScanned

  // Batch upsert per year
  for (const y of targetYears) {
    const records = recordsByYear.get(y)!
    const result  = resultMap.get(y)!
    await runBatchUpsert(records, y, result)
    process.stdout.write('\n')
  }

  return targetYears.map(y => resultMap.get(y)!)
}

// ─── Shared batch upsert helper ───────────────────────────────────────────────

async function runBatchUpsert(
  validRecords: ReturnType<typeof mapToRecord>[],
  year: number,
  result: YearResult,
) {
  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const batch = validRecords.slice(i, i + BATCH_SIZE)
    try {
      await upsertBatch(batch)
      result.upserted += batch.length
    } catch (err) {
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

    if ((i + BATCH_SIZE) % 1000 < BATCH_SIZE) {
      const done = Math.min(i + BATCH_SIZE, validRecords.length)
      process.stdout.write(`  [${year}] ${done}/${validRecords.length} records...\r`)
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── Import ${DIVISION} Player Seasons ─────────────────────────────────`)
  console.log(`Division:   ${DIVISION}`)
  console.log(`Years:      ${YEARS.join(', ')}`)
  console.log(`Batch size: ${BATCH_SIZE}`)
  console.log()

  const teamRows    = await prisma.team.findMany({ select: { id: true } })
  const knownTeamIds = new Set(teamRows.map(t => t.id))
  console.log(`Known teams in DB: ${knownTeamIds.size}`)
  console.log()

  let yearResults: YearResult[]

  if (DIVISION === 'D1') {
    yearResults = []
    for (const year of YEARS) {
      console.log(`[${year}] Starting...`)
      const result = await importD1Year(year, knownTeamIds)
      yearResults.push(result)
      printYearResult(result, 'D1')
      await writeImportLog(result, 'D1')
    }
  } else {
    console.log(`Scanning all D2 cache folders for years: ${YEARS.join(', ')}`)
    console.log()
    yearResults = await importD2Years(YEARS, knownTeamIds)
    for (const result of yearResults) {
      printYearResult(result, 'D2')
      await writeImportLog(result, 'D2')
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalUpserted = yearResults.reduce((s, r) => s + r.upserted, 0)
  const totalRecords  = yearResults.reduce((s, r) => s + r.recordsFound, 0)
  const totalTRank    = yearResults.reduce((s, r) => s + r.tRankCount, 0)
  const totalErrors   = yearResults.reduce((s, r) => s + r.errors, 0)
  const totalSkipped  = yearResults.reduce((s, r) => s + r.skipped, 0)

  console.log('── Summary ──────────────────────────────────────────────────')
  console.log(`Total records found:  ${totalRecords}`)
  console.log(`Total upserted:       ${totalUpserted}`)
  if (DIVISION === 'D1' && totalRecords > 0) {
    console.log(`T-Rank enriched:      ${totalTRank} (${Math.round(totalTRank / totalRecords * 100)}%)`)
  }
  if (totalSkipped > 0) console.log(`Total skipped:        ${totalSkipped}`)
  if (totalErrors  > 0) console.log(`Total errors:         ${totalErrors}`)

  if (totalErrors === 0 && totalSkipped === 0) {
    console.log(`\n✓ Done — ${totalUpserted} ${DIVISION} player seasons in database.`)
  } else if (totalErrors === 0) {
    console.log(`\n✓ Done with warnings — ${totalUpserted} imported, ${totalSkipped} skipped.`)
  } else {
    console.log(`\n⚠ Done with errors — ${totalUpserted} imported, ${totalErrors} errors.`)
    process.exit(1)
  }
}

function printYearResult(result: YearResult, division: string) {
  console.log(`[${division}/${result.year}] Files scanned:    ${result.filesScanned}`)
  console.log(`[${division}/${result.year}] Records found:    ${result.recordsFound}`)
  console.log(`[${division}/${result.year}] Upserted:         ${result.upserted}`)
  if (division === 'D1' && result.tRankCount > 0) {
    console.log(`[${division}/${result.year}] T-Rank enriched:  ${result.tRankCount} / ${result.recordsFound}`)
  }
  if (result.skipped > 0) {
    console.log(`[${division}/${result.year}] Skipped (no FK):  ${result.skipped} (teams: ${result.skippedTeams.join(', ')})`)
  }
  if (result.errors > 0) {
    console.log(`[${division}/${result.year}] Errors:           ${result.errors}`)
    result.errorDetails.slice(0, 5).forEach(e => console.log(`           ${e}`))
  }
  console.log()
}

async function writeImportLog(result: YearResult, division: string) {
  await prisma.importLog.create({
    data: {
      importType:   'player-seasons',
      year:         result.year,
      division,
      status:       result.errors === 0 ? 'ok' : 'partial',
      message:      [
        result.skipped > 0
          ? `${result.skipped} skipped (unknown teams: ${result.skippedTeams.join(', ')})`
          : null,
        result.errorDetails.length > 0
          ? result.errorDetails.slice(0, 3).join(' | ')
          : null,
      ].filter(Boolean).join(' — ') || null,
      rowsAffected: result.upserted,
    },
  })
}

main()
  .catch(err => {
    console.error('\nFatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
