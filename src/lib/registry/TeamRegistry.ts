// Phase 3b: Builds and reads the canonical team registry.
// Source of truth for: canonical slug, display name, division, conference, CBBD team name, external IDs.
// Registry is built from CBBD /ratings/adjusted response + manual team-aliases.json overrides.
// All providers resolve teams through this registry — never by raw display name.

export {};
