import { prisma } from '@/lib/db'

// Scan the two most recent seasons — sufficient for current-season results.
const SCAN_YEARS = [2026, 2025]

export interface PlayerIndexEntry {
  athleteId: string  // D1: numeric only e.g. "237"; D2: full sidearm ID e.g. "sidearm-425-2311"
  name: string
  teamSlug: string
  year: number
}

export async function GET() {
  const rows = await prisma.playerSeason.findMany({
    where: { year: { in: SCAN_YEARS } },
    select: {
      playerId:   true,
      playerName: true,
      teamId:     true,
      year:       true,
    },
    orderBy: [{ year: 'desc' }, { playerName: 'asc' }],
  })

  const seen = new Set<string>()
  const entries: PlayerIndexEntry[] = []

  for (const row of rows) {
    const isD1 = row.playerId.startsWith('cbbd-')
    const isD2 = row.playerId.startsWith('sidearm-')
    if (!isD1 && !isD2) continue

    const athleteId = isD1 ? row.playerId.slice(5) : row.playerId
    if (seen.has(athleteId)) continue
    seen.add(athleteId)

    entries.push({
      athleteId,
      name:     row.playerName,
      teamSlug: row.teamId,
      year:     row.year,
    })
  }

  return Response.json({ success: true, data: entries })
}
