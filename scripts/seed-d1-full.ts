/**
 * Full D1 seed — players + team seasons for all 364 teams.
 *
 * Default: seasons 2024 and 2025 (the year pair needed for Browse).
 * Override: npx tsx scripts/seed-d1-full.ts 2023 2024 2025
 *
 * Behavior:
 *   - Skips frozen entries already on disk (no API call).
 *   - Rates calls at DELAY_MS between actual API calls.
 *   - Logs empty player responses and all errors.
 *   - Retries once on HTTP 429 after RETRY_DELAY_MS.
 *   - Ratings are fetched once per season before team loop.
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { TeamRegistry }            from '../src/lib/registry/TeamRegistry'
import { D1CBBDPlayerProvider }    from '../src/lib/providers/d1/D1CBBDPlayerProvider'
import { D1CBBDTeamProvider }      from '../src/lib/providers/d1/D1CBBDTeamProvider'
import { D1CBBDRatingsProvider }   from '../src/lib/providers/d1/D1CBBDRatingsProvider'
import { CacheManager, CachePaths } from '../src/lib/cache/CacheManager'

// ── Config ────────────────────────────────────────────────────────────────────

const argSeasons = process.argv.filter(a => /^\d{4}$/.test(a)).map(Number)
const SEASONS     = argSeasons.length > 0 ? argSeasons : [2024, 2025]
const DELAY_MS    = 1500   // between actual API calls — ~40/min, conservative
const RETRY_DELAY = 120000 // 2-min backoff on 429 before retry

// ── Helpers ───────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

interface Failure {
  slug:    string
  cbbdName: string
  season:  number
  type:    string
  error:   string
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const allTeams = TeamRegistry.getAll().filter(t => t.division === 'D1')

  console.log('\n── Full D1 Seed ─────────────────────────────────────────────')
  console.log(`Teams:   ${allTeams.length}`)
  console.log(`Seasons: ${SEASONS.join(', ')}`)
  console.log(`Delay:   ${DELAY_MS}ms between API calls`)
  console.log()

  const failures: Failure[] = []
  let totalPlayerOk    = 0
  let totalPlayerEmpty = 0
  let totalPlayerFail  = 0
  let totalTsOk        = 0
  let totalTsFail      = 0

  // ── Step 1: Ratings (once per season) ─────────────────────────────────────

  for (const season of SEASONS) {
    const ratingPath = CachePaths.ratings(season)
    if (CacheManager.exists(ratingPath)) {
      const entry = CacheManager.read<{ entries: unknown[] }>(ratingPath)
      console.log(`[Ratings ${season}] Cached (${entry?.data?.entries?.length ?? '?'} teams) — skipping`)
      continue
    }
    console.log(`[Ratings ${season}] Fetching...`)
    try {
      const data = await D1CBBDRatingsProvider.fetchAndCache(season)
      console.log(`  ✓ ${data.entries.length} teams rated`)
    } catch (err) {
      console.error(`  ✗ Ratings ${season}: ${err}`)
      failures.push({ slug: '(ratings)', cbbdName: '(season)', season, type: 'ratings', error: String(err) })
    }
  }

  // ── Step 2: Players + team seasons per team per season ────────────────────

  for (const season of SEASONS) {
    console.log(`\n── Season ${season} (${season - 1}-${String(season).slice(-2)}) ─────────────────────────`)
    let done = 0
    let seasonPlayerOk = 0
    let seasonPlayerEmpty = 0
    let seasonPlayerFail = 0
    let seasonTsOk = 0
    let seasonTsFail = 0

    for (const team of allTeams) {
      const { slug } = team
      const cbbdName = team.externalIds.cbbdName ?? '(none)'
      const playerPath = CachePaths.players(season, slug)
      const tsPath     = CachePaths.teamSeason(season, slug)

      // ── Players ──────────────────────────────────────────────────────────
      const playerCached = CacheManager.exists(playerPath)
      if (playerCached) {
        seasonPlayerOk++
      } else {
        let fetched = false
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const players = await D1CBBDPlayerProvider.fetchAndCache(slug, season)
            if (players.length === 0) {
              seasonPlayerEmpty++
              console.log(`  ⚠  ${slug} (${cbbdName}) / ${season}: 0 players returned`)
              failures.push({ slug, cbbdName, season, type: 'players-empty', error: '0 players from API' })
            } else {
              seasonPlayerOk++
            }
            fetched = true
            break
          } catch (err) {
            const msg = String(err)
            if (msg.includes('429') && attempt === 1) {
              console.log(`  ⚠  429 rate-limit on ${slug} — waiting ${RETRY_DELAY}ms`)
              await sleep(RETRY_DELAY)
              continue
            }
            seasonPlayerFail++
            console.error(`  ✗  ${slug} (${cbbdName}) / ${season} players: ${msg}`)
            failures.push({ slug, cbbdName, season, type: 'players-error', error: msg })
            fetched = true
            break
          }
        }
        if (fetched) await sleep(DELAY_MS)
      }

      // ── Team season ───────────────────────────────────────────────────────
      const tsCached = CacheManager.exists(tsPath)
      if (tsCached) {
        seasonTsOk++
      } else {
        let fetched = false
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            const ts = await D1CBBDTeamProvider.fetchAndCache(slug, season)
            if (ts) {
              seasonTsOk++
            } else {
              console.log(`  ⚠  ${slug} (${cbbdName}) / ${season}: team-season null`)
              failures.push({ slug, cbbdName, season, type: 'team-season-null', error: 'null response' })
            }
            fetched = true
            break
          } catch (err) {
            const msg = String(err)
            if (msg.includes('429') && attempt === 1) {
              console.log(`  ⚠  429 rate-limit on ${slug} team-season — waiting ${RETRY_DELAY}ms`)
              await sleep(RETRY_DELAY)
              continue
            }
            seasonTsFail++
            console.error(`  ✗  ${slug} (${cbbdName}) / ${season} team-season: ${msg}`)
            failures.push({ slug, cbbdName, season, type: 'team-season-error', error: msg })
            fetched = true
            break
          }
        }
        if (fetched) await sleep(DELAY_MS)
      }

      done++
      if (done % 50 === 0 || done === allTeams.length) {
        console.log(`  Progress: ${done}/${allTeams.length} — players: ${seasonPlayerOk}✓ ${seasonPlayerEmpty}⚠ ${seasonPlayerFail}✗ | team-seasons: ${seasonTsOk}✓ ${seasonTsFail}✗`)
      }
    }

    totalPlayerOk    += seasonPlayerOk
    totalPlayerEmpty += seasonPlayerEmpty
    totalPlayerFail  += seasonPlayerFail
    totalTsOk        += seasonTsOk
    totalTsFail      += seasonTsFail
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  const teamSeasons = allTeams.length * SEASONS.length
  console.log('\n\n── Seed Summary ─────────────────────────────────────────────')
  console.log(`Seasons seeded:       ${SEASONS.join(', ')}`)
  console.log(`Teams × seasons:      ${teamSeasons}`)
  console.log(`Player caches OK:     ${totalPlayerOk} / ${teamSeasons}`)
  console.log(`Player caches empty:  ${totalPlayerEmpty}`)
  console.log(`Player fetch errors:  ${totalPlayerFail}`)
  console.log(`Team-season OK:       ${totalTsOk} / ${teamSeasons}`)
  console.log(`Team-season errors:   ${totalTsFail}`)

  if (failures.length > 0) {
    console.log(`\nFailures / warnings (${failures.length}):`)
    failures.forEach(f => {
      console.log(`  ${f.type.padEnd(22)} ${f.slug.padEnd(30)} cbbdName:"${f.cbbdName}"  season:${f.season}  →  ${f.error}`)
    })
  } else {
    console.log('\n✓ No failures.')
  }

  console.log('\n── Seed complete ────────────────────────────────────────────\n')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
