/**
 * Phase 5: Validates RetentionEngine against cached data.
 *
 * Runs 2024→2025 retention for all 5 test teams.
 * Reports: CI, component %s, player counts, low-confidence matches,
 * starts fallback, warnings.
 *
 * Run: npx tsx scripts/validate-retention.ts
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { CacheManager, CachePaths } from '../src/lib/cache/CacheManager'
import { computeRetention }          from '../src/lib/engine/RetentionEngine'
import type { PlayerSeason, RetentionResult } from '../src/lib/types'

const TEST_SLUGS = ['duke', 'michigan', 'alabama', 'furman', 'san-diego-state']
const YEAR1 = 2024
const YEAR2 = 2025

function loadPlayers(teamSlug: string, season: number): PlayerSeason[] | null {
  const entry = CacheManager.read<PlayerSeason[]>(CachePaths.players(season, teamSlug))
  return entry?.data ?? null
}

function fmt(n: number | null): string {
  if (n === null) return 'null'
  return n.toFixed(1) + '%'
}

function printResult(slug: string, r: RetentionResult) {
  console.log(`\n─── ${slug.toUpperCase()} ${r.year1}→${r.year2} ─────────────────────────────────`)
  console.log(`  CI:               ${r.continuityIndex}  (dataQuality: ${r.dataQuality})`)
  console.log(`  Components:       minutes=${fmt(r.returningMinutesPct)}  starts=${fmt(r.returningStartsPct)}  points=${fmt(r.returningPointsPct)}`)
  console.log(`  Departed:         minutes=${fmt(r.deptMinutesPct)}  points=${fmt(r.deptPointsPct)}`)
  console.log(`  Newcomers:        minutes=${fmt(r.newcomerMinutesPct)}  points=${fmt(r.newcomerPointsPct)}`)
  console.log(`  Returning:        ${r.returningPlayersCount} players  (${r.returningStartersCount} starters)`)
  console.log(`  Non-returning:    ${r.nonReturningPlayers.length} players`)
  console.log(`  New players:      ${r.newPlayersCount}`)
  console.log(`  Below threshold:  ${r.belowThresholdPlayers.length}`)
  console.log(`  Low-conf excl:    ${r.lowConfidenceExcluded.length}`)
  console.log(`  Threshold games:  ${r.thresholdGamesRequired} GP required (20% of ${r.thresholdGamesRequired / 0.20 | 0})`)

  if (r.returningStartsPct === null) {
    console.log(`  ⚠ STARTS FALLBACK triggered — CI is 2-component`)
  }

  if (r.lowConfidenceExcluded.length > 0) {
    console.log(`  Low-confidence matches:`)
    r.lowConfidenceExcluded.forEach(c => {
      console.log(`    "${c.year1Player.playerName}" ↔ "${c.year2Candidate.playerName}" (sim: ${c.similarityScore})`)
    })
  }

  if (r.warnings.length > 0) {
    console.log(`  Warnings:`)
    r.warnings.forEach(w => console.log(`    · ${w}`))
  }

  console.log(`\n  Returning players (Year1 name → Year2 name / confidence):`)
  r.returningPlayers.forEach(p => {
    const sim = p.similarityScore ? ` [sim:${p.similarityScore}]` : ''
    console.log(`    ${p.matchConfidence.padEnd(6)} ${p.year1Stats.playerName} → ${p.year2Stats.playerName}${sim}`)
  })
}

async function main() {
  console.log('\n── Phase 5: RetentionEngine Validation ─────────────────────')
  console.log(`Year pair: ${YEAR1}→${YEAR2}`)
  console.log(`Teams: ${TEST_SLUGS.join(', ')}`)

  const summary: Array<{ slug: string; ci: number; quality: string; returning: number; newP: number; lowConf: number; startsFallback: boolean }> = []

  for (const slug of TEST_SLUGS) {
    const year1Players = loadPlayers(slug, YEAR1)
    const year2Players = loadPlayers(slug, YEAR2)

    if (!year1Players) {
      console.error(`\n✗ ${slug}: no ${YEAR1} player cache`)
      continue
    }
    if (!year2Players) {
      console.error(`\n✗ ${slug}: no ${YEAR2} player cache`)
      continue
    }

    // Load team season for games count (threshold needs it)
    const ts1Entry = CacheManager.read<{ wins: number; losses: number }>(CachePaths.teamSeason(YEAR1, slug))
    const teamGames = ts1Entry
      ? (ts1Entry.data.wins + ts1Entry.data.losses)
      : year1Players.reduce((max, p) => Math.max(max, p.games), 0)  // fallback: max games played

    const result = computeRetention(year1Players, year2Players, teamGames, YEAR1, YEAR2, slug)
    printResult(slug, result)

    summary.push({
      slug,
      ci:            result.continuityIndex,
      quality:       result.dataQuality,
      returning:     result.returningPlayersCount,
      newP:          result.newPlayersCount,
      lowConf:       result.lowConfidenceExcluded.length,
      startsFallback: result.returningStartsPct === null,
    })
  }

  // Summary table
  console.log('\n\n── Summary table ────────────────────────────────────────────')
  console.log('  Team                  CI     Quality    Return  New  LowConf  StartsFallback')
  summary.forEach(r => {
    console.log(
      `  ${r.slug.padEnd(22)} ${String(r.ci).padEnd(7)} ${r.quality.padEnd(10)} ${String(r.returning).padEnd(8)} ${String(r.newP).padEnd(5)} ${String(r.lowConf).padEnd(9)} ${r.startsFallback}`
    )
  })
  console.log('\n── Validation complete ──────────────────────────────────────\n')
}

main().catch(err => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
