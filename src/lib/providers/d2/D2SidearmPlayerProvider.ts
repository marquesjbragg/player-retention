/**
 * Fetches D2 player season stats from the Sidearm Sports conference stats API.
 *
 * Each D2 conference runs its own Sidearm instance. Data is fetched via:
 *   GET {conf_url}/services/conf_stats.ashx
 *     ?method=get_team_stats&team_id={sidearmId}&sport={path}&year={season}
 *     &conf=False&postseason=False
 *
 * Raw cache:  data/cache/d2/sidearm/raw/players/{season}/{teamSlug}.json
 * Normalized: data/cache/d2/sidearm/players/{season}/{teamSlug}.json
 *
 * Registry requirement: entry must have externalIds.sidearmId (numeric team_code
 * found on the teamstats HTML page) and entry.conference must map to a key in
 * data/registry/d2-conference-urls.json.
 */

import * as fs   from 'fs'
import * as path from 'path'
import type { PlayerSeason } from '@/lib/types'
import { TeamRegistry }        from '@/lib/registry/TeamRegistry'
import { CacheManager, D2CachePaths } from '@/lib/cache/CacheManager'
import { normalizePlayerName } from '@/lib/engine/matching'

const CONF_URLS_PATH = path.resolve(process.cwd(), 'data', 'registry', 'd2-conference-urls.json')

interface ConferenceConfig { url: string; path: string }
let _confUrls: Record<string, ConferenceConfig> | null = null

function loadConfUrls(): Record<string, ConferenceConfig> {
  if (!_confUrls) {
    _confUrls = JSON.parse(fs.readFileSync(CONF_URLS_PATH, 'utf-8'))
  }
  return _confUrls!
}

// ─── Sidearm API types ────────────────────────────────────────────────────────

export interface SidearmStatBlock {
  field_goals_made?: string
  field_goals_attempted?: string
  field_goals_pct?: string
  three_points_made?: string
  three_points_attempted?: string
  three_points_pct?: string
  free_throws_made?: string
  free_throws_attempted?: string
  free_throws_pct?: string
  points_scored?: string
  points_per_game?: string
  total_rebounds?: string
  offensive_rebounds?: string
  defensive_rebounds?: string
  rebounds_per_game?: string
  assists?: string
  assists_per_game?: string
  steals?: string
  steals_per_game?: string
  blocked_shots?: string
  blocked_shots_per_game?: string
  turnovers?: string
  minutes_played?: string
  personal_fouls?: string
}

