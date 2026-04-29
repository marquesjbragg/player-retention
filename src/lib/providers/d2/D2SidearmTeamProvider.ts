/**
 * Fetches D2 team-season stats from the Sidearm Sports conference stats API.
 *
 * Offensive per-game stats come from the aggregate TEAM row in the player stats
 * endpoint (same endpoint as D2SidearmPlayerProvider). Opponent stats (oppPpg,
 * oppFgPct, oppThreePct) are scraped from the conference stats HTML page as a
 * best-effort step; they fall back to 0 if unavailable.
 *
 * Wins/losses are parsed from the conference stats HTML scoring-offense table.
 *
 * Normalized: data/cache/d2/sidearm/team-seasons/{season}/{teamSlug}.json
 */

import * as fs   from 'fs'
import * as path from 'path'
import type { TeamSeason } from '@/lib/types'
import { TeamRegistry }   from '@/lib/registry/TeamRegistry'
import { CacheManager, D2CachePaths } from '@/lib/cache/CacheManager'
import {
  D2SidearmPlayerProvider,
  SidearmPlayerRow,
} from './D2SidearmPlayerProvider'

const CONF_URLS_PATH = path.resolve(process.cwd(), 'data', 'registry', 'd2-conference-urls.json')

interface ConferenceConfig { url: string; path: string }
let _confUrls: Record<string, ConferenceConfig> | null = null

function loadConfUrls(): Record<string, ConferenceConfig> {
  if (!_confUrls) {
    _confUrls = JSON.parse(fs.readFileSync(CONF_URLS_PATH, 'utf-8'))
  }
  return _confUrls!
}

// ─── HTML parsing helpers ─────────────────────────────────────────────────────

interface ConferenceTeamRow {
  displayName: string
  games: number
  wins: number
  losses: number
  ppg: number
  oppPpg: number
  fgPct: number
  threePct: number
  oppFgPct: number
  oppThreePct: number
}

function parsePct(val: string): number {
  // handles both "0.482" (decimal) and "48.2" (percentage) formats
  const n = parseFloat(val)
  if (isNaN(n)) return 0
  return n < 2 ? Math.round(n * 1000) / 10 : n  // 0.482 → 48.2,  48.2 stays
}

function parseWL(wl: string): { wins: number; losses: number } {
  const [w, l] = wl.split('-')
  return { wins: parseInt(w ?? '0') || 0, losses: parseInt(l ?? '0') || 0 }
}

/**
 * Extracts team-level stats (W-L, PPG, opponent stats) from the conference
 * stats page HTML. Returns null on any parse failure so caller can gracefully
 * fall back to 0 values.
 */
