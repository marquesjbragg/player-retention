'use client'

import type { PlayerApiData } from '@/hooks/usePlayer'
import { usageModifier } from '@/lib/team/roleUtils'

interface Props {
  data: PlayerApiData
}

interface CellProps {
  label: string
  value: string
  sub?: string
  color?: string
  dim?: boolean
  accent?: boolean
}

function Cell({ label, value, sub, color, dim, accent }: CellProps) {
  return (
    <div style={{
      flex: 1,
      minWidth: '60px',
      padding: '9px 12px',
      borderRight: '1px solid var(--border)',
      backgroundColor: accent ? 'rgba(37,99,235,0.03)' : 'transparent',
    }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-lo)', marginBottom: '3px' }}>
        {label}
      </div>
      <div style={{ fontSize: '17px', fontWeight: 700, color: color ?? (dim ? 'var(--text-lo)' : 'var(--text-hi)'), letterSpacing: '-0.02em', lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '9px', color: 'var(--text-lo)', marginTop: '1px' }}>{sub}</div>
      )}
    </div>
  )
}

function RoleCell({ tag, positionRole, usg }: { tag: string; positionRole?: string | null; usg?: number | null }) {
  const labels: Record<string, { label: string; color: string }> = {
    lead:     { label: 'LEAD PIECE',     color: 'var(--badge-blue-fg)'   },
    core:     { label: 'CORE PIECE',     color: 'var(--badge-sky-fg)'    },
    rotation: { label: 'ROTATION PIECE', color: 'var(--badge-amber-fg)'  },
    bench:    { label: 'BENCH PIECE',    color: 'var(--badge-gray-fg)'   },
    fringe:   { label: 'FRINGE PIECE',   color: 'var(--badge-silver-fg)' },
  }
  const s = labels[tag] ?? labels.fringe
  const usgMod = usageModifier(usg)
  const USG_LABEL: Record<string, string> = { high: 'High USG', moderate: 'Mod USG', low: 'Low USG' }
  const subtitleParts = [positionRole, usgMod ? USG_LABEL[usgMod] : null].filter(Boolean)
  return (
    <div style={{ flex: 1, minWidth: '80px', padding: '9px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-lo)', marginBottom: '3px' }}>
        Role
      </div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: s.color, letterSpacing: '0.04em' }}>
        {s.label}
      </div>
      {subtitleParts.length > 0 && (
        <div style={{ fontSize: '9px', color: 'var(--text-lo)', marginTop: '2px', letterSpacing: '0.01em' }}>
          {subtitleParts.join(' · ')}
        </div>
      )}
    </div>
  )
}

function fmt1(n: number): string { return n.toFixed(1) }
function fmtPct(n: number): string { return `${n.toFixed(1)}%` }
function fmtDelta(n: number): string {
  const abs = Math.abs(n).toFixed(1)
  return n >= 0 ? `+${abs}pp` : `−${abs}pp`
}
function deltaColor(n: number): string {
  if (Math.abs(n) < 0.3) return 'var(--text-mid)'
  return n > 0 ? 'var(--positive)' : 'var(--negative)'
}

export function PlayerStrip({ data }: Props) {
  const { currentStats, minShare, ptsShare, minShareDelta, ptsShareDelta, roleTag, status } = data

  const mpg = currentStats.games > 0
    ? currentStats.minutesPlayed / currentStats.games
    : 0
  const ppg = currentStats.games > 0
    ? currentStats.points / currentStats.games
    : 0
  const gs  = currentStats.gamesStarted
  const gsLabel = gs !== null ? `${currentStats.games} / ${gs}` : String(currentStats.games)
  const usg = currentStats.tRankUsg ?? null

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      border: '1px solid var(--border-hi)',
      borderRadius: '6px',
      overflow: 'hidden',
      marginBottom: '10px',
    }}>
      <Cell label="Min%" value={fmtPct(minShare)} sub="of team min" />
      <Cell label="Pts%"  value={fmtPct(ptsShare)} sub="of team pts" />
      <Cell label="MPG"   value={fmt1(mpg)} />
      <Cell label="PPG"   value={fmt1(ppg)} />
      {usg !== null && <Cell label="USG%" value={fmtPct(usg)} sub="usage" />}
      <Cell label={gs !== null ? 'G / GS' : 'G'} value={gsLabel} />

      {status === 'returner' && minShareDelta !== null && (
        <Cell
          label="Min% Δ"
          value={fmtDelta(minShareDelta)}
          color={deltaColor(minShareDelta)}
          accent
        />
      )}
      {status === 'returner' && ptsShareDelta !== null && (
        <Cell
          label="Pts% Δ"
          value={fmtDelta(ptsShareDelta)}
          color={deltaColor(ptsShareDelta)}
          accent
        />
      )}

      <RoleCell tag={roleTag} positionRole={currentStats.tRankPositionRole} usg={usg} />
    </div>
  )
}
