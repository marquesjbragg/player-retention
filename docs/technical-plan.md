# Technical Plan

## Division II Basketball Player Retention Analysis Tool

---

## 1. Stack

| Category | Choice | Reason |
|----------|--------|--------|
| Framework | Next.js 14+ (App Router) | API routes + SSR in one repo; no separate backend |
| Language | TypeScript | Type safety is essential for complex nested data models |
| Styling | Tailwind CSS | Fast, utilitarian; no design system overhead |
| Data fetching | TanStack Query | Client-side caching, loading/error states, deduplication |
| Tables | TanStack Table | Headless, powerful sort/filter without UI lock-in |
| Fuzzy matching | fuse.js | Lightweight, well-tested, configurable thresholds |
| CSV | Native string construction | No dependency needed for this use case |
| Icons | Lucide React | Consistent, well-maintained |
| Charts (Phase 2) | Recharts | Lightweight, composable, good TypeScript support |

No ORM. No database. No global state management library. File-based cache + React context for UI state is sufficient.

---

## 2. TypeScript Interfaces

All interfaces live in `src/types/index.ts`.

```typescript
// ─── Core Entities ───────────────────────────────────────────────────────────

export interface Team {
  id: string
  name: string
  shortName: string
  conference: string
}

export interface Season {
  year: number       // ending year: 2024 = 2023-24 season
  label: string      // "2023-24"
}

// ─── Season Data ─────────────────────────────────────────────────────────────

export interface PlayerSeason {
  playerId: string
  playerName: string
  teamId: string
  seasonYear: number
  games: number
  gamesStarted: number | null    // null when not reported by NCAA
  minutesPlayed: number
  points: number
  assists: number
  totalRebounds: number
  offRebounds: number
  defRebounds: number
  steals: number
  blocks: number
  turnovers: number
  fgMade: number
  fgAttempted: number
  threeMade: number
  threeAttempted: number
  ftMade: number
  ftAttempted: number
}

export interface TeamSeason {
  teamId: string
  seasonYear: number
  wins: number
  losses: number
  ppg: number
  oppPpg: number
  fgPct: number
  threePct: number
  ftPct: number
  oppFgPct: number
  oppThreePct: number
  apg: number
  topg: number
  spg: number
  bpg: number
  orbpg: number
  drbpg: number
  oppTopg: number
}

// ─── Player Matching ──────────────────────────────────────────────────────────

export type MatchConfidence = 'exact' | 'fuzzy' | 'low' | 'manual'

export interface ReturnedPlayer {
  playerName: string
  year1Stats: PlayerSeason
  year2Stats: PlayerSeason
  matchConfidence: MatchConfidence
  similarityScore?: number    // populated for fuzzy/low matches
}

export interface LowConfidenceCandidate {
  year1Player: PlayerSeason
  year2Player: PlayerSeason
  similarityScore: number     // 0.75–0.87 range; surfaced for manual review
}

export interface PlayerOverride {
  teamId: string
  year1: number
  year2: number
  year1PlayerId: string
  year2PlayerId: string
}

export type OutlierFlag =
  | 'high-ci-improved'
  | 'high-ci-declined'
  | 'low-ci-improved'
  | 'low-ci-declined'
  | null

export interface MatchingResult {
  returning: ReturnedPlayer[]
  nonReturning: PlayerSeason[]              // Year 1 players with no Year 2 match
  newPlayers: PlayerSeason[]                // Year 2 players with no Year 1 match
  lowConfidenceExcluded: LowConfidenceCandidate[]   // pairs surfaced for manual override
  warnings: string[]
}

// ─── Retention Analysis ───────────────────────────────────────────────────────

export type DataQuality = 'complete' | 'partial'

export interface RetentionAnalysis {
  teamId: string
  year1: number
  year2: number
  // Composite score
  continuityIndex: number
  dataQuality: DataQuality
  // Component metrics
  returningMinutesPct: number
  returningStartsPct: number | null    // null when starts data unavailable
  returningPointsPct: number
  // Display-only counts (not scored)
  returningPlayersCount: number
  returningStartersCount: number
  newPlayersCount: number
  // Context metrics (not scored)
  deptMinutesPct: number        // departed players' min as % of Year 1 total; Ret.Min% + Dept.Min% = 100%
  deptPointsPct: number         // departed players' pts as % of Year 1 total; Ret.Pts% + Dept.Pts% = 100%
  newcomerMinutesPct: number    // new Year 2 players' min as % of Year 2 total (different denominator)
  newcomerPointsPct: number     // new Year 2 players' pts as % of Year 2 total (different denominator)
  // Player-level detail
  returningPlayers: ReturnedPlayer[]
  nonReturningPlayers: PlayerSeason[]
  newPlayers: PlayerSeason[]
  lowConfidenceExcluded: LowConfidenceCandidate[]
  // Quality metadata
  warnings: string[]
  minimumMinutesThreshold: number    // documents threshold used for this analysis
}

// ─── Stat Deltas ─────────────────────────────────────────────────────────────

export type DeltaDirection = 'up' | 'down' | 'neutral'

export interface StatDelta {
  key: string
  label: string
  category: 'success' | 'offense' | 'defense'
  year1Value: number
  year2Value: number
  delta: number
  direction: DeltaDirection
  higherIsBetter: boolean
}

// ─── Team Comparison (Full Output) ───────────────────────────────────────────

export interface TeamComparison {
  team: Team
  year1Stats: TeamSeason
  year2Stats: TeamSeason
  retention: RetentionAnalysis
  deltas: StatDelta[]
}

// ─── Browse Table Row ─────────────────────────────────────────────────────────

export interface BrowseRow {
  team: Team
  continuityIndex: number
  dataQuality: DataQuality
  returningMinutesPct: number
  returningStartsPct: number | null
  returningPointsPct: number
  returningPlayersCount: number
  returningStartersCount: number
  newPlayersCount: number
  winPctDelta: number
  ppgDelta: number
  oppPpgDelta: number
  year1WinPct: number
  year2WinPct: number
  // Context metrics (4 additional columns)
  deptMinutesPct: number
  deptPointsPct: number
  newcomerMinutesPct: number
  newcomerPointsPct: number
  // Outlier classification
  outlierFlag: OutlierFlag    // null = no outlier pattern detected
}

// ─── Data Provider Interface ──────────────────────────────────────────────────

export interface IDataProvider {
  getTeams(conference?: string): Promise<Team[]>
  getConferences(): Promise<string[]>
  getTeamSeason(teamId: string, year: number): Promise<TeamSeason>
  getPlayerSeasons(teamId: string, year: number): Promise<PlayerSeason[]>
}

// ─── API Response Types ───────────────────────────────────────────────────────

export interface ApiError {
  code: string
  message: string
  details?: string
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError }
```