async function fetchConferenceTeamRows(
  confConfig: ConferenceConfig,
  season: number
): Promise<Map<string, ConferenceTeamRow> | null> {
  try {
    // Sidearm uses starting-year convention: apiYear=2025 = 2025-26 season (our label: 2026)
    const url = `${confConfig.url}/stats.aspx?path=${confConfig.path}&year=${season - 1}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; player-retention-v2/1.0)' },
    })
    if (!res.ok) return null
    const html = await res.text()
    return parseConferenceHtml(html)
  } catch {
    return null
  }
}

// Column detection: find index of a header cell matching a predicate
function findCol(headers: string[], ...labels: string[]): number {
  const lc = labels.map(l => l.toLowerCase())
  return headers.findIndex(h => lc.some(l => h.toLowerCase().includes(l)))
}

// Try multiple heading label variants; return rows from first that matches
function tryExtractRows(html: string, ...labels: string[]): { rows: string[][]; headerRow: string[] } {
  for (const label of labels) {
    const allRows = extractTableRows(html, label)
    if (allRows.length === 0) continue
    // First row is header; body rows follow
    const headerRow = (allRows[0] ?? []).map(c => extractCellText(c))
    const bodyRows  = allRows.slice(1)
    if (bodyRows.length > 0) return { rows: bodyRows, headerRow }
  }
  return { rows: [], headerRow: [] }
}

function parseConferenceHtml(html: string): Map<string, ConferenceTeamRow> | null {
  const result = new Map<string, ConferenceTeamRow>()

  // ── Scoring offense table (W-L + PPG) ─────────────────────────────────────
  // Sidearm layouts vary: column order may include an "Index" rank column.
  // Dynamically locate "Team", "W-L" and "AVG" columns from the header row.
  const offResult = tryExtractRows(html,
    'Scoring Offense', 'Scoring', 'Offense', 'Scoring Margin')

  if (offResult.rows.length > 0) {
    const hdrs   = offResult.headerRow
    const teamCol = findCol(hdrs, 'team', 'school')
    const wlCol   = findCol(hdrs, 'w-l', 'wl', 'record')
    const avgCol  = findCol(hdrs, 'avg/g', 'avg', 'ppg')
    const gCol    = findCol(hdrs, 'g', 'gp', 'games')

    // Fall back to positional if header not found (legacy layout: Team|G|W-L|PTS|AVG/G)
    const tIdx  = teamCol !== -1 ? teamCol : 0
    const gIdx  = gCol    !== -1 ? gCol    : 1
    const wlIdx = wlCol   !== -1 ? wlCol   : 2
    const aIdx  = avgCol  !== -1 ? avgCol  : 4

    for (const row of offResult.rows) {
      const name = extractCellText(row[tIdx] ?? '')
      if (!name || name.toLowerCase() === 'team') continue
      const wl  = parseWL(extractCellText(row[wlIdx] ?? ''))
      const ppg = parseFloat(extractCellText(row[aIdx] ?? '')) || 0
      const g   = parseInt(extractCellText(row[gIdx] ?? '')) || 0
      result.set(normalizeTeamName(name), {
        displayName: name,
        games: g,
        wins:    wl.wins,
        losses:  wl.losses,
        ppg,
        oppPpg: 0, fgPct: 0, threePct: 0, oppFgPct: 0, oppThreePct: 0,
      })
    }
  }

  if (result.size === 0) return null

  // Helper: pull avg/ppg value from a defense-style table row
  // Skip entirely if the avg column is not found in the header (prevents raw-total garbage)
  const applyAvg = (rows: string[][], hdrs: string[], key: keyof ConferenceTeamRow) => {
    const tIdx  = findCol(hdrs, 'team', 'school')
    const aIdx  = findCol(hdrs, 'avg/g', 'avg', 'ppg')
    if (aIdx === -1) return  // no per-game column in this table — wrong table, skip
    const tCol  = tIdx !== -1 ? tIdx : 0
    for (const row of rows) {
      const name  = normalizeTeamName(extractCellText(row[tCol] ?? ''))
      const entry = result.get(name)
      const val = parseFloat(extractCellText(row[aIdx] ?? '')) || 0
      if (entry && val > 0 && val < 200) (entry as unknown as Record<string, unknown>)[key] = val
    }
  }

  // Helper: pull pct value from a percentage table row
  // Skip if no pct column found in the header
  const applyPct = (rows: string[][], hdrs: string[], key: keyof ConferenceTeamRow) => {
    const tIdx = findCol(hdrs, 'team', 'school')
    const pIdx = findCol(hdrs, 'pct', '%', 'fg%', '3p%', 'ft%')
    if (pIdx === -1) return  // no pct column in this table — wrong table, skip
    const tCol = tIdx !== -1 ? tIdx : 0
    for (const row of rows) {
      const name  = normalizeTeamName(extractCellText(row[tCol] ?? ''))
      const entry = result.get(name)
      const val = parsePct(extractCellText(row[pIdx] ?? ''))
      if (entry && val > 0 && val <= 100) (entry as unknown as Record<string, unknown>)[key] = val
    }
  }

  // ── Scoring defense (oppPpg) ───────────────────────────────────────────────
  const defResult = tryExtractRows(html, 'Scoring Defense', 'Defense')
  if (defResult.rows.length > 0) applyAvg(defResult.rows, defResult.headerRow, 'oppPpg')

  // ── Team FG% ──────────────────────────────────────────────────────────────
  const fgResult = tryExtractRows(html, 'Field Goal Pct', 'Team FG Percentage', 'FG Pct', 'Field Goals')
  if (fgResult.rows.length > 0) applyPct(fgResult.rows, fgResult.headerRow, 'fgPct')

  // ── Team 3PT% ─────────────────────────────────────────────────────────────
  const fg3Result = tryExtractRows(html,
    '3-Point FG Pct', 'Team 3-Point FG Percentage', '3-Point FG PCT', '3-Point FGs')
  if (fg3Result.rows.length > 0) applyPct(fg3Result.rows, fg3Result.headerRow, 'threePct')

  // ── Opp FG% ───────────────────────────────────────────────────────────────
  const oppFgResult = tryExtractRows(html,
    'Opp Field Goal Pct', 'Opponent FG Percentage', 'Field Goal Percent Defense')
  if (oppFgResult.rows.length > 0) applyPct(oppFgResult.rows, oppFgResult.headerRow, 'oppFgPct')

  // ── Opp 3PT% ─────────────────────────────────────────────────────────────
  const opp3Result = tryExtractRows(html,
    'Opp 3-Point FG Pct', 'Opponent 3-Point FG Percentage', '3-Point FG PCT Defense')
  if (opp3Result.rows.length > 0) applyPct(opp3Result.rows, opp3Result.headerRow, 'oppThreePct')

  return result
}

function normalizeTeamName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function extractCellText(cell: string): string {
  // Strip HTML tags and decode common entities
  return cell
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .trim()
}

/**
 * Finds the first HTML table after a heading containing `tableLabel` and
 * returns ALL rows (thead + tbody) as string[] arrays of raw cell HTML.
 * colCount is ignored (kept for API compat); we always capture all cells.
 * Returns empty array on no match.
 */
function extractTableRows(html: string, tableLabel: string): string[][] {
  const rows: string[][] = []
  // Find section header
  const labelIdx = html.toLowerCase().indexOf(tableLabel.toLowerCase())
  if (labelIdx === -1) return rows

  // Find next <table> after that header
  const tableStart = html.indexOf('<table', labelIdx)
  if (tableStart === -1) return rows
  const tableEnd = html.indexOf('</table>', tableStart)
  if (tableEnd === -1) return rows

  // Use the full table (thead + tbody) so header rows are included
  const tableHtml = html.slice(tableStart, tableEnd)

  // Extract each <tr> from the whole table
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch: RegExpExecArray | null
  while ((trMatch = trRegex.exec(tableHtml)) !== null) {
    const cells: string[] = []
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi
    let tdMatch: RegExpExecArray | null
    while ((tdMatch = tdRegex.exec(trMatch[1])) !== null) {
      cells.push(tdMatch[1])
    }
    if (cells.length > 0) rows.push(cells)
  }
  return rows
}

// ─── Normalization ────────────────────────────────────────────────────────────

function float(val: string | undefined): number {
  const n = parseFloat(val ?? '0')
  return isNaN(n) ? 0 : n
}

function perGame(total: string | undefined, games: number): number {
  if (games === 0) return 0
  const t = parseFloat(total ?? '0')
  return isNaN(t) ? 0 : Math.round((t / games) * 100) / 100
}

function normalizeTeamSeason(
  teamRow: SidearmPlayerRow,
  teamSlug: string,
  season: number,
  conference: string,
  confRow: ConferenceTeamRow | null
): TeamSeason {
  const s = teamRow.stats_stats ?? {}
  const games = parseInt(teamRow.games_played ?? '0') || 0

  return {
    teamId:     teamSlug,
    seasonYear: season,
    division:   'D2',
    conference,
    wins:    confRow?.wins    ?? 0,
    losses:  confRow?.losses  ?? 0,
    ppg:     confRow?.ppg     ?? float(s.points_per_game),
    oppPpg:  confRow?.oppPpg  ?? 0,
    fgPct:   confRow?.fgPct   ?? parsePct(s.field_goals_pct ?? '0'),
    threePct: confRow?.threePct ?? parsePct(s.three_points_pct ?? '0'),
    ftPct:   parsePct(s.free_throws_pct ?? '0'),
    oppFgPct:    confRow?.oppFgPct    ?? 0,
    oppThreePct: confRow?.oppThreePct ?? 0,
    apg:   perGame(s.assists,       games),
    topg:  perGame(s.turnovers,     games),
    spg:   perGame(s.steals,        games),
    bpg:   perGame(s.blocked_shots, games),
    orbpg: perGame(s.offensive_rebounds, games),
    drbpg: perGame(s.defensive_rebounds, games),
    oppTopg: 0,   // not available from Sidearm
    source: 'sidearm',
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export const D2SidearmTeamProvider = {
  async fetchAndCache(teamSlug: string, season: number): Promise<TeamSeason | null> {
    const normPath = D2CachePaths.teamSeason(season, teamSlug)
    const rawPath  = D2CachePaths.rawTeam(season, teamSlug)
    const frozen   = CacheManager.isFrozen(season)

    const cached = CacheManager.read<TeamSeason>(normPath)
    if (cached && !CacheManager.isStale(cached)) return cached.data

    const entry = TeamRegistry.getBySlug(teamSlug)
    if (!entry) throw new Error(`TeamRegistry: slug "${teamSlug}" not found`)

    const sidearmId = entry.externalIds.sidearmId
    if (!sidearmId) throw new Error(`No sidearmId for D2 team "${teamSlug}"`)

    const confUrls   = loadConfUrls()
    const confConfig = confUrls[entry.conference]
    if (!confConfig) throw new Error(`No conference URL config for "${entry.conference}"`)

    // Re-use raw player cache if available; otherwise fetch fresh
    const rawPath_players = D2CachePaths.rawPlayers(season, teamSlug)
    let rawArray: SidearmPlayerRow[]

    const existingRaw = CacheManager.readRaw<unknown>(rawPath_players)
    if (existingRaw) {
      // Guard: raw file may be a bare array or the full API body object
      rawArray = Array.isArray(existingRaw)
        ? (existingRaw as SidearmPlayerRow[])
        : ((existingRaw as { players?: SidearmPlayerRow[] }).players ?? [])
    } else {
      rawArray = await D2SidearmPlayerProvider.fetchRaw(teamSlug, season)
      CacheManager.writeRaw(rawPath_players, rawArray)
    }

    // Extract the TEAM aggregate row
    const teamRow = rawArray.find(r => r.uniform === 'TM' || r.name === 'TEAM')
    if (!teamRow) return null

    CacheManager.writeRaw(rawPath, teamRow)

    // Fetch conference HTML for W-L + opponent stats (best effort)
    const confRows = await fetchConferenceTeamRows(confConfig, season)
    const confRow = confRows ? confRows.get(normalizeTeamName(entry.displayName)) ?? null : null

    const ts = normalizeTeamSeason(teamRow, teamSlug, season, entry.conference, confRow)
    CacheManager.write(normPath, ts, frozen)
    return ts
  },

  async getTeamSeason(teamSlug: string, season: number): Promise<TeamSeason | null> {
    return this.fetchAndCache(teamSlug, season)
  },
}
