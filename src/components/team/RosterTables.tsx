'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { RetentionResult, PlayerSeason } from '@/lib/types'
import type { RoleTag, PlayerStatus } from '@/lib/team/roleUtils'
import { buildContinuityLabel, computeRoleTag } from '@/lib/team/roleUtils'

interface Props {
  retention: RetentionResult | null
  teamSlug: string
  year2: number
}

// ─── Player link ──────────────────────────────────────────────────────────────

function athleteId(playerId: string): string {
  return playerId.startsWith('cbbd-') ? playerId.slice(5) : playerId
}

function PlayerLink({ player, teamSlug, year2 }: { player: PlayerSeason; teamSlug: string; year2: number }) {
  const id = athleteId(player.playerId)
  const [hovered, setHovered] = useState(false)
  return (
    <Link
      href={`/player/${id}?team=${teamSlug}&year=${year2}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        color: hovered ? 'var(--brand)' : 'inherit',
        textDecoration: 'none',
        borderBottom: '1px solid var(--border-hi)',
        transition: 'color 0.1s',
      }}
    >
      {player.playerName}
    </Link>
  )
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLE_STYLES: Record<RoleTag, { label: string; color: string; bg: string }> = {
  lead:     { label: 'Lead',     color: 'var(--badge-blue-fg)',   bg: 'var(--badge-blue-bg)'   },
  core:     { label: 'Core',     color: 'var(--badge-sky-fg)',    bg: 'var(--badge-sky-bg)'    },
  rotation: { label: 'Rotation', color: 'var(--badge-amber-fg)',  bg: 'var(--badge-amber-bg)'  },
  bench:    { label: 'Bench',    color: 'var(--badge-gray-fg)',   bg: 'var(--badge-gray-bg)'   },
  fringe:   { label: 'Fringe',   color: 'var(--badge-silver-fg)', bg: 'var(--badge-silver-bg)' },
}

function RoleBadge({ role }: { role: RoleTag }) {
  const s = ROLE_STYLES[role]
  return (
    <span style={{
      fontSize: '8px', fontWeight: 700,
      padding: '1px 5px', borderRadius: '3px',
      backgroundColor: s.bg, color: s.color,
      letterSpacing: '0.05em', whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

// ─── Status badges ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'returner' | 'newcomer' | 'departure' }) {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    returner:  { bg: 'var(--badge-green-bg)', color: 'var(--badge-green-fg)', label: 'RET' },
    newcomer:  { bg: 'var(--badge-blue-bg)',  color: 'var(--badge-blue-fg)',  label: 'NEW' },
    departure: { bg: 'var(--badge-gray-bg)',  color: 'var(--badge-gray-fg)',  label: 'DEP' },
  }
  const s = styles[status]
  return (
    <span style={{
      fontSize: '8px', fontWeight: 700,
      padding: '1px 5px',
      borderRadius: '3px',
      backgroundColor: s.bg,
      color: s.color,
      letterSpacing: '0.06em',
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function ConfidenceBadge({ conf }: { conf: string }) {
  if (conf === 'exact') return null
  const isManual = conf === 'manual'
  return (
    <span style={{
      fontSize: '8px',
      padding: '1px 4px',
      borderRadius: '3px',
      backgroundColor: isManual ? 'var(--badge-amber-bg)' : 'var(--badge-gray-bg)',
      color: isManual ? 'var(--badge-amber-fg)' : 'var(--badge-gray-fg)',
      marginLeft: '4px',
    }}>
      {conf}
    </span>
  )
}

function ThresholdBadge({ below }: { below: boolean }) {
  if (!below) return null
  return (
    <span style={{
      fontSize: '8px',
      padding: '1px 4px',
      borderRadius: '3px',
      backgroundColor: 'var(--badge-amber-bg)',
      color: 'var(--badge-amber-fg)',
      marginLeft: '4px',
    }}>
      sub-threshold
    </span>
  )
}

// ─── Table helpers ─────────────────────────────────────────────────────────────

const TH_STYLE: React.CSSProperties = {
  fontSize: '9px',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  color: 'var(--text-lo)',
  padding: '6px 10px',
  textAlign: 'right',
  borderBottom: '1px solid var(--border-hi)',
  whiteSpace: 'nowrap',
}

const TH_LEFT: React.CSSProperties = { ...TH_STYLE, textAlign: 'left' }

const TD_STYLE: React.CSSProperties = {
  fontSize: '11px',
  color: 'var(--text-hi)',
  padding: '7px 10px',
  textAlign: 'right',
  borderBottom: '1px solid var(--border)',
}

const TD_LEFT: React.CSSProperties = { ...TD_STYLE, textAlign: 'left' }

const TD_DIM: React.CSSProperties = { ...TD_STYLE, color: 'var(--text-mid)' }

function fmt1(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return n.toFixed(1)
}

function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return String(Math.round(n))
}

function fmtPctStr(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—'
  return `${n.toFixed(1)}%`
}

function mpg(player: PlayerSeason): number {
  if (!player.games || player.games === 0) return 0
  return player.minutesPlayed / player.games
}

function ppg(player: PlayerSeason): number {
  if (!player.games || player.games === 0) return 0
  return player.points / player.games
}

function rpg(player: PlayerSeason): number {
  if (!player.games || player.games === 0) return 0
  return player.totalRebounds / player.games
}

function apg(player: PlayerSeason): number {
  if (!player.games || player.games === 0) return 0
  return player.assists / player.games
}

function fgPct(player: PlayerSeason): number | null {
  if (!player.fgAttempted) return null
  return (player.fgMade / player.fgAttempted) * 100
}

function threePct(player: PlayerSeason): number | null {
  if (!player.threeAttempted) return null
  return (player.threeMade / player.threeAttempted) * 100
}

// Compute minute share (player minutes / total minutes across all players passed)
function buildShareMap(players: PlayerSeason[], totalMin: number, totalPts: number): Map<string, { minShare: number; ptsShare: number }> {
  const map = new Map<string, { minShare: number; ptsShare: number }>()
  for (const p of players) {
    map.set(p.playerId, {
      minShare: totalMin > 0 ? (p.minutesPlayed / totalMin) * 100 : 0,
      ptsShare: totalPts > 0 ? (p.points / totalPts) * 100 : 0,
    })
  }
  return map
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionDivider({ label, muted }: { label: string; muted?: boolean }) {
  return (
    <tr>
      <td colSpan={99} style={{
        padding: '6px 10px 3px',
        fontSize: '9px',
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: muted ? 'var(--text-lo)' : 'var(--text-mid)',
        backgroundColor: muted ? 'var(--bg-out)' : 'var(--bg-muted)',
        borderBottom: '1px solid var(--border)',
      }}>
        {label}
      </td>
    </tr>
  )
}

// ─── Tab 1: Season Stats ──────────────────────────────────────────────────────

function SeasonStatsTab({ retention, teamSlug, year2 }: { retention: RetentionResult; teamSlug: string; year2: number }) {
  const { returningPlayers, newPlayers, nonReturningPlayers, belowThresholdPlayers } = retention

  type ActiveRow = {
    player: PlayerSeason
    status: 'returner' | 'newcomer'
    confidence?: string
    belowThreshold?: boolean
    role: RoleTag
  }

  const belowThresholdIds = new Set(belowThresholdPlayers.map(b => b.player.playerId))

  // Compute Y2 share totals for role calculation
  const allY2Active: PlayerSeason[] = [
    ...returningPlayers.map(r => r.year2Stats),
    ...newPlayers,
  ]
  const totalY2Min = allY2Active.reduce((s, p) => s + p.minutesPlayed, 0)
  const totalY2Pts = allY2Active.reduce((s, p) => s + p.points, 0)

  function y2Role(player: PlayerSeason): RoleTag {
    const minShare = totalY2Min > 0 ? (player.minutesPlayed / totalY2Min) * 100 : 0
    const ptsShare = totalY2Pts > 0 ? (player.points / totalY2Pts) * 100 : 0
    return computeRoleTag(minShare, ptsShare, player.gamesStarted ?? null, player.games)
  }

  const activeRows: ActiveRow[] = [
    ...returningPlayers.map(rp => ({
      player: rp.year2Stats,
      status: 'returner' as const,
      confidence: rp.matchConfidence,
      belowThreshold: belowThresholdIds.has(rp.year1Stats.playerId),
      role: y2Role(rp.year2Stats),
    })),
    ...newPlayers.map(p => ({
      player: p,
      status: 'newcomer' as const,
      belowThreshold: false,
      role: y2Role(p),
    })),
  ].sort((a, b) => mpg(b.player) - mpg(a.player))

  // Departed players (Y1 stats, sorted by MPG desc)
  const allY1Dep = nonReturningPlayers.filter(p => !belowThresholdIds.has(p.playerId))
  const totalY1DepMin = allY1Dep.reduce((s, p) => s + p.minutesPlayed, 0) +
    returningPlayers.reduce((s, r) => s + r.year1Stats.minutesPlayed, 0) +
    belowThresholdPlayers.reduce((s, b) => s + b.player.minutesPlayed, 0)
  const totalY1DepPts = nonReturningPlayers.reduce((s, p) => s + p.points, 0) +
    returningPlayers.reduce((s, r) => s + r.year1Stats.points, 0) +
    belowThresholdPlayers.reduce((s, b) => s + b.player.points, 0)

  function y1Role(player: PlayerSeason): RoleTag {
    const minShare = totalY1DepMin > 0 ? (player.minutesPlayed / totalY1DepMin) * 100 : 0
    const ptsShare = totalY1DepPts > 0 ? (player.points / totalY1DepPts) * 100 : 0
    return computeRoleTag(minShare, ptsShare, player.gamesStarted ?? null, player.games)
  }

  const departures = allY1Dep
    .map(p => ({ player: p, role: y1Role(p) }))
    .sort((a, b) => mpg(b.player) - mpg(a.player))

  const hasStarts = activeRows.some(r => r.player.gamesStarted !== null)
  const hasPos    = activeRows.some(r => r.player.position)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={TH_LEFT}>Player</th>
            {hasPos && <th style={TH_STYLE}>Pos</th>}
            <th style={TH_STYLE}>G</th>
            {hasStarts && <th style={TH_STYLE}>GS</th>}
            <th style={TH_STYLE}>MPG</th>
            <th style={TH_STYLE}>PPG</th>
            <th style={TH_STYLE}>RPG</th>
            <th style={TH_STYLE}>APG</th>
            <th style={TH_STYLE}>FG%</th>
            <th style={TH_STYLE}>3P%</th>
          </tr>
        </thead>
        <tbody>
          {activeRows.map((row, i) => (
            <tr key={row.player.playerId} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-alt-row)' }}>
              <td style={TD_LEFT}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <PlayerLink player={row.player} teamSlug={teamSlug} year2={year2} />
                  <StatusBadge status={row.status} />
                  <RoleBadge role={row.role} />
                  {row.confidence && row.confidence !== 'exact' && (
                    <ConfidenceBadge conf={row.confidence} />
                  )}
                  {row.belowThreshold && <ThresholdBadge below />}
                </div>
              </td>
              {hasPos && <td style={TD_DIM}>{row.player.position ?? '—'}</td>}
              <td style={TD_STYLE}>{fmtInt(row.player.games)}</td>
              {hasStarts && <td style={TD_STYLE}>{fmtInt(row.player.gamesStarted)}</td>}
              <td style={TD_STYLE}>{fmt1(mpg(row.player))}</td>
              <td style={{ ...TD_STYLE, fontWeight: 600 }}>{fmt1(ppg(row.player))}</td>
              <td style={TD_STYLE}>{fmt1(rpg(row.player))}</td>
              <td style={TD_STYLE}>{fmt1(apg(row.player))}</td>
              <td style={TD_STYLE}>{fmtPctStr(fgPct(row.player))}</td>
              <td style={TD_STYLE}>{fmtPctStr(threePct(row.player))}</td>
            </tr>
          ))}

          {departures.length > 0 && (
            <>
              <SectionDivider label={`Departures — ${departures.length} player${departures.length > 1 ? 's' : ''} (prior season stats)`} muted />
              {departures.map(({ player, role }) => (
                <tr key={player.playerId} style={{ opacity: 0.5, backgroundColor: 'var(--bg-alt-row)' }}>
                  <td style={TD_LEFT}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <PlayerLink player={player} teamSlug={teamSlug} year2={year2 - 1} />
                      <StatusBadge status="departure" />
                      <RoleBadge role={role} />
                    </div>
                  </td>
                  {hasPos && <td style={TD_DIM}>{player.position ?? '—'}</td>}
                  <td style={TD_STYLE}>{fmtInt(player.games)}</td>
                  {hasStarts && <td style={TD_STYLE}>{fmtInt(player.gamesStarted)}</td>}
                  <td style={TD_STYLE}>{fmt1(mpg(player))}</td>
                  <td style={TD_STYLE}>{fmt1(ppg(player))}</td>
                  <td style={TD_STYLE}>{fmt1(rpg(player))}</td>
                  <td style={TD_STYLE}>{fmt1(apg(player))}</td>
                  <td style={TD_STYLE}>{fmtPctStr(fgPct(player))}</td>
                  <td style={TD_STYLE}>{fmtPctStr(threePct(player))}</td>
                </tr>
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tab 2: Continuity View ───────────────────────────────────────────────────

function ContinuityTab({ retention, teamSlug, year2 }: { retention: RetentionResult; teamSlug: string; year2: number }) {
  const { returningPlayers, newPlayers, nonReturningPlayers, belowThresholdPlayers } = retention

  // Compute totals for share calculation (use ALL players — not just qualified)
  const allY2: PlayerSeason[] = [
    ...returningPlayers.map(r => r.year2Stats),
    ...newPlayers,
  ]
  const allY1: PlayerSeason[] = [
    ...returningPlayers.map(r => r.year1Stats),
    ...nonReturningPlayers,
    ...belowThresholdPlayers.map(b => b.player),
  ]

  const totalY2Min = allY2.reduce((s, p) => s + p.minutesPlayed, 0)
  const totalY2Pts = allY2.reduce((s, p) => s + p.points, 0)
  const totalY1Min = allY1.reduce((s, p) => s + p.minutesPlayed, 0)
  const totalY1Pts = allY1.reduce((s, p) => s + p.points, 0)

  const y2ShareMap = buildShareMap(allY2, totalY2Min, totalY2Pts)
  const y1ShareMap = buildShareMap(allY1, totalY1Min, totalY1Pts)

  const belowThresholdIds = new Set(belowThresholdPlayers.map(b => b.player.playerId))
  const hasStarts = returningPlayers.some(r => r.year2Stats.gamesStarted !== null)

  // Sort returners by Y2 min share desc
  const sortedReturners = [...returningPlayers].sort((a, b) =>
    (y2ShareMap.get(b.year2Stats.playerId)?.minShare ?? 0) -
    (y2ShareMap.get(a.year2Stats.playerId)?.minShare ?? 0)
  )

  // Sort newcomers by Y2 min share desc
  const sortedNewcomers = [...newPlayers].sort((a, b) =>
    (y2ShareMap.get(b.playerId)?.minShare ?? 0) -
    (y2ShareMap.get(a.playerId)?.minShare ?? 0)
  )

  // Departures sorted by Y1 min share desc
  const sortedDepartures = [...nonReturningPlayers]
    .filter(p => !belowThresholdIds.has(p.playerId))
    .sort((a, b) =>
      (y1ShareMap.get(b.playerId)?.minShare ?? 0) -
      (y1ShareMap.get(a.playerId)?.minShare ?? 0)
    )

  function fmtDelta(n: number): string {
    const abs = Math.abs(n).toFixed(1)
    return n > 0 ? `+${abs}pp` : n < 0 ? `−${abs}pp` : '—'
  }

  function deltaColor(n: number): string {
    if (Math.abs(n) < 0.1) return 'var(--text-mid)'
    return n > 0 ? 'var(--positive)' : 'var(--negative)'
  }

  function continuityLabel(role: RoleTag, status: PlayerStatus, isQualified: boolean): string {
    return buildContinuityLabel(role, status, isQualified)
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={TH_LEFT}>Player</th>
            <th style={TH_LEFT}>Role</th>
            <th style={TH_STYLE}>Min%</th>
            <th style={TH_STYLE}>Min Δ</th>
            <th style={TH_STYLE}>Pts%</th>
            <th style={TH_STYLE}>Pts Δ</th>
            {hasStarts && <th style={TH_STYLE}>GS</th>}
            <th style={TH_STYLE}>Qualified</th>
            <th style={TH_STYLE}>Match</th>
          </tr>
        </thead>
        <tbody>
          {/* Returners */}
          {sortedReturners.length > 0 && (
            <>
              <SectionDivider label={`Returners (${sortedReturners.length})`} />
              {sortedReturners.map((rp, i) => {
                const y2Share = y2ShareMap.get(rp.year2Stats.playerId) ?? { minShare: 0, ptsShare: 0 }
                const y1Share = y1ShareMap.get(rp.year1Stats.playerId) ?? { minShare: 0, ptsShare: 0 }
                const minDelta = y2Share.minShare - y1Share.minShare
                const ptsDelta = y2Share.ptsShare - y1Share.ptsShare
                const isBelowThreshold = belowThresholdIds.has(rp.year1Stats.playerId)
                const role = computeRoleTag(y2Share.minShare, y2Share.ptsShare, rp.year2Stats.gamesStarted ?? null, rp.year2Stats.games)
                const clabel = continuityLabel(role, 'returner', !isBelowThreshold)

                return (
                  <tr key={rp.year2Stats.playerId} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-alt-row)' }}>
                    <td style={TD_LEFT}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <PlayerLink player={rp.year2Stats} teamSlug={teamSlug} year2={year2} />
                        {isBelowThreshold && <ThresholdBadge below />}
                      </div>
                    </td>
                    <td style={{ ...TD_LEFT, fontSize: '10px', fontWeight: 600, color: ROLE_STYLES[role].color }}>{clabel}</td>
                    <td style={TD_STYLE}>{fmtPctStr(y2Share.minShare)}</td>
                    <td style={{ ...TD_STYLE, color: deltaColor(minDelta), fontWeight: 600 }}>{fmtDelta(minDelta)}</td>
                    <td style={TD_STYLE}>{fmtPctStr(y2Share.ptsShare)}</td>
                    <td style={{ ...TD_STYLE, color: deltaColor(ptsDelta), fontWeight: 600 }}>{fmtDelta(ptsDelta)}</td>
                    {hasStarts && <td style={TD_STYLE}>{fmtInt(rp.year2Stats.gamesStarted)}</td>}
                    <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                      {isBelowThreshold
                        ? <span style={{ fontSize: '9px', color: 'var(--badge-amber-fg)' }}>sub-threshold</span>
                        : <span style={{ fontSize: '9px', color: 'var(--positive)' }}>✓</span>
                      }
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                      {rp.matchConfidence !== 'exact' && <ConfidenceBadge conf={rp.matchConfidence} />}
                      {rp.matchConfidence === 'exact' && <span style={{ fontSize: '9px', color: 'var(--text-lo)' }}>exact</span>}
                    </td>
                  </tr>
                )
              })}
            </>
          )}

          {/* Newcomers */}
          {sortedNewcomers.length > 0 && (
            <>
              <SectionDivider label={`Newcomers (${sortedNewcomers.length})`} />
              {sortedNewcomers.map((player, i) => {
                const share = y2ShareMap.get(player.playerId) ?? { minShare: 0, ptsShare: 0 }
                const role = computeRoleTag(share.minShare, share.ptsShare, player.gamesStarted ?? null, player.games)
                const clabel = continuityLabel(role, 'newcomer', true)
                return (
                  <tr key={player.playerId} style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-alt-row)' }}>
                    <td style={TD_LEFT}><PlayerLink player={player} teamSlug={teamSlug} year2={year2} /></td>
                    <td style={{ ...TD_LEFT, fontSize: '10px', fontWeight: 600, color: ROLE_STYLES[role].color }}>{clabel}</td>
                    <td style={TD_STYLE}>{fmtPctStr(share.minShare)}</td>
                    <td style={TD_DIM}>—</td>
                    <td style={TD_STYLE}>{fmtPctStr(share.ptsShare)}</td>
                    <td style={TD_DIM}>—</td>
                    {hasStarts && <td style={TD_STYLE}>{fmtInt(player.gamesStarted)}</td>}
                    <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-lo)' }}>new</span>
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-lo)' }}>—</span>
                    </td>
                  </tr>
                )
              })}
            </>
          )}

          {/* Departures */}
          {sortedDepartures.length > 0 && (
            <>
              <SectionDivider label={`Departures (${sortedDepartures.length}) — prior season production`} muted />
              {sortedDepartures.map((player) => {
                const share = y1ShareMap.get(player.playerId) ?? { minShare: 0, ptsShare: 0 }
                const role = computeRoleTag(share.minShare, share.ptsShare, player.gamesStarted ?? null, player.games)
                const clabel = continuityLabel(role, 'departure', true)
                return (
                  <tr key={player.playerId} style={{ opacity: 0.55, backgroundColor: 'var(--bg-alt-row)' }}>
                    <td style={TD_LEFT}><PlayerLink player={player} teamSlug={teamSlug} year2={year2 - 1} /></td>
                    <td style={{ ...TD_LEFT, fontSize: '10px', fontWeight: 600, color: ROLE_STYLES[role].color }}>{clabel}</td>
                    <td style={TD_STYLE}>{fmtPctStr(share.minShare)}</td>
                    <td style={TD_DIM}>—</td>
                    <td style={TD_STYLE}>{fmtPctStr(share.ptsShare)}</td>
                    <td style={TD_DIM}>—</td>
                    {hasStarts && <td style={TD_STYLE}>{fmtInt(player.gamesStarted)}</td>}
                    <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-lo)' }}>departed</span>
                    </td>
                    <td style={{ ...TD_STYLE, textAlign: 'center' }}>
                      <span style={{ fontSize: '9px', color: 'var(--text-lo)' }}>—</span>
                    </td>
                  </tr>
                )
              })}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

// ─── Roster summary bar ───────────────────────────────────────────────────────

interface SummaryBarProps {
  returners: number
  newcomers: number
  departures: number
  subThreshold: number
}

function RosterSummaryBar({ returners, newcomers, departures, subThreshold }: SummaryBarProps) {
  const items = [
    { label: 'Returners',    count: returners,   color: 'var(--badge-green-fg)',  bg: 'var(--badge-green-bg)'  },
    { label: 'Newcomers',    count: newcomers,   color: 'var(--badge-blue-fg)',   bg: 'var(--badge-blue-bg)'   },
    { label: 'Departures',   count: departures,  color: 'var(--badge-gray-fg)',   bg: 'var(--badge-gray-bg)'   },
    ...(subThreshold > 0 ? [{ label: 'Sub-threshold', count: subThreshold, color: 'var(--badge-amber-fg)', bg: 'var(--badge-amber-bg)' }] : []),
  ]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0',
      marginBottom: '8px',
      border: '1px solid var(--border-hi)',
      borderRadius: '5px',
      overflow: 'hidden',
    }}>
      {items.map((item, i) => (
        <div
          key={item.label}
          style={{
            flex: 1,
            padding: '7px 10px',
            borderRight: i < items.length - 1 ? '1px solid var(--border)' : 'none',
            textAlign: 'center',
          }}
        >
          <div style={{
            fontSize: '16px',
            fontWeight: 700,
            color: item.color,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}>
            {item.count}
          </div>
          <div style={{ fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-lo)', marginTop: '2px' }}>
            {item.label}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RosterTables({ retention, teamSlug, year2 }: Props) {
  const [activeTab, setActiveTab] = useState<'stats' | 'continuity'>('stats')

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontSize: '10px',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    padding: '6px 14px',
    border: 'none',
    borderBottom: active ? '2px solid var(--brand)' : '2px solid transparent',
    background: 'none',
    color: active ? 'var(--brand)' : 'var(--text-mid)',
    cursor: 'pointer',
    fontFamily: 'var(--mono)',
    transition: 'color 0.1s',
  })

  if (!retention) {
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-mid)', marginBottom: '8px' }}>
          Roster
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-mid)', padding: '12px 0' }}>
          Player-level data is not available for this season pair.
        </div>
      </div>
    )
  }

  const totalReturners  = retention.returningPlayersCount
  const totalNewcomers  = retention.newPlayersCount
  const totalDepartures = retention.nonReturningPlayers.filter(
    p => !retention.belowThresholdPlayers.find(b => b.player.playerId === p.playerId)
  ).length
  const totalSubThreshold = retention.belowThresholdPlayers.length

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Roster macro summary */}
      <RosterSummaryBar
        returners={totalReturners}
        newcomers={totalNewcomers}
        departures={totalDepartures}
        subThreshold={totalSubThreshold}
      />

      {/* Tab header */}
      <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border-hi)', marginBottom: '0' }}>
        <button style={tabStyle(activeTab === 'stats')} onClick={() => setActiveTab('stats')}>
          Season Stats
        </button>
        <button style={tabStyle(activeTab === 'continuity')} onClick={() => setActiveTab('continuity')}>
          Continuity View
        </button>
      </div>

      {/* Tab content */}
      <div style={{ border: '1px solid var(--border-hi)', borderTop: 'none', borderRadius: '0 0 6px 6px', overflow: 'hidden' }}>
        {activeTab === 'stats'       && <SeasonStatsTab  retention={retention} teamSlug={teamSlug} year2={year2} />}
        {activeTab === 'continuity'  && <ContinuityTab   retention={retention} teamSlug={teamSlug} year2={year2} />}
      </div>

      {/* Below-threshold footnote */}
      {retention.belowThresholdPlayers.length > 0 && (
        <div style={{ fontSize: '10px', color: 'var(--text-lo)', marginTop: '6px' }}>
          * Sub-threshold players matched but excluded from CI denominator (low participation).
        </div>
      )}
    </div>
  )
}
