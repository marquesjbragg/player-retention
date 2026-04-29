'use client'

import type { TeamSeason, RatingsEntry } from '@/lib/types'

interface Props {
  teamSeason1: TeamSeason | null
  teamSeason2: TeamSeason | null
  ratings1: RatingsEntry | null
  ratings2: RatingsEntry | null
  year1: number
  year2: number
}

function seasonLabel(year2: number): string {
  return `${year2 - 1}–${String(year2).slice(2)}`
}

function winPct(wins: number, losses: number): number {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 1000) / 10
}

function fmtDelta(n: number): string {
  const abs = Math.abs(n).toFixed(1)
  return n > 0 ? `+${abs}pp` : n < 0 ? `−${abs}pp` : '—'
}

function deltaColor(n: number): string {
  if (Math.abs(n) < 0.5) return 'var(--text-mid)'
  return n > 0 ? 'var(--positive)' : 'var(--negative)'
}

function rankDeltaLabel(r1: number | null, r2: number | null): string {
  if (!r1 || !r2) return ''
  const diff = r1 - r2
  if (Math.abs(diff) < 1) return 'unchanged'
  return diff > 0 ? `▲${diff} spots` : `▼${Math.abs(diff)} spots`
}

function rankDeltaColor(r1: number | null, r2: number | null): string {
  if (!r1 || !r2) return 'var(--text-lo)'
  const diff = r1 - r2
  return diff > 0 ? 'var(--positive)' : diff < 0 ? 'var(--negative)' : 'var(--text-lo)'
}

export function SeasonComparison({ teamSeason1, teamSeason2, ratings1, ratings2, year1, year2 }: Props) {
  if (!teamSeason1 && !teamSeason2) return null

  const wp1 = teamSeason1 ? winPct(teamSeason1.wins, teamSeason1.losses) : null
  const wp2 = teamSeason2 ? winPct(teamSeason2.wins, teamSeason2.losses) : null
  const wpDelta = wp1 !== null && wp2 !== null ? Math.round((wp2 - wp1) * 100) / 100 : null

  const r1 = ratings1?.rank ?? null
  const r2 = ratings2?.rank ?? null
  const rLabel = rankDeltaLabel(r1, r2)
  const rColor = rankDeltaColor(r1, r2)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'stretch',
      gap: '0',
      border: '1px solid var(--border-hi)',
      borderRadius: '6px',
      overflow: 'hidden',
      marginBottom: '10px',
      fontSize: '11px',
    }}>
      {/* Year 1 */}
      <SeasonRow
        label={seasonLabel(year1)}
        season={teamSeason1}
        wp={wp1}
        rank={r1}
        muted
      />

      {/* Arrow */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 8px',
        borderLeft: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        backgroundColor: 'var(--bg-out)',
        flexDirection: 'column',
        gap: '4px',
        minWidth: '64px',
      }}>
        <span style={{ fontSize: '14px', color: 'var(--text-lo)' }}>→</span>
        {wpDelta !== null && (
          <span style={{ fontSize: '10px', fontWeight: 700, color: deltaColor(wpDelta) }}>
            {fmtDelta(wpDelta)}
          </span>
        )}
        {r1 && r2 && rLabel && (
          <span style={{ fontSize: '9px', color: rColor }}>{rLabel}</span>
        )}
      </div>

      {/* Year 2 */}
      <SeasonRow
        label={seasonLabel(year2)}
        season={teamSeason2}
        wp={wp2}
        rank={r2}
      />
    </div>
  )
}

interface SeasonRowProps {
  label: string
  season: TeamSeason | null
  wp: number | null
  rank: number | null
  muted?: boolean
}

function SeasonRow({ label, season, wp, rank, muted }: SeasonRowProps) {
  const textColor = muted ? 'var(--text-mid)' : 'var(--text-hi)'

  return (
    <div style={{
      flex: 1,
      padding: '8px 12px',
      backgroundColor: muted ? 'var(--bg-out)' : 'transparent',
    }}>
      <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-lo)', marginBottom: '5px' }}>
        {label}
      </div>
      {season ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: textColor, letterSpacing: '-0.01em' }}>
            {season.wins}–{season.losses}
          </span>
          {wp !== null && (
            <span style={{ fontSize: '10px', color: muted ? 'var(--text-lo)' : 'var(--text-mid)' }}>
              {wp.toFixed(1)}% W
            </span>
          )}
          {rank && (
            <span style={{ fontSize: '10px', color: muted ? 'var(--text-lo)' : 'var(--text-mid)' }}>
              Net #{rank}
            </span>
          )}
        </div>
      ) : (
        <span style={{ fontSize: '11px', color: 'var(--text-lo)' }}>—</span>
      )}
    </div>
  )
}
