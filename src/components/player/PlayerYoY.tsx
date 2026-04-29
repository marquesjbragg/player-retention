'use client'

import type { PlayerApiData } from '@/hooks/usePlayer'
import type { PlayerSeason } from '@/lib/types'

interface Props {
  data: PlayerApiData
}

function seasonLabel(year2: number): string {
  return `${year2 - 1}–${String(year2).slice(2)}`
}

function fmt1(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(1)
}

function fmtPct(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `${n.toFixed(1)}%`
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return String(Math.round(n))
}

function mpg(p: PlayerSeason): number { return p.games > 0 ? p.minutesPlayed / p.games : 0 }
function ppg(p: PlayerSeason): number { return p.games > 0 ? p.points / p.games : 0 }
function rpg(p: PlayerSeason): number { return p.games > 0 ? p.totalRebounds / p.games : 0 }
function apg(p: PlayerSeason): number { return p.games > 0 ? p.assists / p.games : 0 }
function fgPct(p: PlayerSeason): number | null { return p.fgAttempted > 0 ? (p.fgMade / p.fgAttempted) * 100 : null }
function efgPct(p: PlayerSeason): number | null {
  return p.fgAttempted > 0 ? ((p.fgMade + 0.5 * p.threeMade) / p.fgAttempted) * 100 : null
}
function threePct(p: PlayerSeason): number | null {
  return p.threeAttempted > 0 ? (p.threeMade / p.threeAttempted) * 100 : null
}
function ftPct(p: PlayerSeason): number | null {
  return p.ftAttempted > 0 ? (p.ftMade / p.ftAttempted) * 100 : null
}

function delta(y2: number | null, y1: number | null): { val: number; label: string; color: string } | null {
  if (y2 === null || y1 === null) return null
  const d = y2 - y1
  const abs = Math.abs(d)
  const label = abs < 0.05 ? '—' : d > 0 ? `+${abs.toFixed(1)}` : `−${abs.toFixed(1)}`
  const color = abs < 0.3 ? 'var(--text-lo)' : d > 0 ? 'var(--positive)' : 'var(--negative)'
  return { val: d, label, color }
}

function deltaPct(y2: number | null, y1: number | null): { val: number; label: string; color: string } | null {
  if (y2 === null || y1 === null) return null
  const d = y2 - y1
  const abs = Math.abs(d)
  const label = abs < 0.05 ? '—' : d > 0 ? `+${abs.toFixed(1)}pp` : `−${abs.toFixed(1)}pp`
  const color = abs < 0.3 ? 'var(--text-lo)' : d > 0 ? 'var(--positive)' : 'var(--negative)'
  return { val: d, label, color }
}

const TH: React.CSSProperties = {
  fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '0.07em', color: 'var(--text-lo)',
  padding: '6px 10px', textAlign: 'right',
  borderBottom: '1px solid var(--border-hi)',
}
const TH_LABEL: React.CSSProperties = { ...TH, textAlign: 'left', width: '100px' }

const TD: React.CSSProperties = {
  fontSize: '11px', color: 'var(--text-mid)',
  padding: '5px 10px', textAlign: 'right',
  borderBottom: '1px solid var(--border)',
}
const TD_Y2: React.CSSProperties = { ...TD, fontWeight: 700, color: 'var(--text-hi)', fontSize: '12px' }
const TD_LABEL: React.CSSProperties = { ...TD, textAlign: 'left', color: 'var(--text-lo)', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }
const TD_DELTA: React.CSSProperties = { ...TD, fontSize: '10px', fontWeight: 600 }

interface RowProps {
  label: string
  y1Val: string
  y2Val: string
  delta?: { label: string; color: string } | null
  isLast?: boolean
}

