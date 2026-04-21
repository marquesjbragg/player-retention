/**
 * Phase 3b: Builds data/registry/teams.json from CBBD /ratings/adjusted.
 *
 * For each team in the ratings response:
 * - generates a canonical slug (filesystem/URL safe)
 * - applies manual alias overrides from data/registry/team-aliases.json
 * - checks for slug collisions (exits with error if any found)
 * - writes sorted registry to data/registry/teams.json
 *
 * Run: npx tsx scripts/build-team-registry.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

// Import slugify inline (can't use @ alias in scripts)
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(([^)]+)\)/g, ' $1 ')
    .replace(/&/g, '')
    .replace(/['.]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CbbdRatingsEntry {
  season: number
  teamId: number
  team: string
  conference: string
  offensiveRating: number
  defensiveRating: number
  netRating: number
  rankings: { offense: number; defense: number; net: number }
}

interface RegistryEntry {
  slug: string
  displayName: string
  shortName: string
  division: 'D1'
  conference: string
  externalIds: {
    cbbdTeamId: number
    cbbdName: string
  }
  logoUrl: string | null
  aliasApplied: boolean
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BASE_URL = 'https://api.collegebasketballdata.com'
const REGISTRY_DIR = path.resolve(process.cwd(), 'data/registry')
const ALIASES_PATH = path.join(REGISTRY_DIR, 'team-aliases.json')
const OUTPUT_PATH = path.join(REGISTRY_DIR, 'teams.json')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getKey(): string {
  const key = process.env.CBB_DATA_API_KEY
  if (!key) {
    console.error('ERROR: CBB_DATA_API_KEY not set in .env.local')
    process.exit(1)
  }
  return key
}

function loadAliases(): Record<string, string> {
  if (!fs.existsSync(ALIASES_PATH)) return {}
  const raw = fs.readFileSync(ALIASES_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as Record<string, string>
  // Remove comment keys
  return Object.fromEntries(
    Object.entries(parsed).filter(([k]) => !k.startsWith('_'))
  )
}

// Derive a short name: use the last word(s) for well-known patterns,
// otherwise use the full display name trimmed to a reasonable length.
function deriveShortName(displayName: string): string {
  // Strip parenthetical suffixes for short names
  const clean = displayName.replace(/\s*\([^)]+\)/, '').trim()

  // Common prefixes to drop for short names
  const dropPrefixes = ['University of ', 'College of ', 'The ']
  for (const prefix of dropPrefixes) {
    if (clean.startsWith(prefix)) return clean.slice(prefix.length)
  }
  return clean
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const key = getKey()
  const aliases = loadAliases()

  console.log('\n── Phase 3b: Building Team Registry ────────────────────────')
  console.log(`Aliases loaded: ${Object.keys(aliases).length}`)

  // Fetch ratings
  const url = `${BASE_URL}/ratings/adjusted?season=2025`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  })

  if (!res.ok) {
    console.error(`FAIL: GET /ratings/adjusted returned ${res.status}`)
    process.exit(1)
  }

  const ratings = (await res.json()) as CbbdRatingsEntry[]
  console.log(`Teams from CBBD: ${ratings.length}`)

  // Build registry entries
  const entries: RegistryEntry[] = []
  const slugsSeen = new Map<string, string>() // slug → displayName (for collision detection)
  const aliasesApplied: string[] = []
  const collisions: string[] = []

  for (const r of ratings) {
    // Determine slug: check alias first, then auto-generate
    let slug: string
    let aliasApplied = false

    if (aliases[r.team]) {
      slug = aliases[r.team]
      aliasApplied = true
      aliasesApplied.push(`"${r.team}" → "${slug}" (alias)`)
    } else {
      slug = slugify(r.team)
    }

    // Collision check
    if (slugsSeen.has(slug)) {
      collisions.push(`COLLISION: "${r.team}" → "${slug}" already used by "${slugsSeen.get(slug)}"`)
    } else {
      slugsSeen.set(slug, r.team)
    }

    entries.push({
      slug,
      displayName: r.team,
      shortName: deriveShortName(r.team),
      division: 'D1',
      conference: r.conference,
      externalIds: {
        cbbdTeamId: r.teamId,
        cbbdName: r.team,
      },
      logoUrl: null,
      aliasApplied,
    })
  }

  // Report collisions before writing
  if (collisions.length > 0) {
    console.error('\nERROR: Slug collisions detected — fix team-aliases.json before proceeding:')
    collisions.forEach(c => console.error(' ', c))
    process.exit(1)
  }

  // Sort by slug
  entries.sort((a, b) => a.slug.localeCompare(b.slug))

  // Write output (strip aliasApplied from final JSON — it's a build artifact)
  const output = entries.map(({ aliasApplied: _, ...rest }) => rest)
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))

  // ── Summary report ─────────────────────────────────────────────────────────
  console.log(`\nRegistry written: ${OUTPUT_PATH}`)
  console.log(`Total entries: ${output.length}`)

  if (aliasesApplied.length > 0) {
    console.log(`\nAlias overrides applied (${aliasesApplied.length}):`)
    aliasesApplied.forEach(a => console.log(' ', a))
  } else {
    console.log('\nNo alias overrides needed — all slugs auto-generated cleanly.')
  }

  // First 20 entries
  console.log('\nFirst 20 registry entries (sorted by slug):')
  output.slice(0, 20).forEach((e, i) => {
    console.log(`  ${String(i + 1).padStart(2)}. ${e.slug.padEnd(30)} ${e.displayName} (${e.conference}) [cbbdId:${e.externalIds.cbbdTeamId}]`)
  })

  // Tricky team spot-check
  const trickyNames = [
    "St. John's",
    'Texas A&M',
    'UConn',
    'Ole Miss',
    'San Diego State',
    "Mount St. Mary's",
  ]
  console.log('\nTricky team slug check:')
  for (const name of trickyNames) {
    const entry = output.find(e => e.displayName === name)
    if (entry) {
      console.log(`  ✓ "${name}" → "${entry.slug}"`)
    } else {
      // CBBD might use a slightly different name — search by slug
      const autoSlug = aliases[name] ?? slugify(name)
      const bySlug = output.find(e => e.slug === autoSlug)
      if (bySlug) {
        console.log(`  ~ "${name}" not found by exact name, but slug "${autoSlug}" → "${bySlug.displayName}"`)
      } else {
        console.log(`  ✗ "${name}" — NOT FOUND in registry`)
      }
    }
  }

  console.log('\n── Registry build complete ──────────────────────────────────\n')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
