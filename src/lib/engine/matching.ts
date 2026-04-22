/**
 * Matches players across two season rosters by name.
 *
 * Ported verbatim from V1/src/lib/analytics/matching.ts.
 * Logic is unchanged — only the import path was updated.
 *
 * Matching is the highest-risk step because CBBD (like Sidearm) does not
 * include a persistent cross-season player ID — we match by name only.
 * Three tiers: exact, fuzzy (Jaro-Winkler ≥ 0.88), low-confidence (0.75–0.87).
 */

import type {
  PlayerSeason,
  ReturnedPlayer,
  MatchingResult,
  LowConfidenceCandidate,
  PlayerOverride,
} from '@/lib/types'

// ─── Jaro-Winkler Similarity ──────────────────────────────────────────────────

function jaro(s1: string, s2: string): number {
  if (s1 === s2) return 1
  const len1 = s1.length
  const len2 = s2.length
  if (len1 === 0 || len2 === 0) return 0

  const matchDist = Math.floor(Math.max(len1, len2) / 2) - 1
  const s1Matches = new Array(len1).fill(false)
  const s2Matches = new Array(len2).fill(false)

  let matches = 0
  let transpositions = 0

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchDist)
    const end   = Math.min(i + matchDist + 1, len2)
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0

  let k = 0
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3
  )
}

function jaroWinkler(s1: string, s2: string, p = 0.1): number {
  const j = jaro(s1, s2)
  let prefixLen = 0
  for (let i = 0; i < Math.min(4, s1.length, s2.length); i++) {
    if (s1[i] === s2[i]) prefixLen++
    else break
  }
  return j + prefixLen * p * (1 - j)
}

// ─── Name Normalization ───────────────────────────────────────────────────────

export function normalizePlayerName(raw: string): string {
  let name = raw.toLowerCase().trim()

  // Sidearm uses "Last,First" or "Last, First" — reverse it
  const commaIdx = name.indexOf(',')
  if (commaIdx !== -1) {
    const last  = name.slice(0, commaIdx).trim()
    const first = name.slice(commaIdx + 1).trim()
    name = `${first} ${last}`
  }

  name = name.replace(/\./g, '')
  name = name.replace(/\b(jr|sr|ii|iii|iv|v)\b/g, '').trim()
  name = name.replace(/\s+/g, ' ').trim()

  return name
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

const FUZZY_THRESHOLD = 0.88
const LOW_CONF_MIN    = 0.75

// ─── Main Matching Function ───────────────────────────────────────────────────

export function matchPlayerRosters(
  year1Qualified: PlayerSeason[],
  year2Players: PlayerSeason[]
): MatchingResult {
  const warnings: string[] = []
  const returning: ReturnedPlayer[] = []
  const nonReturning: PlayerSeason[] = []
  const lowConfidenceExcluded: LowConfidenceCandidate[] = []

  const year2ByNorm = new Map<string, PlayerSeason>()
  const year2Used   = new Set<string>()

  for (const p of year2Players) {
    const norm = normalizePlayerName(p.playerName)
    if (norm) year2ByNorm.set(norm, p)
  }

  // Pass 1: exact matches
  const unmatched1: PlayerSeason[] = []
  for (const p1 of year1Qualified) {
    const norm1 = normalizePlayerName(p1.playerName)
    if (year2ByNorm.has(norm1) && !year2Used.has(norm1)) {
      const p2 = year2ByNorm.get(norm1)!
      returning.push({ playerName: p1.playerName, year1Stats: p1, year2Stats: p2, matchConfidence: 'exact' })
      year2Used.add(norm1)
    } else {
      unmatched1.push(p1)
    }
  }

  // Pass 2: fuzzy match
  const unusedYear2 = Array.from(year2ByNorm.entries()).filter(([norm]) => !year2Used.has(norm))

  for (const p1 of unmatched1) {
    const norm1 = normalizePlayerName(p1.playerName)
    let bestScore = 0
    let bestNorm  = ''
    let bestP2: PlayerSeason | null = null

    for (const [norm2, p2] of unusedYear2) {
      const score = jaroWinkler(norm1, norm2)
      if (score > bestScore) {
        bestScore = score
        bestNorm  = norm2
        bestP2    = p2
      }
    }

    if (bestScore >= FUZZY_THRESHOLD && bestP2) {
      returning.push({
        playerName:      p1.playerName,
        year1Stats:      p1,
        year2Stats:      bestP2,
        matchConfidence: 'fuzzy',
        similarityScore: Math.round(bestScore * 1000) / 1000,
      })
      year2Used.add(bestNorm)
    } else if (bestScore >= LOW_CONF_MIN && bestP2) {
      lowConfidenceExcluded.push({
        year1Player:    p1,
        year2Candidate: bestP2,
        similarityScore: Math.round(bestScore * 1000) / 1000,
      })
      warnings.push(
        `Low-confidence match for "${p1.playerName}" → possible match "${bestP2.playerName}" ` +
        `(similarity ${(bestScore * 100).toFixed(0)}%) — excluded from calculations. Review manually.`
      )
    } else {
      nonReturning.push(p1)
    }
  }

  const newPlayers = Array.from(year2ByNorm.values()).filter(
    p2 => !year2Used.has(normalizePlayerName(p2.playerName))
  )

  const fuzzyCount = returning.filter(r => r.matchConfidence === 'fuzzy').length
  if (fuzzyCount > 0) {
    warnings.push(
      `${fuzzyCount} player${fuzzyCount > 1 ? 's' : ''} matched by name similarity — review recommended.`
    )
  }
  if (lowConfidenceExcluded.length > 0) {
    warnings.push(
      `${lowConfidenceExcluded.length} player${lowConfidenceExcluded.length > 1 ? 's' : ''} excluded due to low match confidence — returning player count may be understated.`
    )
  }

  return { returning, nonReturning, newPlayers, lowConfidenceExcluded, warnings }
}

// ─── Manual Override Application ─────────────────────────────────────────────

export function applyManualOverrides(
  matchResult: MatchingResult,
  overrides: PlayerOverride[]
): MatchingResult {
  if (overrides.length === 0) return matchResult

  const returning  = [...matchResult.returning]
  const newPlayers = [...matchResult.newPlayers]
  const excluded   = [...matchResult.lowConfidenceExcluded]
  const warnings   = [...matchResult.warnings]

  for (const override of overrides) {
    const candIdx = excluded.findIndex(c => c.year1Player.playerId === override.year1PlayerId)
    if (candIdx === -1) continue

    const candidate = excluded[candIdx]
    const year2Player =
      newPlayers.find(p => p.playerId === override.year2PlayerId) ??
      candidate.year2Candidate

    excluded.splice(candIdx, 1)
    const newIdx = newPlayers.findIndex(p => p.playerId === override.year2PlayerId)
    if (newIdx !== -1) newPlayers.splice(newIdx, 1)

    returning.push({
      playerName:      candidate.year1Player.playerName,
      year1Stats:      candidate.year1Player,
      year2Stats:      year2Player,
      matchConfidence: 'manual',
    })
  }

  const overriddenNames = new Set(overrides.map(o => o.year1PlayerName.toLowerCase()))
  const filteredWarnings = warnings.filter(w => {
    if (!w.startsWith('Low-confidence match for')) return true
    return !Array.from(overriddenNames).some(name => w.toLowerCase().includes(name))
  })

  return {
    returning,
    nonReturning: matchResult.nonReturning,
    newPlayers,
    lowConfidenceExcluded: excluded,
    warnings: filteredWarnings,
  }
}
