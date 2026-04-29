'use client'

import Link from 'next/link'
import type { PlayerBrowseRow } from '@/hooks/usePlayerBrowse'

export type SortKey =
  | 'playerName' | 'teamName' | 'status' | 'positionRole' | 'yr' | 'roleTier'
  | 'minShare' | 'ptsShare' | 'minShareDelta' | 'ptsShareDelta'
  | 'mpg' | 'ppg' | 'usg' | 'bpm' | 'obpm' | 'dbpm' | 'ortg' | 'drtg' | 'tsPct'
  | 'teamCi' | 'games' | 'ht'

export type ColumnId =
  | 'player' | 'team' | 'status' | 'posRole' | 'yr' | 'ht' | 'roleTier'
  | 'minShare' | 'ptsShare' | 'minShareDelta' | 'ptsShareDelta'
  | 'mpg' | 'ppg' | 'usg' | 'bpm' | 'obpm' | 'dbpm' | 'ortg' | 'drtg' | 'tsPct'
  | 'teamCi' | 'teamFlag' | 'games'

export interface ColDef { id: ColumnId; label: string; sortKey?: SortKey; always?: boolean; group: 'identity' | 'continuity' | 'efficiency' | 'context' }

export const ALL_COLUMNS: ColDef[] = [
  { id: 'player',        label: 'Player',    sortKey: 'playerName',    always: true, group: 'identity'   },
  { id: 'team',          label: 'Team',      sortKey: 'teamName',                    group: 'identity'   },
  { id: 'status',        label: 'Status',    sortKey: 'status',                      group: 'identity'   },
  { id: 'roleTier',      label: 'Tier',      sortKey: 'roleTier',                    group: 'identity'   },
  { id: 'posRole',       label: 'Pos Role',  sortKey: 'positionRole',                group: 'identity'   },
  { id: 'yr',            label: 'Yr',        sortKey: 'yr',                          group: 'identity'   },
  { id: 'ht',            label: 'Ht',        sortKey: 'ht',                          group: 'identity'   },
  { id: 'minShare',      label: 'Min%',      sortKey: 'minShare',                    group: 'continuity' },
  { id: 'ptsShare',      label: 'Pts%',      sortKey: 'ptsShare',                    group: 'continuity' },
  { id: 'minShareDelta', label: 'Min%Δ',     sortKey: 'minShareDelta',               group: 'continuity' },
  { id: 'ptsShareDelta', label: 'Pts%Δ',     sortKey: 'ptsShareDelta',               group: 'continuity' },
  { id: 'usg',           label: 'USG%',      sortKey: 'usg',                         group: 'efficiency' },
  { id: 'bpm',           label: 'BPM',       sortKey: 'bpm',                         group: 'efficiency' },
  { id: 'tsPct',         label: 'TS%',       sortKey: 'tsPct',                       group: 'efficiency' },
  { id: 'obpm',          label: 'oBPM',      sortKey: 'obpm',                        group: 'efficiency' },
  { id: 'dbpm',          label: 'dBPM',      sortKey: 'dbpm',                        group: 'efficiency' },
  { id: 'ortg',          label: 'ORtg',      sortKey: 'ortg',                        group: 'efficiency' },
  { id: 'drtg',          label: 'DRtg',      sortKey: 'drtg',                        group: 'efficiency' },
  { id: 'mpg',           label: 'MPG',       sortKey: 'mpg',                         group: 'context'    },
  { id: 'ppg',           label: 'PPG',       sortKey: 'ppg',                         group: 'context'    },
  { id: 'games',         label: 'G',         sortKey: 'games',                       group: 'context'    },
  { id: 'teamCi',        label: 'Team CI',   sortKey: 'teamCi',                      group: 'context'    },
  { id: 'teamFlag',      label: 'Flag',                                              group: 'context'    },
]

export const DEFAULT_VISIBLE: Set<ColumnId> = new Set<ColumnId>([
  'player', 'team', 'status', 'roleTier', 'posRole', 'yr',
  'minShare', 'ptsShare', 'minShareDelta', 'ptsShareDelta',
  'usg', 'bpm', 'teamCi', 'teamFlag',
])

