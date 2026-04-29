'use client'

import { useMemo } from 'react'
import type { BrowseRow, OutlierFlag, DataStatus } from '@/lib/types'
import {
  fmtCI, fmtPct, fmtPctDelta, fmtDelta,
  fmtRank, fmtRating, deltaHex,
} from '@/lib/utils/formatting'

// Small muted superscript rank indicator beside stat values
function MiniRank({ rank }: { rank: number | undefined }) {
  if (rank === undefined) return null
  return (
    <span style={{ fontSize: '8px', color: 'var(--text-disabled)', verticalAlign: 'super', marginLeft: '2px', lineHeight: 0, fontWeight: 400, letterSpacing: 0 }}>
      {rank}
    </span>
  )
}

// ─── Sort key ─────────────────────────────────────────────────────────────────

export type SortKey =
  | 'teamName' | 'conference' | 'continuityIndex'
  | 'returningMinutesPct' | 'returningStartsPct' | 'returningPointsPct'
  | 'deptMinutesPct' | 'deptPointsPct'
  | 'newcomerMinutesPct' | 'newcomerPointsPct'
  | 'returningPlayersCount' | 'newPlayersCount'
  | 'year1WinPct' | 'year2WinPct' | 'winPctDelta' | 'ppgDelta' | 'oppPpgDelta'
  | 'ratingsRank' | 'ratingsRating'
  | 'masseyRank'  | 'masseyRating'
  | 'outlierFlag'

// ─── Column definitions ────────────────────────────────────────────────────────

export type ColGroup = 'team' | 'continuity' | 'newcomers' | 'season' | 'context'

export interface ColDef {
  id: string
  sortKey: SortKey | null
  label: string
  sub?: string
  group: ColGroup
  align: 'left' | 'right' | 'center'
  sticky: boolean
  stickyLeft: number
  width: number
  always: boolean
  defaultVisible: boolean
}

