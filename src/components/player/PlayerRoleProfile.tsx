'use client'

import type { PlayerApiData } from '@/hooks/usePlayer'
import type { PlayerSeason } from '@/lib/types'

interface Props {
  data: PlayerApiData
}

// ─── Dimension helpers ────────────────────────────────────────────────────────

function perGame(stat: number, games: number): number {
  return games > 0 ? stat / games : 0
}

function efgPct(p: PlayerSeason): number {
  return p.fgAttempted > 0 ? ((p.fgMade + 0.5 * p.threeMade) / p.fgAttempted) * 100 : 0
}

// Only include players with meaningful sample (≥5 games)
function qualified(players: PlayerSeason[]): PlayerSeason[] {
  return players.filter(p => p.games >= 5)
}

// Find rank of player's value among the qualified set (1 = best)
function rankAmong(playerVal: number, others: number[], higherBetter = true): number {
  const sorted = [...others].sort((a, b) => higherBetter ? b - a : a - b)
  const idx = sorted.findIndex(v => Math.abs(v - playerVal) < 0.001)
  return idx >= 0 ? idx + 1 : others.length
}

function ordinal(n: number): string {
  if (n === 1) return '1st'
  if (n === 2) return '2nd'
  if (n === 3) return '3rd'
  return `${n}th`
}

interface Dimension {
  label: string
  playerVal: number
  teamMax: number
  formattedVal: string
  rank: number
  teamSize: number
}

function computeDimensions(player: PlayerSeason, teamPlayers: PlayerSeason[]): Dimension[] {
  const pool = qualified(teamPlayers)
  if (pool.length === 0) return []

  const g = player.games

  const dims = [
    {
      label: 'Scoring',
      playerVal: perGame(player.points, g),
      teamVals:  pool.map(p => perGame(p.points, p.games)),
      fmt:       (v: number) => `${v.toFixed(1)} PPG`,
    },
    {
      label: 'Rebounding',
      playerVal: perGame(player.totalRebounds, g),
      teamVals:  pool.map(p => perGame(p.totalRebounds, p.games)),
      fmt:       (v: number) => `${v.toFixed(1)} RPG`,
    },
    {
      label: 'Playmaking',
      playerVal: perGame(player.assists, g),
      teamVals:  pool.map(p => perGame(p.assists, p.games)),
      fmt:       (v: number) => `${v.toFixed(1)} APG`,
    },
    {
      label: 'Defense',
      playerVal: perGame(player.steals + player.blocks, g),
      teamVals:  pool.map(p => perGame(p.steals + p.blocks, p.games)),
      fmt:       (v: number) => `${v.toFixed(1)} S+B`,
    },
    {
      label: 'Efficiency',
      playerVal: efgPct(player),
      teamVals:  pool.map(p => efgPct(p)),
      fmt:       (v: number) => `${v.toFixed(1)}% eFG`,
    },
  ]

  return dims.map(d => {
    const teamMax = Math.max(...d.teamVals, 0.001)
    const rank    = rankAmong(d.playerVal, d.teamVals)
    return {
      label:        d.label,
      playerVal:    d.playerVal,
      teamMax,
      formattedVal: d.fmt(d.playerVal),
      rank,
      teamSize:     pool.length,
    }
  })
}

// ─── Bar ──────────────────────────────────────────────────────────────────────