function Row({ label, y1Val, y2Val, delta: d, isLast }: RowProps) {
  const rowBorder = isLast ? 'none' : '1px solid var(--border)'
  return (
    <tr>
      <td style={{ ...TD_LABEL, borderBottom: rowBorder }}>{label}</td>
      <td style={{ ...TD, borderBottom: rowBorder }}>{y1Val}</td>
      <td style={{ ...TD_Y2, borderBottom: rowBorder }}>{y2Val}</td>
      {d ? (
        <td style={{ ...TD_DELTA, color: d.color, borderBottom: rowBorder }}>{d.label}</td>
      ) : (
        <td style={{ ...TD_DELTA, color: 'var(--text-lo)', borderBottom: rowBorder }}>—</td>
      )}
    </tr>
  )
}

export function PlayerYoY({ data }: Props) {
  const { priorStats, currentStats, minShare, ptsShare, priorMinShare, priorPtsShare, year1, year2, status } = data

  if (status !== 'returner' || !priorStats) return null

  const y1 = priorStats
  const y2 = currentStats
  const hasGS = y2.gamesStarted !== null || y1.gamesStarted !== null
  const hasThrees = y2.threeAttempted > 0 || y1.threeAttempted > 0
  const hasFT = y2.ftAttempted > 0 || y1.ftAttempted > 0

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-mid)', marginBottom: '6px' }}>
        Year-over-Year
      </div>
      <div style={{ border: '1px solid var(--border-hi)', borderRadius: '6px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-alt-row)' }}>
              <th style={TH_LABEL}></th>
              <th style={TH}>{seasonLabel(year1)}</th>
              <th style={TH}>{seasonLabel(year2)}</th>
              <th style={TH}>Δ</th>
            </tr>
          </thead>
          <tbody>
            <Row label="Games"   y1Val={fmtInt(y1.games)}           y2Val={fmtInt(y2.games)}           delta={delta(y2.games, y1.games)} />
            {hasGS && (
              <Row label="GS"    y1Val={fmtInt(y1.gamesStarted)}    y2Val={fmtInt(y2.gamesStarted)}    delta={delta(y2.gamesStarted, y1.gamesStarted)} />
            )}
            <Row label="MPG"     y1Val={fmt1(mpg(y1))}              y2Val={fmt1(mpg(y2))}              delta={delta(mpg(y2), mpg(y1))} />
            <Row label="PPG"     y1Val={fmt1(ppg(y1))}              y2Val={fmt1(ppg(y2))}              delta={delta(ppg(y2), ppg(y1))} />
            <Row label="RPG"     y1Val={fmt1(rpg(y1))}              y2Val={fmt1(rpg(y2))}              delta={delta(rpg(y2), rpg(y1))} />
            <Row label="APG"     y1Val={fmt1(apg(y1))}              y2Val={fmt1(apg(y2))}              delta={delta(apg(y2), apg(y1))} />
            <Row label="FG%"     y1Val={fmtPct(fgPct(y1))}         y2Val={fmtPct(fgPct(y2))}         delta={deltaPct(fgPct(y2), fgPct(y1))} />
            <Row label="eFG%"    y1Val={fmtPct(efgPct(y1))}        y2Val={fmtPct(efgPct(y2))}        delta={deltaPct(efgPct(y2), efgPct(y1))} />
            {hasThrees && (
              <Row label="3P%"   y1Val={fmtPct(threePct(y1))}      y2Val={fmtPct(threePct(y2))}      delta={deltaPct(threePct(y2), threePct(y1))} />
            )}
            {hasFT && (
              <Row label="FT%"   y1Val={fmtPct(ftPct(y1))}         y2Val={fmtPct(ftPct(y2))}         delta={deltaPct(ftPct(y2), ftPct(y1))} />
            )}
            <Row label="Min%"    y1Val={fmtPct(priorMinShare)}      y2Val={fmtPct(minShare)}           delta={deltaPct(minShare, priorMinShare)} />
            <Row label="Pts%"    y1Val={fmtPct(priorPtsShare)}      y2Val={fmtPct(ptsShare)}           delta={deltaPct(ptsShare, priorPtsShare)} isLast />
          </tbody>
        </table>
      </div>
    </div>
  )
}
