// Phase 5: Pure function — takes normalized PlayerSeason[] pairs, returns RetentionResult.
// Calls matching.ts for player identity resolution across seasons.
// Participation threshold: minutesPlayed >= 30 OR games >= ceil(teamGames * 0.20)
// Starts fallback: if gamesStarted data unavailable, compute 2-component CI (minutes + points only).
// No I/O — callers provide data, this engine only computes.

export {};
