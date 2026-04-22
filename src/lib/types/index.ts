// ─── Primitives ───────────────────────────────────────────────────────────────

export type Division = 'D1' | 'D2'

/** Ending-year convention: 2024-25 season = seasonYear 2025 */
export type SeasonYear = number

export type DataQuality = 'complete' | 'partial'

export type DataStatus =
  | 'full'            // player data + team stats available, CI computable
  | 'stats-only'      // team stats available, no player data — CI not computable
  | 'no-player-data'  // one or both seasons missing player cache
  | 'unavailable'     // no data at all for this team-year pair

export type DataSource = 'cbbd' | 'sidearm' | 'ncaa-csv' | 'stats-only' | 'manual'

export type MatchConfidence = 'exact' | 'fuzzy' | 'low' | 'manual'

// ─── Team Identity ────────────────────────────────────────────────────────────
// Source of truth for who a team is. All providers resolve through TeamRegistry.
// slug is used for all cache file paths — never raw CBBD or Sidearm names.

export interface ExternalIds {
  cbbdTeamId?: number     // CBBD numeric team ID — stable across seasons, from /ratings/adjusted response
  cbbdName?: string       // CBBD API display name for query params (e.g. "St. John's", "Texas A&M")
  sidearmId?: string      // Sidearm conference site ID (D2 only)
  masseyName?: string     // Massey ratings site name (D2 only, optional)
}

export interface TeamIdentity {
  slug: string            // canonical URL-safe identifier, used for all cache paths
  name: string            // full display name (e.g. "Michigan", "St. John's")
  shortName: string       // abbreviated (e.g. "Michigan", "St. John's")
  division: Division
  conference: string      // current conference — may change by season
  externalIds: ExternalIds
  logoUrl?: string
}

// ─── Season ───────────────────────────────────────────────────────────────────

export interface Season {
  year: SeasonYear    // ending year: 2025 = 2024-25
  label: string       // "2024-25"
}

// ─── Player Season ────────────────────────────────────────────────────────────
// Field names match V1 exactly: games, points, gamesStarted, minutesPlayed,
// teamId, seasonYear. Do not rename these — RetentionEngine depends on them.
// In V2, teamId holds the canonical slug value.

export interface PlayerSeason {
  playerId: string
  playerName: string
  teamId: string              // = teamSlug in V2
  seasonYear: SeasonYear
  games: number
  gamesStarted: number | null // null = starts not reported for this team-season
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
  source: DataSource
}

// ─── Team Season ──────────────────────────────────────────────────────────────
// Per-game averages as reported by the data source.
// In V2, teamId holds the canonical slug value.

export interface TeamSeason {
  teamId: string              // = teamSlug in V2
  seasonYear: SeasonYear
  division: Division
  conference: string
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
  source: DataSource
}

// ─── Player Matching ──────────────────────────────────────────────────────────
// These types are consumed directly by RetentionEngine — do not rename fields.

export interface ReturnedPlayer {
  playerName: string
  year1Stats: PlayerSeason
  year2Stats: PlayerSeason
  matchConfidence: MatchConfidence
  similarityScore?: number
}

// Year1 player whose best Year2 candidate scored 0.75–0.87 — above noise,
// below auto-accept threshold. Surfaced for manual override review.
export interface LowConfidenceCandidate {
  year1Player: PlayerSeason
  year2Candidate: PlayerSeason
  similarityScore: number
}

export interface MatchingResult {
  returning: ReturnedPlayer[]
  nonReturning: PlayerSeason[]
  newPlayers: PlayerSeason[]
  lowConfidenceExcluded: LowConfidenceCandidate[]
  warnings: string[]
}

// ─── Manual Override ──────────────────────────────────────────────────────────
// Forces a specific Year1→Year2 match that the algorithm placed in low-confidence.
// Stored in data/registry/player-overrides.json.
// Key: "{teamSlug}|{year1}|{year2}"

