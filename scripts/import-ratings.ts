/**
 * import-ratings.ts
 *
 * Imports D1 CBBD adjusted efficiency ratings into the RatingsEntry table.
 * All available seasons are imported (2021–2026).
 *
 * Each ratings file is a CacheEntry<RatingsSeasonData> with the shape:
 *   { data: { season, fetchedAt, source, entries: RatingsEntry[] }, ... }
 *
 * Default years: 2021 through 2026 (all available).
 * Override: --year 2025 2026
 *
 * Behavior:
 *   - Reads one JSON file per year from data/cache/d1/cbbd/ratings/
 *   - Upserts records on (teamId, year) — safe to rerun
 *   - Skips entries whose teamSlug is not found in the Team table (logs warning)
 *   - Writes an ImportLog entry per year when complete
 *
 * Usage:
 *   source .env.local && npx tsx scripts/import-ratings.ts
 *   source .env.local && npx tsx scripts/import-ratings.ts --year 2025 2026
 *   DATABASE_URL="<url>" npx tsx scripts/import-ratings.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import * as fs from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_YEARS  = [2021, 2022, 2023, 2024, 2025, 2026]
const RATINGS_DIR    = path.resolve(process.cwd(), 'data/cache/d1/cbbd/ratings')

const argYears = process.argv
  .filter(a => /^\d{4}$/.test(a))
  .map(Number)
  .filter(y => y >= 2021 && y <= 2030)

const YEARS = argYears.length > 0 ? argYears : DEFAULT_YEARS

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawRatingsEntry {
  teamSlug:   string
  season:     number
  rank:       number | null
  rating:     number | null
  offRating:  number | null
  defRating:  number | null
  conference: string
  source:     string
}

interface RatingsSeasonData {
  season:    number
  fetchedAt: string
  source:    string
  entries:   RawRatingsEntry[]
}

interface CacheEntry<T> {
  data: T
  fetchedAt: string
  frozen:    boolean
}

// ─── Per-year import ──────────────────────────────────────────────────────────

interface YearResult {
  year:         number
  recordsFound: number
  upserted:     number
  skipped:      number
  errors:       number
  skippedSlugs: string[]
  errorDetails: string[]
}

async function importYear(year: number, knownTeamIds: Set<string>): Promise<YearResult> {
  const filePath = path.join(RATINGS_DIR, `${year}.json`)
  const result: YearResult = {
    year, recordsFound: 0, upserted: 0,
    skipped: 0, errors: 0, skippedSlugs: [], errorDetails: [],
  }

  if (!fs.existsSync(filePath)) {
    console.log(`  [${year}] File not found — skipping`)
    return result
  }

  let entries: RawRatingsEntry[]
  try {
    const raw   = fs.readFileSync(filePath, 'utf-8')
    const outer = JSON.parse(raw) as CacheEntry<RatingsSeasonData>
    entries = outer.data?.entries ?? []
  } catch (err) {
    result.errors++
    result.errorDetails.push(`parse error: ${String(err)}`)
    return result
  }

  result.recordsFound = entries.length

  for (const e of entries) {
    // FK guard: skip if teamSlug not in the Team table
    if (!knownTeamIds.has(e.teamSlug)) {
      result.skipped++
      if (!result.skippedSlugs.includes(e.teamSlug)) {
        result.skippedSlugs.push(e.teamSlug)
      }
      continue
    }

    try {
      await prisma.ratingsEntry.upsert({
        where:  { teamId_year: { teamId: e.teamSlug, year } },
        create: {
          teamId:     e.teamSlug,
          year,
          rank:       e.rank       ?? null,
          rating:     e.rating     ?? null,
          offRating:  e.offRating  ?? null,
          defRating:  e.defRating  ?? null,
          conference: e.conference,
          source:     e.source,
        },
        update: {
          rank:       e.rank       ?? null,
          rating:     e.rating     ?? null,
          offRating:  e.offRating  ?? null,
          defRating:  e.defRating  ?? null,
          conference: e.conference,
          source:     e.source,
        },
      })
      result.upserted++
    } catch (err) {
      result.errors++
      result.errorDetails.push(`upsert error ${e.teamSlug}: ${String(err)}`)
    }
  }

  return result
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Import D1 Ratings ────────────────────────────────────────')
  console.log(`Years: ${YEARS.join(', ')}`)
  console.log()

  const teamRows     = await prisma.team.findMany({ select: { id: true } })
  const knownTeamIds = new Set(teamRows.map(t => t.id))
  console.log(`Known teams in DB: ${knownTeamIds.size}`)
  console.log()

  const yearResults: YearResult[] = []

  for (const year of YEARS) {
    const result = await importYear(year, knownTeamIds)
    yearResults.push(result)

    const status = result.errors > 0 ? ' ⚠' : ''
    console.log(`[${year}]  found: ${String(result.recordsFound).padStart(3)}  upserted: ${String(result.upserted).padStart(3)}  skipped: ${result.skipped}  errors: ${result.errors}${status}`)

    if (result.skippedSlugs.length > 0) {
      console.log(`         skipped slugs: ${result.skippedSlugs.join(', ')}`)
    }
    if (result.errorDetails.length > 0) {
      result.errorDetails.slice(0, 3).forEach(e => console.log(`         ${e}`))
    }

    await prisma.importLog.create({
      data: {
        importType:   'ratings',
        year,
        division:     'D1',
        status:       result.errors === 0 ? 'ok' : 'partial',
        message:      [
          result.skipped > 0
            ? `${result.skipped} skipped (unknown: ${result.skippedSlugs.join(', ')})`
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
  const totalFound    = yearResults.reduce((s, r) => s + r.recordsFound, 0)
  const totalUpserted = yearResults.reduce((s, r) => s + r.upserted, 0)
  const totalSkipped  = yearResults.reduce((s, r) => s + r.skipped, 0)
  const totalErrors   = yearResults.reduce((s, r) => s + r.errors, 0)

  console.log()
  console.log('── Summary ──────────────────────────────────────────────────')
  console.log(`Total found:    ${totalFound}`)
  console.log(`Total upserted: ${totalUpserted}`)
  if (totalSkipped > 0) console.log(`Total skipped:  ${totalSkipped}`)
  if (totalErrors  > 0) console.log(`Total errors:   ${totalErrors}`)

  if (totalErrors === 0 && totalSkipped === 0) {
    console.log(`\n✓ Done — ${totalUpserted} ratings entries in database.`)
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