---

## 3. API Routes

All routes are Next.js App Router route handlers in `src/app/api/`.

### `GET /api/teams`
Query: `?conference=PSAC` (optional)
Returns: `Team[]`

### `GET /api/conferences`
Returns: `string[]` (sorted conference names)

### `GET /api/retention`
Query: `?teamId=X&year1=2022&year2=2023`
Returns: `TeamComparison`
Validation: year2 must be > year1; both years must be in supported range

### `GET /api/browse`
Query: `?conference=X&year1=2022&year2=2023` (conference optional)
Returns: `BrowseRow[]`

### `GET /api/teamseason`
Query: `?teamId=X&year=2024`
Returns: `{ team: Team; stats: TeamSeason }`
Used by the Single Season tab. Wraps `DataService.getSingleTeamSeason()`.

### `GET /api/overrides`
Query: `?teamId=X&year1=2024&year2=2025`
Returns: `PlayerOverride[]` for the given team-year pair.

### `POST /api/overrides`
Body: `PlayerOverride`
Persists a manual match to `data/player-overrides.json`. Deduplicates by `year1PlayerId`.
Returns: `{ success: true; overrides: PlayerOverride[] }`

### `DELETE /api/overrides`
Body: `{ teamId, year1, year2, year1PlayerId }`
Removes a specific override. Cleans up empty store keys.
Returns: `{ success: true; overrides: PlayerOverride[] }`

---

## 4. Core Utility Functions

### `lib/analytics/matching.ts`

