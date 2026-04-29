'use client'

import type { TeamIdentity, TeamSeason, RatingsEntry } from '@/lib/types'
import type { MasseyResult } from '@/lib/providers/d1/D1MasseyProvider'

interface Props {
  identity: TeamIdentity
  teamSeason2: TeamSeason | null
  coachYear2: string | null
  ratings2: RatingsEntry | null
  massey2: MasseyResult | null
}

function winPct(wins: number, losses: number): number {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 1000) / 10
}

export function TeamHeader({ identity, teamSeason2, coachYear2, ratings2, massey2 }: Props) {
  const wins  = teamSeason2?.wins  ?? null
  const losses = teamSeason2?.losses ?? null
  const wp = wins !== null && losses !== null ? winPct(wins, losses) : null

  return (
    <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border-hi)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px' }}>

        {/* Logo */}
        {identity.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={identity.logoUrl}
            width={60}
            height={60}
            style={{ objectFit: 'contain', flexShrink: 0, marginTop: '2px' }}
            alt=""
          />
        ) : (
          <div style={{
            width: 60, height: 60,
            borderRadius: '8px',
            backgroundColor: 'var(--bg-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: '2px',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-lo)' }}>
              {identity.shortName.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Identity block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name + record */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>
              {identity.name}
            </h1>
            {wins !== null && losses !== null && (
              <span style={{
                fontSize: '13px', fontWeight: 600,
                color: 'var(--text-mid)',
                letterSpacing: '-0.01em',
              }}>
                {wins}–{losses}
                {wp !== null && (
                  <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-lo)', marginLeft: '4px' }}>
                    ({wp}%)
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Context line: conference · division · coach · ranks */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>{identity.conference}</span>
            <Dot />
            <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>{identity.division}</span>

            {coachYear2 && (
              <>
                <Dot />
                <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>
                  HC: <span style={{ fontWeight: 600 }}>{coachYear2}</span>
                </span>
              </>
            )}

            {ratings2?.rank && (
              <>
                <Dot />
                <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>
                  Net <span style={{ fontWeight: 600 }}>#{ratings2.rank}</span>
                  {ratings2.rating !== null && (
                    <span style={{ color: 'var(--text-lo)', marginLeft: '3px' }}>
                      ({ratings2.rating >= 0 ? '+' : ''}{ratings2.rating?.toFixed(1)})
                    </span>
                  )}
                </span>
              </>
            )}

            {massey2?.rank && (
              <>
                <Dot />
                <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>
                  Massey <span style={{ fontWeight: 600 }}>#{massey2.rank}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Dot() {
  return <span style={{ fontSize: '11px', color: 'var(--border-hi)', userSelect: 'none' }}>·</span>
}