export interface PlayerOverride {
  year1PlayerId: string
  year2PlayerId: string
  year1PlayerName: string   // informational only
  year2PlayerName: string   // informational only
  addedAt: string           // ISO timestamp
}

// ─── Participation Threshold ──────────────────────────────────────────────────
// Option B: qualifies if EITHER check passes (OR logic).
// minutesPlayed >= 30 OR games >= ceil(teamGames × 0.20)

export interface BelowThresholdPlayer {
  player: PlayerSeason
  meetsMinutes: boolean     // minutesPlayed >= 30
  meetsGames: boolean       // games >= ceil(teamGames × 0.20)
  minutesRequired: number   // always 30
  gamesRequired: number     // ceil(teamGames × 0.20)
  exclusionLabel: string    // e.g. "4 min < 30 AND 2 GP < 7 (20% of 32 games)"
}

// ─── Retention Result ─────────────────────────────────────────────────────────
// V2 name for V1's RetentionAnalysis. All fields preserved.
// Required arrays: returningPlayers, nonReturningPlayers, newPlayers,
// belowThresholdPlayers. Required threshold fields: thresholdMinutes,
// thresholdGamesPct, thresholdGamesRequired.

export interface RetentionResult {
  teamId: string
  year1: SeasonYear
  year2: SeasonYear
  continuityIndex: number
  dataQuality: DataQuality
  // CI components
  returningMinutesPct: number
  returningStartsPct: number | null   // null = starts data unavailable
  returningPointsPct: number
  // Departed + newcomer context (not part of CI score)
  deptMinutesPct: number
  deptPointsPct: number
  newcomerMinutesPct: number
  newcomerPointsPct: number
  // Display counts
  returningPlayersCount: number
  returningStartersCount: number
  newPlayersCount: number
  // Player detail arrays
  returningPlayers: ReturnedPlayer[]
  nonReturningPlayers: PlayerSeason[]
  newPlayers: PlayerSeason[]
  lowConfidenceExcluded: LowConfidenceCandidate[]
  belowThresholdPlayers: BelowThresholdPlayer[]
  // Quality metadata
  warnings: string[]
  thresholdMinutes: number        // always 30
  thresholdGamesPct: number       // always 0.20
  thresholdGamesRequired: number  // actual games cutoff for this team-season
}

// ─── Stat Deltas ──────────────────────────────────────────────────────────────

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

// ─── Ratings ──────────────────────────────────────────────────────────────────
// Generic ratings entry that works for CBBD adjusted efficiency (D1) and
// Massey composite ratings (D2). Do not mix sources in the same season.

export type RatingsSource = 'cbbd' | 'massey'

export type RatingsBucket = 'high' | 'mid' | 'low' | null

export interface RatingsEntry {
  teamSlug: string
  season: SeasonYear
  rank: number | null         // overall rank (CBBD: rankings.net; Massey: rank)
  rating: number | null       // net adjusted efficiency (CBBD: netRating) or Massey composite
  offRating: number | null    // offensive adj efficiency — CBBD only, null for Massey
  defRating: number | null    // defensive adj efficiency — CBBD only, null for Massey
  conference: string
  source: RatingsSource
  // wins/losses live in TeamSeason — not duplicated here
}

export interface RatingsSeasonData {
  season: SeasonYear
  fetchedAt: string           // ISO timestamp
  source: RatingsSource
  entries: RatingsEntry[]
}

// ─── Outlier Flag ─────────────────────────────────────────────────────────────
// Null = no notable pattern. Computed from CI tier vs win% delta.
// High/Low thresholds: CI ≥ 65 = high, ≤ 40 = low; W% Δ > ±5pts flagged.
// Mid threshold (41–64): only large swings (> ±10pts) flagged.