```typescript
function normalizePlayerName(name: string): string
function matchPlayerRosters(
  year1Players: PlayerSeason[],
  year2Players: PlayerSeason[],
  minMinutesThreshold: number
): MatchingResult

// Applied post-matching — moves overridden LowConfidenceCandidates into returning[],
// removes them from newPlayers[], sets matchConfidence = 'manual'
function applyManualOverrides(
  matchResult: MatchingResult,
  overrides: PlayerOverride[]
): MatchingResult
```

Thresholds:
- `FUZZY_THRESHOLD = 0.88` — auto-accept as returning with confidence `'fuzzy'`
- `LOW_CONF_MIN = 0.75` — surface as `LowConfidenceCandidate` for manual review
- Below 0.75 — ignored entirely

### `lib/analytics/retention.ts`

```typescript
function calculateRetention(
  matchResult: MatchingResult,
  year1Players: PlayerSeason[],
  minMinutesThreshold: number
): RetentionAnalysis
function detectStartsDataQuality(players: PlayerSeason[]): boolean
```

### `lib/analytics/deltas.ts`

```typescript
function calculateDeltas(year1: TeamSeason, year2: TeamSeason): StatDelta[]
function getDeltaDirection(delta: number, higherIsBetter: boolean): DeltaDirection
```

### `lib/data/dataService.ts`

```typescript
function getTeamComparison(teamId: string, year1: number, year2: number): Promise<TeamComparison>
function getBrowseData(year1: number, year2: number, conference?: string): Promise<BrowseRow[]>
function getSingleTeamSeason(teamId: string, year: number): Promise<{ team: Team; stats: TeamSeason; coach: string | null }>
function getCoach(teamId: string, year: number): Promise<string | null>
```

### `lib/data/providers/coachMetadataProvider.ts`

Static coach data layer. Reads `data/coaches.json` — the authoritative source for head coach names.

```typescript
export interface CoachRecord {
  name:         string
  source:       'manual' | 'athletics-page' | 'news-release' | 'sidearm' | 'unknown'
  confidence:   'high' | 'medium' | 'low'
  url?:         string
  lastUpdated?: string   // YYYY-MM-DD
  notes?:       string
}

// Primary lookup — returns null if entry absent or name empty
function getCoachFromStore(teamId: string, year: number): CoachRecord | null

// Returns all populated entries for a team (for scripts/reporting)
function getTeamCoachHistory(teamId: string): Array<{ year: number; record: CoachRecord }>

// Returns fill status across all teams/years (used by seed script)
function getStoreFillStatus(): Array<{ teamId: string; year: number; filled: boolean; source?: string }>
```

#### Coach source priority (applied in `DataService.getCoach`)

| Priority | Source | Notes |
|---|---|---|
| 1 | `data/coaches.json` | Static, manually curated. Always wins. |
| 2 | Sidearm `coach` field | Runtime fallback. Unreliable for SIAC (returns `"0"`). Cached per-session. |
| 3 | `null` → "Unknown" | When neither source has a usable name. |

#### Why static JSON is primary

Live athletics pages show *current* coaching staff only. For a retrospective study covering seasons 2020–2025, historical data must be manually recorded — scraping current pages would give 2025–26 coaches, not who coached in 2022. `data/coaches.json` provides an immutable record that researchers populate once from official sources and maintain over time.

#### Populating coach data

```bash
npm run coaches:seed               # generate/refresh placeholder entries from sidearm-teams.json
npm run coaches:seed -- --dry-run  # preview without writing
npm run coaches:seed -- --year 2025  # seed only one season
```

After seeding, fill in empty `"name"` fields in `data/coaches.json` from:
- Official school athletics coaches pages (current season)
- Historical coaching announcements / press releases
- Conference media guide archives

The `_readme` key in `coaches.json` documents the schema in-file.

### `lib/data/providers/localCSVProvider.ts` — Team-level CSV file mapping

