'use client'

import type { RatingsEntry } from '@/lib/types'
import type { MasseyResult } from '@/lib/providers/d1/D1MasseyProvider'

interface Props {
  ratings1: RatingsEntry | null
  ratings2: RatingsEntry | null
  massey1: MasseyResult | null
  massey2: MasseyResult | null
  year1: number
  year2: number
}

function seasonLabel(year2: number): string {
  return `${year2 - 1}–${String(year2).slice(2)}`
}

function fmt1(n: number): string {
  return n >= 0 ? `+${n.toFixed(1)}` : n.toFixed(1)
}

function RatingRow({
  label,
  r1,
  r2,
  rating1,
  rating2,
}: {
  label: string
  r1: number | null
  r2: number | null
  rating1: number | null
  rating2: number | null
}) {
  const rankDir = r1 && r2 ? (r1 - r2 > 0 ? '▲' : r1 - r2 < 0 ? '▼' : '=') : null
  const rankDiff = r1 && r2 ? Math.abs(r1 - r2) : null
  const rankColor = r1 && r2 ? (r1 > r2 ? 'var(--positive)' : r1 < r2 ? 'var(--negative)' : 'var(--text-mid)') : 'var(--text-mid)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: '80px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-lo)' }}>
        {label}
      </div>

      {/* Year 1 */}
      <div style={{ width: '80px', textAlign: 'right' }}>
        {r1 ? (
          <span style={{ fontSize: '12px', color: 'var(--text-mid)' }}>#{r1}</span>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-lo)' }}>—</span>
        )}
        {rating1 !== null && r1 && (
          <span style={{ fontSize: '9px', color: 'var(--text-lo)', marginLeft: '4px' }}>({fmt1(rating1)})</span>
        )}
      </div>

      {/* Arrow */}
      <div style={{ fontSize: '11px', color: rankColor, fontWeight: 700, minWidth: '60px', textAlign: 'center' }}>
        {rankDir && rankDiff !== null && rankDiff > 0
          ? `${rankDir}${rankDiff}`
          : rankDir === '='
          ? '='
          : '→'
        }
      </div>

      {/* Year 2 */}
      <div style={{ width: '80px' }}>
        {r2 ? (
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)' }}>#{r2}</span>
        ) : (
          <span style={{ fontSize: '11px', color: 'var(--text-lo)' }}>—</span>
        )}
        {rating2 !== null && r2 && (
          <span style={{ fontSize: '9px', color: 'var(--text-lo)', marginLeft: '4px' }}>({fmt1(rating2)})</span>
        )}
      </div>
    </div>
  )
}

export function RatingsContext({ ratings1, ratings2, massey1, massey2, year1, year2 }: Props) {
  const hasAny = ratings1 || ratings2 || massey1 || massey2
  if (!hasAny) return null

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-mid)' }}>
          Rankings & Ratings
        </div>
        <div style={{ display: 'flex', gap: '20px', fontSize: '9px', color: 'var(--text-lo)' }}>
          <span>{seasonLabel(year1)}</span>
          <span style={{ width: '60px' }} />
          <span>{seasonLabel(year2)}</span>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border-hi)', borderRadius: '6px', padding: '0 12px' }}>
        <RatingRow
          label="Net Rating"
          r1={ratings1?.rank ?? null}
          r2={ratings2?.rank ?? null}
          rating1={ratings1?.rating ?? null}
          rating2={ratings2?.rating ?? null}
        />
        {(massey1 || massey2) && (
          <RatingRow
            label="Massey"
            r1={massey1?.rank ?? null}
            r2={massey2?.rank ?? null}
            rating1={massey1?.rating ?? null}
            rating2={massey2?.rating ?? null}
          />
        )}
        {(ratings2?.offRating || ratings2?.defRating) && (
          <div style={{ padding: '8px 0', fontSize: '10px', color: 'var(--text-lo)' }}>
            Adj. Off: {ratings2.offRating?.toFixed(1) ?? '—'} · Adj. Def: {ratings2.defRating?.toFixed(1) ?? '—'}
          </div>
        )}
      </div>
    </div>
  )
}
