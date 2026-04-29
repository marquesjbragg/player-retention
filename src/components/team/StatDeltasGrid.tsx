'use client'

import { useState } from 'react'
import type { StatDelta } from '@/lib/types'

interface Props {
  deltas: StatDelta[]
}

// Primary stats shown by default
const PRIMARY_KEYS = new Set(['winPct', 'wins', 'losses', 'ppg', 'fgPct', 'threePct', 'oppPpg', 'oppFgPct'])

interface DeltaCardProps {
  delta: StatDelta
}

function fmtVal(val: number, key: string): string {
  if (key.endsWith('Pct')) return `${val.toFixed(1)}%`
  return val.toFixed(1)
}

function deltaHex(delta: number, higherIsBetter: boolean): string {
  if (Math.abs(delta) < 0.005) return 'var(--text-mid)'
  const positive = delta > 0
  return (positive === higherIsBetter) ? 'var(--positive)' : 'var(--negative)'
}

function fmtDelta(val: number, key: string): string {
  const abs = key.endsWith('Pct') ? Math.abs(val).toFixed(1) + 'pp' : Math.abs(val).toFixed(1)
  return val >= 0 ? `+${abs}` : `−${abs}`
}

function DeltaCard({ delta }: DeltaCardProps) {
  const color = deltaHex(delta.delta, delta.higherIsBetter)
  const arrow = delta.direction === 'neutral' ? '' : delta.direction === 'up' ? '↑' : '↓'
  const y1 = fmtVal(delta.year1Value, delta.key)
  const y2 = fmtVal(delta.year2Value, delta.key)
  const d  = fmtDelta(delta.delta, delta.key)

  return (
    <div style={{
      padding: '7px 9px',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      backgroundColor: 'var(--bg-out)',
    }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-lo)', marginBottom: '3px' }}>
        {delta.label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
        <span style={{ fontSize: '10px', color: 'var(--text-mid)' }}>{y1}</span>
        <span style={{ fontSize: '8px', color: 'var(--text-lo)' }}>→</span>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-hi)' }}>{y2}</span>
      </div>
      <div style={{ fontSize: '10px', fontWeight: 600, color, marginTop: '2px' }}>
        {arrow} {d}
      </div>
    </div>
  )
}

const CATEGORY_LABELS: Record<string, string> = {
  success: 'Record',
  offense: 'Offense',
  defense: 'Defense',
}

export function StatDeltasGrid({ deltas }: Props) {
  const [showAll, setShowAll] = useState(false)

  const displayed = showAll ? deltas : deltas.filter(d => PRIMARY_KEYS.has(d.key))

  const byCategory = {
    success: displayed.filter(d => d.category === 'success'),
    offense: displayed.filter(d => d.category === 'offense'),
    defense: displayed.filter(d => d.category === 'defense'),
  }

  const hasHidden = deltas.length > PRIMARY_KEYS.size

  if (deltas.length === 0) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <SectionLabel>Season Deltas</SectionLabel>
        <div style={{ fontSize: '11px', color: 'var(--text-mid)', padding: '12px 0' }}>
          Team season data not available for this comparison.
        </div>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <SectionLabel>Season Deltas</SectionLabel>
        {hasHidden && (
          <button
            onClick={() => setShowAll(v => !v)}
            style={{
              fontSize: '10px', fontWeight: 600,
              color: 'var(--brand)',
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0',
              fontFamily: 'var(--mono)',
            }}
          >
            {showAll ? 'Show fewer' : `Show all ${deltas.length}`}
          </button>
        )}
      </div>

      {(['success', 'offense', 'defense'] as const).map(cat => {
        const group = byCategory[cat]
        if (group.length === 0) return null
        return (
          <div key={cat} style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-lo)', marginBottom: '5px' }}>
              {CATEGORY_LABELS[cat]}
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
              gap: '5px',
            }}>
              {group.map(d => <DeltaCard key={d.key} delta={d} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-mid)' }}>
      {children}
    </div>
  )
}