export type OutlierFlag =
  | 'high-ci-improve'   // CI ≥ 65, W% Δ > +5  — high continuity, improved
  | 'high-ci-decline'   // CI ≥ 65, W% Δ < −5  — high continuity, declined (anomaly)
  | 'mid-ci-improve'    // CI 41–64, W% Δ > +10
  | 'mid-ci-decline'    // CI 41–64, W% Δ < −10
  | 'low-ci-improve'    // CI ≤ 40, W% Δ > +5  — low continuity, improved (anomaly)
  | 'low-ci-decline'    // CI ≤ 40, W% Δ < −5  — low continuity, declined
  | null

// ─── Browse Row ───────────────────────────────────────────────────────────────
// One row in the Browse table. Assembled by the BrowseRow builder from:
// TeamIdentity + TeamSeason × 2 + RetentionResult + RatingsEntry.

export interface BrowseRow {
  // Team identity
  teamSlug: string
  teamName: string
  shortName: string
  division: Division
  conference: string
  logoUrl?: string
  // Year pair
  year1: SeasonYear
  year2: SeasonYear
  // Data availability
  dataStatus: DataStatus
  dataSource: DataSource
  dataQuality: DataQuality
  // Continuity Index
  continuityIndex: number
  returningMinutesPct: number
  returningStartsPct: number | null
  returningPointsPct: number
  deptMinutesPct: number
  deptPointsPct: number
  newcomerMinutesPct: number
  newcomerPointsPct: number
  returningPlayersCount: number
  returningStartersCount: number
  newPlayersCount: number
  // Season outcomes
  year1WinPct: number
  year2WinPct: number
  winPctDelta: number
  ppgDelta: number
  oppPpgDelta: number
  // Ratings context
  ratingsRank: number | null
  ratingsRating: number | null
  ratingsBucket: RatingsBucket
  ratingsSource: RatingsSource | null
  // Pattern flag
  outlierFlag: OutlierFlag
}

// ─── Full Comparison Output ───────────────────────────────────────────────────
// Used by the Compare page and Team Research page.

export interface TeamComparison {
  team: TeamIdentity
  year1Season: TeamSeason
  year2Season: TeamSeason
  retention: RetentionResult
  deltas: StatDelta[]
  coachYear1: string | null
  coachYear2: string | null
  ratings: RatingsEntry | null    // year2 ratings entry, null if unavailable
}

// ─── Team Research / Timeline ─────────────────────────────────────────────────

export interface TimelineEntry {
  year1: SeasonYear
  year2: SeasonYear
  seasonLabel: string           // e.g. "2024-25"
  // false = player cache absent for year1 or year2; CI fields are 0/"—"
  playerDataAvailable: boolean
  ci: number
  dataQuality: DataQuality
  dataSource: DataSource
  winPct: number                // year2 win% (0–100)
  winPctPrev: number            // year1 win% (0–100)
  winPctChange: number          // year2 − year1 (percentage points)
  returningPointsPct: number
  returningMinutesPct: number
  newcomerPointsPct: number
  newcomerMinutesPct: number
  ratingsRank: number | null
  ratingsBucket: RatingsBucket
  returningCount: number
  newCount: number
}

export interface TeamTimeline {
  team: TeamIdentity
  entries: TimelineEntry[]       // sorted oldest → newest
  latestComparison: TeamComparison | null
}

// ─── Provider Interface ───────────────────────────────────────────────────────
// All D1 and D2 providers implement this contract.
// Callers (RetentionEngine, BrowseRow builder) only import from this interface.

export interface IDataProvider {
  getTeams(options?: { conference?: string; year?: SeasonYear }): Promise<TeamIdentity[]>
  getConferences(options?: { division?: Division; year?: SeasonYear }): Promise<string[]>
  getTeamSeason(teamSlug: string, year: SeasonYear): Promise<TeamSeason | null>
  getPlayerSeasons(teamSlug: string, year: SeasonYear): Promise<PlayerSeason[]>
}

// ─── Cache ────────────────────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T
  fetchedAt: string     // ISO timestamp
  frozen: boolean       // true = completed season, never re-fetch
}

// ─── API Response Envelope ────────────────────────────────────────────────────

export interface ApiError {
  code: string
  message: string
  details?: string
}

export type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: ApiError }