| Stat            | CSV file               | Column read |
|-----------------|------------------------|-------------|
| PPG, W-L        | teams-scoring.csv      | PPG, W-L    |
| Opp PPG         | teams-opp-scoring.csv  | OPP PPG     |
| FG%             | teams-fg.csv           | FG%         |
| 3PT%            | teams-3pt.csv          | 3FG%        |
| FT%             | teams-ft.csv           | FT%         |
| Assists/G       | teams-assists.csv      | APG         |
| Turnovers/G     | teams-turnovers.csv    | TOPG        |
| Steals/G        | teams-steals.csv       | STPG        |
| Blocks/G        | teams-blocks.csv       | BKPG        |
| Opp FG%         | teams-opp-fg.csv       | OPP FG%     |
| Opp 3PT%        | teams-opp-3pt.csv      | Pct         |
| Opp TO/G        | teams-opp-topg.csv     | Avg         |
| Def Reb/G       | teams-dreb.csv         | RPG         |
| Off Reb/G       | —                      | Unavailable |

---

## 5. NCAA Team-Stat Ingestion Workflow

### Overview

NCAA team-stat files are downloaded manually as `.xlsx` exports from `stats.ncaa.org`
and processed into the CSV files the app reads. The ingestion workflow is semi-automated:
the user downloads files and drops them into a known folder; one command handles the rest.

### Folder structure

```
data/
  inbox/
    ncaa/                     ← drop downloaded .xlsx files here (any filename)
      processed/
        2024/                 ← processed originals are archived here
  ncaa-csv/
    2024/
      teams-scoring.csv       ← final named files the app reads
      teams-fg.csv
      ...
```

### Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `scripts/ingest-ncaa.ts` | `npm run ncaa:ingest -- --year YYYY` | Process inbox, convert xlsx→csv, auto-detect category, write to ncaa-csv, clear cache |
| `scripts/ncaa-status.ts` | `npm run ncaa:status` | Checklist showing present/missing files per season |
| `scripts/lib/ncaa-catalog.ts` | (library) | Single source of truth: all 13 expected files, detection logic, UI field mappings |

### Auto-detection

Each xlsx/csv is identified by its column headers. Detection rules are defined in
`scripts/lib/ncaa-catalog.ts` (`STAT_CATALOG`). Rules are ordered most-specific first;
the first matching rule wins.

| Detection trigger (lowercase header present) | → targetFile |
|---|---|
| `opp fg%` | teams-opp-fg.csv |
| `opp 3fga` or `opp 3fg` | teams-opp-3pt.csv |
| `opp to` | teams-opp-topg.csv |
| `drebs` | teams-dreb.csv |
| `opp ppg` or `opp pts` | teams-opp-scoring.csv |
| `fgm` + `fg%` | teams-fg.csv |
| `3fg%` (no `opp 3fga`) | teams-3pt.csv |
| `ft%` + `fta` | teams-ft.csv |
| `apg` | teams-assists.csv |
| `topg` | teams-turnovers.csv |
| `stpg` | teams-steals.csv |
| `bkpg` or `blks` | teams-blocks.csv |
| `ppg` + `pts` (no opp) | teams-scoring.csv |

### Cache clearing

After ingestion, the script automatically deletes `data/cache/teamstats-*-{year}.json`
entries for the processed season. These are frozen (never auto-refreshed), so deleting
them forces a fresh CSV read on the next request.

### `lib/export/csv.ts`

```typescript
function exportTeamComparisonCSV(comparison: TeamComparison): void
function exportBrowseCSV(rows: BrowseRow[], year1: number, year2: number): void
function buildCSVString(headers: string[], rows: string[][]): string
function downloadBlob(content: string, filename: string): void
```

### `lib/utils/formatting.ts`

```typescript
function formatPct(value: number, decimals?: number): string      // "72.4%"
function formatDelta(delta: number, decimals?: number): string    // "+2.7" or "-1.3"
function formatRecord(wins: number, losses: number): string       // "18-9"
function formatCI(score: number): string                          // "67.8"
```

---

## 6. Participation Threshold — Option B Implementation

Two independent checks joined by OR. A player qualifies if they meet **either** condition.

```typescript
export const THRESHOLD_MINUTES   = 30     // Check 1: minimum total minutes played
export const THRESHOLD_GAMES_PCT = 0.20   // Check 2: minimum 20% of team games

// Check 1 and Check 2 are evaluated independently — not collapsed.
// A player is excluded only if they FAIL BOTH.
export function meetsThreshold(player: PlayerSeason, teamGamesPlayed: number): boolean {
  const gamesRequired = Math.ceil(teamGamesPlayed * THRESHOLD_GAMES_PCT)
  return player.minutesPlayed >= THRESHOLD_MINUTES || player.games >= gamesRequired
}

// Returns qualified players AND full exclusion detail for below-threshold players.
export function applyThreshold(
  players: PlayerSeason[],
  teamGamesPlayed: number
): { qualified: PlayerSeason[]; excluded: BelowThresholdPlayer[] }
```

