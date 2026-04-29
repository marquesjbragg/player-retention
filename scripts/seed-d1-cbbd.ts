/**
 * Canonical D1 CBBD seed script with manifest tracking.
 *
 * Manifest: data/cache/d1/cbbd/seed-status.json
 *
 * Flags:
 *   --season YYYY       process only this season (default: 2024 2025)
 *   --team slug         process only this team
 *   --missing-only      skip complete/not-applicable (default; explicit for clarity)
 *   --force             refetch all in-scope entries regardless of manifest status
 *                       Note: providers return frozen cache without an API call —
 *                       --force is most useful for retrying failed/null entries.
 *   --dry-run           reconcile + print plan, make no API calls
 *   --delay N           ms between API calls (default: 1500)
 *   --retry-delay N     ms to wait after HTTP 429 (default: 120000)
 *
 * Examples:
 *   npx tsx scripts/seed-d1-cbbd.ts --season 2025 --missing-only --dry-run
 *   npx tsx scripts/seed-d1-cbbd.ts --season 2025 --missing-only
 *   npx tsx scripts/seed-d1-cbbd.ts --team duke --season 2025
 *   npx tsx scripts/seed-d1-cbbd.ts --season 2025 --force --dry-run
 */

import * as dotenv from 'dotenv'
import * as path from 'path'
import * as fs from 'fs'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

import { TeamRegistry }         from '../src/lib/registry/TeamRegistry'
import { D1CBBDPlayerProvider } from '../src/lib/providers/d1/D1CBBDPlayerProvider'
import { D1CBBDTeamProvider }   from '../src/lib/providers/d1/D1CBBDTeamProvider'
import { D1CBBDRatingsProvider } from '../src/lib/providers/d1/D1CBBDRatingsProvider'
import { CachePaths }           from '../src/lib/cache/CacheManager'
import type { PlayerSeason, TeamSeason } from '../src/lib/types'

// ── Types ──────────────────────────────────────────────────────────────────────

type CacheStatus = 'complete' | 'missing' | 'failed' | 'skipped' | 'not-applicable'

interface TeamSeasonStatus {
  teamSlug:              string
  cbbdName:              string
  season:                number
  playerCacheStatus:     CacheStatus
  teamSeasonCacheStatus: CacheStatus
  ratingsCacheStatus:    CacheStatus
  playerCount:           number | null
  teamSeasonSummary:     { wins: number; losses: number } | null
  coachCacheStatus:      CacheStatus
  coachName:             string | null
  coachSource:           'cbbd' | 'local' | 'manual' | 'unknown'
  coachLastFetched:      string | null
  lastFetched:           string | null
  lastError:             string | null
}

type SeasonData   = Record<string, TeamSeasonStatus>
type ManifestBody = Record<string, SeasonData>

interface SeedManifest {
  _meta: {
    version:      string
    generatedAt:  string
    note:         string
  }
  seasons: ManifestBody
}

interface WorkItem {
  teamSlug:        string
  cbbdName:        string
  season:          number
  fetchPlayers:    boolean
  fetchTeamSeason: boolean
  reason:          string
}

// ── Config ────────────────────────────────────────────────────────────────────

const CACHE_ROOT    = path.resolve(process.cwd(), 'data/cache/d1/cbbd')
const MANIFEST_PATH = path.join(CACHE_ROOT, 'seed-status.json')
const DEFAULT_SEASONS = [2024, 2025]

// ── Arg parsing ───────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)

function hasFlag(name: string): boolean {
  return argv.includes(name)
}

function getOption(name: string): string | null {
  const idx = argv.indexOf(name)
  return idx >= 0 && argv[idx + 1] !== undefined ? argv[idx + 1] : null
}

const argSeasonStr  = getOption('--season')
const argTeam       = getOption('--team')
const isDryRun      = hasFlag('--dry-run')
const isForce       = hasFlag('--force')
const DELAY_MS      = parseInt(getOption('--delay')       ?? '1500',   10)
const RETRY_DELAY   = parseInt(getOption('--retry-delay') ?? '120000', 10)
const SEASONS       = argSeasonStr ? [parseInt(argSeasonStr, 10)] : DEFAULT_SEASONS

// ── Phase 7.5 known-state overrides ──────────────────────────────────────────
// Applied on first manifest generation only (when no manifest exists yet).
// These encode outcomes observed during the original seed run.