export const ALL_COLUMNS: ColDef[] = [
  { id: 'num',         sortKey: null,                   label: '#',         group: 'team',        align: 'center', sticky: true,  stickyLeft: 0,   width: 36,  always: true,  defaultVisible: true  },
  { id: 'teamName',    sortKey: 'teamName',              label: 'Team',      group: 'team',        align: 'left',   sticky: true,  stickyLeft: 36,  width: 220, always: true,  defaultVisible: true  },
  { id: 'conference',  sortKey: 'conference',           label: 'Conf',      group: 'team',        align: 'left',   sticky: false, stickyLeft: 0,   width: 60,  always: false, defaultVisible: false },
  { id: 'ci',          sortKey: 'continuityIndex',      label: 'CI',        sub: 'index',         group: 'continuity', align: 'right',  sticky: false, stickyLeft: 0,   width: 52,  always: false, defaultVisible: true  },
  { id: 'retMin',      sortKey: 'returningMinutesPct',  label: 'Ret',       sub: 'min%',          group: 'continuity', align: 'right',  sticky: false, stickyLeft: 0,   width: 56,  always: false, defaultVisible: true  },
  { id: 'retPts',      sortKey: 'returningPointsPct',   label: 'Ret',       sub: 'pts%',          group: 'continuity', align: 'right',  sticky: false, stickyLeft: 0,   width: 56,  always: false, defaultVisible: true  },
  { id: 'retStarts',   sortKey: 'returningStartsPct',   label: 'Ret',       sub: 'starts%',       group: 'continuity', align: 'right',  sticky: false, stickyLeft: 0,   width: 62,  always: false, defaultVisible: false },
  { id: 'deptMin',     sortKey: 'deptMinutesPct',       label: 'Dept',      sub: 'min%',          group: 'continuity', align: 'right',  sticky: false, stickyLeft: 0,   width: 58,  always: false, defaultVisible: false },
  { id: 'deptPts',     sortKey: 'deptPointsPct',        label: 'Dept',      sub: 'pts%',          group: 'continuity', align: 'right',  sticky: false, stickyLeft: 0,   width: 58,  always: false, defaultVisible: false },
  { id: 'newMin',      sortKey: 'newcomerMinutesPct',   label: 'New',       sub: 'min%',          group: 'newcomers',  align: 'right',  sticky: false, stickyLeft: 0,   width: 56,  always: false, defaultVisible: true  },
  { id: 'newPts',      sortKey: 'newcomerPointsPct',    label: 'New',       sub: 'pts%',          group: 'newcomers',  align: 'right',  sticky: false, stickyLeft: 0,   width: 56,  always: false, defaultVisible: true  },
  { id: 'returners',   sortKey: 'returningPlayersCount',label: 'Ret',       sub: 'players',       group: 'newcomers',  align: 'right',  sticky: false, stickyLeft: 0,   width: 54,  always: false, defaultVisible: false },
  { id: 'newPlayers',  sortKey: 'newPlayersCount',      label: 'New',       sub: 'players',       group: 'newcomers',  align: 'right',  sticky: false, stickyLeft: 0,   width: 54,  always: false, defaultVisible: false },
  { id: 'year1Wpct',   sortKey: 'year1WinPct',          label: 'W%',        sub: 'y1',            group: 'season',     align: 'right',  sticky: false, stickyLeft: 0,   width: 54,  always: false, defaultVisible: false },
  { id: 'year2Wpct',   sortKey: 'year2WinPct',          label: 'W%',        sub: 'y2',            group: 'season',     align: 'right',  sticky: false, stickyLeft: 0,   width: 54,  always: false, defaultVisible: false },
  { id: 'wpctDelta',   sortKey: 'winPctDelta',          label: 'W%',        sub: 'Δ',             group: 'season',     align: 'right',  sticky: false, stickyLeft: 0,   width: 58,  always: false, defaultVisible: true  },
  { id: 'ppgDelta',    sortKey: 'ppgDelta',             label: 'PPG',       sub: 'Δ',             group: 'season',     align: 'right',  sticky: false, stickyLeft: 0,   width: 58,  always: false, defaultVisible: true  },
  { id: 'oppPpgDelta', sortKey: 'oppPpgDelta',          label: 'Opp',       sub: 'PPG Δ',         group: 'season',     align: 'right',  sticky: false, stickyLeft: 0,   width: 62,  always: false, defaultVisible: false },
  { id: 'ratingsRank', sortKey: 'ratingsRank',          label: 'Net',       sub: 'rank',          group: 'context',    align: 'right',  sticky: false, stickyLeft: 0,   width: 52,  always: false, defaultVisible: false },
  { id: 'ratingsRtg',  sortKey: 'ratingsRating',        label: 'Net',       sub: 'rtg',           group: 'context',    align: 'right',  sticky: false, stickyLeft: 0,   width: 64,  always: false, defaultVisible: true  },
  { id: 'masseyRank',  sortKey: 'masseyRank',           label: 'Massey',    sub: 'rank',          group: 'context',    align: 'right',  sticky: false, stickyLeft: 0,   width: 60,  always: false, defaultVisible: true  },
  { id: 'masseyRtg',   sortKey: 'masseyRating',         label: 'Massey',    sub: 'rtg',           group: 'context',    align: 'right',  sticky: false, stickyLeft: 0,   width: 60,  always: false, defaultVisible: false },
  { id: 'flag',        sortKey: 'outlierFlag',           label: 'Flag',                            group: 'context',    align: 'center', sticky: false, stickyLeft: 0,   width: 72,  always: false, defaultVisible: true  },
  { id: 'dataStatus',  sortKey: null,                   label: 'Status',                          group: 'context',    align: 'center', sticky: false, stickyLeft: 0,   width: 58,  always: false, defaultVisible: true  },
]

export const DEFAULT_VISIBLE_COLS = new Set(
  ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id)
)

// D2 has no net/Massey ratings; swap those out for conference column
const D2_VISIBLE_IDS = new Set([
  ...ALL_COLUMNS.filter(c => c.defaultVisible && c.id !== 'ratingsRtg' && c.id !== 'masseyRank').map(c => c.id),
  'conference',
])

export function getDefaultVisibleCols(division: 'D1' | 'D2'): Set<string> {
  return division === 'D2' ? new Set(D2_VISIBLE_IDS) : new Set(DEFAULT_VISIBLE_COLS)
}

