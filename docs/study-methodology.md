# Study Methodology

## Division II Basketball Player Retention Analysis

---

## 1. Study Overview

This study examines the relationship between **roster continuity** and **year-over-year team performance change** in Division II college basketball.

The central hypothesis is that teams which retain a higher share of on-court production from one season to the next will show more consistent or improved team outcomes in the following season, relative to teams that experience higher roster turnover.

The study is observational and descriptive. It does not claim causal relationships. It is designed to surface patterns and correlations that can inform future research.

---

## 2. Why Division II

Division II is an underexplored tier of college basketball in the analytics literature. Several characteristics make it particularly interesting for roster continuity research:

- **Fewer high-profile transfers.** Division II programs historically have had less transfer portal activity than DI, though this gap has narrowed since the 2021 portal rule changes.
- **Less coaching volatility.** DII head coaches tend to have longer tenures than DI counterparts, making coaching changes a less dominant confounder.
- **Genuine roster management variation.** Unlike DI programs with consistent high-level recruiting pipelines, DII programs exhibit wide variation in roster composition year-to-year, making continuity a more variable and therefore more interesting explanatory factor.
- **Limited existing research.** Most basketball analytics research focuses on Division I and the NBA. DII represents a genuine gap in the literature.

---

## 3. Unit of Analysis

The unit of analysis is a **team-season pair**: a single team compared across two consecutive (or selected) seasons.

- **Year 1**: The baseline season
- **Year 2**: The outcome season

Retention metrics are calculated using Year 1 as the reference. Team performance change metrics compare Year 2 outcomes to Year 1 outcomes.

---

## 4. The Continuity Index

### 4.1 Definition

The **Continuity Index** is a composite score on a 0–100 scale that measures how much of a team's on-court production returned from Year 1 to Year 2.

It is calculated as the simple average of three component percentages:

```
Continuity Index = (Returning Minutes % + Returning Starts % + Returning Points %) / 3
```

All three components are expressed as percentages (0–100). The Index is their unweighted mean.

### 4.2 Component Metrics

#### Returning Minutes %

```
Returning Minutes % =
  sum(Year 1 total minutes for all returning players) /
  sum(Year 1 total minutes for all qualifying players) × 100
```

Measures the volume of playing time that returned. Minutes are the most structurally neutral measure because they reflect how much a coach deployed a player, independent of scoring system or pace.

#### Returning Starts %

```
Returning Starts % =
  sum(Year 1 games started for all returning players) /
  sum(Year 1 games started for all qualifying players) × 100
```

Measures role continuity. Returning starters signal that the structural composition of the starting lineup was preserved. This is distinct from minutes because a player can accumulate significant minutes off the bench.

**Note on starts data availability:** Starts data at Division II is inconsistently reported. See Section 4.5 for fallback handling.

#### Returning Points %

```
Returning Points % =
  sum(Year 1 total points for all returning players) /
  sum(Year 1 total points for all qualifying players) × 100
```

Measures scoring production continuity. This is the most volatile of the three components because it is influenced by pace, shot distribution, and offensive system changes independent of personnel.

### 4.3 Weighting — Documented Assumption

All three components are equally weighted in the Continuity Index for the MVP.

**This is an assumption, not a proven optimal weighting.** Arguments exist for alternative weighting:

- Minutes could be weighted more heavily as the most structurally neutral indicator
- Points could be weighted less heavily due to its sensitivity to system changes
- Starts could be weighted differently depending on whether a team runs a clear starting-five rotation

Equal weighting is used because it is transparent, easy to explain, and does not require prior calibration data. Any weighting scheme other than equal weights requires a principled basis (e.g., empirical optimization against outcome data), which is not available for the initial study.

Future research should test alternative weightings against outcome correlations.

---

## 5. Display-Only Metrics (Not Scored)

The following counts are displayed in the UI alongside the Continuity Index but are **not** included in the composite score.

| Metric | Definition | Why Not Scored |
|--------|-----------|----------------|
| Returning Players Count | Number of Year 1 players matched in Year 2 roster | Raw count lacks normalization for roster size |
| Returning Starters Count | Number of Year 1 starters confirmed in Year 2 roster | Intuitive but redundant with Returning Starts % |
| New Players Count | Year 2 players with no Year 1 match | Measures influx, not continuity — a different dimension |

These metrics are analytically valuable as context for interpreting the Continuity Index. A team with a CI of 65 and 4 returning starters reads differently than a CI of 65 with 1 returning starter and 8 new players.

---

## 6. Minimum Participation Threshold — Option B

### 6.1 Rationale