function DimensionBar({ dim }: { dim: Dimension }) {
  const fillPct = Math.min((dim.playerVal / dim.teamMax) * 100, 100)

  const isTop3 = dim.rank <= 3
  const barColor = isTop3 ? 'var(--brand)' : 'var(--border-hi)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
      {/* Label */}
      <div style={{ width: '90px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-lo)', flexShrink: 0 }}>
        {dim.label}
      </div>

      {/* Bar track */}
      <div style={{ flex: 1, height: '7px', backgroundColor: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${fillPct}%`,
          backgroundColor: barColor,
          borderRadius: '4px',
          transition: 'width 0.2s ease',
        }} />
      </div>

      {/* Value + rank */}
      <div style={{ width: '120px', display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-hi)', fontFamily: 'var(--mono)' }}>
          {dim.formattedVal}
        </span>
        <span style={{ fontSize: '9px', color: isTop3 ? 'var(--brand)' : 'var(--text-lo)' }}>
          {ordinal(dim.rank)}
        </span>
      </div>
    </div>
  )
}

// ─── T-Rank context block ─────────────────────────────────────────────────────

interface TRankStat { label: string; value: number; fmt: (v: number) => string; positiveGood?: boolean }

function TRankStatRow({ stat }: { stat: TRankStat }) {
  const pos = stat.positiveGood !== false ? stat.value > 0 : stat.value < 0
  const neutral = Math.abs(stat.value) < 0.5
  const color = neutral ? 'var(--text-mid)' : pos ? 'var(--positive)' : 'var(--negative)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
      <div style={{ width: '44px', fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-lo)', flexShrink: 0 }}>
        {stat.label}
      </div>
      <span style={{ fontSize: '12px', fontWeight: 600, color, fontFamily: 'var(--mono)', letterSpacing: '-0.01em' }}>
        {stat.fmt(stat.value)}
      </span>
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function PlayerRoleProfile({ data }: Props) {
  const { currentStats, teamActivePlayers } = data
  const dims = computeDimensions(currentStats, teamActivePlayers)

  const posRole = currentStats.tRankPositionRole
  const bpm     = currentStats.tRankBpm
  const obpm    = currentStats.tRankObpm
  const dbpm    = currentStats.tRankDbpm
  const ortg    = currentStats.tRankOrtg
  const drtg    = currentStats.tRankDrtg
  const hasTRank = posRole || bpm !== undefined || ortg !== undefined

  if (dims.length === 0 && !hasTRank) return null

  const tRankStats: TRankStat[] = []
  if (ortg !== undefined) tRankStats.push({ label: 'ORtg', value: ortg, fmt: v => v.toFixed(1), positiveGood: true })
  if (drtg !== undefined) tRankStats.push({ label: 'DRtg', value: drtg, fmt: v => v.toFixed(1), positiveGood: false })
  if (bpm  !== undefined) tRankStats.push({ label: 'BPM',  value: bpm,  fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) })
  if (obpm !== undefined) tRankStats.push({ label: 'oBPM', value: obpm, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) })
  if (dbpm !== undefined) tRankStats.push({ label: 'dBPM', value: dbpm, fmt: v => (v >= 0 ? '+' : '') + v.toFixed(1) })

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-mid)' }}>
          Role Profile
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {posRole && (
            <span style={{
              fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em',
              padding: '2px 7px', borderRadius: '3px',
              backgroundColor: 'var(--bg-muted)', color: 'var(--text-mid)',
              textTransform: 'uppercase',
            }}>
              {posRole}
            </span>
          )}
          {dims.length > 0 && (
            <div style={{ fontSize: '9px', color: 'var(--text-lo)' }}>
              team-relative · {dims[0]?.teamSize ?? 0} qualified
            </div>
          )}
        </div>
      </div>

      <div style={{ border: '1px solid var(--border-hi)', borderRadius: '6px', overflow: 'hidden' }}>
        {/* Team-relative bars */}
        {dims.length > 0 && (
          <div style={{ padding: '12px 14px', borderBottom: tRankStats.length > 0 ? '1px solid var(--border)' : 'none' }}>
            {dims.map(dim => <DimensionBar key={dim.label} dim={dim} />)}
          </div>
        )}

        {/* T-Rank context */}
        {tRankStats.length > 0 && (
          <div style={{ padding: '10px 14px', backgroundColor: 'var(--bg-out)' }}>
            <div style={{ fontSize: '8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-lo)', marginBottom: '7px' }}>
              Efficiency Context
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 32px' }}>
              {tRankStats.map(s => <TRankStatRow key={s.label} stat={s} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
