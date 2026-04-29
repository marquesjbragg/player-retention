# Product Specification

## Division II Basketball Player Retention Analysis Tool

---

## 1. Project Purpose

An internal-use research web application for studying how player retention relates to year-over-year team performance change in Division II college basketball. Built for research and study use, not public release.

---

## 2. Research Purpose

To test whether and how strongly roster continuity — measured as the share of on-court production that returns from one season to the next — correlates with team improvement, decline, or stability in key performance categories.

The **Continuity Index** (CI) serves as the primary explanatory variable. Team outcome metrics (win rate, PPG, opponent PPG, etc.) serve as dependent variables for comparison. The study is observational and comparative, not causal.

---

## 3. Target User

- Graduate students or researchers studying sport management, coaching, or basketball analytics
- College basketball coaches or analysts examining roster management patterns
- Athletic department staff studying retention trends in DII programs

**Not a consumer product.** The tool is for people who are comfortable with statistics and are conducting or reviewing a research study.

---

## 4. Main Features

### 4.1 Team Comparison Mode (Primary)
- Select a DII team, Year 1, and Year 2
- Optionally filter team list by conference
- View full Continuity Index breakdown
- View returning player roster with match confidence
- View year-over-year stat changes across success, offense, and defense (now including Opp FG%, Opp 3PT%, Opp TO/G, Def Reb/G)
- **Coach context box** — shows head coach for Year 1 and Year 2, and whether a coaching change occurred
- Export results to CSV

### 4.2 Single Season Mode
- Separate tab on the main page alongside Compare
- Select a conference, team, and a single season
- View the team's full stat profile for that year:
  - Record (W-L, Win%)
  - Offense: PPG, FG%, 3PT%, FT%, Assists/G, Turnovers/G
  - Defense: Opp PPG, Opp FG%, Opp 3PT%, Opp TO/G, Steals/G, Blocks/G, Def Reb/G
- **Coach context box** — shows head coach for the selected season
- Shows inline warning if any stat CSV is missing for the selected year

### 4.3 Browse Mode (Secondary)
- Browse all DII teams for a selected season pair
- Filter by conference; "Flagged only" toggle to surface outlier patterns
- Sort by any column: CI score, win% change, PPG change, departed/newcomer metrics, etc.
- **Outlier flag badges**: patterns computed per row — High CI + Improved, High CI + Declined, Low CI + Improved, Low CI + Declined (thresholds: CI ≥ 60 = high, CI ≤ 40 = low; win% Δ > +5 = improved, < −5 = declined)
- **Departed metrics**: departed players' minutes/points as % of Year 1 total (complementary partition to Ret. Min% and Ret. Pts%)
- **Newcomer metrics**: new Year 2 players' minutes/points as % of Year 2 total (different denominator — not directly comparable to departed figures)
- **Conference averages table**: aggregate CI and outcome trends per conference
- **Metric legend**: color-coded column guide and pattern flag key shown when data is loaded
- Export filtered view to CSV

### 4.4 Guide / Methodology Page (`/methodology`)
- Internal research reference page linked from the nav bar
- Six sections: Study Overview, Core Metrics (CI formula, components, what CI does/does not measure), Context Metrics (departed and newcomer metrics with denominator distinction), Data Quality and Caveats, How to Use Each View, Suggested Research Workflow
- No interactive state — server-rendered static page
- Explains CI assumptions (equal weighting), scope limitations, and manual override context

### 4.5 Data Quality Transparency
- Data quality warnings surfaced inline (not hidden in console)
- Fuzzy player matches flagged for review
- Partial CI clearly labeled when starts data is unavailable (rare for Sidearm-sourced teams; most report GS)
- Below-threshold players visible in the player table with an explicit label showing which condition(s) they failed

---

## 5. User Flow

### Team Comparison Flow

```
[Landing Screen]
  ↓
Select conference (optional)
  ↓
Select team (searchable dropdown, filtered by conference)
  ↓
Select Year 1
  ↓
Select Year 2
  ↓
Click [Analyze]
  ↓
[Results View]
  ├── Data quality warnings (if any)
  ├── Coach context box (Year 1 coach / Year 2 coach / change indicator)
  ├── Continuity Index card
  ├── Retention component bars (Minutes %, Starts %, Points %)
  ├── Display count badges (Returning Players, Returning Starters, New Players)
  ├── Team stat delta table (tabs: Success / Offense / Defense)
  ├── Returning players table (expandable)
  └── [Export CSV]
```

### Browse Flow

```
[Browse Screen]
  ↓
Select Year 1 → Year 2
  ↓
Select conference (optional)
  ↓
[Browse Table loads — all matching teams]
  ↓
Toggle "Flagged only" to filter to outlier patterns (optional)
  ↓
Sort by column header (CI Score, Win% Δ, PPG Δ, Dept. Min%, New Min% (Y2), etc.)
  ↓
Review conference averages table (below main table)
  ↓
[Export CSV]
```

---

## 6. Retention Output Display

The following are shown in the results view for every team comparison:

### Composite Score
- **Continuity Index** (0–100, one decimal place)
- `dataQuality` badge: `"Complete"` or `"Partial (starts unavailable)"`
- **Complete** is the expected state for Sidearm-sourced teams; GS is reported for most schools

### Component Metrics (with progress bars)
- **Returning Minutes %**
- **Returning Starts %** (shown for complete data; or "N/A — starts not available" when fallback applies)
- **Returning Points %**

### Display-Only Counts (badges/chips)
- **Returning Players Count** — total players matched Year 1 → Year 2
- **Returning Starters Count** — Year 1 starters confirmed in Year 2
- **New Players Count** — Year 2 players with no Year 1 match