const GROUP_META: Record<ColGroup, { label: string }> = {
  team:        { label: 'Team' },
  continuity:  { label: 'Continuity' },
  newcomers:   { label: 'Newcomers' },
  season:      { label: 'Season' },
  context:     { label: 'Context' },
}

// ─── Massey color ─────────────────────────────────────────────────────────────
// Same tier thresholds as ratingsBucket (top ~14% = high, ~48% = mid, rest = low)
function masseyColor(rank: number | null): string {
  if (rank === null) return 'var(--text-disabled)'
  if (rank <= 50)  return 'var(--positive)'
  if (rank <= 175) return 'var(--text-label)'
  return 'var(--negative)'
}

// ─── Badge configs ─────────────────────────────────────────────────────────────

const FLAG_CONFIG: Partial<Record<NonNullable<OutlierFlag>, { label: string; bg: string; color: string }>> = {
  'high-ci-improve': { label: 'High ↑', bg: 'var(--badge-green-bg)',   color: 'var(--badge-green-fg)'   },
  'high-ci-stable':  { label: 'High —', bg: 'var(--badge-neutral-bg)', color: 'var(--badge-neutral-fg)' },
  'high-ci-decline': { label: 'High ↓', bg: 'var(--badge-red-bg)',     color: 'var(--badge-red-fg)'     },
  'mid-ci-improve':  { label: 'Mid ↑',  bg: 'var(--badge-green-bg)',   color: 'var(--badge-green-fg)'   },
  'mid-ci-stable':   { label: 'Mid —',  bg: 'var(--badge-neutral-bg)', color: 'var(--text-lo)'          },
  'mid-ci-decline':  { label: 'Mid ↓',  bg: 'var(--badge-red-bg)',     color: 'var(--badge-red-fg)'     },
  'low-ci-improve':  { label: 'Low ↑',  bg: 'var(--badge-amber-bg)',   color: 'var(--badge-amber-fg)'   },
  'low-ci-stable':   { label: 'Low —',  bg: 'var(--badge-neutral-bg)', color: 'var(--text-lo)'          },
  'low-ci-decline':  { label: 'Low ↓',  bg: 'var(--badge-neutral-bg)', color: 'var(--badge-neutral-fg)' },
  'stats-only':      { label: 'Stats',  bg: 'var(--badge-blue-bg)',    color: 'var(--badge-blue-fg)'    },
}

const STATUS_CONFIG: Record<DataStatus, { label: string; bg: string; color: string }> = {
  'full':           { label: 'Full',    bg: 'var(--badge-green-bg)',   color: 'var(--badge-green-fg)'   },
  'stats-only':     { label: 'Stats',   bg: 'var(--badge-blue-bg)',    color: 'var(--badge-blue-fg)'    },
  'no-player-data': { label: 'Partial', bg: 'var(--badge-amber-bg)',   color: 'var(--badge-amber-fg)'   },
  'unavailable':    { label: '—',       bg: 'var(--badge-neutral-bg)', color: 'var(--text-lo)'          },
}

// ─── Sort ──────────────────────────────────────────────────────────────────────

// Flag sort order: high tier first, decline → stable → improve, stats-only last, null final
const FLAG_ORDER: Record<string, number> = {
  'high-ci-decline': 0,
  'high-ci-stable':  1,
  'high-ci-improve': 2,
  'mid-ci-decline':  3,
  'mid-ci-stable':   4,
  'mid-ci-improve':  5,
  'low-ci-decline':  6,
  'low-ci-stable':   7,
  'low-ci-improve':  8,
  'stats-only':      9,
}

