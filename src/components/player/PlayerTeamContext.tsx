'use client'

import Link from 'next/link'
import type { PlayerApiData } from '@/hooks/usePlayer'
import type { OutlierFlag } from '@/lib/types'

interface Props {
  data: PlayerApiData
}

function seasonLabel(year2: number): string {
  return `${year2 - 1}–${String(year2).slice(2)}`
}

function fmtDelta(n: number): string {
  const abs = Math.abs(n).toFixed(1)
  return n >= 0 ? `+${abs}pp` : `−${abs}pp`
}

function deltaColor(n: number): string {
  if (Math.abs(n) < 0.5) return 'var(--text-mid)'
  return n > 0 ? 'var(--positive)' : 'var(--negative)'
}

const FLAG_DISPLAY: Partial<Record<NonNullable<OutlierFlag>, { label: string; color: string; bg: string }>> = {
  'high-ci-improve': { label: 'HIGH CI · IMPROVED', color: 'var(--badge-green-fg)',  bg: 'var(--badge-green-bg)'  },
  'high-ci-stable':  { label: 'HIGH CI · STABLE',   color: 'var(--badge-green-fg)',  bg: 'var(--badge-green-bg)'  },
  'high-ci-decline': { label: 'HIGH CI · DECLINED',  color: 'var(--badge-red-fg)',    bg: 'var(--badge-red-bg)'    },
  'mid-ci-improve':  { label: 'MID CI · IMPROVED',   color: 'var(--badge-amber-fg)',  bg: 'var(--badge-amber-bg)'  },
  'mid-ci-stable':   { label: 'MID CI · STABLE',     color: 'var(--badge-amber-fg)',  bg: 'var(--badge-amber-bg)'  },
  'mid-ci-decline':  { label: 'MID CI · DECLINED',   color: 'var(--badge-red-fg)',    bg: 'var(--badge-red-bg)'    },
  'low-ci-improve':  { label: 'LOW CI · IMPROVED',   color: 'var(--badge-amber-fg)',  bg: 'var(--badge-amber-bg)'  },
  'low-ci-stable':   { label: 'LOW CI · STABLE',     color: 'var(--badge-red-fg)',    bg: 'var(--badge-red-bg)'    },
  'low-ci-decline':  { label: 'LOW CI · DECLINED',   color: 'var(--badge-red-fg)',    bg: 'var(--badge-red-bg)'    },
  'stats-only':      { label: 'STATS ONLY',           color: 'var(--badge-gray-fg)',   bg: 'var(--badge-silver-bg)' },
}

function ciColor(ci: number): string {
  if (ci >= 70) return 'var(--positive)'
  if (ci >= 40) return 'var(--badge-amber-fg)'
  return 'var(--negative)'
}

function rankDeltaLabel(r1: number | null, r2: number | null): string {
  if (!r1 || !r2) return ''
  const diff = r1 - r2
  if (Math.abs(diff) < 1) return `#${r2}`
  return diff > 0 ? `▲${diff} → #${r2}` : `▼${Math.abs(diff)} → #${r2}`
}

function rankDeltaColor(r1: number | null, r2: number | null): string {
  if (!r1 || !r2) return 'var(--text-mid)'
  const diff = r1 - r2
  return diff > 0 ? 'var(--positive)' : diff < 0 ? 'var(--negative)' : 'var(--text-hi)'
}

export function PlayerTeamContext({ data }: Props) {
  const {
    teamIdentity, teamSlug, year2,
    retention, outlierFlag,
    winPctDelta,
    ratings1, ratings2,
    teamSeason1, teamSeason2,
  } = data

  const teamName = teamIdentity?.shortName ?? teamIdentity?.name ?? teamSlug
  const label    = seasonLabel(year2)
  const flag     = outlierFlag ? FLAG_DISPLAY[outlierFlag] : null

  const r1 = ratings1?.rank ?? null
  const r2 = ratings2?.rank ?? null

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-mid)', marginBottom: '6px' }}>
        Team Context
      </div>

      <div style={{ border: '1px solid var(--border-hi)', borderRadius: '6px', overflow: 'hidden' }}>
        {/* Team identity bar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px',
          borderBottom: '1px solid var(--border)',
          backgroundColor: 'var(--bg-out)',
        }}>
          {teamIdentity?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamIdentity.logoUrl} width={28} height={28} style={{ objectFit: 'contain', flexShrink: 0 }} alt="" />
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.01em' }}>
              {teamName}
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-lo)', marginTop: '1px' }}>
              {label} · {teamIdentity?.conference}
            </div>
          </div>
          {flag && (
            <span style={{
              fontSize: '8px', fontWeight: 700, letterSpacing: '0.08em',
              padding: '3px 7px', borderRadius: '3px',
              backgroundColor: flag.bg, color: flag.color,
            }}>
              {flag.label}
            </span>
          )}
        </div>

        {/* Metrics */}
        <div style={{ display: 'flex', padding: '0' }}>
          {/* CI */}
          <div style={{ flex: 1, padding: '8px 12px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-lo)', marginBottom: '2px' }}>CI</div>
            {retention ? (
              <div style={{ fontSize: '15px', fontWeight: 700, color: ciColor(retention.continuityIndex), letterSpacing: '-0.02em' }}>
                {retention.continuityIndex.toFixed(1)}
              </div>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-lo)' }}>—</div>
            )}
            {retention && (
              <div style={{ fontSize: '9px', color: 'var(--text-lo)' }}>
                {retention.returningPlayersCount}R · {retention.newPlayersCount}N
              </div>
            )}
          </div>

          {/* W% */}
          <div style={{ flex: 1, padding: '8px 12px', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-lo)', marginBottom: '2px' }}>Record</div>
            {teamSeason1 && teamSeason2 ? (
              <>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-hi)' }}>
                  {teamSeason2.wins}–{teamSeason2.losses}
                </div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: deltaColor(winPctDelta), marginTop: '1px' }}>
                  {fmtDelta(winPctDelta)} W%
                </div>
              </>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-lo)' }}>—</div>
            )}
          </div>

          {/* Net rank */}
          <div style={{ flex: 1, padding: '8px 12px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-lo)', marginBottom: '2px' }}>Net Rank</div>
            {r2 ? (
              <>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-hi)' }}>#{r2}</div>
                {r1 && r2 && r1 !== r2 && (
                  <div style={{ fontSize: '10px', fontWeight: 600, color: rankDeltaColor(r1, r2), marginTop: '1px' }}>
                    {rankDeltaLabel(r1, r2)}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '13px', color: 'var(--text-lo)' }}>—</div>
            )}
          </div>
        </div>

        {/* Team page link */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-out)' }}>
          <Link
            href={`/team/${teamSlug}?year=${year2}`}
            style={{ fontSize: '10px', fontWeight: 700, color: 'var(--brand)', textDecoration: 'none', letterSpacing: '0.02em' }}
          >
            View full team analysis →
          </Link>
        </div>
      </div>
    </div>
  )
}
