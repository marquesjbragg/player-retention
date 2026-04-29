import { NextRequest } from 'next/server'
import * as fs from 'fs'
import * as path from 'path'
import { getPlayerAppearances } from '@/lib/identity/PlayerIdentityIndex'
import type { IdentityConfidence } from '@/lib/identity/PlayerIdentityIndex'

const D1_CACHE_ROOT = path.resolve(process.cwd(), 'data/cache/d1/cbbd/players')
const D2_CACHE_ROOT = path.resolve(process.cwd(), 'data/cache/d2/sidearm/players')
const YEARS = [2026, 2025, 2024, 2023, 2022, 2021]

export interface PlayerAppearance {
  year: number
  teamSlug: string
  division: 'D1' | 'D2'
  /** Always the normalized form: "cbbd-{n}" for D1, "sidearm-{id}" for D2 */
  playerId: string
  confidence: IdentityConfidence
}

interface RouteParams {
  params: { id: string }
}

/** Normalize the URL param to a fully-qualified player ID. */
function resolvePlayerId(id: string): { playerId: string; isD2: boolean } {
  if (id.startsWith('sidearm-')) return { playerId: id,          isD2: true  }
  if (id.startsWith('cbbd-'))   return { playerId: id,          isD2: false }
  // bare numeric D1 ID (e.g. "85")
  return { playerId: `cbbd-${id}`, isD2: false }
}

function scanCache(
  cacheRoot: string,
  playerId: string,
  division: 'D1' | 'D2',
  years: number[],
): PlayerAppearance[] {
  const results: PlayerAppearance[] = []

  for (const year of years) {
    const yearDir = path.join(cacheRoot, String(year))
    if (!fs.existsSync(yearDir)) continue

    const files = fs.readdirSync(yearDir).filter(f => f.endsWith('.json'))
    for (const file of files) {
      const teamSlug = file.replace('.json', '')
      try {
        const raw = fs.readFileSync(path.join(yearDir, file), 'utf-8')
        if (!raw.includes(playerId)) continue
        const entry = JSON.parse(raw)
        const players: { playerId: string }[] = entry.data ?? entry
        if (Array.isArray(players) && players.some(p => p.playerId === playerId)) {
          results.push({ year, teamSlug, division, playerId, confidence: 'exact' })
        }
      } catch {
        // skip malformed files
      }
    }
  }

  return results
}

const CONFIDENCE_RANK: Record<IdentityConfidence, number> = {
  exact: 4, high: 3, probable: 2, possible: 1,
}

// Keeps the highest-confidence entry per year+teamSlug pair.
function dedupAppearances(appearances: PlayerAppearance[]): PlayerAppearance[] {
  const best = new Map<string, PlayerAppearance>()
  for (const a of appearances) {
    const key = `${a.year}:${a.teamSlug}`
    const existing = best.get(key)
    if (!existing || CONFIDENCE_RANK[a.confidence] > CONFIDENCE_RANK[existing.confidence]) {
      best.set(key, a)
    }
  }
  return Array.from(best.values()).sort((a, b) => b.year - a.year)
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id } = params
  const { playerId, isD2 } = resolvePlayerId(id)

  // Primary: O(1) identity index lookup, includes cross-division links
  const indexEntry = getPlayerAppearances(playerId)
  if (indexEntry) {
    const collected: PlayerAppearance[] = []
    const visitedIds = new Set<string>([playerId])

    for (const a of indexEntry) {
      collected.push({
        year:       a.year,
        teamSlug:   a.teamSlug,
        division:   a.division,
        playerId:   a.playerId,
        confidence: a.confidence,
      })

      // Secondary lookup: when the index entry references a different playerId
      // (cross-school probable or cross-division possible), pull its full history
      // so both entry points show the complete career chain.
      if (a.playerId !== playerId && !visitedIds.has(a.playerId)) {
        visitedIds.add(a.playerId)
        const linked = getPlayerAppearances(a.playerId)
        if (linked) {
          for (const la of linked) {
            collected.push({
              year:       la.year,
              teamSlug:   la.teamSlug,
              division:   la.division,
              playerId:   la.playerId,
              confidence: la.confidence,
            })
          }
        }
      }
    }

    return Response.json({ success: true, data: dedupAppearances(collected) })
  }

  // Fallback: filesystem scan for players not yet in the index
  const homeCacheRoot = isD2 ? D2_CACHE_ROOT : D1_CACHE_ROOT
  const homeDivision: 'D1' | 'D2' = isD2 ? 'D2' : 'D1'
  const scanResults = scanCache(homeCacheRoot, playerId, homeDivision, YEARS)
    .map(a => ({ ...a, confidence: 'exact' as IdentityConfidence }))

  return Response.json({ success: true, data: dedupAppearances(scanResults) })
}
