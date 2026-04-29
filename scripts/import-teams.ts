/**
 * import-teams.ts
 *
 * Imports all teams from data/registry/teams.json into the database.
 * Joins logo URLs from data/registry/d1-logos.json and d2-logos.json.
 * Logo maps take precedence over the logoUrl field in teams.json.
 *
 * Safe to rerun — uses upsert on Team.id (slug).
 *
 * Usage:
 *   npx tsx scripts/import-teams.ts
 *
 * Requires DATABASE_URL to be set. Use the project .env.local:
 *   source .env.local && npx tsx scripts/import-teams.ts
 * Or inline:
 *   DATABASE_URL="<url>" npx tsx scripts/import-teams.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import * as fs from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegistryEntry {
  slug: string
  displayName: string
  shortName: string
  division: 'D1' | 'D2'
  conference: string
  externalIds: {
    cbbdTeamId?: number
    cbbdName?: string
    sidearmId?: string
    masseyName?: string
  }
  logoUrl: string | null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const teamsPath  = path.resolve(process.cwd(), 'data/registry/teams.json')
  const d1LogoPath = path.resolve(process.cwd(), 'data/registry/d1-logos.json')
  const d2LogoPath = path.resolve(process.cwd(), 'data/registry/d2-logos.json')

  if (!fs.existsSync(teamsPath)) {
    console.error(`ERROR: teams.json not found at ${teamsPath}`)
    process.exit(1)
  }

  const teams: RegistryEntry[] = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'))

  const d1Logos: Record<string, string> = fs.existsSync(d1LogoPath)
    ? JSON.parse(fs.readFileSync(d1LogoPath, 'utf-8'))
    : {}
  const d2Logos: Record<string, string> = fs.existsSync(d2LogoPath)
    ? JSON.parse(fs.readFileSync(d2LogoPath, 'utf-8'))
    : {}

  const d1Teams = teams.filter(t => t.division === 'D1')
  const d2Teams = teams.filter(t => t.division === 'D2')

  console.log('\n── Import Teams ─────────────────────────────────────────────')
  console.log(`Total teams:  ${teams.length} (D1: ${d1Teams.length}, D2: ${d2Teams.length})`)
  console.log(`D1 logo map:  ${Object.keys(d1Logos).length} entries`)
  console.log(`D2 logo map:  ${Object.keys(d2Logos).length} entries`)
  console.log()

  let upserted = 0
  let errors   = 0
  const errorDetails: string[] = []

  for (const team of teams) {
    const logoMap = team.division === 'D1' ? d1Logos : d2Logos
    // Logo map takes precedence over teams.json logoUrl (maps are more recently maintained)
    const logoUrl = logoMap[team.slug] ?? team.logoUrl ?? null

    const record = {
      id:          team.slug,
      displayName: team.displayName,
      shortName:   team.shortName,
      division:    team.division,
      conference:  team.conference,
      cbbdTeamId:  team.externalIds.cbbdTeamId  ?? null,
      cbbdName:    team.externalIds.cbbdName     ?? null,
      sidearmId:   team.externalIds.sidearmId    ?? null,
      masseyName:  team.externalIds.masseyName   ?? null,
      logoUrl,
    }

    try {
      await prisma.team.upsert({
        where:  { id: team.slug },
        create: record,
        update: record,
      })
      upserted++
    } catch (err) {
      errors++
      const msg = `${team.slug}: ${String(err)}`
      errorDetails.push(msg)
      console.error(`  ✗ ${msg}`)
    }
  }

  // ── Logo coverage audit ───────────────────────────────────────────────────

  const d1WithLogo = d1Teams.filter(t => d1Logos[t.slug]).length
  const d2WithLogo = d2Teams.filter(t => d2Logos[t.slug]).length

  console.log(`Upserted: ${upserted}  Errors: ${errors}`)
  console.log()
  console.log('Logo coverage:')
  console.log(`  D1: ${d1WithLogo}/${d1Teams.length} teams have logos`)
  console.log(`  D2: ${d2WithLogo}/${d2Teams.length} teams have logos`)

  if (d1WithLogo < d1Teams.length) {
    const missing = d1Teams.filter(t => !d1Logos[t.slug]).map(t => t.slug)
    console.log(`  D1 missing: ${missing.join(', ')}`)
  }

  // ── Write ImportLog ───────────────────────────────────────────────────────

  await prisma.importLog.create({
    data: {
      importType:   'teams',
      status:       errors === 0 ? 'ok' : errors < teams.length ? 'partial' : 'error',
      message:      errorDetails.length > 0 ? errorDetails.slice(0, 5).join(' | ') : null,
      rowsAffected: upserted,
    },
  })

  console.log()
  if (errors === 0) {
    console.log(`✓ Done — ${upserted} teams in database.`)
  } else {
    console.log(`⚠ Done with errors — ${upserted} upserted, ${errors} failed.`)
    process.exit(1)
  }
}

main()
  .catch(err => {
    console.error('\nFatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
