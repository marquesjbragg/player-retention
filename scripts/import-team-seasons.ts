/**
 * import-team-seasons.ts
 *
 * Imports D1 and D2 team seasons from the local cache into the TeamSeason table.
 *
 * Default: D1, years 2025 and 2026.
 * Override division: --division D2
 * Override years:    --year 2024 2025 2026
 *
 * D2 notes:
 *   - Cache root: data/cache/d2/sidearm/team-seasons/
 *   - Folder naming is off by one (folder 2026 contains seasonYear 2025 data).
 *     All D2 folders are scanned; data.seasonYear is used as the DB year.
 *   - 7 fields are structurally unavailable from Sidearm and stored as 0 in
 *     cache. These are coerced to null on import:
 *     oppPpg, threePct, ftPct, apg, spg, bpg, oppTopg
 *   - Latest available D2 team season is 2025 (2024-25 season). Year 2026 will
 *     produce 0 records until Sidearm data for the 2025-26 season is collected.
 *
 * Behavior:
 *   - Reads each CacheEntry<TeamSeason> JSON file and unwraps .data
 *   - Upserts records on (teamId, year) — safe to rerun
 *   - Skips records whose teamId is not found in the Team table (logs warning)
 *   - Writes an ImportLog entry per year when complete
 *
 * Usage:
 *   source .env.local && npx tsx scripts/import-team-seasons.ts
 *   source .env.local && npx tsx scripts/import-team-seasons.ts --division D2
 *   source .env.local && npx tsx scripts/import-team-seasons.ts --division D2 --year 2025
 *   DATABASE_URL="<url>" npx tsx scripts/import-team-seasons.ts --division D2
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import * as fs from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_YEARS  = [2025, 2026]
const BATCH_SIZE     = 100
const D1_CACHE_ROOT  = path.resolve(process.cwd(), 'data/cache/d1/cbbd/team-seasons')
const D2_CACHE_ROOT  = path.resolve(process.cwd(), 'data/cache/d2/sidearm/team-seasons')

// D2 team seasons have 7 fields that Sidearm does not provide.
// They arrive as structural zeros in the cache and must be stored as null.
const D2_NULL_FIELDS = new Set([
  'oppPpg', 'threePct', 'ftPct', 'apg', 'spg', 'bpg', 'oppTopg',
])

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

interface RawTeamSeason {
  teamId:      string   // = team slug in V2
  seasonYear:  number
  division:    string
  conference:  string
  wins:        number
  losses:      number
  ppg:         number
  oppPpg:      number
  fgPct:       number
  threePct:    number
  ftPct:       number
  oppFgPct:    number
  oppThreePct: number
  apg:         number
  topg:        number
  spg:         number
  bpg:         number
  orbpg:       number
  drbpg:       number
  oppTopg:     number
  source:      string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mapToRecord(ts: RawTeamSeason, year: number, division: 'D1' | 'D2') {
  // D2: coerce structural-zero fields to null. These 7 fields are always 0 in
  // the Sidearm cache because the provider doesn't supply them. Storing 0 would
  // be misleading (a team can genuinely score 0 oppPpg is impossible).
  const nullIfD2Zero = (val: number | undefined, key: string): number | null => {
    if (val == null) return null
    if (division === 'D2' && D2_NULL_FIELDS.has(key) && val === 0) return null
    return val
  }

  return {
    teamId:      ts.teamId,
    year,
    division,
    conference:  ts.conference,
    wins:        ts.wins,
    losses:      ts.losses,
    source:      ts.source,
    ppg:         ts.ppg         ?? null,
    oppPpg:      nullIfD2Zero(ts.oppPpg,      'oppPpg'),
    fgPct:       ts.fgPct       ?? null,
    threePct:    nullIfD2Zero(ts.threePct,    'threePct'),
    ftPct:       nullIfD2Zero(ts.ftPct,       'ftPct'),
    oppFgPct:    ts.oppFgPct    ?? null,
    oppThreePct: ts.oppThreePct ?? null,
    apg:         nullIfD2Zero(ts.apg,         'apg'),
    topg:        ts.topg        ?? null,
    spg:         nullIfD2Zero(ts.spg,         'spg'),
    bpg:         nullIfD2Zero(ts.bpg,         'bpg'),
    orbpg:       ts.orbpg       ?? null,
    drbpg:       ts.drbpg       ?? null,
    oppTopg:     nullIfD2Zero(ts.oppTopg,     'oppTopg'),
  }
}

async function upsertBatch(records: ReturnType<typeof mapToRecord>[]) {
  await prisma.$transaction(
    records.map(r =>
      prisma.teamSeason.upsert({
        where: { teamId_year: { teamId: r.teamId, year: r.year } },
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
  skippedTeams: string[]
  errorDetails: string[]
}

// D1: scan folder matching the year.
async function importD1Year(year: number, knownTeamIds: Set<string>): Promise<YearResult> {
  const cacheDir = path.join(D1_CACHE_ROOT, String(year))
  const result: YearResult = {
    year, filesScanned: 0, recordsFound: 0, upserted: 0,
    skipped: 0, errors: 0, skippedTeams: [], errorDetails: [],
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
    let ts: RawTeamSeason
    try {
      const raw   = fs.readFileSync(filePath, 'utf-8')
      const entry = JSON.parse(raw) as CacheEntry<RawTeamSeason>
      ts = entry.data
      if (!ts || !ts.teamId) {
        result.skipped++
        result.errorDetails.push(`empty data in ${file}`)
        continue
      }
    } catch (err) {
      result.errors++
      result.errorDetails.push(`parse error ${file}: ${String(err)}`)
      continue
    }
    result.recordsFound++
    if (!knownTeamIds.has(ts.teamId)) {
      result.skipped++
      if (!result.skippedTeams.includes(ts.teamId)) result.skippedTeams.push(ts.teamId)
      continue
    }
    validRecords.push(mapToRecord(ts, year, 'D1'))
  }

  await runBatchUpsert(validRecords, year, result)
  return result
}

// D2: scan ALL available folders; use data.seasonYear as the DB year.
// Only imports records whose seasonYear is in targetYears.
// D2 folder naming is off by one vs D1 — folder 2026 contains seasonYear 2025.
async function importD2Years(targetYears: number[], knownTeamIds: Set<string>): Promise<YearResult[]> {
  const resultMap = new Map<number, YearResult>()
  for (const y of targetYears) {
    resultMap.set(y, {
      year: y, filesScanned: 0, recordsFound: 0, upserted: 0,
      skipped: 0, errors: 0, skippedTeams: [], errorDetails: [],
    })
  }

  const yearSet = new Set(targetYears)

  if (!fs.existsSync(D2_CACHE_ROOT)) {
    console.log(`D2 cache root not found: ${D2_CACHE_ROOT}`)
    return Array.from(resultMap.values())
  }

  const folderYears = fs.readdirSync(D2_CACHE_ROOT)
    .filter(d => /^\d{4}$/.test(d) && fs.statSync(path.join(D2_CACHE_ROOT, d)).isDirectory())
    .map(Number)
    .sort()

  const recordsByYear = new Map<number, ReturnType<typeof mapToRecord>[]>()
  for (const y of targetYears) recordsByYear.set(y, [])

  let totalFilesScanned = 0

  for (const folderYear of folderYears) {
    const cacheDir = path.join(D2_CACHE_ROOT, String(folderYear))
    const files = fs.readdirSync(cacheDir).filter(f => f.endsWith('.json'))
    totalFilesScanned += files.length

    for (const file of files) {
      const filePath = path.join(cacheDir, file)
      let ts: RawTeamSeason
      try {
        const raw   = fs.readFileSync(filePath, 'utf-8')
        const entry = JSON.parse(raw) as CacheEntry<RawTeamSeason>
        ts = entry.data
        if (!ts || !ts.teamId) continue
      } catch (err) {
        const firstY = targetYears[0]
        if (firstY) {
          const r = resultMap.get(firstY)!
          r.errors++
          r.errorDetails.push(`parse error ${folderYear}/${file}: ${String(err)}`)
        }
        continue
      }

      const dbYear = ts.seasonYear
      if (!yearSet.has(dbYear)) continue   // not a requested year

      const yr = resultMap.get(dbYear)!
      yr.recordsFound++

      if (!knownTeamIds.has(ts.teamId)) {
        yr.skipped++
        if (!yr.skippedTeams.includes(ts.teamId)) yr.skippedTeams.push(ts.teamId)
        continue
      }

      recordsByYear.get(dbYear)!.push(mapToRecord(ts, dbYear, 'D2'))
    }
  }

  for (const y of targetYears) resultMap.get(y)!.filesScanned = totalFilesScanned

  for (const y of targetYears) {
    const records = recordsByYear.get(y)!
    const result  = resultMap.get(y)!
    await runBatchUpsert(records, y, result)
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
            `upsert error ${record.teamId} ${year}: ${String(innerErr)}`
          )
        }
      }
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n── Import ${DIVISION} Team Seasons ───────────────────────────────────`)
  console.log(`Division:   ${DIVISION}`)
  console.log(`Years:      ${YEARS.join(', ')}`)
  console.log(`Batch size: ${BATCH_SIZE}`)
  console.log()

  const teamRows     = await prisma.team.findMany({ select: { id: true } })
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
  const totalErrors   = yearResults.reduce((s, r) => s + r.errors, 0)
  const totalSkipped  = yearResults.reduce((s, r) => s + r.skipped, 0)

  console.log('── Summary ──────────────────────────────────────────────────')
  console.log(`Total records found:  ${totalRecords}`)
  console.log(`Total upserted:       ${totalUpserted}`)
  if (totalSkipped > 0) console.log(`Total skipped:        ${totalSkipped}`)
  if (totalErrors  > 0) console.log(`Total errors:         ${totalErrors}`)

  if (totalErrors === 0 && totalSkipped === 0) {
    console.log(`\n✓ Done — ${totalUpserted} ${DIVISION} team seasons in database.`)
  } else if (totalErrors === 0) {
    console.log(`\n✓ Done with warnings — ${totalUpserted} imported, ${totalSkipped} skipped.`)
  } else {
    console.log(`\n⚠ Done with errors — ${totalUpserted} imported, ${totalErrors} errors.`)
    process.exit(1)
  }
}

function printYearResult(result: YearResult, division: string) {
  console.log(`[${division}/${result.year}] Files scanned:  ${result.filesScanned}`)
  console.log(`[${division}/${result.year}] Records found:  ${result.recordsFound}`)
  console.log(`[${division}/${result.year}] Upserted:       ${result.upserted}`)
  if (result.skipped > 0) {
    console.log(`[${division}/${result.year}] Skipped:        ${result.skipped} (teams: ${result.skippedTeams.join(', ')})`)
  }
  if (result.errors > 0) {
    console.log(`[${division}/${result.year}] Errors:         ${result.errors}`)
    result.errorDetails.slice(0, 5).forEach(e => console.log(`         ${e}`))
  }
  console.log()
}

async function writeImportLog(result: YearResult, division: string) {
  await prisma.importLog.create({
    data: {
      importType:   'team-seasons',
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
