'use client'

import { useRouter } from 'next/navigation'

interface Props {
  slug: string
  currentYear: number
  availableYears: number[]
}

function seasonLabel(year2: number): string {
  const y1 = year2 - 1
  return `${y1}–${String(year2).slice(2)}`
}

export function YearPairSelector({ slug, currentYear, availableYears }: Props) {
  const router = useRouter()

  const y1Label = seasonLabel(currentYear - 1)
  const y2Label = seasonLabel(currentYear)

  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-lo)' }}>
          Transition
        </span>

        {availableYears.length > 1 ? (
          <select
            value={currentYear}
            onChange={e => router.push(`/team/${slug}?year=${e.target.value}`)}
            style={{
              fontSize: '13px',
              fontWeight: 700,
              fontFamily: 'var(--mono)',
              color: 'var(--text-hi)',
              background: 'var(--bg-out)',
              border: '1px solid var(--border-hi)',
              borderRadius: '4px',
              padding: '4px 26px 4px 10px',
              cursor: 'pointer',
              appearance: 'none',
              WebkitAppearance: 'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='8' height='5' viewBox='0 0 8 5'%3E%3Cpath d='M0 0l4 5 4-5z' fill='%23888'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            {availableYears.map(year2 => (
              <option key={year2} value={year2}>
                {seasonLabel(year2 - 1)} → {seasonLabel(year2)}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-hi)' }}>
            {y1Label} → {y2Label}
          </span>
        )}
      </div>
    </div>
  )
}
