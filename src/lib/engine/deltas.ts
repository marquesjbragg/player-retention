/**
 * Computes year-over-year stat changes between two TeamSeason objects.
 *
 * Ported verbatim from V1/src/lib/analytics/deltas.ts.
 * Logic is unchanged — only the import path was updated.
 */

import type { TeamSeason, StatDelta, DeltaDirection } from '@/lib/types'

function direction(delta: number, higherIsBetter: boolean): DeltaDirection {
  if (Math.abs(delta) < 0.005) return 'neutral'
  if (delta > 0) return higherIsBetter ? 'up' : 'down'
  return higherIsBetter ? 'down' : 'up'
}

function delta(
  key: string,
  label: string,
  category: StatDelta['category'],
  y1: number,
  y2: number,
  higherIsBetter: boolean
): StatDelta {
  const d = Math.round((y2 - y1) * 1000) / 1000
  return {
    key,
    label,
    category,
    year1Value:    Math.round(y1 * 100) / 100,
    year2Value:    Math.round(y2 * 100) / 100,
    delta:         d,
    direction:     direction(d, higherIsBetter),
    higherIsBetter,
  }
}

function winPct(wins: number, losses: number): number {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 10000) / 100
}

export function calculateDeltas(year1: TeamSeason, year2: TeamSeason): StatDelta[] {
  return [
    delta('winPct',      'Win %',       'success', winPct(year1.wins, year1.losses), winPct(year2.wins, year2.losses), true),
    delta('wins',        'Wins',        'success', year1.wins,       year2.wins,       true),
    delta('losses',      'Losses',      'success', year1.losses,     year2.losses,     false),
    delta('ppg',         'PPG',         'offense', year1.ppg,        year2.ppg,        true),
    delta('fgPct',       'FG%',         'offense', year1.fgPct,      year2.fgPct,      true),
    delta('threePct',    '3PT%',        'offense', year1.threePct,   year2.threePct,   true),
    delta('ftPct',       'FT%',         'offense', year1.ftPct,      year2.ftPct,      true),
    delta('apg',         'Assists/G',   'offense', year1.apg,        year2.apg,        true),
    delta('topg',        'Turnovers/G', 'offense', year1.topg,       year2.topg,       false),
    delta('orbpg',       'Off Reb/G',   'offense', year1.orbpg,      year2.orbpg,      true),
    delta('oppPpg',      'Opp PPG',     'defense', year1.oppPpg,     year2.oppPpg,     false),
    delta('oppFgPct',    'Opp FG%',     'defense', year1.oppFgPct,   year2.oppFgPct,   false),
    delta('oppThreePct', 'Opp 3PT%',    'defense', year1.oppThreePct, year2.oppThreePct, false),
    delta('oppTopg',     'Opp TO/G',    'defense', year1.oppTopg,    year2.oppTopg,    true),
    delta('spg',         'Steals/G',    'defense', year1.spg,        year2.spg,        true),
    delta('bpg',         'Blocks/G',    'defense', year1.bpg,        year2.bpg,        true),
    delta('drbpg',       'Def Reb/G',   'defense', year1.drbpg,      year2.drbpg,      true),
  ]
}
