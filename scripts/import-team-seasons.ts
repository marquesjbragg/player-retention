/**
 * import-team-seasons.ts
 *
 * Imports D1 team seasons from the local cache into the TeamSeason table.
 * Currently scoped to D1 only (data/cache/d1/cbbd/team-seasons/).
 * D2 will be added in a future pass (D2 has 7 structurally unavailable fields
 * that must be coerced from 0 to null on import — handled separately).
 *
 * Default years: 2025 and 2026.
 * Override: --year 2024 2025 2026
 *
 * Behavior:
 *   - Reads each CacheEntry<TeamSeason> JSON file and unwraps .data
 *   - Upserts records on (teamId, year) — safe to rerun
 *   - Skips records whose teamId is not found in the Team table (logs warning)
 *   - Writes an ImportLog entry per year when complete
 *
 * Usage:
 *   source .env.local && npx tsx scripts/import-team-seasons.ts
 *   source .env.local && npx tsx scripts/import-team-seasons.ts --year 2026
 *   DATABASE_URL="<url>" npx tsx scripts/import-team-seasons.ts
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

function mapToRecord(ts: RawTeamSeason, year: number) {
  return {
    teamId:      ts.teamId,
    year,
    division:    ts.division,
    conference:  ts.conference,
    wins:        ts.wins,
    losses:      ts.losses,
    source:      ts.source,
    // Per-game stats — all present and non-null for D1.
    // D2 import will coerce structural-zero fields to null here; D1 uses values as-is.
    ppg:         ts.ppg         ?? null,
    oppPpg:      ts.oppPpg      ?? null,
    fgPct:       ts.fgPct       ?? null,
    threePct:    ts.threePct    ?? null,
    ftPct:       ts.ftPct       ?? null,
    oppFgPct:    ts.oppFgPct    ?? null,
    oppThreePct: ts.oppThreePct ?? null,
    apg:         ts.apg         ?? null,
    topg:        ts.topg        ?? null,
    spg:         ts.spg         ?? null,
    bpg:         ts.bpg         ?? null,
    orbpg:       ts.orbpg       ?? null,
    drbpg:       ts.drbpg       ?? null,
    oppTopg:     ts.oppTopg     ?? null,
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

async function importYear(year: number, knownTeamIds: Set<string>): Promise<YearResult> {
  const cacheDir = path.join(D1_CACHE_ROOT, String(year))
  const result: YearResult = {
    year, filesScanned: 0, recordsFound: 0, upserted: 0,
    skipped: 0, errors: 0, skippedTeams: [], errorDetails: [],
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

    // FK guard: skip if teamId not in the Team table
    if (!knownTeamIds.has(ts.teamId)) {
      result.skipped++
      if (!result.skippedTeams.includes(ts.teamId)) {
        result.skippedTeams.push(ts.teamId)
      }
      continue
    }

    validRecords.push(mapToRecord(ts, year))
  }

  // ── Batch upsert ───────────────────────────────────────────────────────────
  for (let i = 0; i < validRecords.length; i += BATCH_SIZE) {
    const batch = validRecords.slice(i, i + BATCH_SIZE)
    try {
      await upsertBatch(batch)
      result.upserted += batch.length
    } catch (err) {
      // Retry individually to isolate the bad record
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

  return result
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Import D1 Team Seasons ───────────────────────────────────')
  console.log(`Years:      ${YEARS.join(', ')}`)
  console.log(`Batch size: ${BATCH_SIZE}`)
  console.log()

  // Load known team IDs from DB (FK guard)
  const teamRows     = await prisma.team.findMany({ select: { id: true } })
  const knownTeamIds = new Set(teamRows.map(t => t.id))
  console.log(`Known teams in DB: ${knownTeamIds.size}`)
  console.log()

  const yearResults: YearResult[] = []

  for (const year of YEARS) {
    console.log(`[${year}] Starting...`)
    const result = await importYear(year, knownTeamIds)
    yearResults.push(result)

    console.log(`[${year}] Files scanned:  ${result.filesScanned}`)
    console.log(`[${year}] Records found:  ${result.recordsFound}`)
    console.log(`[${year}] Upserted:       ${result.upserted}`)
    if (result.skipped > 0) {
      console.log(`[${year}] Skipped:        ${result.skipped} (teams: ${result.skippedTeams.join(', ')})`)
    }
    if (result.errors > 0) {
      console.log(`[${year}] Errors:         ${result.errors}`)
      result.errorDetails.slice(0, 5).forEach(e => console.log(`         ${e}`))
    }
    console.log()

    // Write ImportLog
    await prisma.importLog.create({
      data: {
        importType:   'team-seasons',
        year,
        division:     'D1',
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
    console.log(`\n✓ Done — ${totalUpserted} team seasons in database.`)
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