function sortRows(rows: BrowseRow[], key: SortKey | null, dir: 'asc' | 'desc'): BrowseRow[] {
  if (!key) return rows
  if (key === 'outlierFlag') {
    return [...rows].sort((a, b) => {
      const ao = a.outlierFlag != null ? (FLAG_ORDER[a.outlierFlag] ?? 9) : 10
      const bo = b.outlierFlag != null ? (FLAG_ORDER[b.outlierFlag] ?? 9) : 10
      const cmp = ao - bo
      return dir === 'asc' ? cmp : -cmp
    })
  }
  if (key === 'teamName') {
    // For D1 teams with ratings, sort by rank; for D2 (all null), fall back to alphabetical
    const hasRatings = rows.some(r => r.ratingsRank !== null)
    if (hasRatings) {
      return [...rows].sort((a, b) => {
        const ar = a.ratingsRank
        const br = b.ratingsRank
        if (ar === null && br === null) return a.teamName.localeCompare(b.teamName)
        if (ar === null) return 1
        if (br === null) return -1
        const cmp = ar - br
        return dir === 'asc' ? cmp : -cmp
      })
    }
    return [...rows].sort((a, b) => {
      const cmp = a.teamName.localeCompare(b.teamName)
      return dir === 'asc' ? cmp : -cmp
    })
  }
  return [...rows].sort((a, b) => {
    const av = a[key as keyof BrowseRow] as number | string | null
    const bv = b[key as keyof BrowseRow] as number | string | null
    if (av === null && bv === null) return 0
    if (av === null) return 1
    if (bv === null) return -1
    if (typeof av === 'string' && typeof bv === 'string') {
      const cmp = av.localeCompare(bv)
      return dir === 'asc' ? cmp : -cmp
    }
    const cmp = (av as number) - (bv as number)
    return dir === 'asc' ? cmp : -cmp
  })
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

function renderCell(
  col: ColDef,
  row: BrowseRow,
  rowIndex: number,
  slugRanks: Map<string, number> | undefined,
): React.ReactNode {
  const hasCIData = row.dataStatus === 'full'
  const hasStats  = row.dataStatus === 'full' || row.dataStatus === 'stats-only'
  const isUnavail = row.dataStatus === 'unavailable'
  const r = (id: string) => slugRanks?.get(id)

  switch (col.id) {
    case 'num':
      return <span style={{ fontSize: '10px', color: 'var(--text-disabled)', fontWeight: 500 }}>{rowIndex + 1}</span>

    case 'teamName':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          {row.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.logoUrl} width={20} height={20} style={{ objectFit: 'contain', flexShrink: 0 }} alt="" />
          ) : (
            <div style={{ width: '20px', height: '20px', borderRadius: '3px', backgroundColor: 'var(--bg-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '7px', color: 'var(--text-lo)', fontWeight: 700, lineHeight: 1 }}>
                {row.shortName.substring(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: isUnavail ? 'var(--text-lo)' : 'var(--text-strong)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.shortName}
            </span>
            <span style={{ fontSize: '9px', color: 'var(--text-lo)', lineHeight: 1 }}>
              {row.conference}
              {row.ratingsRank !== null && <span style={{ marginLeft: '4px', color: 'var(--text-hi)', fontWeight: 700 }}>#{row.ratingsRank}</span>}
            </span>
          </div>
        </div>
      )

    case 'conference':
      return <span style={{ fontSize: '11px', color: 'var(--text-mid)' }}>{row.conference}</span>

    case 'ci':
      return hasCIData ? (
        <span style={{ fontWeight: 600, color: 'var(--text-hi)' }}>{fmtCI(row.continuityIndex)}<MiniRank rank={r('ci')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'retMin':
      return hasCIData ? (
        <span style={{ color: 'var(--text-body)' }}>{fmtPct(row.returningMinutesPct)}<MiniRank rank={r('retMin')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'retPts':
      return hasCIData ? (
        <span style={{ color: 'var(--text-body)' }}>{fmtPct(row.returningPointsPct)}<MiniRank rank={r('retPts')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'retStarts':
      return hasCIData ? (
        <span style={{ color: 'var(--text-body)' }}>{fmtPct(row.returningStartsPct)}<MiniRank rank={r('retStarts')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'deptMin':
      return hasCIData ? (
        <span style={{ color: 'var(--text-body)' }}>{fmtPct(row.deptMinutesPct)}<MiniRank rank={r('deptMin')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'deptPts':
      return hasCIData ? (
        <span style={{ color: 'var(--text-body)' }}>{fmtPct(row.deptPointsPct)}<MiniRank rank={r('deptPts')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'newMin':
      return hasCIData ? (
        <span style={{ color: 'var(--text-body)' }}>{fmtPct(row.newcomerMinutesPct)}<MiniRank rank={r('newMin')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'newPts':
      return hasCIData ? (
        <span style={{ color: 'var(--text-body)' }}>{fmtPct(row.newcomerPointsPct)}<MiniRank rank={r('newPts')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'returners':
      return hasCIData ? (
        <span style={{ color: 'var(--text-body)' }}>{String(row.returningPlayersCount)}<MiniRank rank={r('returners')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'newPlayers':
      return hasCIData ? (
        <span style={{ color: 'var(--text-body)' }}>{String(row.newPlayersCount)}<MiniRank rank={r('newPlayers')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'year1Wpct':
      return hasStats && !isUnavail ? (
        <span style={{ color: 'var(--text-body)' }}>{fmtPct(row.year1WinPct)}<MiniRank rank={r('year1Wpct')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'year2Wpct':
      return hasStats && !isUnavail ? (
        <span style={{ color: 'var(--text-body)' }}>{fmtPct(row.year2WinPct)}<MiniRank rank={r('year2Wpct')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'wpctDelta':
      return hasStats && !isUnavail ? (
        <span style={{ color: deltaHex(row.winPctDelta, true) }}>{fmtPctDelta(row.winPctDelta)}<MiniRank rank={r('wpctDelta')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'ppgDelta':
      return hasStats && !isUnavail ? (
        <span style={{ color: deltaHex(row.ppgDelta, true) }}>{fmtDelta(row.ppgDelta)}<MiniRank rank={r('ppgDelta')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'oppPpgDelta':
      return hasStats && !isUnavail ? (
        <span style={{ color: deltaHex(row.oppPpgDelta, false) }}>{fmtDelta(row.oppPpgDelta)}<MiniRank rank={r('oppPpgDelta')} /></span>
      ) : <span style={{ color: 'var(--text-disabled)' }}>—</span>

    case 'ratingsRank':
      return <span style={{ color: row.ratingsRank !== null ? 'var(--text-body)' : 'var(--text-disabled)' }}>{fmtRank(row.ratingsRank)}<MiniRank rank={r('ratingsRank')} /></span>

    case 'ratingsRtg':
      return <span style={{ color: row.ratingsRating !== null ? 'var(--text-body)' : 'var(--text-disabled)' }}>{fmtRating(row.ratingsRating)}<MiniRank rank={r('ratingsRtg')} /></span>

    case 'masseyRank': {
      const mc = masseyColor(row.masseyRank)
      return <span style={{ color: mc, fontWeight: row.masseyRank !== null ? 500 : 400 }}>
        {row.masseyRank !== null ? String(row.masseyRank) : '—'}
        <MiniRank rank={r('masseyRank')} />
      </span>
    }

    case 'masseyRtg': {
      const mc = masseyColor(row.masseyRank)
      return <span style={{ color: mc }}>
        {row.masseyRating !== null ? row.masseyRating.toFixed(2) : '—'}
        <MiniRank rank={r('masseyRtg')} />
      </span>
    }

    case 'flag': {
      const flagCfg = row.outlierFlag ? FLAG_CONFIG[row.outlierFlag] : null
      return flagCfg ? (
        <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: flagCfg.bg, color: flagCfg.color }}>
          {flagCfg.label}
        </span>
      ) : null
    }

    case 'dataStatus': {
      const sCfg = STATUS_CONFIG[row.dataStatus]
      return (
        <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: sCfg.bg, color: sCfg.color }}>
          {sCfg.label}
        </span>
      )
    }

    default:
      return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface BrowseTableProps {
  rows: BrowseRow[]
  sortKey: SortKey | null
  sortDir: 'asc' | 'desc'
  onSort: (key: SortKey) => void
  isLoading?: boolean
  visibleCols: Set<string>
  columnRanks: Map<string, Map<string, number>>
  onTeamMenuOpen: (row: BrowseRow, x: number, y: number) => void
}

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace"

const CELL_PAD: React.CSSProperties = { padding: '5px 9px' }

const TH_BASE: React.CSSProperties = {
  backgroundColor: 'var(--bg-muted)',
  borderBottom: '2px solid var(--border-hi)',
  padding: '0',
  whiteSpace: 'nowrap',
  userSelect: 'none',
  verticalAlign: 'bottom',
}

export default function BrowseTable({ rows, sortKey, sortDir, onSort, isLoading, visibleCols, columnRanks, onTeamMenuOpen }: BrowseTableProps) {
  const sorted = useMemo(() => sortRows(rows, sortKey, sortDir), [rows, sortKey, sortDir])

  // Compute visible column list in order
  const visibleList = useMemo(
    () => ALL_COLUMNS.filter(c => visibleCols.has(c.id)),
    [visibleCols]
  )

  // Determine which cols are first in their group (for group label + border)
  const firstInGroup = useMemo(() => {
    const seen = new Set<ColGroup>()
    const result = new Set<string>()
    for (const col of visibleList) {
      if (!seen.has(col.group)) {
        result.add(col.id)
        seen.add(col.group)
      }
    }
    return result
  }, [visibleList])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px', fontSize: '12px', color: 'var(--text-mid)', fontFamily: MONO }}>
        Loading…
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '120px', fontSize: '12px', color: 'var(--text-mid)', fontFamily: MONO }}>
        No teams match the current filters.
      </div>
    )
  }

  return (
    <div style={{ border: '1px solid var(--border-hi)', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table
          className="browse-table"
          style={{
            width: '100%',
            fontSize: '12px',
            fontFamily: MONO,
            fontVariantNumeric: 'tabular-nums',
            borderCollapse: 'separate',
            borderSpacing: 0,
          }}
        >
          <thead>
            <tr>
              {visibleList.map((col) => {
                const isSticky    = col.sticky
                const sortable    = col.sortKey !== null
                const isActive    = sortable && sortKey === col.sortKey
                const isFirstGroup = firstInGroup.has(col.id)
                const showGroupLabel = isFirstGroup && col.group !== 'team'
                const groupLabel = GROUP_META[col.group].label

                return (
                  <th
                    key={col.id}
                    onClick={sortable ? () => onSort(col.sortKey!) : undefined}
                    className={isFirstGroup && col.group !== 'team' ? 'group-start' : (col.id === 'teamName' ? 'sticky-shadow' : '')}
                    style={{
                      ...TH_BASE,
                      width: col.width,
                      minWidth: col.width,
                      textAlign: col.align,
                      position: isSticky ? 'sticky' : undefined,
                      left: isSticky ? col.stickyLeft : undefined,
                      zIndex: isSticky ? 25 : 10,
                      cursor: sortable ? 'pointer' : 'default',
                    }}
                  >
                    <div style={{ padding: '6px 9px 5px', display: 'flex', flexDirection: 'column', alignItems: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start', gap: '1px' }}>
                      {showGroupLabel && (
                        <span style={{ fontSize: '8px', fontWeight: 400, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-lo)', lineHeight: 1, marginBottom: '2px' }}>
                          {groupLabel}
                        </span>
                      )}
                      <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: isActive ? 'var(--brand)' : 'var(--text-mid)', lineHeight: 1 }}>
                        {col.label}
                        {isActive && <span style={{ marginLeft: '2px' }}>{sortDir === 'desc' ? '↓' : '↑'}</span>}
                      </span>
                      {col.sub && (
                        <span style={{ fontSize: '8px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-disabled)', fontStyle: 'italic', lineHeight: 1 }}>
                          {col.sub}
                        </span>
                      )}
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {sorted.map((row, rowIdx) => (
              <tr key={row.teamSlug} className="browse-row">
                {visibleList.map((col) => {
                  const isSticky     = col.sticky
                  const isFirstGroup = firstInGroup.has(col.id)

                  return (
                    <td
                      key={col.id}
                      className={[
                        isFirstGroup && col.group !== 'team' ? 'group-start' : '',
                        col.id === 'teamName' ? 'sticky-shadow' : '',
                      ].filter(Boolean).join(' ') || undefined}
                      onClick={col.id === 'teamName' ? (e) => {
                        e.stopPropagation()
                        onTeamMenuOpen(row, e.clientX, e.clientY)
                      } : undefined}
                      style={{
                        ...CELL_PAD,
                        textAlign: col.align,
                        position: isSticky ? 'sticky' : undefined,
                        left: isSticky ? col.stickyLeft : undefined,
                        zIndex: isSticky ? 10 : undefined,
                        cursor: col.id === 'teamName' ? 'pointer' : undefined,
                      }}
                    >
                      {renderCell(col, row, rowIdx, columnRanks.get(row.teamSlug))}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
