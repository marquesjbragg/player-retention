/**
 * Phase 4: Seeds CBBD data for a list of teams and seasons.
 * Default target: 5 test teams for season 2025.
 *
 * Run: npx tsx scripts/seed-d1-cbbd.ts
 *
 * What it does per team:
 * 1. Fetch + cache raw player stats  → data/cache/d1/cbbd/raw/players/{season}/{slug}.json
 * 2. Fetch + cache normalized players → data/cache/d1/cbbd/players/{season}/{slug}.json
 * 3. Fetch + cache normalized team season → data/cache/d1/cbbd/team-seasons/{season}/{slug}.json
 * Then once per season:
 * 4. Fetch + cache raw ratings  → data/cache/d1/cbbd/raw/ratings/{season}.json
 * 5. Fetch + cache normalized ratings → data/cache/d1/cbbd/ratings/{season}.json
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { D1CBBDPlayerProvider } from '../src/lib/providers/d1/D1CBBDPlayerProvider'
import { D1CBBDTeamProvider }   from '../src/lib/providers/d1/D1CBBDTeamProvider'
import { D1CBBDRatingsProvider } from '../src/lib/providers/d1/D1CBBDRatingsProvider'
import { TeamRegistry }          from '../src/lib/registry/TeamRegistry'
import { CachePaths }            from '../src/lib/cache/CacheManager'

// ── Config ────────────────────────────────────────────────────────────────────

const TEST_SLUGS = [
  'duke',
  'michigan',
  'alabama',
  'furman',
  'san-diego-state',
]

// Accept --season YYYY args, fallback to [2025]
const argSeasons = process.argv
  .filter(a => a.match(/^\d{4}$/))
  .map(Number)
const SEASONS = argSeasons.length > 0 ? argSeasons : [2025]

// ── Helpers ───────────────────────────────────────────────────────────────────

function checkmark(ok: boolean) { return ok ? '✓' : '✗' }

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── Phase 4: Seeding 5 test teams ───────────────────────────')
  console.log(`Teams: ${TEST_SLUGS.join(', ')}`)
  console.log(`Season(s): ${SEASONS.join(', ')}`)
  console.log()

  // Verify all slugs exist in registry before fetching
  for (const slug of TEST_SLUGS) {
    const entry = TeamRegistry.getBySlug(slug)
    if (!entry) {
      console.error(`ERROR: "${slug}" not found in TeamRegistry. Run build-team-registry.ts first.`)
      process.exit(1)
    }
    console.log(`Registry: ${slug} → "${entry.displayName}" (${entry.conference}) cbbdName:"${entry.externalIds.cbbdName}"`)
  }
  console.log()

  // Seed ratings once per season (covers all teams)
  for (const season of SEASONS) {
    console.log(`[Ratings] Fetching season ${season}...`)
    try {
      const data = await D1CBBDRatingsProvider.fetchAndCache(season)
      console.log(`  ✓ ${data.entries.length} teams rated`)
    } catch (err) {
      console.error(`  ✗ Ratings fetch failed: ${err}`)
    }
  }
  console.log()

  // Seed each team
  const results: Record<string, { players: number; teamSeason: boolean; error?: string }> = {}

  for (const slug of TEST_SLUGS) {
    for (const season of SEASONS) {
      console.log(`[${slug} / ${season}]`)
      let playerCount = 0
      let teamSeasonOk = false
      let error: string | undefined

      try {
        // Players
        const players = await D1CBBDPlayerProvider.fetchAndCache(slug, season)
        playerCount = players.length
        console.log(`  ${checkmark(playerCount > 0)} Players: ${playerCount}`)

        // Team season
        const ts = await D1CBBDTeamProvider.fetchAndCache(slug, season)
        teamSeasonOk = ts !== null
        if (ts) {
          console.log(`  ✓ Team season: ${ts.wins}W-${ts.losses}L, PPG:${ts.ppg}, OppPPG:${ts.oppPpg}`)
        } else {
          console.log(`  ✗ Team season: null`)
        }

        // Ratings spot-check
        const rating = await D1CBBDRatingsProvider.getRating(slug, season)
        if (rating) {
          console.log(`  ✓ Rating: rank ${rating.rank}, net ${rating.rating}`)
        } else {
          console.log(`  ~ Rating: not found for this slug`)
        }
      } catch (err) {
        error = String(err)
        console.error(`  ✗ Error: ${error}`)
      }

      results[`${slug}/${season}`] = { players: playerCount, teamSeason: teamSeasonOk, error }
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────
  console.log('\n── Summary ──────────────────────────────────────────────────')
  console.log('\nFiles created:')

  for (const slug of TEST_SLUGS) {
    for (const season of SEASONS) {
      const rawP   = CachePaths.rawPlayers(season, slug)
      const normP  = CachePaths.players(season, slug)
      const normTS = CachePaths.teamSeason(season, slug)
      const fs = require('fs')
      console.log(`  ${checkmark(fs.existsSync(rawP))}  raw players:      ${rawP.replace(process.cwd() + '/', '')}`)
      console.log(`  ${checkmark(fs.existsSync(normP))}  norm players:     ${normP.replace(process.cwd() + '/', '')}`)
      console.log(`  ${checkmark(fs.existsSync(normTS))} norm team-season: ${normTS.replace(process.cwd() + '/', '')}`)
    }
  }

  for (const season of SEASONS) {
    const rawR  = CachePaths.rawRatings(season)
    const normR = CachePaths.ratings(season)
    const fs = require('fs')
    console.log(`  ${checkmark(fs.existsSync(rawR))}  raw ratings:      ${rawR.replace(process.cwd() + '/', '')}`)
    console.log(`  ${checkmark(fs.existsSync(normR))}  norm ratings:     ${normR.replace(process.cwd() + '/', '')}`)
  }

  console.log('\nResult table:')
  console.log('  Team                 Players  TeamSeason')
  for (const [key, r] of Object.entries(results)) {
    const ok = r.error ? '✗' : '✓'
    console.log(`  ${ok} ${key.padEnd(25)} ${String(r.players).padEnd(9)} ${r.teamSeason ? 'yes' : 'no'}${r.error ? `  ERROR: ${r.error}` : ''}`)
  }

  const allOk = Object.values(results).every(r => !r.error && r.players > 0 && r.teamSeason)
  console.log(`\nOverall: ${allOk ? '✓ All 5 test teams seeded successfully' : '✗ Some teams had errors — review above'}`)
  console.log('\n── Seed complete ────────────────────────────────────────────\n')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
