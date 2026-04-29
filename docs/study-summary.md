# Study Summary

## Roster Continuity and Team Performance in Division II College Basketball

---

## What the Study Is About

This study examines whether and how roster continuity — the degree to which a team's players return from one season to the next — relates to year-over-year changes in team performance in Division II college basketball.

The premise is straightforward: a team that returns most of its core players enters the next season with accumulated experience, established chemistry, and system familiarity. A team with high turnover — through transfers, graduation, or attrition — must rebuild those elements from scratch. The question is whether this difference in continuity shows up in measurable outcomes.

This study does not count returning players. It measures how much of a team's actual on-court contribution returned.

---

## Why Division II

Division II college basketball is underrepresented in basketball analytics research. Most statistical work in the college game focuses on Division I programs, where recruiting pipelines, media coverage, and data availability are more robust.

Division II is interesting for several reasons. Programs exhibit wide variation in roster construction and management, which makes continuity a more variable and therefore more interesting factor to study. Coaching tenures at the DII level tend to be longer than in DI, which reduces coaching change as a dominant confounder. The athlete population includes players who are less likely to be recruited away mid-career by higher divisions, which historically made continuity more stable — though the expansion of the transfer portal has changed this dynamic.

Studying DII fills a genuine gap in the literature and offers insights that may apply to lower-resource programs navigating retention decisions without the recruiting advantages of top-tier programs.

---

## What the Continuity Index Measures

The **Continuity Index** (CI) is a composite score on a 0–100 scale that quantifies how much of a team's on-court production returned from Year 1 to Year 2.

It is calculated as the equal-weight average of three component metrics:

**Returning Minutes %** — What share of the team's total playing time in Year 1 was logged by players who returned in Year 2? This is the most structurally neutral measure because it reflects how much a coach deployed a player, independent of scoring system or pace.

**Returning Starts %** — What share of the team's starting lineup appearances in Year 1 came from players who returned in Year 2? This captures role continuity at the highest level of deployment.

**Returning Points %** — What share of the team's scoring in Year 1 came from players who returned in Year 2? This captures production continuity but is more sensitive to system changes than the other two components.

```
Continuity Index = (Returning Minutes % + Returning Starts % + Returning Points %) / 3
```

A CI of 80 means roughly 80% of the team's on-court value, by these three dimensions, returned. A CI of 35 means the team turned over the majority of its production.

Equal weighting across the three components is a documented assumption, not an empirically optimized model. Future research should test alternative weightings.

---

## Supplemental Retention Displays

Alongside the Continuity Index, the study also tracks and displays:

- **Returning Players Count** — the raw number of individual players matched from Year 1 to Year 2
- **Returning Starters Count** — the number of Year 1 starters confirmed in Year 2
- **New Players Count** — the number of Year 2 players with no Year 1 match, representing transfers in and new recruits

These context metrics help interpret the CI. A team with a CI of 65 that added 8 new players has a very different story than a team with a CI of 65 that has only 2 new players.

---

## What Team Outcomes Are Compared Against

The CI is the explanatory variable. Team outcome changes from Year 1 to Year 2 are the dependent variables. The study tracks year-over-year change in:

**Success:** Win-loss record, win percentage

**Offense:** Points per game, field goal percentage, 3-point percentage, free throw percentage, assists per game, turnovers per game, offensive rebounds per game

**Defense:** Opponent points per game, opponent field goal percentage, opponent 3-point percentage, opponent turnovers per game, steals per game, blocks per game, defensive rebounds per game

The tool displays the absolute change (delta) in each metric from Year 1 to Year 2, allowing the researcher to see which dimensions of performance improved, declined, or remained stable alongside the team's continuity level.

---

## What the Tool Is For

The tool is a web application that operationalizes the study at scale. It allows the researcher to:

- Select any Division II team and two seasons
- Automatically calculate the Continuity Index and its components
- View returning player rosters with matching confidence levels
- View year-over-year stat changes across all tracked metrics
- Filter teams by conference and sort by any metric
- Export results to CSV for external analysis

The tool is designed for research workflow, not public consumption. Its interface prioritizes data density and transparency over visual polish.

---

## Main Methodological Limitations

**Transfer additions are not scored.** The CI measures what was retained from Year 1. It does not capture the quality or impact of new players added in Year 2. A team with a low CI that acquires high-impact transfers may significantly outperform the score's prediction. The CI is an incomplete picture of Year 2 roster quality.

**Points retention is system-sensitive.** If a team changes its offensive system — increasing pace, shifting toward more three-point attempts, or restructuring ball distribution — the share of points going to returning players can shift independently of who actually came back. A returning player in a new system may contribute more or fewer points than their Year 1 numbers suggest. This adds noise to Returning Points % that is not present in Returning Minutes %.

**Schedule strength is not adjusted.** Win percentage change from Year 1 to Year 2 is not adjusted for schedule difficulty, conference strength changes, or opponent quality. A team's record improvement may reflect an easier schedule rather than improved performance driven by continuity.

**Coaching changes are a major confounder.** A new head coach in Year 2 can override the effect of roster continuity entirely. A high-CI team under a new coach has continuity in personnel but discontinuity in system, philosophy, and player deployment. This confound is not controlled for in v1.

**Redshirt players are excluded.** A player who redshirted in Year 1 has zero stats and falls below the minimum minutes threshold. They will not be counted as returning in Year 2. This is the correct behavior for the study's purposes — a player with no Year 1 contribution cannot contribute to continuity — but it means some returning roster members are not captured.

**Name matching introduces margin of error.** Player identity is resolved by name only. NCAA-reported rosters frequently contain name inconsistencies between seasons. The fuzzy matching algorithm reduces but does not eliminate missed matches, meaning some returning players may be classified as non-returning.

These limitations do not invalidate the study. They are documented here to ensure accurate interpretation of findings and appropriate humility in claims.
