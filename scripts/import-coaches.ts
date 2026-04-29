/**
 * Import D1 head coach data from data/coaches/d1/d1-coaches-{year}.csv into the Coach table.
 *
 * Matching strategy (mirrors coachProvider.ts):
 *   1. Direct lookup: CSV school name (lowercased) against team displayName / cbbdName (lowercased).
 *   2. Alias table: known mismatches where CSV school name differs from any registry field.
 *   3. Suppress: non-D1 schools that appear in the CSV (e.g. DII transitional programs).
 *
 * Idempotent: uses upsert on (teamId, year). Safe to rerun.
 */

import * as fs   from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const COACHES_DIR = path.resolve(process.cwd(), 'data', 'coaches', 'd1')

// CSV school name → canonical team slug.
// Required when the CSV school name does not match any team's displayName or cbbdName.
const ALIASES: Record<string, string> = {
  'Albany':                  'ualbany',
  'American':                'american-university',
  'Appalachian State':       'app-state',
  'College of Charleston':   'charleston',
  'FIU':                     'florida-international',
  'Grambling State':         'grambling',
  'Hawaii':                  'hawaii',
  'IU Indy':                 'iu-indianapolis',
  'LIU':                     'long-island-university',
  'Louisiana-Monroe':        'ul-monroe',
  'Miami (FL)':              'miami',
  'Nicholls State':          'nicholls',
  'Penn':                    'pennsylvania',
  'Queens':                  'queens-university',
  'Saint Francis (PA)':      'st-francis-pa',
  'San Jose State':          'san-jos-state',
  'Seattle':                 'seattle-u',
  'Southeastern Louisiana':  'se-louisiana',
  'St. Thomas':              'st-thomas-minnesota',
  'UMass':                   'massachusetts',
  'UTRGV':                   'ut-rio-grande-valley',
}

// CSV school names that are not D1 programs and should be silently skipped.
const SUPPRESS = new Set([
  'New Haven',    // DII transitional — not in D1 registry
  'West Florida', // D2 team — not a D1 program
])

async function main() {
  const prisma = new PrismaClient()

  // Build lookup: lowercased displayName / cbbdName → slug (same as coachProvider.ts)
  const d1Teams = await prisma.team.findMany({
    where:  { division: 'D1' },
    select: { id: true, displayName: true, cbbdName: true },
  })
  const nameToSlug = new Map<string, string>()
  for (const t of d1Teams) {
    nameToSlug.set(t.displayName.toLowerCase(), t.id)
    if (t.cbbdName) nameToSlug.set(t.cbbdName.toLowerCase(), t.id)
  }

  // Discover CSV files
  const files = fs.readdirSync(COACHES_DIR)
    .filter(f => /^d1-coaches-\d{4}\.csv$/.test(f))
    .sort()

  if (files.length === 0) {
    console.log('No CSV files found in', COACHES_DIR)
    await prisma.$disconnect()
    return
  }

  console.log(`Found ${files.length} CSV file(s): ${files.join(', ')}\n`)

  let totalUpserted = 0
  let totalSuppressed = 0
  let totalUnmatched = 0

  for (const file of files) {
    const seasonMatch = file.match(/(\d{4})/)
    if (!seasonMatch) continue
    const season = parseInt(seasonMatch[1], 10)
    const filePath = path.join(COACHES_DIR, file)
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim())

    let upserted = 0
    let suppressed = 0
    const unmatched: string[] = []

    for (const line of lines.slice(1)) { // skip header row
      const comma = line.indexOf(',')
      if (comma === -1) continue
      const school    = line.slice(0, comma).trim()
      const coachName = line.slice(comma + 1).trim()
      if (!school || !coachName) continue

      // Suppress known non-D1 entries
      if (SUPPRESS.has(school)) {
        suppressed++
        continue
      }

      // Resolve slug: alias table first, then direct name lookup
      const slug =
        ALIASES[school] ??
        nameToSlug.get(school.toLowerCase()) ??
        null

      if (!slug) {
        unmatched.push(school)
        continue
      }

      await prisma.coach.upsert({
        where:  { teamId_year: { teamId: slug, year: season } },
        update: { name: coachName },
        create: { teamId: slug, year: season, name: coachName, division: 'D1' },
      })
      upserted++
    }

    console.log(`${file} (season ${season}):`)
    console.log(`  upserted: ${upserted}`)
    if (suppressed > 0) console.log(`  suppressed (non-D1): ${suppressed} — ${[...SUPPRESS].filter(s => {
      const l = fs.readFileSync(filePath, 'utf-8')
      return l.includes(s + ',')
    }).join(', ')}`)
    if (unmatched.length > 0) {
      console.log(`  UNMATCHED (${unmatched.length}): ${unmatched.join(', ')}`)
    }

    totalUpserted   += upserted
    totalSuppressed += suppressed
    totalUnmatched  += unmatched.length
  }

  console.log(`\n✓ Done — ${totalUpserted} coach records upserted across ${files.length} season(s)`)
  if (totalSuppressed > 0) console.log(`  ${totalSuppressed} suppressed (non-D1)`)
  if (totalUnmatched  > 0) console.log(`  ${totalUnmatched} unmatched (review needed)`)

  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