`BelowThresholdPlayer` (in `src/types/index.ts`) captures both conditions and generates a human-readable exclusion label, e.g.:
```
"4 min < 30 AND 2 GP < 7 (20% of 33 games)"
```

Players below the threshold:
- Excluded from Year 1 qualifying set (CI denominator)
- Excluded from player matching
- Included in player-level output with explicit exclusion label
- Stored in `RetentionAnalysis.belowThresholdPlayers`

`RetentionAnalysis` stores both threshold parameters for documentation in CSV exports:
- `thresholdMinutes: 30`
- `thresholdGamesPct: 0.20`
- `thresholdGamesRequired: number` (actual game cutoff for this team-season)

---

## 6. Starts Data Fallback — Implementation

```typescript
// Returns true if starts data is usable for CI calculation.
// Available = at least one player has non-null GS AND sum > 0.
// The Sidearm provider reports GS for most schools; fallback only for
// schools that do not track starts in their Sidearm system.
export function startsDataAvailable(players: PlayerSeason[]): boolean {
  if (players.length === 0) return false
  const nullCount = players.filter(p => p.gamesStarted === null).length
  if (nullCount === players.length) return false
  const sumStarts = players.reduce((acc, p) => acc + (p.gamesStarted ?? 0), 0)
  return sumStarts > 0
}
```

If starts unavailable:
- `returningStartsPct` is set to `null` in `RetentionAnalysis`
- `continuityIndex = (returningMinutesPct + returningPointsPct) / 2`
- `dataQuality = 'partial'`
- Warning added: `"Starts data not available for [Team] [Year] — Continuity Index calculated from Minutes % and Points % only."`

**Note:** For SIAC teams via Sidearm, GS is present and non-zero. The fallback applies only to schools that do not enter starts data in their Sidearm system, or to data sources (e.g. some NCAA CSV exports) that do not include a starts column.

---

## 7. Build Phases

### Phase 0 — Foundation ✓ Complete
- [x] Define all TypeScript interfaces (`src/types/index.ts`)
- [x] Build `IDataProvider` interface
- [x] Build `LocalCSVProvider` (reads NCAA CSV exports; team-level stats)
- [x] Build `SidearmProvider` (primary player-season source; Sidearm JSON API)
- [x] Build `cache.ts` utilities
- [x] Validate Sidearm fetch against real data (SIAC, Morehouse, 2025)
- [x] Fix CSV parsing issues (W-L combined field, comma-formatted numbers, BOM)

**Milestone:** `npm run test:sidearm` fetches real player data; `npm run test:pull` parses NCAA CSVs.

### Phase 1 — Analytics Engine ✓ Complete
- [x] Build `matching.ts` (name normalization, Jaro-Winkler fuzzy matching)
- [x] Build `retention.ts` (Option B threshold, CI calculation, starts fallback)
- [x] Build `deltas.ts` (year-over-year team stat deltas)
- [x] Build `scripts/compare-seasons.ts` (two-season comparison pipeline PoC)
- [x] Validate end-to-end: Morehouse 2024→2025, CI = 30.7, dataQuality = complete

**Milestone:** `npm run compare` produces a full `RetentionAnalysis` with all fields populated.

### Phase 1.5 — Data Layer + API ✓ Complete
- [x] Team_id discovery for SIAC: all 13 teams in `data/sidearm-teams.json`
- [x] `DataService` (cache-through routing: players → Sidearm; stats → CSV)
- [x] API routes: `/api/teams`, `/api/conferences`, `/api/retention`, `/api/browse`
- [x] Validated: `/api/browse?conference=SIAC&year1=2024&year2=2025` returns 12/13 teams
- [x] All SIAC teams `dataQuality: complete` (GS present in Sidearm data)

**Data source confirmed:** NCAA team-level CSV exports cover 289 DII teams including all SIAC teams. Valid and sufficient for all team-stat metrics.

