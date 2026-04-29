# Player Retention V2 — Project Checklist

> Paste this into a new Claude session to get up to speed instantly.

---

## 1. Project Goal

NCAA Men's Basketball player retention research tool. Measures Continuity Index (CI) — how much of a team's Year 1 production (minutes, starts, points) returned in Year 2 — and correlates it with win% change, PPG delta, and contextual ratings.

---

## 2. Paths

- **V1 (legacy reference):** `/Users/marquesbragg/codeproj/Player Retention`
- **V2 (active development):** `/Users/marquesbragg/codeproj/Player Retention V2`
- Start your dev server from V2: `npm run dev`

---

## 3. Tech Stack

- Next.js 14 App Router (TypeScript)
- React Query (`@tanstack/react-query`) for data fetching
- No UI library — all styles inline
- Monospace font (`MONO` constant) throughout Browse UI

---

## 4. Data Source Strategy

| Division | Player Data | Team Stats | Ratings | Massey |
|----------|------------|------------|---------|--------|
| D1       | CBBD API   | CBBD API   | CBBD adjusted efficiency | Manual CSV → JSON |
| D2       | Not ported yet | Not ported yet | — | — |

- CBBD credentials live in `.env.local` — never commit or expose
- Player data cached in `data/cache/` as `coach-{slug}-{year}.json`
- Team seasons cached as `data/cache/team-season-{slug}-{year}.json`
- Ratings cached as `data/cache/ratings-{year}.json`
- Massey data lives in `data/massey-d1/{year}.json` (not fetched via API)

---

## 5. Completed Work

### Infrastructure
- [x] V2 created as a separate Next.js 14 project
- [x] `TeamRegistry` built with 364 D1 teams + full external ID mapping
- [x] `CacheManager` + `CachePaths` for consistent file I/O
- [x] `RetentionEngine` (player matching, CI computation)
- [x] CBBD D1 provider fully working
- [x] `d1-logos.json` — 364 logo URLs

### Data / Cache
- [x] 2025 full seed: 362 full + 2 stats-only teams (2024→2025 year pair)
- [x] 2026 full seed: 364/364 teams, 0 errors (2025→2026 year pair)
- [x] 2021, 2022, 2023 seeds completed (background)
- [x] Massey 2026.json in place (2025–26 ratings, 364 D1 teams matched)
- [x] 44 Massey alias fixes — 97 total aliases, 100% coverage verified