// ─── Styles ───────────────────────────────────────────────────────────────────

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace"

const TH: React.CSSProperties = {
  padding: '5px 8px', fontSize: '9px', fontWeight: 700,
  textTransform: 'uppercase', letterSpacing: '0.07em',
  color: 'var(--text-mid)', whiteSpace: 'nowrap', userSelect: 'none',
  borderBottom: '2px solid var(--border-hi)', backgroundColor: 'var(--bg-muted)',
  fontFamily: MONO, position: 'sticky', top: 0, zIndex: 1,
}
const TD: React.CSSProperties = {
  padding: '5px 8px', fontSize: '11px', color: 'var(--text-mid)',
  borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', fontFamily: MONO,
}

const STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  returner:  { bg: 'var(--badge-green-bg)', color: 'var(--badge-green-fg)', label: 'RET' },
  newcomer:  { bg: 'var(--badge-blue-bg)',  color: 'var(--badge-blue-fg)',  label: 'NEW' },
  departure: { bg: 'var(--badge-gray-bg)',  color: 'var(--badge-gray-fg)',  label: 'DEP' },
}

function fmt1(n: number | null): string {
  return n === null ? '—' : n.toFixed(1)
}
function fmtPct(n: number | null): string {
  return n === null ? '—' : `${n.toFixed(1)}%`
}
function fmtDelta(n: number | null): string {
  if (n === null) return '—'
  const abs = Math.abs(n).toFixed(1)
  return n >= 0 ? `+${abs}` : `−${abs}`
}
function deltaColor(n: number | null): string {
  if (n === null) return 'var(--text-lo)'
  if (Math.abs(n) < 0.3) return 'var(--text-lo)'
  return n > 0 ? 'var(--positive)' : 'var(--negative)'
}
function bpmColor(n: number | null): string {
  if (n === null) return 'var(--text-mid)'
  if (n >= 3) return 'var(--positive)'
  if (n >= 0) return 'var(--badge-sky-fg)'
  if (n >= -3) return 'var(--text-mid)'
  return 'var(--badge-gray-fg)'
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={TD}>
          <div style={{ height: '11px', backgroundColor: 'var(--bg-subtle)', borderRadius: '3px', width: i === 0 ? '120px' : '48px' }} />
        </td>
      ))}
    </tr>
  )
}

// ─── Sort helper ──────────────────────────────────────────────────────────────

function sortRows(rows: PlayerBrowseRow[], key: SortKey, dir: 'asc' | 'desc'): PlayerBrowseRow[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[key]
    const bv = (b as unknown as Record<string, unknown>)[key]
    if (av === null || av === undefined) return 1
    if (bv === null || bv === undefined) return -1
    if (typeof av === 'string' && typeof bv === 'string') return mul * av.localeCompare(bv)
    return mul * ((av as number) - (bv as number))
  })
}

// ─── Header cell ─────────────────────────────────────────────────────────────

