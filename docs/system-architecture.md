# System Architecture

## Division II Basketball Player Retention Analysis Tool

---

## 1. Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                       Next.js Application                          │
│                                                                   │
│  ┌──────────────────┐    ┌─────────────────────────────────────┐  │
│  │  React Frontend  │◄──►│  Next.js API Routes                 │  │
│  │  (TypeScript)    │    │  (serverless handlers)              │  │
│  └──────────────────┘    └──────────────┬───────────────────── ┘  │
│                                         │                          │
│                            ┌────────────▼──────────────────────┐  │
│                            │     DataService                    │  │
│                            │     (cache-through orchestrator)   │  │
│                            └────────────┬──────────────────────┘  │
│                                         │                          │
│         ┌───────────────────────────────┼─────────────────────┐   │
│         │                               │                     │   │
│  ┌──────▼─────────────┐   ┌─────────────▼───────┐  ┌─────────▼┐  │
│  │  SidearmProvider   │   │  LocalCSVProvider   │  │ Cache    │  │
│  │  (primary, player  │   │  (team-level stats, │  │ Layer    │  │
│  │   season data)     │   │   CSV fallback)     │  │ JSON     │  │
│  └────────────────────┘   └─────────────────────┘  └──────────┘  │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │               Analytics Engine                              │   │
│  │   matching.ts  |  retention.ts  |  deltas.ts               │   │
│  └────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 2. Build Approach

**Next.js with API routes (serverless handlers). No separate backend.**

This is the right architecture for this project because:
- The data layer does not require a persistent process. It reads from cached JSON files or makes outbound HTTP requests to NCAA stats endpoints.
- API routes provide clean server/client separation without managing a second service.
- A single `next dev` starts the entire application.
- Deployment requires no additional infrastructure.
- The file-based cache works naturally in this setup.

No database. No separate backend service. No message queue. File-based cache and Next.js API routes is the appropriate level of complexity for a research tool of this scope.

---

## 3. Data Flow

### Single Team Comparison Request

```
1. User selects conference → team → Year 1 → Year 2
2. Frontend calls GET /api/teams?conference=SIAC
3. User clicks "Analyze"
4. Frontend calls GET /api/retention?teamId=morehouse&year1=2024&year2=2025
5. API route calls DataService.getTeamSeasonComparison(teamId, year1, year2)
6. DataService in parallel:
     a. getPlayerSeasons(year1) → check cache → SidearmProvider (or CSV fallback)
     b. getPlayerSeasons(year2) → check cache → SidearmProvider (or CSV fallback)
     c. getTeamSeason(year1)   → check cache → LocalCSVProvider (NCAA CSV)
     d. getTeamSeason(year2)   → check cache → LocalCSVProvider (NCAA CSV)
7. Analytics engine:
     a. applyThreshold(): filter Year 1 players by Option B participation threshold
     b. matchPlayerRosters(): Jaro-Winkler name matching
     c. calculateRetention(): CI + components + starts fallback if needed
     d. calculateDeltas(): year-over-year team stat changes
8. API route returns TeamComparison object
9. TanStack Query caches response client-side (5 min stale time)
10. Frontend renders results, enables CSV export
```

### Browse Request

```
1. User selects conference + year pair
2. Frontend calls GET /api/browse?conference=X&year1=Y&year2=Z
3. API route iterates all teams (filtered by conference)
4. For each team: runs same DataService + analytics pipeline as above
5. Returns array of TeamComparison objects (trimmed to table columns)
6. Frontend renders sortable BrowseTable
```

---

## 4. Data Provider Interface

All data sources implement a single interface contract. This makes the source swappable.

```typescript
interface IDataProvider {
  getTeams(conference?: string): Promise<Team[]>
  getConferences(): Promise<string[]>
  getTeamSeason(teamId: string, year: number): Promise<TeamSeason>
  getPlayerSeasons(teamId: string, year: number): Promise<PlayerSeason[]>
}
```

Three implementations exist in v1:

| Provider | Responsibility | Status |
|----------|----------------|--------|
| `SidearmProvider` | Player-season data from Sidearm Sports conference JSON API | **Primary v1** — validated |
| `LocalCSVProvider` | Team-level stats from NCAA CSV exports; player fallback for non-Sidearm conferences | Support/fallback |
| `NcaaProvider` | Live NCAA stats API | Blocked by Akamai WAF; kept for reference |

