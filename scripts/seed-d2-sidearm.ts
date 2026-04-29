/**
 * Seed D2 player and team-season data from Sidearm conference stats pages.
 *
 * Manifest: data/cache/d2/sidearm/seed-status.json
 *
 * Flags:
 *   --season YYYY         process only this season (default: 2022 2023 2024 2025 2026)
 *                        NOTE: Season labels use ending-year convention (2026 = 2025-26 season).
 *                        The Sidearm API year is season-1 (handled internally by providers).
 *   --team slug           process only this team
 *   --conference NAME     process only teams in this conference
 *   --missing-only        skip already-complete entries (default behavior)
 *   --force               refetch all in-scope entries regardless of status
 *   --dry-run             print plan, make no API calls
 *   --delay N             ms between team fetches (default: 1000)
 *   --players-only        only fetch player stats, skip team seasons
 *   --team-seasons-only   only fetch team seasons, skip players
 *
 * Usage:
 *   npx tsx scripts/seed-d2-sidearm.ts --conference GLIAC --season 2025 --dry-run
 *   npx tsx scripts/seed-d2-sidearm.ts --conference GLIAC --season 2025
 *   npx tsx scripts/seed-d2-sidearm.ts --conference NSIC --season 2025
 *   npx tsx scripts/seed-d2-sidearm.ts --conference PSAC --season 2025
 *   npx tsx scripts/seed-d2-sidearm.ts --season 2025   # all D2 conferences
 */

import * as fs   from 'fs'
import * as path from 'path'

import { TeamRegistry }          from '../src/lib/registry/TeamRegistry'
import { D2SidearmPlayerProvider } from '../src/lib/providers/d2/D2SidearmPlayerProvider'
import { D2SidearmTeamProvider }   from '../src/lib/providers/d2/D2SidearmTeamProvider'
import { D2CachePaths, CacheManager } from '../src/lib/cache/CacheManager'

// ── Types ─────────────────────────────────────────────────────────────────────

type CacheStatus = 'complete' | 'missing' | 'failed' | 'skipped' | 'not-applicable'

interface TeamSeasonStatus {
  teamSlug:              string
  sidearmId:             string
  conference:            string
  season:                number
  playerCacheStatus:     CacheStatus
  teamSeasonCacheStatus: CacheStatus
  playerCount:           number | null
  lastFetched:           string | null
  lastError:             string | null
}

type SeasonData   = Record<string, TeamSeasonStatus>
type ManifestBody = Record<string, SeasonData>

interface SeedManifest {
  _meta: { version: string; generatedAt: string; note: string }
  seasons: ManifestBody
}

interface WorkItem {
  teamSlug:        string
  sidearmId:       string
  conference:      string
  season:          number
  fetchPlayers:    boolean
  fetchTeamSeason: boolean
  reason:          string
}

// ── Config ─────────────────────────────────────────────────────────────────────

const MANIFEST_PATH = path.resolve(process.cwd(), 'data/cache/d2/sidearm/seed-status.json')
const DEFAULT_SEASONS = [2022, 2023, 2024, 2025, 2026]

const args           = process.argv.slice(2)
const dryRun         = args.includes('--dry-run')
const forceFlag      = args.includes('--force')
const playersOnly    = args.includes('--players-only')
const teamSeasonOnly = args.includes('--team-seasons-only')

function argVal(flag: string): string | null {
  const i = args.indexOf(flag)
  return i !== -1 ? (args[i + 1] ?? null) : null
}

const targetSeasonArg = argVal('--season')
const targetTeam      = argVal('--team')
const targetConf      = argVal('--conference')
const delay           = parseInt(argVal('--delay') ?? '1000') || 1000

const targetSeasons = targetSeasonArg ? [parseInt(targetSeasonArg)] : DEFAULT_SEASONS

// ── Manifest helpers ───────────────────────────────────────────────────────────

