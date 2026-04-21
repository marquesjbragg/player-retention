/**
 * Converts a team display name into a URL-safe, filesystem-safe canonical slug.
 *
 * Rules applied in order:
 * 1. Lowercase
 * 2. Parenthetical suffixes: "(CA)" → "ca", "(FL)" → "fl" (space-separated, parens removed)
 * 3. Ampersand removed (not replaced): "A&M" → "AM" → "am"
 * 4. Apostrophes and periods removed: "St. John's" → "st johns"
 * 5. All remaining non-alphanumeric-non-space chars removed
 * 6. Whitespace collapsed and converted to hyphens
 * 7. Leading/trailing hyphens stripped
 *
 * Test cases:
 *   "Duke"               → "duke"
 *   "St. John's"         → "st-johns"
 *   "Texas A&M"          → "texas-am"
 *   "UConn"              → "uconn"
 *   "Ole Miss"           → "ole-miss"
 *   "Mount St. Mary's"   → "mount-st-marys"
 *   "Saint Peter's"      → "saint-peters"
 *   "Saint Mary's (CA)"  → "saint-marys-ca"
 *   "Miami (FL)"         → "miami-fl"
 *   "Miami (OH)"         → "miami-oh"
 *   "UC Irvine"          → "uc-irvine"
 *   "San Diego State"    → "san-diego-state"
 *   "UTSA"               → "utsa"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(([^)]+)\)/g, ' $1 ')   // "(CA)" → " ca "
    .replace(/&/g, '')                  // "A&M" → "AM", "A&T" → "AT" (no space — keeps abbreviation intact)
    .replace(/['.]/g, '')               // apostrophes and periods
    .replace(/[^a-z0-9\s]/g, ' ')       // all other special chars → space
    .replace(/\s+/g, ' ')               // collapse whitespace
    .trim()
    .replace(/\s/g, '-')                // spaces → hyphens
    .replace(/-+/g, '-')                // collapse multiple hyphens
    .replace(/^-|-$/g, '')              // strip leading/trailing hyphens
}