function Th({ col, sortKey, sortDir, onSort }: {
  col: ColDef
  sortKey: SortKey | null
  sortDir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
}) {
  const active = col.sortKey && sortKey === col.sortKey
  return (
    <th
      style={{ ...TH, cursor: col.sortKey ? 'pointer' : 'default', color: active ? 'var(--brand)' : 'var(--text-mid)' }}
      onClick={() => col.sortKey && onSort(col.sortKey)}
      title={col.label}
    >
      {col.label}
      {active && <span style={{ marginLeft: '3px', fontSize: '8px' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
    </th>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

interface Props {
  rows: PlayerBrowseRow[]
  isLoading: boolean
  sortKey: SortKey | null
  sortDir: 'asc' | 'desc'
  onSort: (k: SortKey) => void
  visibleCols: Set<ColumnId>
}

export function PlayerBrowseTable({ rows, isLoading, sortKey, sortDir, onSort, visibleCols }: Props) {
  const visibleDefs = ALL_COLUMNS.filter(c => visibleCols.has(c.id))
  const sorted = sortKey ? sortRows(rows, sortKey, sortDir) : rows

  return (
    <div style={{ overflowX: 'auto', border: '1px solid var(--border-hi)', borderRadius: '8px' }}>
      <table className="player-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: '11px' }}>
        <thead>
          <tr>
            <th style={{ ...TH, paddingLeft: '10px', textAlign: 'left', color: 'var(--text-lo)', width: '36px' }}>#</th>
            {visibleDefs.map(col => (
              <Th key={col.id} col={col} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {isLoading
            ? Array.from({ length: 20 }).map((_, i) => <SkeletonRow key={i} cols={visibleDefs.length + 1} />)
            : sorted.map((row, i) => (
                <tr key={`${row.athleteId}-${row.teamSlug}-${row.status}`}>
                  {/* Row number */}
                  <td style={{ ...TD, paddingLeft: '10px', color: 'var(--text-disabled)', fontSize: '10px', textAlign: 'right', width: '36px' }}>
                    {i + 1}
                  </td>

                  {visibleDefs.map(col => {
                    switch (col.id) {
                      case 'player':
                        return (
                          <td key={col.id} style={{ ...TD, fontWeight: 600, color: 'var(--text-hi)', maxWidth: '160px' }}>
                            <Link
                              href={`/player/${row.athleteId}?team=${row.teamSlug}&year=${row.year}`}
                              style={{ color: 'inherit', textDecoration: 'none' }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}
                            >
                              {row.playerName}
                            </Link>
                          </td>
                        )
                      case 'team':
                        return (
                          <td key={col.id} style={{ ...TD, maxWidth: '140px' }}>
                            <Link
                              href={`/team/${row.teamSlug}?year=${row.year}`}
                              style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'inherit', textDecoration: 'none' }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--brand)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}
                            >
                              {row.logoUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={row.logoUrl} width={14} height={14} style={{ objectFit: 'contain', flexShrink: 0, opacity: 0.85 }} alt="" />
                              )}
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {row.teamShortName}
                              </span>
                            </Link>
                          </td>
                        )
                      case 'status': {
                        const badge = STATUS_BADGE[row.status]
                        return (
                          <td key={col.id} style={TD}>
                            <span style={{
                              fontSize: '8px', fontWeight: 700, letterSpacing: '0.07em',
                              padding: '2px 5px', borderRadius: '3px',
                              backgroundColor: badge.bg, color: badge.color,
                            }}>
                              {badge.label}
                            </span>
                          </td>
                        )
                      }
                      case 'roleTier': {
                        const TIER_COLOR: Record<string, string> = {
                          lead: 'var(--badge-blue-fg)', core: 'var(--badge-sky-fg)', rotation: 'var(--badge-amber-fg)', bench: 'var(--badge-gray-fg)', fringe: 'var(--badge-silver-fg)',
                        }
                        const TIER_LABEL: Record<string, string> = {
                          lead: 'Lead', core: 'Core', rotation: 'Rot', bench: 'Bench', fringe: 'Fringe',
                        }
                        return (
                          <td key={col.id} style={{ ...TD, color: TIER_COLOR[row.roleTier] ?? 'var(--text-mid)', fontWeight: 700, fontSize: '9px', letterSpacing: '0.04em' }}>
                            {TIER_LABEL[row.roleTier] ?? row.roleTier}
                          </td>
                        )
                      }
                      case 'posRole':
                        return (
                          <td key={col.id} style={{ ...TD, color: row.positionRole ? 'var(--text-hi)' : 'var(--text-disabled)' }}>
                            {row.positionRole ?? '—'}
                          </td>
                        )
                      case 'yr':
                        return <td key={col.id} style={TD}>{row.yr ?? '—'}</td>
                      case 'ht':
                        return <td key={col.id} style={TD}>{row.ht ?? '—'}</td>
                      case 'minShare':
                        return <td key={col.id} style={{ ...TD, fontWeight: 600 }}>{fmtPct(row.minShare)}</td>
                      case 'ptsShare':
                        return <td key={col.id} style={{ ...TD, fontWeight: 600 }}>{fmtPct(row.ptsShare)}</td>
                      case 'minShareDelta':
                        return <td key={col.id} style={{ ...TD, color: deltaColor(row.minShareDelta), fontWeight: row.minShareDelta !== null && Math.abs(row.minShareDelta) >= 2 ? 600 : 400 }}>{fmtDelta(row.minShareDelta)}</td>
                      case 'ptsShareDelta':
                        return <td key={col.id} style={{ ...TD, color: deltaColor(row.ptsShareDelta), fontWeight: row.ptsShareDelta !== null && Math.abs(row.ptsShareDelta) >= 2 ? 600 : 400 }}>{fmtDelta(row.ptsShareDelta)}</td>
                      case 'usg':
                        return <td key={col.id} style={TD}>{fmtPct(row.usg)}</td>
                      case 'bpm':
                        return <td key={col.id} style={{ ...TD, color: bpmColor(row.bpm), fontWeight: row.bpm !== null && Math.abs(row.bpm) >= 3 ? 600 : 400 }}>{row.bpm !== null ? (row.bpm >= 0 ? '+' : '') + row.bpm.toFixed(1) : '—'}</td>
                      case 'obpm':
                        return <td key={col.id} style={{ ...TD, color: bpmColor(row.obpm) }}>{row.obpm !== null ? (row.obpm >= 0 ? '+' : '') + row.obpm.toFixed(1) : '—'}</td>
                      case 'dbpm':
                        return <td key={col.id} style={{ ...TD, color: bpmColor(row.dbpm) }}>{row.dbpm !== null ? (row.dbpm >= 0 ? '+' : '') + row.dbpm.toFixed(1) : '—'}</td>
                      case 'tsPct':
                        return <td key={col.id} style={TD}>{fmtPct(row.tsPct)}</td>
                      case 'ortg':
                        return <td key={col.id} style={TD}>{fmt1(row.ortg)}</td>
                      case 'drtg':
                        return <td key={col.id} style={TD}>{fmt1(row.drtg)}</td>
                      case 'mpg':
                        return <td key={col.id} style={TD}>{fmt1(row.mpg)}</td>
                      case 'ppg':
                        return <td key={col.id} style={{ ...TD, fontWeight: 500 }}>{fmt1(row.ppg)}</td>
                      case 'games':
                        return <td key={col.id} style={{ ...TD, color: 'var(--text-lo)' }}>{row.games}</td>
                      case 'teamCi':
                        return <td key={col.id} style={{ ...TD, color: row.teamCi !== null ? 'var(--text-hi)' : 'var(--text-disabled)' }}>{row.teamCi !== null ? row.teamCi.toFixed(1) : '—'}</td>
                      case 'teamFlag': {
                        const flag = row.teamFlag
                        if (!flag || flag === 'none') return <td key={col.id} style={{ ...TD, color: 'var(--text-disabled)' }}>—</td>
                        const flagColors: Record<string, string> = {
                          'low-up': 'var(--positive)', 'high-down': 'var(--negative)',
                          'low-down': 'var(--badge-amber-fg)', 'high-up': 'var(--badge-sky-fg)',
                        }
                        return <td key={col.id} style={{ ...TD, color: flagColors[flag] ?? 'var(--text-mid)', fontSize: '9px', fontWeight: 700, letterSpacing: '0.04em' }}>{flag.toUpperCase()}</td>
                      }
                      default:
                        return <td key={col.id} style={TD}>—</td>
                    }
                  })}
                </tr>
              ))
          }
        </tbody>
      </table>

      {!isLoading && sorted.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', fontSize: '11px', color: 'var(--text-lo)', fontFamily: MONO }}>
          No players match the current filters.
        </div>
      )}
    </div>
  )
}