function loadManifest(): SeedManifest {
  if (fs.existsSync(MANIFEST_PATH)) {
    try { return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8')) }
    catch { /* fall through to fresh */ }
  }
  return {
    _meta: {
      version:     '1.0',
      generatedAt: new Date().toISOString(),
      note:        'D2 Sidearm seed manifest — tracks per-team-season fetch status',
    },
    seasons: {},
  }
}

function saveManifest(manifest: SeedManifest): void {
  manifest._meta.generatedAt = new Date().toISOString()
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
}

function getStatus(manifest: SeedManifest, teamSlug: string, season: number): TeamSeasonStatus | null {
  return manifest.seasons[season]?.[teamSlug] ?? null
}

function setStatus(
  manifest: SeedManifest,
  status: TeamSeasonStatus
): void {
  const key = String(status.season)
  manifest.seasons[key] ??= {}
  manifest.seasons[key][status.teamSlug] = status
}

// ── Build work list ────────────────────────────────────────────────────────────

function buildWorkList(manifest: SeedManifest): WorkItem[] {
  const allTeams = TeamRegistry.getAll().filter(t => t.division === 'D2')

  let teams = allTeams
  if (targetConf)  teams = teams.filter(t => t.conference === targetConf)
  if (targetTeam)  teams = teams.filter(t => t.slug === targetTeam)

  const work: WorkItem[] = []

  for (const season of targetSeasons) {
    for (const team of teams) {
      if (!team.externalIds.sidearmId) continue  // not yet in registry

      const existing = getStatus(manifest, team.slug, season)

      const playersDone      = existing?.playerCacheStatus === 'complete'
      const teamSeasonDone   = existing?.teamSeasonCacheStatus === 'complete'

      let fetchPlayers    = !playersOnly    ? !teamSeasonOnly : true
      let fetchTeamSeason = !teamSeasonOnly ? !playersOnly    : true

      if (!forceFlag) {
        if (playersDone)    fetchPlayers    = false
        if (teamSeasonDone) fetchTeamSeason = false
      }

      const reason = forceFlag ? 'force' : !existing ? 'new' : 'incomplete'

      if (fetchPlayers || fetchTeamSeason) {
        work.push({
          teamSlug:        team.slug,
          sidearmId:       team.externalIds.sidearmId!,
          conference:      team.conference,
          season,
          fetchPlayers,
          fetchTeamSeason,
          reason,
        })
      }
    }
  }

  return work
}

// ── Seed ───────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function processItem(
  item: WorkItem,
  manifest: SeedManifest
): Promise<void> {
  const existing = getStatus(manifest, item.teamSlug, item.season)
  const status: TeamSeasonStatus = existing ?? {
    teamSlug:              item.teamSlug,
    sidearmId:             item.sidearmId,
    conference:            item.conference,
    season:                item.season,
    playerCacheStatus:     'missing',
    teamSeasonCacheStatus: 'missing',
    playerCount:           null,
    lastFetched:           null,
    lastError:             null,
  }

  let lastError: string | null = null

  // ── Players ──────────────────────────────────────────────────────────────────

  if (item.fetchPlayers) {
    try {
      const players = await D2SidearmPlayerProvider.fetchAndCache(item.teamSlug, item.season)
      status.playerCacheStatus = 'complete'
      status.playerCount       = players.length
      console.log(`  [players] ${item.teamSlug} ${item.season}: ${players.length} players`)
    } catch (err) {
      lastError = String(err)
      status.playerCacheStatus = 'failed'
      console.error(`  [players] FAIL ${item.teamSlug} ${item.season}: ${lastError}`)
    }
  }

  // ── Team season ───────────────────────────────────────────────────────────────

  if (item.fetchTeamSeason) {
    try {
      const ts = await D2SidearmTeamProvider.fetchAndCache(item.teamSlug, item.season)
      if (ts) {
        status.teamSeasonCacheStatus = 'complete'
        console.log(`  [team-szn] ${item.teamSlug} ${item.season}: ${ts.wins}-${ts.losses}`)
      } else {
        status.teamSeasonCacheStatus = 'missing'
        console.warn(`  [team-szn] ${item.teamSlug} ${item.season}: no TEAM row returned`)
      }
    } catch (err) {
      lastError = String(err)
      status.teamSeasonCacheStatus = 'failed'
      console.error(`  [team-szn] FAIL ${item.teamSlug} ${item.season}: ${lastError}`)
    }
  }

  status.lastFetched = new Date().toISOString()
  status.lastError   = lastError
  setStatus(manifest, status)
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const manifest = loadManifest()
  const work     = buildWorkList(manifest)

  if (work.length === 0) {
    console.log('Nothing to do — all in-scope entries are complete.')
    return
  }

  const bySeason = work.reduce<Record<number, number>>((acc, w) => {
    acc[w.season] = (acc[w.season] ?? 0) + 1; return acc
  }, {})

  console.log(`\nD2 Sidearm Seed`)
  console.log(`  Target seasons: ${targetSeasons.join(', ')}`)
  console.log(`  Total work items: ${work.length}`)
  Object.entries(bySeason).forEach(([s, n]) => console.log(`    ${s}: ${n} teams`))
  if (targetConf) console.log(`  Conference filter: ${targetConf}`)
  if (targetTeam) console.log(`  Team filter: ${targetTeam}`)
  if (dryRun) console.log('  [dry-run]')

  if (dryRun) {
    console.log('\nWork items:')
    work.forEach(w => {
      const parts = []
      if (w.fetchPlayers)    parts.push('players')
      if (w.fetchTeamSeason) parts.push('team-szn')
      console.log(`  ${w.teamSlug} ${w.season} [${parts.join('+')}] (${w.reason})`)
    })
    return
  }

  let done = 0; let failed = 0

  for (const item of work) {
    await processItem(item, manifest)
    done++
    saveManifest(manifest)

    if (done % 10 === 0) {
      console.log(`  Progress: ${done}/${work.length}`)
    }

    await sleep(delay)
  }

  // ── Summary ───────────────────────────────────────────────────────────────────

  const allStatuses = Object.values(manifest.seasons).flatMap(s => Object.values(s))
  const complete = allStatuses.filter(s => s.playerCacheStatus === 'complete' && s.teamSeasonCacheStatus === 'complete').length
  const failures = allStatuses.filter(s => s.playerCacheStatus === 'failed' || s.teamSeasonCacheStatus === 'failed').length

  console.log(`\n── Seed Complete ────────────────────────────`)
  console.log(`  Work items processed: ${done}`)
  console.log(`  Fully complete (all seasons): ${complete}`)
  console.log(`  With failures: ${failures}`)

  if (failures > 0) {
    console.log('\nFailed entries:')
    allStatuses
      .filter(s => s.playerCacheStatus === 'failed' || s.teamSeasonCacheStatus === 'failed')
      .forEach(s => console.log(`  ${s.teamSlug} ${s.season}: ${s.lastError}`))
  }
}

main().catch(err => { console.error(err); process.exit(1) })
