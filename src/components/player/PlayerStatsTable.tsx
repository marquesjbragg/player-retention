'use client'

import type { PlayerApiData } from '@/hooks/usePlayer'
import type { PlayerSeason } from '@/lib/types'

interface Props {
  data: PlayerApiData
}

// ─── Derivations ──────────────────────────────────────────────────────────────

function pg(stat: number, games: number): number { return games > 0 ? stat / games : 0 }

function fgPct(p: PlayerSeason): number | null {
  return p.fgAttempted > 0 ? (p.fgMade / p.fgAttempted) * 100 : null
}
function efgPct(p: PlayerSeason): number | null {
  return p.fgAttempted > 0 ? ((p.fgMade + 0.5 * p.threeMade) / p.fgAttempted) * 100 : null
}
function tsPct(p: PlayerSeason): number | null {
  const d = 2 * (p.fgAttempted + 0.44 * p.ftAttempted)
  return d > 0 ? (p.points / d) * 100 : null
}
function threePct(p: PlayerSeason): number | null {
  return p.threeAttempted > 0 ? (p.threeMade / p.threeAttempted) * 100 : null
}
function threePar(p: PlayerSeason): number | null {
  return p.fgAttempted > 0 ? (p.threeAttempted / p.fgAttempted) * 100 : null
}
function ftPct(p: PlayerSeason): number | null {
  return p.ftAttempted > 0 ? (p.ftMade / p.ftAttempted) * 100 : null
}
function ftRate(p: PlayerSeason): number | null {
  return p.fgAttempted > 0 ? (p.ftAttempted / p.fgAttempted) * 100 : null
}
function astTo(p: PlayerSeason): number | null {
  return p.turnovers > 0 ? p.assists / p.turnovers : null
}

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmt1(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return n.toFixed(1)
}
function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return `${n.toFixed(1)}%`
}
function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return String(Math.round(n))
}

// ─── Stat cell ────────────────────────────────────────────────────────────────

function StatCell({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ padding: '8px 10px', borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-lo)', marginBottom: '2px' }}>
        {label}
      </div>
      <div style={{ fontSize: '13px', fontWeight: bold ? 700 : 500, color: bold ? 'var(--text-hi)' : 'var(--text-mid)', fontFamily: 'var(--mono)', letterSpacing: '-0.01em' }}>
        {value}
      </div>
    </div>
  )
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      padding: '5px 10px 3px',
      fontSize: '8px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.08em',
      color: 'var(--text-mid)',
      backgroundColor: 'var(--bg-muted)',
      borderBottom: '1px solid var(--border)',
    }}>
      {label}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PlayerStatsTable({ data }: Props) {
  const p = data.currentStats
  const g = p.games

  const hasGS     = p.gamesStarted !== null
  const hasThrees = p.threeAttempted > 0
  const hasFT     = p.ftAttempted > 0

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-mid)', marginBottom: '6px' }}>
        Season Stats
      </div>

      <div style={{
        border: '1px solid var(--border-hi)',
        borderRadius: '6px',
        overflow: 'hidden',
      }}>
        {/* Scoring group */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))' }}>
          <GroupHeader label="Scoring" />
          <StatCell label="G"    value={fmtInt(g)} />
          {hasGS && <StatCell label="GS"  value={fmtInt(p.gamesStarted)} />}
          <StatCell label="MPG"  value={fmt1(pg(p.minutesPlayed, g))} />
          <StatCell label="PPG"  value={fmt1(pg(p.points, g))} bold />
          <StatCell label="FG%"  value={fmtPct(fgPct(p))} />
          <StatCell label="eFG%" value={fmtPct(efgPct(p))} />
          <StatCell label="TS%"  value={fmtPct(tsPct(p))} />
          {hasThrees && <StatCell label="3P%"  value={fmtPct(threePct(p))} />}
          {hasThrees && <StatCell label="3PAr" value={fmtPct(threePar(p))} />}
          {hasFT && <StatCell label="FT%"  value={fmtPct(ftPct(p))} />}
          {hasFT && <StatCell label="FTr"  value={fmtPct(ftRate(p))} />}
        </div>

        {/* Playmaking & Boards group */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(68px, 1fr))' }}>
          <GroupHeader label="Playmaking & Boards" />
          <StatCell label="APG"    value={fmt1(pg(p.assists, g))} />
          <StatCell label="RPG"    value={fmt1(pg(p.totalRebounds, g))} bold />
          <StatCell label="ORB"    value={fmt1(pg(p.offRebounds, g))} />
          <StatCell label="DRB"    value={fmt1(pg(p.defRebounds, g))} />
          <StatCell label="SPG"    value={fmt1(pg(p.steals, g))} />
          <StatCell label="BPG"    value={fmt1(pg(p.blocks, g))} />
          <StatCell label="TOPG"   value={fmt1(pg(p.turnovers, g))} />
          <StatCell label="AST/TO" value={fmt1(astTo(p))} />
        </div>
      </div>
    </div>
  )
}