**`DataService`** acts as a cache-through orchestrator:
1. Check file cache first (`/data/cache/`)
2. On miss, call the appropriate provider (Sidearm for players; CSV for team stats)
3. Write result to cache
4. Return result

**Player data routing:**
- Player seasons → `SidearmProvider` (primary) for conferences hosted on Sidearm
- Player seasons → `LocalCSVProvider` (fallback) for non-Sidearm conferences, if a team-specific CSV is available

**Team-level stat routing:**
- Team W-L, PPG, FG% etc. → `LocalCSVProvider` reading NCAA CSV exports

---

## 5. Multi-Conference Configuration

### data/conference-registry.json

The conference registry documents all targeted DII conferences — their display names, Sidearm base URLs, sport codes, stats paths, and discovery status. It is the source of truth for "which conferences exist and what we know about them." It is not read at runtime; it drives the discovery workflow and serves as documentation.

```json
{
  "conferences": {
    "SIAC":    { "displayName": "Southern Intercollegiate Athletic Conference", ... },
    "MIAA":    { "displayName": "Mid-America Intercollegiate Athletics Association", ... },
    "SSC":     { "displayName": "Sunshine State Conference", ... },
    "LSC":     { "displayName": "Lone Star Conference", ... },
    "MEC":     { "displayName": "Mountain East Conference", "sport": "mbb", ... },
    "PacWest": { "displayName": "Pacific West Conference", ... },
    "GSC":     { "displayName": "Gulf South Conference", ... },
    "PSAC":    { "displayName": "Pennsylvania State Athletic Conference", ... },
    "CCAA":    { "displayName": "California Collegiate Athletic Association", ... }
  }
}
```

Conference tiers reflect discovery complexity:
- **Tier 1**: Direct `stats.aspx?path=mbball` entry — same pattern as SIAC. Zero config changes needed.
- **Tier 2**: Sidearm-hosted but uses a different sport code (e.g. Mountain East uses `mbb`). The `sport` field in both the registry and `CONFERENCE_TARGETS` handles this transparently.

### data/sidearm-teams.json

The operational team-ID map. Maps team slug → Sidearm numeric `team_id` for each conference that has been discovered. This file is read at runtime by `DataService` to route player-season fetches to the correct `SidearmProvider` config.

```json
{
  "SIAC": {
    "baseUrl": "https://thesiac.com",
    "sport": "mbball",
    "teams": {
      "morehouse": { "sidearmId": "445", "name": "Morehouse", "schoolCode": "mhc" },
      "benedict":  { "sidearmId": "55",  "name": "Benedict",  "schoolCode": "bc" },
      ...
    }
  },
  "MIAA": {
    "baseUrl": "https://themiaa.com",
    "sport": "mbball",
    "teams": {
      "washburn":        { "sidearmId": "2814",  "name": "Washburn",        "schoolCode": "wu"   },
      "fort-hays-state": { "sidearmId": "9011",  "name": "Fort Hays State", "schoolCode": "fhsu" },
      ...
    }
  }
}
```

**Currently seeded:**
- SIAC: 13 teams — all validated (2024, 2025)
- MIAA: 14 teams — team IDs discovered, ready for data pulls