export interface SidearmPlayerRow {
  name: string
  checkname?: string
  team_name?: string
  team_id?: string      // school abbreviation code, e.g. "NMU"
  team_code?: string    // numeric Sidearm school ID, e.g. "506"
  sdrm_id?: string      // stable Sidearm player ID, e.g. "425-2311"
  games_played?: string
  games_started?: string
  uniform?: string
  year?: string         // eligibility year code
  position?: string
  stats_stats?: SidearmStatBlock
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function parseSidearmName(raw: string): string {
  // "LastName,FirstName" → "FirstName LastName"
  const comma = raw.indexOf(',')
  if (comma === -1) return raw.trim()
  const last  = raw.slice(0, comma).trim()
  const first = raw.slice(comma + 1).trim()
  return first ? `${first} ${last}` : last
}

function int(val: string | undefined): number {
  return parseInt(val ?? '0', 10) || 0
}

// ─── Normalization ────────────────────────────────────────────────────────────

function normalize(row: SidearmPlayerRow, teamSlug: string, season: number): PlayerSeason {
  const s          = row.stats_stats ?? {}
  const hasRealId  = row.sdrm_id && row.sdrm_id !== '0'
  const playerId   = hasRealId
    ? `sidearm-${row.sdrm_id}`
    : `sidearm-name-${teamSlug}-${row.name.replace(/\W/g, '')}`
  const playerName = parseSidearmName(row.name)

  return {
    playerId,
    playerName,
    teamId:         teamSlug,
    seasonYear:     season,
    position:       row.position || undefined,
    games:          int(row.games_played),
    gamesStarted:   row.games_started !== undefined ? int(row.games_started) : null,
    minutesPlayed:  int(s.minutes_played),
    points:         int(s.points_scored),
    assists:        int(s.assists),
    steals:         int(s.steals),
    blocks:         int(s.blocked_shots),
    turnovers:      int(s.turnovers),
    totalRebounds:  int(s.total_rebounds),
    offRebounds:    int(s.offensive_rebounds),
    defRebounds:    int(s.defensive_rebounds),
    fgMade:         int(s.field_goals_made),
    fgAttempted:    int(s.field_goals_attempted),
    threeMade:      int(s.three_points_made),
    threeAttempted: int(s.three_points_attempted),
    ftMade:         int(s.free_throws_made),
    ftAttempted:    int(s.free_throws_attempted),
    source:         'sidearm',
    // Identity enrichment fields
    // eligibilityYear: Sidearm stats API returns year="0" for all players (not supported
    // in this endpoint). Field reserved for future population via roster-page scraping.
    eligibilityYear: null,
    normalizedName:  normalizePlayerName(playerName),
    sourceKey:       hasRealId ? (row.sdrm_id ?? null) : null,
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const D2SidearmPlayerProvider = {
  buildUrl(confConfig: ConferenceConfig, sidearmId: string, season: number): string {
    // Sidearm uses starting-year convention: apiYear=2025 = 2025-26 season (our label: 2026)
    const apiYear = season - 1
    return `${confConfig.url}/services/conf_stats.ashx?method=get_team_stats&team_id=${sidearmId}&sport=${confConfig.path}&year=${apiYear}&conf=False&postseason=False`
  },

  async fetchRaw(teamSlug: string, season: number): Promise<SidearmPlayerRow[]> {
    const entry = TeamRegistry.getBySlug(teamSlug)
    if (!entry) throw new Error(`TeamRegistry: slug "${teamSlug}" not found`)

    const sidearmId = entry.externalIds.sidearmId
    if (!sidearmId) throw new Error(`No sidearmId for D2 team "${teamSlug}" — run build-d2-registry.ts first`)

    const confUrls   = loadConfUrls()
    const confConfig = confUrls[entry.conference]
    if (!confConfig) throw new Error(`No conference URL config for conference "${entry.conference}"`)

    const url = this.buildUrl(confConfig, sidearmId, season)
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; player-retention-v2/1.0)' },
    })
    if (!res.ok) throw new Error(`Sidearm HTTP ${res.status} for ${teamSlug} ${season}: ${url}`)

    const body = await res.json()
    if (!body) return []
    // API returns { players: [...], season, conference, coach } — not a bare array
    const rows = Array.isArray(body) ? body : ((body as { players?: SidearmPlayerRow[] }).players ?? [])
    return rows
  },

  async fetchAndCache(teamSlug: string, season: number): Promise<PlayerSeason[]> {
    const normPath = D2CachePaths.players(season, teamSlug)
    const rawPath  = D2CachePaths.rawPlayers(season, teamSlug)
    const frozen   = CacheManager.isFrozen(season)

    const cached = CacheManager.read<PlayerSeason[]>(normPath)
    if (cached && !CacheManager.isStale(cached)) return cached.data

    const rawArray = await this.fetchRaw(teamSlug, season)
    CacheManager.writeRaw(rawPath, rawArray)

    // Exclude the TEAM aggregate row and nameless entries
    const players = rawArray
      .filter(r => r.uniform !== 'TM' && r.name && r.name !== 'TEAM')
      .map(r => normalize(r, teamSlug, season))

    CacheManager.write(normPath, players, frozen)
    return players
  },

  async getPlayerSeasons(teamSlug: string, season: number): Promise<PlayerSeason[]> {
    return this.fetchAndCache(teamSlug, season)
  },
}
