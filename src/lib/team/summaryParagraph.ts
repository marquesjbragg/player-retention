/**
 * Template-driven summary paragraph for the Team Research page.
 *
 * Returns a 5–7 sentence editorial paragraph based on the team's year-pair data.
 * Returns null if data is insufficient (no player data or no team seasons).
 *
 * Intentionally template-driven — not AI prose — so output is deterministic,
 * verifiable, and won't hallucinate context it doesn't have.
 */

import type { OutlierFlag } from '@/lib/types'
import type { TeamPageData } from './teamPageData'

// Season label: 2026 → "2025–26"
function seasonLabel(year2: number): string {
  const y1 = year2 - 1
  return `${y1}–${String(year2).slice(2)}`
}

function winPct(wins: number, losses: number): number {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 10000) / 100
}

function fmt1(n: number): string {
  return n.toFixed(1)
}

function fmtPct(n: number): string {
  return `${fmt1(n)}%`
}

function fmtDelta(n: number, decimals = 1): string {
  const s = Math.abs(n).toFixed(decimals)
  return n >= 0 ? `+${s}` : `−${s}`
}

// ─── Pattern sentences ────────────────────────────────────────────────────────

const PATTERN_SENTENCES: Record<NonNullable<Exclude<OutlierFlag, 'stats-only' | null>>, string> = {
  'high-ci-improve':  'High roster continuity aligned with improved outcomes — the program built on its returning core.',
  'high-ci-stable':   'High roster continuity produced consistent results — the returning core held the program\'s trajectory steady.',
  'high-ci-decline':  'Despite strong roster continuity, outcomes declined — a notable pattern suggesting factors beyond personnel loss were at play.',
  'mid-ci-improve':   'Moderate roster turnover did not prevent improvement — the team integrated its newcomers effectively.',
  'mid-ci-stable':    'Moderate roster turnover produced comparable results to the prior season.',
  'mid-ci-decline':   'Moderate roster turnover coincided with declining results — the team did not fully replace what it lost.',
  'low-ci-improve':   'Low roster continuity but improved results — the rebuilt roster outperformed expectations.',
  'low-ci-stable':    'Significant roster turnover produced similar outcomes — production was successfully replenished.',
  'low-ci-decline':   'Low roster continuity and declining results — significant personnel loss translated directly to on-court regression.',
}

// ─── Main function ────────────────────────────────────────────────────────────

export function buildSummaryParagraph(data: TeamPageData): string | null {
  const { identity, yearPair, teamSeason1, teamSeason2, retention, deltas, ratings1, ratings2, outlierFlag } = data

  if (!retention || !teamSeason1 || !teamSeason2) return null

  const { year2 } = yearPair
  const teamName = identity.shortName || identity.name
  const label2 = seasonLabel(year2)

  const ci = retention.continuityIndex
  const retMin = retention.returningMinutesPct
  const retPts = retention.returningPointsPct
  const newMin = retention.newcomerMinutesPct
  const newPts = retention.newcomerPointsPct

  const y1wp  = winPct(teamSeason1.wins, teamSeason1.losses)
  const y2wp  = winPct(teamSeason2.wins, teamSeason2.losses)
  const wpDelta = Math.round((y2wp - y1wp) * 100) / 100

  const ppgDelta    = deltas.find(d => d.key === 'ppg')?.delta    ?? 0
  const oppPpgDelta = deltas.find(d => d.key === 'oppPpg')?.delta ?? 0

  const sentences: string[] = []

  // 1. CI sentence
  sentences.push(
    `${teamName} entered the ${label2} season with a continuity index of ${fmt1(ci)}, ` +
    `returning ${fmtPct(retMin)} of minutes and ${fmtPct(retPts)} of points from the prior year.`
  )

  // 2. Pattern flag sentence
  const flagKey = outlierFlag && outlierFlag !== 'stats-only' ? outlierFlag : null
  if (flagKey && flagKey in PATTERN_SENTENCES) {
    sentences.push(PATTERN_SENTENCES[flagKey as keyof typeof PATTERN_SENTENCES])
  }

  // 3. Record sentence
  const wpDirection = wpDelta > 0.5 ? 'improved' : wpDelta < -0.5 ? 'declined' : 'held steady'
  sentences.push(
    `The team went from ${teamSeason1.wins}–${teamSeason1.losses} (${fmtPct(y1wp)}) ` +
    `to ${teamSeason2.wins}–${teamSeason2.losses} (${fmtPct(y2wp)}), ` +
    `${wpDirection === 'held steady'
      ? 'with win percentage essentially unchanged'
      : `a ${fmtDelta(wpDelta)}pp change in win percentage`
    }.`
  )

  // 4. Offensive delta
  if (Math.abs(ppgDelta) >= 0.05) {
    const offDir = ppgDelta > 0 ? 'increased' : 'decreased'
    sentences.push(
      `Offensively, scoring ${offDir} from ${fmt1(teamSeason1.ppg)} to ${fmt1(teamSeason2.ppg)} PPG (${fmtDelta(ppgDelta)}).`
    )
  }

  // 5. Defensive delta
  if (Math.abs(oppPpgDelta) >= 0.05) {
    const defDir = oppPpgDelta < 0 ? 'improved' : 'worsened'
    sentences.push(
      `Defensively, opponent scoring ${defDir} from ${fmt1(teamSeason1.oppPpg)} to ${fmt1(teamSeason2.oppPpg)} points allowed per game (${fmtDelta(oppPpgDelta)}).`
    )
  }

  // 6. Newcomer context
  const newCount = retention.newPlayersCount
  if (newCount > 0) {
    sentences.push(
      `${newCount} newcomer${newCount === 1 ? '' : 's'} contributed ${fmtPct(newMin)} of minutes ` +
      `and ${fmtPct(newPts)} of points in the new season.`
    )
  }

  // 7. Ratings context (optional — only if both years have ratings)
  if (ratings1?.rank && ratings2?.rank) {
    const rankDir = ratings2.rank < ratings1.rank ? 'improved' : ratings2.rank > ratings1.rank ? 'declined'  : 'held steady'
    sentences.push(
      `The team's net rating rank ${rankDir} from #${ratings1.rank} to #${ratings2.rank} nationally.`
    )
  }

  return sentences.join(' ')
}
