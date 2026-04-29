/**
 * Template-driven interpretation paragraph for the Player Page.
 *
 * Places the player inside the team's transition story based on their status,
 * role size, and role change. Intentionally template-driven — deterministic
 * and verifiable, consistent with the Team Page summary paragraph pattern.
 */

import type { OutlierFlag } from '@/lib/types'
import type { PlayerPageData } from './playerPageData'

function seasonLabel(year2: number): string {
  return `${year2 - 1}–${String(year2).slice(2)}`
}

function fmt1(n: number): string { return n.toFixed(1) }

function fmtPct(n: number): string { return `${fmt1(n)}%` }

function fmtDelta(n: number): string {
  const abs = Math.abs(n).toFixed(1)
  return n >= 0 ? `+${abs}pp` : `−${abs}pp`
}

const FLAG_CONTEXT: Partial<Record<NonNullable<OutlierFlag>, string>> = {
  'high-ci-improve': 'a program that leaned on its returning core and improved',
  'high-ci-stable':  'a program that returned most of its roster and held steady',
  'high-ci-decline': 'a program that retained most of its roster but saw results dip',
  'mid-ci-improve':  'a program navigating moderate turnover with improved results',
  'mid-ci-stable':   'a program with moderate roster turnover and comparable results',
  'mid-ci-decline':  'a program that cycled significant turnover with declining results',
  'low-ci-improve':  'a program that rebuilt heavily and still improved',
  'low-ci-stable':   'a program in heavy transition that maintained its level',
  'low-ci-decline':  'a program in transition that saw results fall',
  'stats-only':      'a program where player-level continuity data is unavailable',
}

export function buildPlayerParagraph(data: PlayerPageData): string {
  const {
    playerName, teamIdentity, status,
    year1, year2,
    minShare, ptsShare,
    priorMinShare, priorPtsShare,
    minShareDelta, ptsShareDelta,
    roleTag, retention, outlierFlag,
    departedAfterYear2, belowThresholdInfo,
    currentStats,
  } = data

  const teamName  = teamIdentity?.shortName ?? teamIdentity?.name ?? 'the team'
  const label2    = seasonLabel(year2)
  const label1    = seasonLabel(year1)
  const flagCtx   = outlierFlag && outlierFlag in FLAG_CONTEXT
    ? FLAG_CONTEXT[outlierFlag as keyof typeof FLAG_CONTEXT]!
    : ''
  const retCount  = retention?.returningPlayersCount ?? 0
  const newCount  = retention?.newPlayersCount       ?? 0
  const ciStr     = retention ? `a continuity index of ${fmt1(retention.continuityIndex)}` : 'tracked roster continuity'

  const departureNote = departedAfterYear2
    ? ` ${playerName} did not return to the program for ${seasonLabel(year2 + 1)}.`
    : ''

  // ── Below threshold ───────────────────────────────────────────────────────
  if (belowThresholdInfo) {
    return (
      `${playerName} appeared in ${currentStats.games} game${currentStats.games === 1 ? '' : 's'} for ` +
      `${teamName} in ${label2} but fell below the participation threshold — ` +
      `${belowThresholdInfo.exclusionLabel}. ` +
      `They are tracked in the roster but excluded from the team's Continuity Index calculation.` +
      departureNote
    )
  }

  // ── Newcomer ─────────────────────────────────────────────────────────────
  if (status === 'newcomer') {
    const roleDesc  = roleTag === 'lead' ? 'a lead' : roleTag === 'core' ? 'a core' : roleTag === 'rotation' ? 'a rotation' : 'a bench'
    const newcomerN = `one of ${newCount} newcomer${newCount === 1 ? '' : 's'} on`
    const flagLine  = flagCtx ? ` ${teamName} was ${flagCtx} in ${label2}.` : ''
    return (
      `${playerName} joined ${teamName} as ${newcomerN} a team with ${ciStr} in ${label2}. ` +
      `They contributed ${fmtPct(minShare)} of team minutes and ${fmtPct(ptsShare)} of scoring as ${roleDesc} contributor.` +
      flagLine +
      departureNote
    )
  }

  // ── Departure (found only in year1 cache — rare with current link gen) ───
  if (status === 'departure') {
    const roleDesc = roleTag === 'lead' ? 'a lead contributor' : roleTag === 'core' ? 'a core contributor' : roleTag === 'rotation' ? 'a rotation contributor' : 'a bench player'
    return (
      `${playerName} was ${roleDesc} for ${teamName} in the ${label2} season, ` +
      `accounting for ${fmtPct(minShare)} of team minutes and ${fmtPct(ptsShare)} of scoring. ` +
      `They did not appear on ${teamName}'s roster the following season.`
    )
  }

  // ── Returner ─────────────────────────────────────────────────────────────
  const roleDelta  = minShareDelta ?? 0
  const roleGrew   = roleDelta >  1.5
  const roleShrank = roleDelta < -1.5

  if (roleGrew) {
    const ptsNote = ptsShareDelta !== null && Math.abs(ptsShareDelta) > 1
      ? `, and their scoring share grew from ${fmtPct(priorPtsShare!)} to ${fmtPct(ptsShare)} (${fmtDelta(ptsShareDelta!)})`
      : ''
    const flagLine = flagCtx ? ` ${teamName} was ${flagCtx}.` : ''
    return (
      `${playerName} returned to ${teamName} for ${label2} and expanded their role from ` +
      `${fmtPct(priorMinShare!)} to ${fmtPct(minShare)} of team minutes (${fmtDelta(roleDelta)})${ptsNote}. ` +
      `They were one of ${retCount} returning contributor${retCount === 1 ? '' : 's'} on a team with ${ciStr}.` +
      flagLine +
      departureNote
    )
  }

  if (roleShrank) {
    const flagLine = flagCtx ? ` ${teamName} was ${flagCtx}.` : ''
    return (
      `${playerName} returned to ${teamName} for ${label2} but played a reduced role, ` +
      `with their minute share declining from ${fmtPct(priorMinShare!)} to ${fmtPct(minShare)} (${fmtDelta(roleDelta)}). ` +
      `They contributed ${fmtPct(ptsShare)} of team scoring — down from ${fmtPct(priorPtsShare!)} the prior year.` +
      flagLine +
      departureNote
    )
  }

  // Stable returner
  const flagLine = flagCtx ? ` ${teamName} was ${flagCtx} in ${label2}.` : ''
  return (
    `${playerName} held a consistent role for ${teamName} in ${label2}, returning with ` +
    `${fmtPct(minShare)} of team minutes and ${fmtPct(ptsShare)} of scoring — ` +
    `closely matching their ${label1} contributions. ` +
    `They were one of ${retCount} returner${retCount === 1 ? '' : 's'} on a team with ${ciStr}.` +
    flagLine +
    departureNote
  )
}