const PHASE75_OVERRIDES: Array<{
  teamSlug:              string
  season:                number
  teamSeasonCacheStatus: CacheStatus
  lastError:             string
}> = [
  {
    teamSlug: 'iowa-state', season: 2025,
    teamSeasonCacheStatus: 'failed',
    lastError: 'CBBD returned null for team-season (observed 2026-04-22; retry when quota resets)',
  },
  {
    teamSlug: 'mercyhurst', season: 2024,
    teamSeasonCacheStatus: 'not-applicable',
    lastError: 'new D1 program — CBBD has no 2024 team-season record',
  },
  {
    teamSlug: 'west-georgia', season: 2024,
    teamSeasonCacheStatus: 'not-applicable',
    lastError: 'new D1 program — CBBD has no 2024 team-season record',
  },
]

// ── Manifest helpers ──────────────────────────────────────────────────────────

function loadManifest(): SeedManifest | null {
  if (!fs.existsSync(MANIFEST_PATH)) return null
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) as SeedManifest
  } catch {
    console.warn('  ⚠ seed-status.json could not be parsed — regenerating from scratch')
    return null
  }
}

function saveManifest(manifest: SeedManifest): void {
  manifest._meta.generatedAt = new Date().toISOString()
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

function getEntry(manifest: SeedManifest, season: number, slug: string): TeamSeasonStatus | undefined {
  return manifest.seasons[String(season)]?.[slug]
}

function setEntry(manifest: SeedManifest, season: number, entry: TeamSeasonStatus): void {
  const yr = String(season)
  if (!manifest.seasons[yr]) manifest.seasons[yr] = {}
  manifest.seasons[yr][entry.teamSlug] = entry
}

// ── Reconcile ─────────────────────────────────────────────────────────────────
// Source of truth = actual files on disk.
// Manifest preserves 'failed' / 'not-applicable' statuses from prior runs.
// PHASE75_OVERRIDES seed the initial manifest when no prior manifest exists.

function reconcile(existing: SeedManifest | null): SeedManifest {
  const allTeams = TeamRegistry.getAll().filter(t => t.division === 'D1')
  const isFirstGen = existing === null

  const manifest: SeedManifest = {
    _meta: {
      version:     '1',
      generatedAt: new Date().toISOString(),
      note:        'D1 CBBD seed manifest. Auto-generated from cache state. Do not edit manually unless recording a known permanent gap.',
    },
    seasons: {},
  }

  for (const season of DEFAULT_SEASONS) {
    const ratingsPath    = CachePaths.ratings(season)
    const ratingsComplete = fs.existsSync(ratingsPath)

    for (const team of allTeams) {
      const prev       = existing ? getEntry(existing, season, team.slug) : undefined
      const playerPath = CachePaths.players(season, team.slug)
      const tsPath     = CachePaths.teamSeason(season, team.slug)
      const playerExists = fs.existsSync(playerPath)
      const tsExists     = fs.existsSync(tsPath)

      // Read player count + fetchedAt from normalized cache
      let playerCount:    number | null = null
      let playerFetchedAt: string | null = null
      if (playerExists) {
        try {
          const raw = JSON.parse(fs.readFileSync(playerPath, 'utf-8')) as {
            data: PlayerSeason[]
            fetchedAt: string
          }
          playerCount    = raw.data.length
          playerFetchedAt = raw.fetchedAt
        } catch { /* corrupted file — leave null */ }
      }

      // Read team-season summary + fetchedAt
      let teamSeasonSummary: { wins: number; losses: number } | null = null
      let tsFetchedAt: string | null = null
      if (tsExists) {
        try {
          const raw = JSON.parse(fs.readFileSync(tsPath, 'utf-8')) as {
            data: TeamSeason
            fetchedAt: string
          }
          teamSeasonSummary = { wins: raw.data.wins, losses: raw.data.losses }
          tsFetchedAt       = raw.fetchedAt
        } catch { /* corrupted */ }
      }

      // ── Player status ──────────────────────────────────────────────────────
      let playerCacheStatus: CacheStatus
      if (playerExists) {
        playerCacheStatus = 'complete'
      } else if (prev?.playerCacheStatus === 'not-applicable') {
        playerCacheStatus = 'not-applicable'    // preserve permanent gap
      } else {
        playerCacheStatus = 'missing'
      }

      // ── Team-season status ─────────────────────────────────────────────────
      let teamSeasonCacheStatus: CacheStatus
      let lastError: string | null = prev?.lastError ?? null

      if (tsExists) {
        teamSeasonCacheStatus = 'complete'
        lastError = null
      } else if (prev?.teamSeasonCacheStatus === 'not-applicable') {
        teamSeasonCacheStatus = 'not-applicable'  // preserve permanent gap
      } else if (prev?.teamSeasonCacheStatus === 'failed') {
        teamSeasonCacheStatus = 'failed'          // preserve known failure
      } else if (playerCacheStatus === 'not-applicable') {
        teamSeasonCacheStatus = 'not-applicable'  // no players → no ts needed
      } else {
        teamSeasonCacheStatus = 'missing'
      }

      setEntry(manifest, season, {
        teamSlug:              team.slug,
        cbbdName:              team.externalIds.cbbdName ?? '(none)',
        season,
        playerCacheStatus,
        teamSeasonCacheStatus,
        ratingsCacheStatus:    ratingsComplete ? 'complete' : 'missing',
        playerCount,
        teamSeasonSummary,
        coachCacheStatus:      'not-applicable',
        coachName:             null,
        coachSource:           'unknown',
        coachLastFetched:      null,
        lastFetched:           tsFetchedAt ?? playerFetchedAt ?? prev?.lastFetched ?? null,
        lastError,
      })
    }
  }

  // Apply Phase 7.5 known-state overrides on first generation only.
  // Subsequent reconcile runs preserve these via the 'failed'/'not-applicable' preservation above.
  if (isFirstGen) {
    for (const override of PHASE75_OVERRIDES) {
      const entry = manifest.seasons[String(override.season)]?.[override.teamSlug]
      if (entry) {
        entry.teamSeasonCacheStatus = override.teamSeasonCacheStatus
        entry.lastError             = override.lastError
      }
    }
  }

  return manifest
}

// ── Work queue ────────────────────────────────────────────────────────────────

function buildWorkQueue(manifest: SeedManifest): WorkItem[] {
  const allTeams   = TeamRegistry.getAll().filter(t => t.division === 'D1')
  const targetSlug = argTeam ?? null
  const queue: WorkItem[] = []

  for (const season of SEASONS) {
    for (const team of allTeams) {
      if (targetSlug && team.slug !== targetSlug) continue

      const entry = getEntry(manifest, season, team.slug)
      if (!entry) continue

      const needsPlayers = isForce
        ? entry.playerCacheStatus !== 'not-applicable'
        : ['missing', 'failed'].includes(entry.playerCacheStatus)

      const needsTeamSeason = isForce
        ? entry.teamSeasonCacheStatus !== 'not-applicable'
        : ['missing', 'failed'].includes(entry.teamSeasonCacheStatus)

      if (!needsPlayers && !needsTeamSeason) continue

      const parts: string[] = []
      if (needsPlayers)    parts.push(`players:${entry.playerCacheStatus}`)
      if (needsTeamSeason) parts.push(`team-season:${entry.teamSeasonCacheStatus}`)

      queue.push({
        teamSlug:        team.slug,
        cbbdName:        entry.cbbdName,
        season,
        fetchPlayers:    needsPlayers,
        fetchTeamSeason: needsTeamSeason,
        reason:          parts.join(', '),
      })
    }
  }

  return queue
}

// ── Dry-run report ────────────────────────────────────────────────────────────

function dryRunReport(manifest: SeedManifest, queue: WorkItem[]): void {
  console.log('\n── Dry Run ──────────────────────────────────────────────────')
  console.log(`Seasons in scope:  ${SEASONS.join(', ')}`)
  if (argTeam) console.log(`Team filter:       --team ${argTeam}`)
  console.log(`Mode:              ${isForce ? '--force (all in scope)' : '--missing-only (default)'}`)
  console.log()

  let grandTotalCalls = 0

  for (const season of SEASONS) {
    const seasonData = manifest.seasons[String(season)] ?? {}
    const entries    = Object.values(seasonData)

    const bothComplete    = entries.filter(e =>
      e.playerCacheStatus === 'complete' && e.teamSeasonCacheStatus === 'complete')
    const notApplicable   = entries.filter(e =>
      e.teamSeasonCacheStatus === 'not-applicable' && e.playerCacheStatus !== 'missing')
    const playersMissing  = entries.filter(e => e.playerCacheStatus === 'missing')
    const tsOnlyMissing   = entries.filter(e =>
      e.playerCacheStatus === 'complete' && ['missing', 'failed'].includes(e.teamSeasonCacheStatus))
    const tsFailed        = entries.filter(e => e.teamSeasonCacheStatus === 'failed')
    const playersFailed   = entries.filter(e => e.playerCacheStatus === 'failed')

    const seasonQueue   = queue.filter(w => w.season === season)
    const playerCalls   = seasonQueue.filter(w => w.fetchPlayers).length
    const tsCalls       = seasonQueue.filter(w => w.fetchTeamSeason).length
    const totalCalls    = playerCalls + tsCalls
    grandTotalCalls    += totalCalls

    const ratingsStatus = entries[0]?.ratingsCacheStatus ?? 'missing'
    const estSec        = Math.ceil((totalCalls * DELAY_MS) / 1000)
    const estMin        = (estSec / 60).toFixed(1)

    console.log(`── Season ${season} (${season - 1}–${String(season).slice(-2)}) ───────────────────────────`)
    console.log(`  Teams:                   ${entries.length}`)
    console.log(`  Both complete (skip):    ${bothComplete.length}`)
    console.log(`  Not-applicable (skip):   ${notApplicable.length}`)
    console.log(`  Players missing:         ${playersMissing.length}`)
    console.log(`  Team-season only missing:${tsOnlyMissing.length - tsFailed.length} (includes ${tsFailed.length} failed → retry)`)
    if (playersFailed.length > 0)
      console.log(`  Players failed (retry):  ${playersFailed.map(e => e.teamSlug).join(', ')}`)
    if (tsFailed.length > 0)
      console.log(`  Team-season failed:      ${tsFailed.map(e => `${e.teamSlug} — ${e.lastError ?? 'unknown'}`).join('\n                           ')}`)
    console.log(`  Ratings ${season}:             ${ratingsStatus} — skip`)
    console.log(`  API calls this season:   ${playerCalls} player + ${tsCalls} team-season = ${totalCalls}`)
    if (totalCalls > 0)
      console.log(`  Est. time:               ~${estMin} min at ${DELAY_MS}ms delay`)
    console.log()
  }

  console.log(`── Totals ──────────────────────────────────────────────────`)
  console.log(`  Total expected API calls: ${grandTotalCalls}`)
  if (grandTotalCalls === 0) {
    console.log('\n✓ Nothing to fetch — all in-scope teams are complete.')
  } else {
    const estTotalMin = ((grandTotalCalls * DELAY_MS) / 60000).toFixed(0)
    console.log(`  Est. total time:          ~${estTotalMin} min`)
    console.log()
    console.log('  First 15 teams to fetch:')
    queue.slice(0, 15).forEach(w => {
      console.log(`    ${w.season} | ${w.teamSlug.padEnd(30)} | ${w.reason}`)
    })
    if (queue.length > 15)
      console.log(`    ... and ${queue.length - 15} more`)
  }

  console.log()
  console.log('── Coach data ──────────────────────────────────────────────')
  console.log('  CBBD exposure: none — player, team-season, and ratings endpoints')
  console.log('                 do not include head coach name or any coaching field.')
  console.log('  V1 coaches.json: 13 D2 teams only, all names empty — not usable for D1.')
  console.log('  Manifest status: coachCacheStatus = "not-applicable" for all D1 teams.')
  console.log('  Recommendation: data/registry/coaches-d1.json (manual entry or')
  console.log('                  external source e.g. SportsReference) — add later.')
  console.log('                  Separate from CBBD seed; does not block player/team data.')

  console.log()
  console.log('── To run the seed ─────────────────────────────────────────')
  const sFlag = SEASONS.length === 1 ? ` --season ${SEASONS[0]}` : ''
  const tFlag = argTeam ? ` --team ${argTeam}` : ''
  console.log(`  npx tsx scripts/seed-d1-cbbd.ts${sFlag}${tFlag} --missing-only`)
  console.log('────────────────────────────────────────────────────────────\n')
}

// ── Seed loop ─────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function runSeed(manifest: SeedManifest, queue: WorkItem[]): Promise<void> {
  let playerOk = 0, playerFail = 0, playerEmpty = 0
  let tsOk = 0, tsFail = 0
  let done = 0

  for (const item of queue) {
    const entry = manifest.seasons[String(item.season)]![item.teamSlug]!
    done++

    // ── Players ──────────────────────────────────────────────────────────────
    if (item.fetchPlayers) {
      let fetched = false
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const players = await D1CBBDPlayerProvider.fetchAndCache(item.teamSlug, item.season)
          entry.playerCacheStatus = 'complete'
          entry.playerCount       = players.length
          entry.lastFetched       = new Date().toISOString()
          entry.lastError         = null
          if (players.length === 0) {
            playerEmpty++
            console.log(`  ⚠  ${item.teamSlug} (${item.cbbdName}) / ${item.season}: 0 players`)
          } else {
            playerOk++
          }
          fetched = true
          break
        } catch (err) {
          const msg = String(err)
          if (msg.includes('429') && attempt === 1) {
            console.log(`  ⚠  429 on ${item.teamSlug} players — waiting ${RETRY_DELAY}ms`)
            await sleep(RETRY_DELAY)
            continue
          }
          entry.playerCacheStatus = 'failed'
          entry.lastError         = msg
          playerFail++
          console.error(`  ✗  ${item.teamSlug} / ${item.season} players: ${msg}`)
          fetched = true
          break
        }
      }
      if (fetched) await sleep(DELAY_MS)
    }

    // ── Team season ───────────────────────────────────────────────────────────
    if (item.fetchTeamSeason) {
      let fetched = false
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const ts = await D1CBBDTeamProvider.fetchAndCache(item.teamSlug, item.season)
          if (ts) {
            entry.teamSeasonCacheStatus = 'complete'
            entry.teamSeasonSummary     = { wins: ts.wins, losses: ts.losses }
            entry.lastFetched           = new Date().toISOString()
            entry.lastError             = null
            tsOk++
          } else {
            entry.teamSeasonCacheStatus = 'failed'
            entry.lastError             = 'CBBD returned null for team-season'
            tsFail++
            console.log(`  ⚠  ${item.teamSlug} / ${item.season}: team-season null`)
          }
          fetched = true
          break
        } catch (err) {
          const msg = String(err)
          if (msg.includes('429') && attempt === 1) {
            console.log(`  ⚠  429 on ${item.teamSlug} team-season — waiting ${RETRY_DELAY}ms`)
            await sleep(RETRY_DELAY)
            continue
          }
          entry.teamSeasonCacheStatus = 'failed'
          entry.lastError             = msg
          tsFail++
          console.error(`  ✗  ${item.teamSlug} / ${item.season} team-season: ${msg}`)
          fetched = true
          break
        }
      }
      if (fetched) await sleep(DELAY_MS)
    }

    // Write manifest after every team so the run can resume on interruption
    saveManifest(manifest)

    if (done % 25 === 0 || done === queue.length) {
      console.log(`  Progress: ${done}/${queue.length} — players: ${playerOk}✓ ${playerEmpty}⚠ ${playerFail}✗ | team-seasons: ${tsOk}✓ ${tsFail}✗`)
    }
  }

  console.log('\n── Seed Summary ─────────────────────────────────────────────')
  console.log(`Players:      ${playerOk} ok  ${playerEmpty} empty  ${playerFail} failed`)
  console.log(`Team-seasons: ${tsOk} ok  ${tsFail} failed`)
  console.log(`Manifest:     ${MANIFEST_PATH}`)
  console.log('── Seed complete ────────────────────────────────────────────\n')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n── D1 CBBD Seed ─────────────────────────────────────────────')
  console.log(`Seasons:      ${SEASONS.join(', ')}`)
  if (argTeam) console.log(`Team filter:  ${argTeam}`)
  console.log(`Dry run:      ${isDryRun}`)
  console.log(`Force:        ${isForce}`)
  console.log(`Delay:        ${DELAY_MS}ms  |  Retry delay: ${RETRY_DELAY}ms`)
  console.log()

  // Step 1: Reconcile manifest with actual files on disk
  process.stdout.write('Reconciling manifest with cache files... ')
  const existing = loadManifest()
  const manifest = reconcile(existing)
  saveManifest(manifest)
  console.log('done.')
  console.log(`Manifest: ${MANIFEST_PATH}`)
  console.log()

  // Step 2: Build work queue
  const queue = buildWorkQueue(manifest)

  // Step 3: Dry-run exits here
  if (isDryRun) {
    dryRunReport(manifest, queue)
    return
  }

  // Step 4: Validate API key before any calls
  if (!process.env.CBB_DATA_API_KEY) {
    console.error('ERROR: CBB_DATA_API_KEY not set. Check .env.local')
    process.exit(1)
  }

  if (queue.length === 0) {
    console.log('✓ Nothing to fetch — all in-scope teams are complete or not-applicable.')
    return
  }

  const totalCalls = queue.reduce((n, w) => n + (w.fetchPlayers ? 1 : 0) + (w.fetchTeamSeason ? 1 : 0), 0)
  const estMin     = ((totalCalls * DELAY_MS) / 60000).toFixed(0)
  console.log(`Fetching ${queue.length} team/season entries (~${totalCalls} API calls, ~${estMin} min)`)
  console.log()

  await runSeed(manifest, queue)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
