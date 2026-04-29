/**
 * import-massey.ts
 *
 * Imports Massey composite ratings (D1 only) into the MasseyEntry table.
 * Currently only 2026.json exists in data/massey-d1/.
 *
 * File format: direct JSON (NOT a CacheEntry wrapper):
 *   { season, fetchedAt, source, ratings: [{ rank, teamName, conference, wins, losses, rating }] }
 *
 * Team name → slug resolution mirrors D1MasseyProvider.ts exactly:
 *   1. MASSEY_ALIASES table (direct override, including explicit non-D1 suppression)
 *   2. Normalized name match against the registry (displayName, shortName, cbbdName)
 *   3. Substring fallback for abbreviated names (both sides ≥ 5 chars)
 *
 * Idempotency: MasseyEntry has no unique constraint in the current schema, so
 * upsert is unavailable. Instead, the script deletes all MasseyEntry rows for
 * the target year before inserting fresh records. This is safe because nothing
 * FK-references MasseyEntry. Each run is a clean replacement for the year.
 *
 * If a team name cannot be resolved, teamId is stored as null and the name is
 * logged. Known non-D1 suppressions (e.g. New Haven) are excluded entirely.
 *
 * Default years: any JSON file found in data/massey-d1/.
 * Override: --year 2026
 *
 * Usage:
 *   source .env.local && npx tsx scripts/import-massey.ts
 *   source .env.local && npx tsx scripts/import-massey.ts --year 2026
 *   DATABASE_URL="<url>" npx tsx scripts/import-massey.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import * as fs from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Config ───────────────────────────────────────────────────────────────────

const MASSEY_DIR = path.resolve(process.cwd(), 'data/massey-d1')

const argYears = process.argv
  .filter(a => /^\d{4}$/.test(a))
  .map(Number)
  .filter(y => y >= 2020 && y <= 2030)

// ─── Alias table (copied from D1MasseyProvider.ts) ────────────────────────────
// Maps raw Massey team names → registry slugs.
// Empty string = known non-D1 program, skip entirely.

const MASSEY_ALIASES: Record<string, string> = {
  "St Mary's CA":      'saint-marys',
  'St Louis':          'saint-louis',
  "St Joseph's PA":    'saint-josephs',
  'Cal Baptist':       'california-baptist',
  'SF Austin':         'stephen-f-austin',
  'N Dakota St':       'north-dakota-state',
  'Hawaii':            'hawaii',
  'IL Chicago':        'uic',
  'St Thomas MN':      'st-thomas-minnesota',
  'WKU':               'western-kentucky',
  'MTSU':              'middle-tennessee',
  'ETSU':              'east-tennessee-state',
  'Loy Marymount':     'loyola-marymount',
  'CS Northridge':     'cal-state-northridge',
  'UTRGV':             'ut-rio-grande-valley',
  'Appalachian St':    'app-state',
  'Queens NC':         'queens-university',
  'TAM C. Christi':    'texas-am-corpus-christi',
  'CS Fullerton':      'cal-state-fullerton',
  'San Jose St':       'san-jos-state',
  'PFW':               'purdue-fort-wayne',
  'S Dakota St':       'south-dakota-state',
  'LIU Brooklyn':      'long-island-university',
  'W Carolina':        'western-carolina',
  'TN Martin':         'ut-martin',
  "St Peter's":        'saint-peters',
  'FGCU':              'florida-gulf-coast',
  'SIUE':              'siu-edwardsville',
  "Mt St Mary's":      'mount-st-marys',
  'FL Atlantic':       'florida-atlantic',
  'Kent':              'kent-state',
  'Penn':              'pennsylvania',
  'CS Sacramento':     'sacramento-state',
  'SC Upstate':        'south-carolina-upstate',
  'MA Lowell':         'umass-lowell',
  'NC A&T':            'north-carolina-at',
  'UT San Antonio':    'utsa',
  'CS Bakersfield':    'cal-state-bakersfield',
  'SUNY Albany':       'ualbany',
  'Loyola MD':         'loyola-maryland',
  'NC Central':        'north-carolina-central',
  'Ark Pine Bluff':    'arkansas-pine-bluff',
  'IUPUI':             'iu-indianapolis',
  'F Dickinson':       'fairleigh-dickinson',
  'S Carolina St':     'south-carolina-state',
  'MD E Shore':        'maryland-eastern-shore',
  'ULM':               'ul-monroe',
  'MS Valley St':      'mississippi-valley-state',
  'Alabama St':        'alabama-state',
  'Arizona St':        'arizona-state',
  'Arkansas St':       'arkansas-state',
  'C Michigan':        'central-michigan',
  'Cent Arkansas':     'central-arkansas',
  'Charleston So':     'charleston-southern',
  'Colorado St':       'colorado-state',
  'Connecticut':       'uconn',
  'Delaware St':       'delaware-state',
  'E Illinois':        'eastern-illinois',
  'E Kentucky':        'eastern-kentucky',
  'E Michigan':        'eastern-michigan',
  'E Washington':      'eastern-washington',
  'Florida Intl':      'florida-international',
  'Florida St':        'florida-state',
  'G Washington':      'george-washington',
  'Ga Southern':       'georgia-southern',
  'Georgia St':        'georgia-state',
  'Houston Chr':       'houston-christian',
  'Idaho St':          'idaho-state',
  'Illinois St':       'illinois-state',
  'Indiana St':        'indiana-state',
  'Jacksonville St':   'jacksonville-state',
  'Kansas St':         'kansas-state',
  'Michigan St':       'michigan-state',
  'Miami FL':          'miami',
  'Mississippi':       'ole-miss',
  'Missouri KC':       'kansas-city',
  'Missouri St':       'missouri-state',
  'Montana St':        'montana-state',
  'N Colorado':        'northern-colorado',
  'N Illinois':        'northern-illinois',
  'N Kentucky':        'northern-kentucky',
  'New Mexico St':     'new-mexico-state',
  'Northwestern LA':   'northwestern-state',
  'Oklahoma St':       'oklahoma-state',
  'Oregon St':         'oregon-state',
  'Portland St':       'portland-state',
  'S Illinois':        'southern-illinois',
  'SE Missouri St':    'southeast-missouri-state',
  'Sam Houston St':    'sam-houston',
  'San Diego St':      'san-diego-state',
  'Tennessee St':      'tennessee-state',
  'Texas St':          'texas-state',
  'TX Southern':       'texas-southern',
  'W Illinois':        'western-illinois',
  'W Michigan':        'western-michigan',
  'Washington St':     'washington-state',
  // Known non-D1 programs — excluded from import (empty string = skip)
  'New Haven':         '',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawMasseyEntry {
  rank:       number
  teamName:   string
  conference: string
  wins:       number
  losses:     number
  rating:     number
}

interface MasseyFile {
  season:    number
  fetchedAt: string
  source:    string
  ratings:   RawMasseyEntry[]
}

// ─── Name resolution ──────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function buildRegMap(
  d1Teams: Array<{ slug: string; displayName: string; shortName: string; externalIds: { cbbdName?: string | null } }>
): Map<string, string> {
  const map = new Map<string, string>()
  for (const t of d1Teams) {
    map.set(normalize(t.displayName), t.slug)
    map.set(normalize(t.shortName),   t.slug)
    if (t.externalIds.cbbdName) {
      map.set(normalize(t.externalIds.cbbdName), t.slug)
    }
  }
  return map
}

function resolveSlug(
  mname: string,
  regSlugs: Set<string>,
  regMap: Map<string, string>,
): string | null | 'SUPPRESS' {
  // 1. Alias table
  if (Object.prototype.hasOwnProperty.call(MASSEY_ALIASES, mname)) {
    const aliasSlug = MASSEY_ALIASES[mname]
    if (aliasSlug === '') return 'SUPPRESS'          // known non-D1 — skip entirely
    if (regSlugs.has(aliasSlug)) return aliasSlug
    return null                                       // alias points to unknown slug
  }

  // 2. Normalized name match
  const norm = normalize(mname)
  const direct = regMap.get(norm)
  if (direct) return direct

  // 3. Substring fallback — conservative (both sides ≥ 5 chars)
  if (norm.length >= 5) {
    for (const [regNorm, slug] of regMap) {
      if (regNorm.length >= 5 && (norm.includes(regNorm) || regNorm.includes(norm))) {
        return slug
      }
    }
  }

  return null
}

// ─── Per-year import ──────────────────────────────────────────────────────────

interface YearResult {
  year:          number
  recordsFound:  number
  inserted:      number
  resolved:      number
  unresolved:    number
  suppressed:    number
  errors:        number
  unresolvedNames: string[]
  suppressedNames: string[]
  errorDetails:  string[]
}

async function importYear(
  year: number,
  regSlugs: Set<string>,
  regMap: Map<string, string>,
): Promise<YearResult> {
  const filePath = path.join(MASSEY_DIR, `${year}.json`)
  const result: YearResult = {
    year, recordsFound: 0, inserted: 0, resolved: 0,
    unresolved: 0, suppressed: 0, errors: 0,
    unresolvedNames: [], suppressedNames: [], errorDetails: [],
  }

  if (!fs.existsSync(filePath)) {
    console.log(`  [${year}] File not found — skipping`)
    return result
  }

  let file: MasseyFile
  try {
    file = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as MasseyFile
  } catch (err) {
    result.errors++
    result.errorDetails.push(`parse error: ${String(err)}`)
    return result
  }

  result.recordsFound = file.ratings.length

  // Build records — resolve team names before touching the DB
  const records: Array<{
    teamId:     string | null
    teamName:   string
    year:       number
    rank:       number
    wins:       number
    losses:     number
    rating:     number
    conference: string
  }> = []

  for (const e of file.ratings) {
    const resolution = resolveSlug(e.teamName, regSlugs, regMap)

    if (resolution === 'SUPPRESS') {
      result.suppressed++
      result.suppressedNames.push(e.teamName)
      continue  // known non-D1 — don't store at all
    }

    if (resolution === null) {
      result.unresolved++
      result.unresolvedNames.push(e.teamName)
    } else {
      result.resolved++
    }

    records.push({
      teamId:     resolution,   // null for unresolved
      teamName:   e.teamName,
      year,
      rank:       e.rank,
      wins:       e.wins,
      losses:     e.losses,
      rating:     e.rating,
      conference: e.conference,
    })
  }

  // Idempotency: delete existing records for this year, then bulk insert.
  // MasseyEntry has no unique constraint so upsert is unavailable.
  // This is safe — nothing FK-references MasseyEntry.
  try {
    await prisma.$transaction([
      prisma.masseyEntry.deleteMany({ where: { year } }),
      prisma.masseyEntry.createMany({ data: records }),
    ])
    result.inserted = records.length
  } catch (err) {
    result.errors++
    result.errorDetails.push(`transaction error: ${String(err)}`)
  }

  return result
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Import Massey Ratings ────────────────────────────────────')

  // Discover available files
  const availableYears = fs.existsSync(MASSEY_DIR)
    ? fs.readdirSync(MASSEY_DIR)
        .filter(f => /^\d{4}\.json$/.test(f))
        .map(f => parseInt(f, 10))
        .sort()
    : []

  const yearsToImport = argYears.length > 0
    ? argYears.filter(y => availableYears.includes(y))
    : availableYears

  if (yearsToImport.length === 0) {
    console.log('No Massey files found or no matching year arguments.')
    return
  }

  console.log(`Available years: ${availableYears.join(', ')}`)
  console.log(`Importing:       ${yearsToImport.join(', ')}`)
  console.log()

  // Load D1 teams from DB for name resolution
  const dbTeams = await prisma.team.findMany({
    where:  { division: 'D1' },
    select: { id: true, displayName: true, shortName: true, cbbdName: true },
  })
  const regSlugs = new Set(dbTeams.map(t => t.id))
  const regMap   = buildRegMap(
    dbTeams.map(t => ({
      slug:        t.id,
      displayName: t.displayName,
      shortName:   t.shortName,
      externalIds: { cbbdName: t.cbbdName },
    }))
  )
  console.log(`D1 teams in DB: ${regSlugs.size}`)
  console.log()

  const yearResults: YearResult[] = []

  for (const year of yearsToImport) {
    const result = await importYear(year, regSlugs, regMap)
    yearResults.push(result)

    console.log(`[${year}] Records found:    ${result.recordsFound}`)
    console.log(`[${year}] Inserted:         ${result.inserted}`)
    console.log(`[${year}] Resolved:         ${result.resolved} / ${result.recordsFound - result.suppressed}`)
    if (result.suppressed > 0) {
      console.log(`[${year}] Suppressed:       ${result.suppressed} (non-D1: ${result.suppressedNames.join(', ')})`)
    }
    if (result.unresolved > 0) {
      console.log(`[${year}] Unresolved:       ${result.unresolved} — stored with teamId=null`)
      result.unresolvedNames.forEach(n => console.log(`           "${n}"`))
    }
    if (result.errors > 0) {
      console.log(`[${year}] Errors:           ${result.errors}`)
      result.errorDetails.slice(0, 5).forEach(e => console.log(`         ${e}`))
    }
    console.log()

    await prisma.importLog.create({
      data: {
        importType:   'massey',
        year,
        division:     'D1',
        status:       result.errors === 0 ? 'ok' : 'error',
        message:      [
          result.suppressed > 0
            ? `suppressed (non-D1): ${result.suppressedNames.join(', ')}`
            : null,
          result.unresolved > 0
            ? `unresolved (teamId=null): ${result.unresolvedNames.join(', ')}`
            : null,
          result.errorDetails.length > 0
            ? result.errorDetails.slice(0, 3).join(' | ')
            : null,
        ].filter(Boolean).join(' — ') || null,
        rowsAffected: result.inserted,
      },
    })
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  const totalInserted   = yearResults.reduce((s, r) => s + r.inserted,   0)
  const totalResolved   = yearResults.reduce((s, r) => s + r.resolved,   0)
  const totalUnresolved = yearResults.reduce((s, r) => s + r.unresolved, 0)
  const totalSuppressed = yearResults.reduce((s, r) => s + r.suppressed, 0)
  const totalErrors     = yearResults.reduce((s, r) => s + r.errors,     0)

  console.log('── Summary ──────────────────────────────────────────────────')
  console.log(`Total inserted:    ${totalInserted}`)
  console.log(`Total resolved:    ${totalResolved}  (teamId populated)`)
  console.log(`Total unresolved:  ${totalUnresolved}  (teamId=null)`)
  if (totalSuppressed > 0) {
    console.log(`Total suppressed:  ${totalSuppressed}  (known non-D1, excluded from DB)`)
  }
  if (totalErrors > 0) {
    console.log(`Total errors:      ${totalErrors}`)
  }

  if (totalErrors === 0) {
    console.log(`\n✓ Done — ${totalInserted} Massey entries in database.`)
  } else {
    console.log(`\n⚠ Done with errors.`)
    process.exit(1)
  }
}

main()
  .catch(err => {
    console.error('\nFatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
