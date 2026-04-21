// Phase 4: File-based JSON cache with TTL logic.
// Cache paths must use teamSlug — never raw CBBD display names.
// Frozen seasons (past years): cache indefinitely.
// Current season: cache with TTL (TBD — likely 6–12 hours matching V1).
// Raw cache layer: always write raw API response before normalized data.

export {};