**To add a new conference:**
1. Add the conference to `CONFERENCE_TARGETS` in `scripts/discover-teams.ts` with `knownSchoolCodes` and `schoolCodeNames` (look these up from the conference's stats page)
2. Run `npm run discover` — the known-codes resolver will call each school's `teamstats.aspx` page and extract the embedded `team_id`
3. Verify entries were written to `sidearm-teams.json`
4. Update `data/conference-registry.json` discovery status to `"complete"`

**Why known school codes are required:**
Sidearm conference stats pages are fully client-side rendered. The `get_conference_teams` API endpoint returns empty on all tested conferences. The HTML-scraping fallback also finds no links (they load via JavaScript). However, each individual school's `teamstats.aspx` page embeds the `team_id` as a JavaScript variable in its server-rendered HTML — discoverable via HTTP GET with no browser automation required.

The `schoolCode` field on each team record is the `school=` URL parameter on the conference stats page. It is not required for API calls but enables the known-codes discovery path and is useful for debugging.

### Conference Separation in DataService

`DataService` is fully conference-aware. Conference isolation happens at the config-file level:

- `getTeamsByConference("MIAA")` → reads MIAA entries from `sidearm-teams.json`
- `getTeamsByConference("SIAC")` → reads SIAC entries from `sidearm-teams.json`
- `getTeamsByConference()` → returns all teams across all configured conferences
- `getConferences()` → returns all conference keys present in `sidearm-teams.json`

Each team's `conference` field is populated from the conference key it belongs to in `sidearm-teams.json`. Browse filtering and team dropdown filtering both use this field. No hardcoded conference lists exist anywhere in the runtime code.

---

## 5b. Data Strategy

### Player-Level Data — Sidearm Sports (Primary)

Sidearm Sports hosts conference stats pages for the majority of DII conferences. Each team's stats page loads player data from an internal JSON API endpoint:

```
GET /services/conf_stats.ashx
  ?method=get_team_stats
  &team_id={numericId}
  &sport=mbball
  &year={endingYear}
  &conf=False
  &postseason=False
```

This endpoint returns clean JSON — no headless browser, no session management required. It is unofficial and undocumented, discoverable via browser DevTools.

**Verified fields:** GP, MP (minutes played), PTS, GS (games started), FGM/A, 3PM/A, FTM/A, OREB, DREB, AST, STL, BLK, turnovers.

**GS (games started) is present** as a top-level field on each player row for Sidearm-hosted schools that track starts. For Morehouse in the SIAC, 2024 season: sum of GS across 15 qualified players = 155. The full three-component CI is supported from this source.

**team_id discovery:** The numeric team_id is not derivable from the team name. It must be discovered once per conference by either:
- Reading the conference teams list endpoint: `GET /services/conf_stats.ashx?method=get_conference_teams&sport=mbball&year={year}`
- Or inspecting the team stats page URL in a browser

### Team-Level Stats — NCAA CSV Exports (Confirmed Valid)

Team W-L records, PPG, FG%, and other per-game averages are downloaded as CSV exports from `stats.ncaa.org`. These feed the `TeamSeason` object and power year-over-year stat delta comparisons.

**Confirmed:** NCAA team-level exports cover 289 DII men's basketball teams and include all SIAC teams. This source is valid and sufficient for all team-stat metrics the tool needs.

**Currently downloaded:**
- `data/ncaa-csv/2024/teams-scoring.csv` — W-L, PPG ✓

**Still needed (download from stats.ncaa.org → Men's Basketball → Division II → Team stats):**

| File | Stat category | Populates |
|------|---------------|-----------|
| `teams-opp-scoring.csv` | Scoring Defense | `oppPpg` |
| `teams-fg.csv` | FG% | `fgPct` |
| `teams-3pt.csv` | 3-Point FG% | `threePct` |
| `teams-ft.csv` | FT% | `ftPct` |
| `teams-assists.csv` | Assists Per Game | `apg` |
| `teams-turnovers.csv` | Turnovers Per Game | `topg` |
| `teams-steals.csv` | Steals Per Game | `spg` |
| `teams-blocks.csv` | Blocks Per Game | `bpg` |

All 9 files are needed for **each season year** (2024, 2025, etc.). Place in `data/ncaa-csv/{year}/`.

**Cannot be sourced — hardcoded to unavailable:**
- Opponent FG% (`oppFgPct`) — no standard export
- Opponent 3PT% (`oppThreePct`) — no standard export
- Opponent Turnovers/G (`oppTopg`) — no standard export
- Off/Def rebounds split (`orbpg`, `drbpg`) — NCAA export gives total rebounds only, not split

The UI shows "—" for these fields rather than a misleading 0.

- See `data/ncaa-csv/README.txt` for download instructions
- The `LocalCSVProvider` reads these files directly; returns 0 when a file is absent (UI detects and labels these as unavailable)

### Seed Strategy

1. Fetch team_id mappings for target conferences → store in `data/sidearm-teams.json`
2. For each target team-season: call Sidearm API → normalize → write to `data/cache/`
3. Download NCAA team-level CSVs for target years → place in `data/ncaa-csv/{year}/`
4. Running app reads from cache first; live pulls on cache miss

Data from completed seasons is treated as **permanent** — cached once, never re-fetched automatically. This ensures study results are reproducible.

### Fallback for Non-Sidearm Conferences

For DII conferences not hosted on Sidearm, player data falls back to `LocalCSVProvider` if a team-specific CSV export is available. The NCAA scoring leaders export (top N scorers across all DII) is **not** a valid source for team roster analysis.

### Year Range

Sidearm year parameter = ending year of the season (e.g., `year=2025` = 2024-25 season).

| Year param | Season    | Notes |
|------------|-----------|-------|
| 2025       | 2024-25   | Validated |
| 2024       | 2023-24   | Validated |
| 2023       | 2022-23   | Assumed working |
| 2022       | 2021-22   | Assumed working |
| 2021       | 2020-21   | COVID-shortened; some teams did not play |

---

## 6. Caching Strategy

### Cache Location

```
/data/cache/
├── teams.json                                  ← full DII team list
├── conferences.json                            ← derived conference list
├── team-{id}-season-{year}-stats.json         ← team season stats
├── team-{id}-season-{year}-roster.json        ← player season data
└── meta.json                                  ← write timestamps per key
```

The `/data/cache/` directory is not committed to version control for general use, but a seeded research dataset may be committed to lock in the study's source data.

### Cache Lifetime

| Data Type | Lifetime | Reasoning |
|-----------|----------|-----------|
| Teams list | 24 hours | Team/conference assignments change rarely |
| Completed season stats | Permanent | Historical data is immutable |
| Completed season rosters | Permanent | Same |
| Current season stats | 6 hours | May update mid-season |
| Conferences list | 24 hours | Derived; same cadence as teams list |

### Client-Side Cache

TanStack Query is used for client-side caching with a 5-minute stale time. This prevents redundant API calls during a single research session.

---

## 7. Player Matching Algorithm

Full methodology documented in `docs/study-methodology.md`, Section 7.

Implementation summary:

```
1. Normalize both Year 1 and Year 2 name lists
2. Build exact match map (O(n) lookup)
3. For unmatched Year 1 players:
   a. Run Jaro-Winkler similarity against all unmatched Year 2 names
   b. Take highest similarity score
   c. If ≥ 0.88: fuzzy match (auto-accepted, flagged)
   d. If 0.75–0.87: low-confidence (excluded from calculations, surfaced in UI)
   e. If < 0.75: no match (player classified as non-returning)
4. Apply minimum minutes threshold to Year 1 qualifying players
5. Build RetentionAnalysis output object
```

---

## 8. Analytics Engine

Three modules, each with a single responsibility.

### `matching.ts`
- Input: `PlayerSeason[]` (Year 1), `PlayerSeason[]` (Year 2)
- Output: `{ returning: ReturnedPlayer[], nonReturning: PlayerSeason[], newPlayers: PlayerSeason[], warnings: string[] }`

### `retention.ts`
- Input: matched player sets, Year 1 player seasons, Year 1 team season
- Output: `RetentionAnalysis`
- Handles: minimum minutes filtering, starts data null detection, partial CI calculation

### `deltas.ts`
- Input: `TeamSeason` (Year 1), `TeamSeason` (Year 2)
- Output: `StatDelta[]`
- Handles: direction labels, higher-is-better vs lower-is-better awareness

---

## 9. Conference Filtering

Conference is a field on the `Team` record. There is no separate conference entity.

- `GET /api/teams` accepts optional `?conference=` query param
- Conference list is derived by extracting unique conference values from the teams list
- If a team changed conferences between Year 1 and Year 2, both conference assignments are shown in the comparison view
- The browse filter narrows to teams whose Year 2 conference matches the filter (or Year 1 if only one year is selected)

---

## 10. CSV Export

### Single Team Export

Generated client-side. No server involvement.

```typescript
function exportTeamComparisonCSV(comparison: TeamComparison): void
```

Columns (flat structure):
```
team_name, conference, year1, year2,
continuity_index, data_quality,
returning_minutes_pct, returning_starts_pct, returning_points_pct,
returning_players_count, returning_starters_count, new_players_count,
[year1_win_pct, year1_ppg, year1_fg_pct, ...all year1 stats],
[year2_win_pct, year2_ppg, year2_fg_pct, ...all year2 stats],
[delta_win_pct, delta_ppg, delta_fg_pct, ...all deltas]
```

### Browse Export

Same column structure. One row per team in the current filtered view.

### Implementation

Native string construction (no library dependency). Blob URL download triggered on button click.

---

## 11. Error Handling Summary

| Scenario | Behavior |
|----------|---------|
| NCAA pull fails, cache exists | Use cache silently |
| NCAA pull fails, no cache | Return 503 with typed error, surface in UI |
| Starts data missing | Partial CI calculation, `dataQuality: 'partial'`, UI warning |
| All fuzzy matches below threshold | CI calculated with available exact matches, warning surfaced |
| Team not found | 404 with descriptive message |
| Year not in supported range | 400 with valid range in message |
| Year 2 ≤ Year 1 | Rejected at API route level with 400 |

---

## 12. File and Folder Structure

```
/
├── README.md
├── docs/
│   ├── study-methodology.md
│   ├── system-architecture.md
│   ├── product-spec.md
│   ├── technical-plan.md
│   ├── study-summary.md
│   └── writeup-base.md
├── data/
│   ├── cache/                                  ← seeded JSON + script outputs
│   │   ├── sidearm-mhc-2025.json              ← single-team fetch test output
│   │   └── compare-morehouse-2024-2025.json   ← two-season comparison output
│   ├── ncaa-csv/
│   │   └── {year}/                            ← NCAA team-level CSV exports
│   │       ├── teams-scoring.csv
│   │       ├── teams-fg.csv
│   │       └── ...
│   ├── sidearm-teams.json                     ← operational team_id map (SIAC + MIAA seeded)
│   └── conference-registry.json              ← multi-conference metadata registry (9 conferences)
├── scripts/
│   ├── test-pull.ts                           ← NCAA CSV parsing test
│   ├── test-sidearm.ts                        ← single-team Sidearm fetch test
│   └── compare-seasons.ts                     ← two-season retention pipeline PoC
├── src/
│   ├── app/
│   │   ├── page.tsx                           ← landing / compare view (not built)
│   │   ├── browse/
│   │   │   └── page.tsx                       ← multi-team browse (not built)
│   │   └── api/
│   │       ├── teams/route.ts
│   │       ├── conferences/route.ts
│   │       ├── retention/route.ts
│   │       └── browse/route.ts
│   ├── components/
│   │   ├── ui/
│   │   ├── TeamSelector.tsx
│   │   ├── SeasonSelector.tsx
│   │   ├── ConferenceFilter.tsx
│   │   ├── ContinuityIndexCard.tsx
│   │   ├── RetentionComponentBars.tsx
│   │   ├── RetentionCountBadges.tsx
│   │   ├── StatDeltaTable.tsx
│   │   ├── ReturnedPlayersTable.tsx
│   │   ├── DataQualityWarnings.tsx
│   │   └── BrowseTable.tsx
│   ├── lib/
│   │   ├── data/
│   │   │   ├── providers/
│   │   │   │   ├── IDataProvider.ts
│   │   │   │   ├── sidearmProvider.ts         ← PRIMARY v1 player source ✓
│   │   │   │   ├── localCSVProvider.ts        ← team stats + CSV fallback ✓
│   │   │   │   └── ncaaProvider.ts            ← reference only (Akamai blocked)
│   │   │   ├── dataService.ts
│   │   │   └── cache.ts
│   │   ├── analytics/
│   │   │   ├── matching.ts                    ← name matching, fuzzy ✓
│   │   │   ├── retention.ts                   ← CI calculation, threshold ✓
│   │   │   └── deltas.ts                      ← year-over-year stat deltas ✓
│   │   ├── export/
│   │   │   └── csv.ts
│   │   └── utils/
│   │       └── formatting.ts
│   └── types/
│       └── index.ts                           ← all interfaces ✓
└── package.json
```
