'use client'

import Link from 'next/link'
import type { PlayerApiData } from '@/hooks/usePlayer'
import type { PlayerStatus } from '@/lib/team/roleUtils'

interface Props {
  data: PlayerApiData
}

const STATUS_STYLES: Record<PlayerStatus, { bg: string; color: string; label: string }> = {
  returner:  { bg: 'var(--badge-green-bg)', color: 'var(--badge-green-fg)', label: 'RETURNER'  },
  newcomer:  { bg: 'var(--badge-blue-bg)',  color: 'var(--badge-blue-fg)',  label: 'NEWCOMER'  },
  departure: { bg: 'var(--badge-gray-bg)',  color: 'var(--badge-gray-fg)',  label: 'DEPARTURE' },
}

function seasonLabel(year2: number): string {
  return `${year2 - 1}–${String(year2).slice(2)}`
}

function Dot() {
  return <span style={{ color: 'var(--border-hi)', userSelect: 'none', margin: '0 5px' }}>·</span>
}

export function PlayerHeader({ data }: Props) {
  const { playerName, position, teamIdentity, teamSlug, year2, status, departedAfterYear2, coachYear2, currentStats } = data
  const badgeStyle = STATUS_STYLES[status]
  const teamLabel  = seasonLabel(year2)
  const teamHref   = `/team/${teamSlug}?year=${year2}`

  const posRole = currentStats.tRankPositionRole
  const yr      = currentStats.tRankYr
  const ht      = currentStats.tRankHt

  return (
    <div style={{ marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid var(--border-hi)' }}>
      {/* Back nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Link
          href={teamHref}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em', color: 'var(--text-lo)', textDecoration: 'none',
          }}
        >
          {teamIdentity?.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teamIdentity.logoUrl} width={16} height={16} style={{ objectFit: 'contain' }} alt="" />
          )}
          ← {teamIdentity?.shortName ?? teamIdentity?.name ?? teamSlug} · {teamLabel}
        </Link>
      </div>

      {/* Player identity */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0', flexDirection: 'column' }}>
        {/* Name + badge row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h1 style={{
            fontSize: '24px', fontWeight: 700,
            color: 'var(--text-hi)',
            letterSpacing: '-0.02em', lineHeight: 1.1,
            margin: 0,
          }}>
            {playerName}
          </h1>
          <span style={{
            fontSize: '9px', fontWeight: 700,
            letterSpacing: '0.09em',
            padding: '3px 8px',
            borderRadius: '3px',
            backgroundColor: badgeStyle.bg,
            color: badgeStyle.color,
            whiteSpace: 'nowrap',
          }}>
            {badgeStyle.label}
          </span>
          {departedAfterYear2 && (
            <span style={{
              fontSize: '9px', fontWeight: 600,
              padding: '2px 6px',
              borderRadius: '3px',
              backgroundColor: 'var(--badge-gray-bg)',
              color: 'var(--badge-gray-fg)',
            }}>
              departed after {teamLabel}
            </span>
          )}
        </div>

        {/* Context line */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', marginTop: '5px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>
            {teamIdentity?.name ?? teamSlug}
          </span>
          {teamIdentity?.conference && (
            <>
              <Dot />
              <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>{teamIdentity.conference}</span>
            </>
          )}
          {posRole && (
            <>
              <Dot />
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-hi)' }}>{posRole}</span>
            </>
          )}
          {(!posRole && position) && (
            <>
              <Dot />
              <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>{position}</span>
            </>
          )}
          {yr && (
            <>
              <Dot />
              <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>{yr}</span>
            </>
          )}
          {ht && (
            <>
              <Dot />
              <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>{ht}</span>
            </>
          )}
          <Dot />
          <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>{teamLabel}</span>
          {coachYear2 && (
            <>
              <Dot />
              <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>
                HC: <span style={{ fontWeight: 600 }}>{coachYear2}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