---

## 7. Team Stat Comparison Display

Organized in three tab sections. Each section shows a table with:
`Metric | Year 1 | Year 2 | Change (Δ) | Direction indicator`

### Success
- Win-loss record
- Win percentage

### Offense
- Points per game
- FG%
- 3PT%
- FT%
- Assists per game
- Turnovers per game
- Offensive rebounds per game

### Defense
- Opponent points per game
- Opponent FG%
- Opponent 3PT%
- Opponent turnovers per game
- Steals per game
- Blocks per game
- Defensive rebounds per game

Direction indicators: green arrow (improvement), red arrow (decline), gray dash (neutral). Higher-is-better vs lower-is-better is handled per metric.

---

## 8. Conference Filtering

Conference is a first-class filter available on both the Compare screen and Browse screen.

- Conference dropdown populated from team data (no hardcoded list)
- "All Conferences" is the default state
- Selecting a conference narrows the team dropdown
- In Browse mode, selecting a conference narrows the results table

### Multi-Conference Support

The pipeline is designed to be conference-agnostic. Adding a new conference requires only:
1. Discovering team IDs (via `npm run discover` once school codes are known)
2. Adding them to `data/sidearm-teams.json`

No code changes are required to API routes, `DataService`, or UI components when a new conference is added. The conference dropdown, team selector, and browse filter all derive their options from `sidearm-teams.json` at runtime.

**Conferences seeded as of Phase 3:**
- SIAC (13 teams) — validated
- MIAA (14 teams) — team IDs seeded, ready for data pulls

**Conferences staged (school codes known, team IDs pending):**
SSC (Sunshine State, 11), LSC (Lone Star, 17), PacWest (Pacific West, 13), GSC (Gulf South, 12), PSAC (Pennsylvania State, 17), CCAA (California Collegiate, 12), MEC (Mountain East, 11)

---

## 9. Data Quality Warnings Panel

A warnings panel appears at the top of results when any of the following conditions are true:

| Condition | Warning Message |
|-----------|----------------|
| Starts data unavailable | "Starts data not available for [Team] [Year]. Continuity Index calculated from Minutes % and Points % only." |
| One or more fuzzy matches | "[N] player name(s) matched by similarity — review recommended." |
| One or more low-confidence matches excluded | "[N] player(s) excluded due to low match confidence — may be under-counting returning players." |
| Players below participation threshold | "[N] player(s) excluded from CI denominator (below participation threshold). See player detail." |
| Team PPG changed by ≥15% | "Points per game changed significantly between seasons — Returning Points % may reflect system changes, not just personnel." |

Warnings do not prevent results from displaying. They appear as a dismissible amber notice above the results.

---

## 10. CSV Export

### Single Team Export
- Triggered by [Export CSV] button at the bottom of the results view
- File name: `{team-name}-{year1}-vs-{year2}.csv`
- Flat structure: one header row, one data row
- Includes: all retention metrics, all display counts, all team stats for both years, all deltas, data_quality flag

### Browse Export
- Triggered by [Export CSV] at the bottom of the browse table
- File name: `dii-retention-{conference or "all"}-{year1}-{year2}.csv`
- One row per team currently in the filtered view
- Same column structure as single team export

---

## 11. MVP Scope

**Data layer status (as of Phase 3):**
- Player seasons: ✓ SIAC (13 teams, 2024/2025 validated) + MIAA (14 teams, team IDs seeded)
- Team seasons: Partial — W-L + PPG from teams-scoring.csv; other stats need CSV downloads
- API routes: ✓ `/api/teams`, `/api/conferences`, `/api/retention`, `/api/browse`
- Multi-conference: ✓ Architecture supports 9 conferences; 2 fully configured

---

**In scope for v1:**
- Single team comparison (any two seasons in the seeded range)
- Continuity Index with all three components (full CI expected for most Sidearm-sourced teams)
- Display-only counts (returning players, returning starters, new players)
- Option B participation threshold (30 min OR 20% of team games, two separate checks)
- Starts data fallback when GS genuinely unavailable; not applied by default
- Fuzzy player matching with confidence flags
- Stat delta table (success, offense, defense)
- Conference filter on team selector
- Data quality warnings panel (threshold exclusions, fuzzy matches, starts fallback, PPG change)
- Below-threshold players visible in player table with exclusion label
- CSV export (single team + browse) including threshold parameters and data_quality flag
- Browse mode with sortable table and conference filter
- Sidearm-first data layer for player seasons; NCAA CSV for team-level stats

**Completed in v1 beyond original scope:**
- Manual player match override UI (surfacing low-confidence candidates, force-match, persistence in `data/player-overrides.json`)
- Departed/newcomer context metrics (4 additional columns in Browse)
- Outlier pattern flags (computed per row, filterable)
- Conference averages table in Browse
- Internal methodology/guide page at `/methodology`

**Out of scope for v1:**
- Scatter plot visualizations
- Coaching change flags
- Transfer portal tracking (in/out)
- Longitudinal view (3+ season chains)
- Regression or correlation statistics
- Schedule strength adjustment
- Mobile optimization

---

## 12. Future Enhancements

### Phase 2
- Scatter plot: CI score vs. win% change across all teams
- Coaching change field (displayed, not scored)
- Export full study dataset (all teams, all years, one CSV)
- Longitudinal view for 3+ seasons

### Phase 3
- Transfer tracker (in/out player list with source team)
- Conference strength normalization for win%
- Correlation summary statistics (r, r², p-value)
- Regression tool (CI as predictor of outcome delta)

### Phase 4
- Persistent manual player match overrides
- User-defined weighting for CI components
- Alternative retention score models (minutes-only, starters-only)