Including all rostered players in retention calculations adds noise. A player who appeared in one game and logged 4 total minutes is technically on the roster but contributed negligible on-court value. Including them in the denominator of Returning Minutes % dilutes the metric without adding meaningful information.

### 6.2 Option B: Two Separate Qualification Checks (OR Logic)

A Year 1 player qualifies for retention calculations if they meet **either** of the following conditions:

| Check | Condition | Example (32-game season) |
|-------|-----------|--------------------------|
| Check 1 | At least **30 total minutes** played in Year 1 | Player played 30+ total min |
| Check 2 | Appeared in at least **20% of team games** in Year 1 | Player appeared in ≥ 7 of 32 games |

**These are two independent checks joined by OR — not collapsed into a single minutes cutoff.**

A player is excluded only if they fail **both** checks. Passing either one is sufficient to qualify.

This is more permissive than a pure minutes cutoff and more meaningful than a pure games cutoff. A player who appeared in many games but rarely played (common in garbage time rotations) passes Check 2. A player who played significant minutes but in only a few games (e.g., an early-season contributor who was injured) passes Check 1.

### 6.3 Implementation

```
gamesRequired = ceil(teamGames × 0.20)

qualified = player.minutesPlayed >= 30 OR player.games >= gamesRequired
```

Players excluded from the denominator are shown in the player-level output with an explicit label documenting which check(s) they failed:
```
"4 min < 30 AND 2 GP < 7 (20% of 32 games)"
```

### 6.4 Effect on Calculations

Players below the threshold:
- Are **excluded** from all three retention percentage denominators (Minutes %, Starts %, Points %)
- Are **not matched** against the Year 2 roster for returning player identification
- Are **not included** in Returning Players Count
- **Do appear** in the player-level breakdown table, labeled as `"below threshold — excluded from CI denominator"`, showing which condition(s) they failed

### 6.5 Year 2 Treatment

The threshold applies only to Year 1 players determining the denominator. Year 2 player data is collected in full. New players (Year 2 only) are counted in full for the New Players Count display metric and are not subject to a threshold filter.

---

## 7. Player Matching Strategy

Identifying returning players requires matching names across two season rosters. This is the highest-risk step in the data pipeline because NCAA data inconsistently formats player names.

### 7.1 Normalization

Before any matching, all player names are normalized:
- Lowercase
- Trimmed of leading/trailing whitespace
- Periods removed (e.g., `D.J.` → `dj`)
- Common suffixes normalized (`Jr.`, `Sr.`, `II`, `III` stripped or standardized)
- Apostrophes and hyphens retained

### 7.2 Match Tiers

| Tier | Method | Confidence | Action |
|------|--------|------------|--------|
| Exact | Normalized name strings are identical | `exact` | Auto-accepted |
| Fuzzy | Jaro-Winkler similarity ≥ 0.88 | `fuzzy` | Auto-accepted, flagged for review |
| Low-confidence | Jaro-Winkler similarity 0.75–0.87 | `low` | Surfaced as warning, user prompted to review |
| No match | Similarity < 0.75 | — | Player treated as non-returning |

### 7.3 Flagging in the UI

- **Fuzzy matches** appear in the returning players table with a yellow indicator and tooltip: `"Name matched by similarity — confirm this is the same player"`
- **Low-confidence matches** appear in a separate "Needs Review" section, excluded from default calculations until confirmed
- All unresolved low-confidence matches are listed in the data quality warnings panel

### 7.4 Manual Override (Future)

In v1, there is no manual override interface. Low-confidence matches are excluded. Future versions should allow a researcher to confirm or reject fuzzy and low-confidence matches and persist those decisions.

### 7.5 Known Edge Cases

| Case | Handling |
|------|---------|
| Player nickname in one season (e.g., "Mike" vs "Michael") | Caught by fuzzy matching in most cases |
| Hyphenated name split across seasons | Normalization may not resolve; will surface as low-confidence |
| Redshirt player (Year 1 stats = 0) | Falls below minutes threshold; excluded from calculations |
| Player transferred away and back | Will appear as new player in Year 2; not identified as returning |
| Transfer in from another team | Treated as new player; not tracked as returning |

---

## 8. Starts Data — Availability and Fallback

### 8.1 Primary Source (Sidearm)

The primary v1 player data source — Sidearm Sports conference sites — **reports games started** (`games_started`) as a top-level field on each player row. For Sidearm-hosted schools that track starts, the full three-component CI formula is used without modification.

