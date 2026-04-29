/**
 * Phase 3a: Verifies CBBD API key and inspects the /ratings/adjusted response shape.
 * Run: npx tsx scripts/verify-cbbd.ts
 *
 * Checks:
 * 1. CBB_DATA_API_KEY is set
 * 2. /ratings/adjusted?season=2025 returns HTTP 200
 * 3. Response contains >= 300 teams (confirms full D1 coverage)
 * 4. Prints field names from first entry (never prints key or raw team data beyond sample)
 * 5. Tests /stats/player/season for one team (Duke) — shape check only
 * 6. Tests /stats/team/season for one team (Duke) — shape check only
 */

import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const BASE_URL = 'https://api.collegebasketballdata.com'

function getKey(): string {
  const key = process.env.CBB_DATA_API_KEY
  if (!key) {
    console.error('ERROR: CBB_DATA_API_KEY is not set in .env.local')
    process.exit(1)
  }
  return key
}

function headers(key: string): Record<string, string> {
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  }
}

async function fetchJSON(url: string, key: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers: headers(key) })
  const body = res.ok ? await res.json() : await res.text()
  return { status: res.status, body }
}

async function main() {
  const key = getKey()
  console.log('\n── Phase 3a: CBBD Verification ─────────────────────────────')

  // ── 1. Ratings endpoint ────────────────────────────────────────────────────
  console.log('\n[1] GET /ratings/adjusted?season=2025')
  const ratingsUrl = `${BASE_URL}/ratings/adjusted?season=2025`
  const { status: rStatus, body: rBody } = await fetchJSON(ratingsUrl, key)

  console.log(`    HTTP status: ${rStatus}`)

  if (rStatus !== 200) {
    console.error(`    FAIL — expected 200, got ${rStatus}`)
    console.error(`    Response: ${JSON.stringify(rBody).slice(0, 200)}`)
    process.exit(1)
  }

  const ratings = rBody as unknown[]
  if (!Array.isArray(ratings)) {
    console.error('    FAIL — response is not an array')
    process.exit(1)
  }

  console.log(`    Team count: ${ratings.length}`)
  if (ratings.length < 300) {
    console.warn(`    WARN — expected >= 300 teams, got ${ratings.length}`)
  } else {
    console.log(`    Coverage: OK (>= 300 teams)`)
  }

  if (ratings.length > 0) {
    const sample = ratings[0] as Record<string, unknown>
    console.log(`    Field names (first entry): ${Object.keys(sample).join(', ')}`)
    // Print one non-sensitive sample entry to inspect shape
    console.log(`    Sample entry:`, JSON.stringify(sample, null, 2))
  }

  // ── 2. Player stats endpoint ───────────────────────────────────────────────
  console.log('\n[2] GET /stats/player/season?season=2025&team=Duke')
  const playerUrl = `${BASE_URL}/stats/player/season?season=2025&team=Duke`
  const { status: pStatus, body: pBody } = await fetchJSON(playerUrl, key)

  console.log(`    HTTP status: ${pStatus}`)

  if (pStatus !== 200) {
    console.error(`    FAIL — expected 200, got ${pStatus}`)
    console.error(`    Response: ${JSON.stringify(pBody).slice(0, 200)}`)
  } else {
    const players = pBody as unknown[]
    if (!Array.isArray(players)) {
      console.error('    FAIL — response is not an array')
    } else {
      console.log(`    Player count: ${players.length}`)
      if (players.length > 0) {
        const sample = players[0] as Record<string, unknown>
        console.log(`    Field names (first entry): ${Object.keys(sample).join(', ')}`)
        console.log(`    Sample entry:`, JSON.stringify(sample, null, 2))
      }
    }
  }

  // ── 3. Team stats endpoint ─────────────────────────────────────────────────
  console.log('\n[3] GET /stats/team/season?season=2025&team=Duke')
  const teamUrl = `${BASE_URL}/stats/team/season?season=2025&team=Duke`
  const { status: tStatus, body: tBody } = await fetchJSON(teamUrl, key)

  console.log(`    HTTP status: ${tStatus}`)

  if (tStatus !== 200) {
    console.error(`    FAIL — expected 200, got ${tStatus}`)
    console.error(`    Response: ${JSON.stringify(tBody).slice(0, 200)}`)
  } else {
    const teams = Array.isArray(tBody) ? tBody : [tBody]
    console.log(`    Entry count: ${teams.length}`)
    if (teams.length > 0) {
      const sample = teams[0] as Record<string, unknown>
      console.log(`    Field names (first entry): ${Object.keys(sample).join(', ')}`)
      console.log(`    Sample entry:`, JSON.stringify(sample, null, 2))
    }
  }

  // ── 4. Tricky team name spot-check ─────────────────────────────────────────
  const trickyTeams = ["St. John's", 'Texas A&M', 'UConn', 'Ole Miss']
  console.log(`\n[4] Tricky team name spot-check (player endpoint, season=2025)`)

  for (const team of trickyTeams) {
    const url = `${BASE_URL}/stats/player/season?season=2025&team=${encodeURIComponent(team)}`
    const { status, body } = await fetchJSON(url, key)
    const count = Array.isArray(body) ? (body as unknown[]).length : 'N/A'
    const ok = status === 200 && Array.isArray(body) && (body as unknown[]).length > 0
    console.log(`    ${ok ? '✓' : '✗'} "${team}" → HTTP ${status}, players: ${count}`)
  }

  console.log('\n── Verification complete ────────────────────────────────────\n')
}

main().catch((err) => {
  console.error('Unexpected error:', err)
  process.exit(1)
})
