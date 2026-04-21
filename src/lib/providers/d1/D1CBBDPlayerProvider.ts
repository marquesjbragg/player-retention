// Phase 4: Fetches D1 player seasons from CBBD /stats/player/season endpoint.
// Always saves raw API response to data/cache/d1/cbbd/raw/players/{season}/{teamSlug}.json first.
// Then normalizes to PlayerSeason[] and saves to data/cache/d1/cbbd/players/{season}/{teamSlug}.json.
// Never logs or exposes CBB_DATA_API_KEY.

export {};
