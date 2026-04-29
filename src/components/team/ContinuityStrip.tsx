'use client'

import type { RetentionResult, RatingsEntry, DataStatus } from '@/lib/types'

interface Props {
  retention: RetentionResult | null
  ratings1: RatingsEntry | null
  ratings2: RatingsEntry | null
  year1WinPct: number
  year2WinPct: number
  dataStatus: DataStatus
}

interface MetricCardProps {
  label: string
  value: string
  sub?: string
  color?: string
  dim?: boolean
}

function MetricCard({ label, value, sub, color, dim }: MetricCardProps) {
  return (
    <div style={{
      flex: 1,
      minWidth: '80px',
      padding: '9px 12px',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      gap: '2px',
    }}>
      <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-lo)' }}>
        {label}
      </div>
      <div style={{ fontSize: '17px', fontWeight: 700, color: color ?? (dim ? 'var(--text-lo)' : 'var(--text-hi)'), letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '9px', color: 'var(--text-lo)' }}>{sub}</div>
      )}
    </div>
  )
}

function fmtPct(n: number, decimals = 1): string {
  return `${n.toFixed(decimals)}%`
}

function fmtDelta(n: number): string {
  const abs = Math.abs(n).toFixed(1)
  return n > 0 ? `+${abs}pp` : n < 0 ? `−${abs}pp` : `0pp`
}

function ciColor(ci: number): string {
  if (ci >= 70) return 'var(--positive)'
  if (ci >= 40) return 'var(--badge-amber-fg)'
  return 'var(--negative)'
}

function deltaColor(n: number, higherBetter = true): string {
  if (Math.abs(n) < 0.5) return 'var(--text-mid)'
  const positive = n > 0
  return (positive === higherBetter) ? 'var(--positive)' : 'var(--negative)'
}

function rankDelta(r1: number | null, r2: number | null): string {
  if (!r1 || !r2) return '—'
  const diff = r1 - r2  // improvement = lower rank number
  if (Math.abs(diff) < 1) return `#${r2}`
  return diff > 0 ? `▲${diff} → #${r2}` : `▼${Math.abs(diff)} → #${r2}`
}

function rankDeltaColor(r1: number | null, r2: number | null): string {
  if (!r1 || !r2) return 'var(--text-mid)'
  const diff = r1 - r2
  if (Math.abs(diff) < 1) return 'var(--text-hi)'
  return diff > 0 ? 'var(--positive)' : 'var(--negative)'
}

export function ContinuityStrip({ retention, ratings1, ratings2, year1WinPct, year2WinPct, dataStatus }: Props) {
  const winPctDelta = Math.round((year2WinPct - year1WinPct) * 100) / 100

  if (!retention) {
    return (
      <div style={{
        display: 'flex',
        border: '1px solid var(--border-hi)',
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '10px',
        backgroundColor: 'var(--bg-out)',
      }}>
        <MetricCard label="CI" value="—" sub={dataStatus === 'stats-only' ? 'no player data' : 'unavailable'} dim />
        <MetricCard label="Ret Min%" value="—" dim />
        <MetricCard label="Ret Pts%" value="—" dim />
        <MetricCard label="New Min%" value="—" dim />
        <MetricCard label="W% Δ" value={fmtDelta(winPctDelta)} color={deltaColor(winPctDelta)} />
        <MetricCard label="Net Rank" value="—" dim />
      </div>
    )
  }

  const ci = retention.continuityIndex
  const qualityBadge = retention.dataQuality === 'partial' ? ' *' : ''

  return (
    <div style={{
      display: 'flex',
      border: '1px solid var(--border-hi)',
      borderRadius: '6px',
      overflow: 'hidden',
      marginBottom: '24px',
    }}>
      <MetricCard
        label="CI"
        value={`${ci.toFixed(1)}${qualityBadge}`}
        sub={retention.dataQuality === 'partial' ? '2-component (no starts)' : undefined}
        color={ciColor(ci)}
      />
      <MetricCard
        label="Ret Min%"
        value={fmtPct(retention.returningMinutesPct)}
      />
      <MetricCard
        label="Ret Pts%"
        value={fmtPct(retention.returningPointsPct)}
      />
      <MetricCard
        label="New Min%"
        value={fmtPct(retention.newcomerMinutesPct)}
      />
      <MetricCard
        label="W% Δ"
        value={fmtDelta(winPctDelta)}
        color={deltaColor(winPctDelta)}
      />
      <MetricCard
        label="Net Rank"
        value={rankDelta(ratings1?.rank ?? null, ratings2?.rank ?? null)}
        color={rankDeltaColor(ratings1?.rank ?? null, ratings2?.rank ?? null)}
        sub={ratings2?.rank ? `#${ratings2.rank}` : undefined}
      />
    </div>
  )
}