GS is considered **available** when the sum of `gamesStarted` across all Year 1 qualified players is greater than zero. This has been verified for SIAC teams. The Morehouse 2023-24 season returned a sum of 155 starts across 15 qualified players, enabling the full CI calculation.

### 8.2 When Fallback Applies

Starts data is considered **unavailable** for a team-season if:
- All qualified players have `gamesStarted === null`, OR
- The sum of `gamesStarted` across all qualified players is exactly 0

The first case applies when a data source (such as an NCAA CSV export) does not include a starts column. The second case applies when a Sidearm-hosted school did not enter starts data for that season.

Starts data from a single season being unavailable triggers the fallback for that team-year pair. It does not affect other teams or years.

### 8.3 Fallback Behavior

If starts data is unavailable for Year 1:

1. **Returning Starts % is set to null** — not zero, null
2. **Continuity Index falls back to:** `CI = (Returning Minutes % + Returning Points %) / 2`
3. The result is flagged with `dataQuality: 'partial'`
4. The UI displays: `"Starts data not available for [Team] [Year] — Continuity Index calculated from Minutes % and Points % only"`
5. The CSV export includes a `data_quality` column with value `partial`

This prevents silent inflation or deflation of the CI score and ensures the researcher is aware of what they are working with.

---

## 9. Team Outcome Metrics

These are the Year-over-Year comparison metrics displayed alongside the Continuity Index.

### Success Metrics
- Win-loss record
- Win percentage

### Offensive Metrics
- Points per game
- Field goal percentage (FG%)
- 3-point percentage (3PT%)
- Free throw percentage (FT%)
- Assists per game
- Turnovers per game
- Offensive rebounds per game

### Defensive Metrics
- Opponent points per game
- Opponent field goal percentage
- Opponent 3-point percentage
- Opponent turnovers forced per game
- Steals per game
- Blocks per game
- Defensive rebounds per game

All metrics are expressed as per-game averages or season percentages, normalized for games played.

---

## 10. Study Limitations and Confounders

These limitations are documented here for use in research write-ups and must be surfaced in the tool's UI.

### 10.1 Transfer Additions Are Not Fully Captured

The Continuity Index measures what was retained from Year 1. It does not measure the quality or quantity of what was added in Year 2. A team with a low CI that acquires several high-impact transfers may significantly outperform the score's prediction. **The CI is an incomplete picture of Year 2 roster quality.**

Mitigation: Display New Players Count prominently alongside the CI. Future versions should track transfer portal additions.

### 10.2 Points Retention Is System-Sensitive

If a team changes its offensive system between seasons — increasing pace, shifting shot distribution toward 3-pointers, running a more or less ball-dominant offense — the distribution of points across players can shift significantly independent of which players returned. A returning player in a new system may score more or fewer points than Year 1, affecting the denominator and the returning percentage.

Mitigation: Display team PPG for both seasons. If PPG changed by more than 15%, a note should flag that points retention may be system-influenced.

### 10.3 Schedule Strength and Opponent Quality

Win% change from Year 1 to Year 2 is not adjusted for schedule strength. A team may improve its record by playing a weaker conference schedule, moving conferences, or facing weakened conference opponents — none of which is related to retention.

Mitigation: Display conference standing change where available. Document this as a key limitation in all exports and summaries.

### 10.4 Coaching Changes

A new head coach in Year 2 is a major confounder. The CI may be high while the outcomes are negative simply because a new coach runs a completely different system. Conversely, a low CI under a new coach may not reflect poor retention decisions — the roster may have been rebuilt intentionally.

**This is one of the strongest confounders in the study.** Coaching change data is not tracked in v1 but should be added as a displayed field as soon as reliably obtainable.

### 10.5 Redshirt Players

A medical or academic redshirt player has zero statistics in Year 1 but is on the roster. They fall below the minimum minutes threshold and are excluded from retention calculations. If they return to play in Year 2, they will be classified as a new player. This is a known limitation. These cases are rare enough to be noted but not common enough to require a dedicated handling path in v1.

### 10.6 Inconsistent Player Naming

NCAA-reported rosters do not use a persistent player ID system at DII level. Players are matched by name only. Name inconsistencies between seasons — common due to data entry differences — will cause some returning players to be missed and classified as non-returning.

The fuzzy matching algorithm reduces but does not eliminate this problem. Any retention analysis should be treated as having a small margin of error due to name matching failures.

---

## 11. Reproducibility

All data used in this study is pulled from NCAA stats endpoints and cached locally before analysis. Cached season data from completed seasons is treated as permanent and not re-fetched. This ensures the study dataset is fixed and reproducible. The cached data directory should be documented with the date of the initial pull.