**Currently downloaded:**
- `data/ncaa-csv/2024/teams-scoring.csv` → W-L, PPG ✓

**Still needed per year (download from stats.ncaa.org → Men's Basketball → Div II):**
- [ ] `teams-opp-scoring.csv` — Scoring Defense → `oppPpg`
- [ ] `teams-fg.csv` — FG% → `fgPct`
- [ ] `teams-3pt.csv` — 3-Point FG% → `threePct`
- [ ] `teams-ft.csv` — FT% → `ftPct`
- [ ] `teams-assists.csv` — Assists Per Game → `apg`
- [ ] `teams-turnovers.csv` — Turnovers Per Game → `topg`
- [ ] `teams-steals.csv` — Steals Per Game → `spg`
- [ ] `teams-blocks.csv` — Blocks Per Game → `bpg`
- [ ] All 9 files also needed for 2025

**Available via CSV (confirmed downloads):**
- `oppFgPct` → `teams-opp-fg.csv`, `oppThreePct` → `teams-opp-3pt.csv`, `oppTopg` → `teams-opp-topg.csv`
- `drbpg` → `teams-dreb.csv`

**Permanently unavailable (no standard NCAA export):**
- `orbpg` — offensive rebounds per game; no NCAA team-level CSV export exists
- UI shows "—" for this stat; provider returns 0 as sentinel

**Milestone reached:** `GET /api/retention?teamId=morehouse&year1=2024&year2=2025` returns correct `TeamComparison` JSON with CI=30.7 and W-L populated.

### Phase 3 — Multi-Conference Player-Data Expansion ✓ In Progress

**Goal:** Extend the player-data pipeline beyond SIAC to support all 8 target conferences.

- [x] Evaluated all 8 conference sites — confirmed all are Sidearm-hosted
- [x] Created `data/conference-registry.json` — metadata registry for all 9 conferences (SIAC + 8 new)
- [x] Updated `scripts/discover-teams.ts` — all 8 new conferences added to `CONFERENCE_TARGETS`
- [x] Added `discoverViaKnownCodes()` to discovery pipeline — resolves team IDs from known school codes (required because Sidearm pages are fully client-side rendered)
- [x] MIAA: 14/14 team IDs discovered and written to `sidearm-teams.json`
- [x] `DataService` already conference-aware — no runtime changes required for new conferences
- [x] API routes already parameterized — `/api/teams?conference=MIAA`, `/api/browse?conference=MIAA` work without code changes

**Remaining for full multi-conference support:**
- [ ] Add `knownSchoolCodes` + `schoolCodeNames` to `CONFERENCE_TARGETS` for the 7 remaining conferences
- [ ] Run `npm run discover` after each conference is configured → team IDs auto-populate
- [ ] Validate data pulls: `GET /api/browse?conference=MIAA&year1=2024&year2=2025`
- [ ] Update `data/conference-registry.json` discovery status to `"complete"` for each conference

**Conference discovery status:**

| Conference | Key | Teams | Tier | Status |
|-----------|-----|-------|------|--------|
| SIAC | SIAC | 13 | 1 | ✓ Complete |
| MIAA (Mid-America) | MIAA | 14 | 1 | ✓ Complete — team IDs seeded |
| Sunshine State | SSC | 11 | 1 | Pending — school codes known |
| Lone Star | LSC | 17 | 1 | Pending — school codes known |
| Pacific West | PacWest | 13 | 1 | Pending — school codes known |
| Gulf South | GSC | 12 | 1 | Pending — school codes known |
| PSAC | PSAC | 17 | 1 | Pending — school codes known |
| CCAA | CCAA | 12 | 1 | Pending — school codes known |
| Mountain East | MEC | 11 | 2 | Pending — sport=mbb, school codes known |

To activate a pending conference: add its `knownSchoolCodes` and `schoolCodeNames` to `CONFERENCE_TARGETS` in `discover-teams.ts`, then run `npm run discover`.

**Why no runtime changes are needed:**
`DataService` iterates all entries in `sidearm-teams.json` — adding a new conference key automatically makes its teams available to all API routes. Conference-scoped queries, browse filtering, and team discovery all work immediately once team IDs are seeded.

### Phase 2 — Core UI ✓ Complete
- [x] Landing page with conference/team/year selectors + Analyze button
- [x] `ContinuityCard` — CI score, quality badge, component bars, count badges
- [x] `StatDeltaTable` — tabbed success/offense/defense, shows "—" for unavailable stats
- [x] `ReturnedPlayersTable` — collapsible sections: returning, below-threshold (with exclusion labels), non-returning
- [x] `DataWarnings` — dismissible amber panel for data quality notices
- [x] TanStack Query wired to all API routes with 5-min stale time
- [x] Loading and error states on both pages
- [x] Tailwind v4 + `@tailwindcss/postcss` configured
- [x] `src/components/Providers.tsx` (QueryClientProvider wrapper)
- [x] Browse page (`src/app/browse/page.tsx`) with TanStack Table, sortable columns
- [x] Nav bar linking Compare ↔ Browse

**Milestone reached:** Full single-team comparison visible in browser. Browse table loads and sorts. Build passes with no type errors.

**Key files added:**
- `src/app/page.tsx` — Compare page
- `src/app/browse/page.tsx` — Browse page (with outlier flags, departed/newcomer columns, conference summary, metric legend)
- `src/app/methodology/page.tsx` — Guide page (server component, 6 sections)
- `src/app/layout.tsx` — layout with nav + Providers + Guide link
- `src/app/globals.css` — Tailwind v4 import
- `src/app/api/overrides/route.ts` — GET/POST/DELETE override persistence
- `src/components/` — ContinuityCard, StatDeltaTable, ReturnedPlayersTable, DataWarnings, Providers
- `src/hooks/` — useConferences, useTeams, useRetention, useBrowse
- `src/lib/utils/formatting.ts` — formatCI, formatPct, formatDelta, formatRecord, formatStatOrUnavailable
- `data/player-overrides.json` — persistent manual match store
- `postcss.config.mjs` — Tailwind v4 PostCSS config

### Phase 3 — Browse Mode ✓ Complete (included in Phase 2 delivery)

### Phase 4 — CSV Export
- [ ] `csv.ts` export utilities
- [ ] Export button on single team view
- [ ] Export button on browse view
- [ ] Columns include: `threshold_minutes`, `threshold_games_pct`, `threshold_games_required`, `data_quality`

**Milestone:** Both export paths produce clean, research-ready CSVs.

### Phase 5 — Data Quality and Polish
- [ ] Fuzzy match warnings in player table (yellow badge, tooltip)
- [ ] `dataQuality: 'partial'` badge on CI card with explanation
- [ ] Below-threshold players in player table with exclusion label (which check(s) failed)
- [ ] PPG system change warning (≥15% change between seasons)
- [ ] Final data QA pass with edge case teams

**Milestone:** Tool is research-ready and transparent about data limitations.

---

## 8. Supported Season Range

v1 target: **2019-20 through 2025-26** (years: 2020, 2021, 2022, 2023, 2024, 2025, 2026)

COVID note: The 2020-21 season was shortened and some programs did not play. This season should be included in the data but flagged in the UI as potentially having abnormal roster patterns due to the pandemic. The tool should not automatically exclude it — the researcher can account for it in interpretation.

---

## 9. Development Notes

- Year convention: integer representing the ending year. Season "2022-23" = year `2023`.
- `minutesPlayed` stores total minutes for the season, not per-game average. Per-game averages are computed on the fly where needed.
- All percentages stored as `number` between 0–100 (not 0–1 decimals).
- All per-game stats stored as season totals in `PlayerSeason`; per-game values derived by dividing by `games`.
- `TeamSeason` stores per-game averages directly (as reported by NCAA stats).

---

## 10. Constraints and Assumptions

1. Season data from completed seasons is immutable. Once cached, never re-fetched automatically.
2. Player identity is resolved by name only. No persistent NCAA player IDs are available at DII level.
3. Starts data may be null for some DII programs. The system handles this explicitly.
4. "Year" refers to the ending year of the season throughout the codebase.
5. Only Division II men's basketball is in scope for v1.
6. Mobile optimization is low priority. The tool is designed for desktop use.
7. The minimum minutes threshold is a configurable constant, not a user-facing setting in v1.
8. All CSV exports are client-side. No server-side file generation.
