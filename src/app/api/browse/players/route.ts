import * as fs from 'fs'
import * as path from 'path'

const D1_CACHE_ROOT = path.resolve(process.cwd(), 'data/cache/d1/cbbd/players')
const D2_CACHE_ROOT = path.resolve(process.cwd(), 'data/cache/d2/sidearm/players')

// Only scan the most recent seasons — fast and sufficient for current-season results.
const D1_SCAN_YEARS = [2026, 2025]
const D2_SCAN_YEARS = [2026, 2025]

export interface PlayerIndexEntry {
  athleteId: string  // D1: numeric only e.g. "237"; D2: full sidearm ID e.g. "sidearm-425-2311"
  name: string
  teamSlug: string
  year: number
}

export async function GET() {
  const seen = new Set<string>()  // dedup by athleteId
  const entries: PlayerIndexEntry[] = []

  // ── D1 players ────────────────────────────────────────────────────────────
  for (const year of D1_SCAN_YEARS) {
    const yearDir = path.join(D1_CACHE_ROOT, String(year))
    if (!fs.existsSync(yearDir)) continue

    const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const teamSlug = file.replace('.json', '')
      try {
        const raw = fs.readFileSync(path.join(yearDir, file), 'utf-8')
        const entry = JSON.parse(raw)
        const players: { playerId: string; playerName: string }[] = entry.data ?? entry
        if (!Array.isArray(players)) continue
        for (const p of players) {
          if (!p.playerId?.startsWith('cbbd-')) continue
          const athleteId = p.playerId.slice(5)  // strip "cbbd-"
          if (!seen.has(athleteId)) {
            seen.add(athleteId)
            entries.push({ athleteId, name: p.playerName, teamSlug, year })
          }
        }
      } catch {
        // skip
      }
    }
  }

  // ── D2 players ────────────────────────────────────────────────────────────
  for (const year of D2_SCAN_YEARS) {
    const yearDir = path.join(D2_CACHE_ROOT, String(year))
    if (!fs.existsSync(yearDir)) continue

    const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const teamSlug = file.replace('.json', '')
      try {
        const raw = fs.readFileSync(path.join(yearDir, file), 'utf-8')
        const entry = JSON.parse(raw)
        const players: { playerId: string; playerName: string }[] = entry.data ?? entry
        if (!Array.isArray(players)) continue
        for (const p of players) {
          if (!p.playerId?.startsWith('sidearm-')) continue
          const athleteId = p.playerId  // keep full ID: "sidearm-425-2311"
          if (!seen.has(athleteId)) {
            seen.add(athleteId)
            entries.push({ athleteId, name: p.playerName, teamSlug, year })
          }
        }
      } catch {
        // skip
      }
    }
  }

  return Response.json({ success: true, data: entries })
}