### Browse Page (`/browse`)
- [x] Browse API (`/api/browse`) working
- [x] BrowseTable with sticky columns, group headers, sortable
- [x] All column groups: Continuity, Newcomers, Season, Context
- [x] Column visibility toggle (Columns popover)
- [x] Division toggle (D1/D2 — D2 disabled until ported)
- [x] Season selector: 2022–2026
- [x] Conference dropdown filter
- [x] Conference Group filter: Power / Major Mid / Mid-Major / Independent
- [x] Quality/Quad filter: All / Q1 / Q2 / Q3 / Q4 / NR (rank-based)
- [x] Flag system: 9 CI × direction variants + stats-only + null
- [x] Massey rank coloring (green/gray/red by tier)
- [x] Delta coloring (green/red on W%Δ, PPG Δ, Opp PPG Δ)
- [x] Logo display in team cell
- [x] 2-line team cell (short name + conf + #rank)
- [x] **Mini-rankings** beside every major stat column
- [x] **Team search bar** with logo results + routing to `/team/{slug}`
- [x] **Left-click team menu** (Open Team Page, Open in New Tab, Copy Link, Copy Stats)
- [x] **Default year: 2025–26** (season=2026)

---

## 6. Current Browse Status

- Default view: 2025–26 (season selector = 2026)
- 364 D1 teams load (full CI data for all 364 in 2025–26)
- Massey 2026.json serves both 2025 and 2026 browse years (fallback for 2025)
- Compare page: **not built**
- Team Research page: **placeholder only** at `/team/[slug]`

---

## 7. D1 Cache Coverage

| Season | Full teams | Stats-only | Notes |
|--------|-----------|------------|-------|
| 2026   | 364       | 0          | 2025–26, seeded April 2026 |
| 2025   | 362       | 2          | 2024–25 |
| 2024   | 360ish    | varies     | check seed logs |
| 2023   | varies    | varies     | seeded in background |
| 2022   | varies    | varies     | seeded in background |
| 2021   | varies    | varies     | seeded in background |

---

## 8. Massey Data Status

- Only `data/massey-d1/2026.json` exists (2025–26 season)
- Provider path: `src/lib/providers/d1/D1MasseyProvider.ts`
- 97 aliases handle D1 name→slug matching (100% coverage for 2026)
- Prior years: no Massey files yet — Browse shows `—` for Massey columns when viewing 2022–2025
- To add a prior year: see **How to Add Massey Data for Prior Years** section below

---

## 9. How to Add Massey Data for Prior Years

### Where to get the data
Visit `https://masseyratings.com/cb/ncaa-d1/ratings` in a browser. Massey uses Cloudflare JS challenge so it can't be fetched programmatically.

### Step-by-step process

1. **Download the CSV export** from the Massey page (click "Export" or use the text export URL). Save it as:
   ```
   data/massey-d1/raw/{year}.csv
   ```
   where `{year}` is the ending year of the season (e.g. `2025` for 2024–25).

2. **Run the V1 import script** from the V2 project root (it handles D1 when `--division d1` is passed):
   ```bash
   npx tsx /Users/marquesbragg/codeproj/Player\ Retention/scripts/import-massey.ts \
     --year 2025 --division d1 --file data/massey-d1/raw/2025.csv
   ```
   This writes `data/massey-d1/2025.json`.

3. **If you don't have the V1 script accessible**, manually create `data/massey-d1/{year}.json` with this structure:
   ```json
   {
     "season": 2025,
     "fetchedAt": "2025-01-01T00:00:00.000Z",
     "source": "data/massey-d1/raw/2025.csv",
     "ratings": [
       { "rank": 1, "teamName": "Duke", "conference": "Atlantic Coast", "wins": 35, "losses": 3, "rating": 9.13 },
       ...
     ]
   }
   ```

4. **Add team name aliases if needed**. If any D1 team names in the Massey file don't match V2 registry names, add them to `MASSEY_ALIASES` in `src/lib/providers/d1/D1MasseyProvider.ts`. The file has 97 existing aliases as reference.

5. **Verify in Browse**: Open `/browse`, switch to the relevant year pair (e.g. 2024–25 = season 2024→2025), and check the Massey Rank column. Previously `—` rows should now show values.

### Season alignment rules
- `data/massey-d1/2026.json` → serves Browse year pair `2025→2026`
- `data/massey-d1/2025.json` → serves Browse year pair `2024→2025`
- The provider (`loadMasseyMap`) tries exact season first, then falls back to `season+1`
- **Avoid ambiguity**: once you add `2025.json`, the 2025 Browse view will use it instead of the 2026.json fallback. This is correct behavior.

### Expected CSV columns
Massey exports vary but the import script handles:
- Format A: `rank, team_name, conference, record (W-L), rating`
- Format B (web export): `team_name, conference, record, win%, delta, rank, rating, ...`
- Format C: space/tab separated with rank first

---

## 10. UI Direction

- Monospace font throughout (`MONO` constant = `ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, ...`)
- Compact, data-dense layout — no large cards on table rows
- Color palette: brand blue `var(--brand)`, neutral grays, green/red for deltas
- Reference screenshots: `/Users/marquesbragg/codeproj/Player Retention/` (V1 screenshots)

---

## 11. Remaining Planned Phases

| Phase | Status | Notes |
|-------|--------|-------|
| Browse polish | **In progress** | Mini-ranks, search, menu done this session |
| Browse validation (local) | Next step | User validates before Compare |
| Compare page | Not started | Wait for user sign-off on Browse |
| Team Research page | Not started | Placeholder exists at `/team/[slug]` |
| D2 port | Not started | After D1 is complete |
| Exports / study support | Not started | Later |
| Prior-year Massey data | Pending (manual) | User imports CSV per season |

---

## 12. Immediate Next Steps

1. User validates Browse locally (filters, mini-ranks, search, menu)
2. Confirm 2025–26 is the correct default
3. Import Massey data for 2022–2025 seasons if desired
4. Confirm before starting Compare

---

## 13. Rules / Constraints

- **Do not** build Compare until user confirms Browse is stable
- **Do not** build Team Research (just the placeholder route)
- **Do not** port D2 yet
- **Do not** expose the CBBD API key (`.env.local` only)
- Do not add error handling for impossible cases
- Do not add comments explaining what code does — only add WHY if non-obvious
- No mock database in tests — real data only
- Default sort: CI descending

---

## 14. Key Commands

```bash
# Start dev server
npm run dev

# Seed D1 data for a year (e.g. 2026)
npx tsx scripts/seed-d1-full.ts 2026

# Seed multiple years
npx tsx scripts/seed-d1-full.ts 2021 2022 2023

# Import Massey for a year (from V1 script)
npx tsx /path/to/Player\ Retention/scripts/import-massey.ts --year 2025 --division d1 --file data/massey-d1/raw/2025.csv

# TypeScript check
npx tsc --noEmit

# Build
npm run build
```

---

## 15. Do-Not-Do List

- Do not build Compare until Browse is validated
- Do not build full Team Research (placeholder only)
- Do not port D2 yet
- Do not expose API keys
- Do not use `any` types unnecessarily
- Do not use server-side code (fs, path) in client components
- Do not hardcode team slug logic outside the registry
- Do not fetch live data inside BrowseRowBuilder (cache reads only)
- Do not mock the database / cache in tests
