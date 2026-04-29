'use client'

import type { ConfGroup } from '@/lib/utils/conferenceGroups'
import { CONF_GROUP_LABELS } from '@/lib/utils/conferenceGroups'
import { seasonLabel } from '@/lib/utils/formatting'

export type Division     = 'd1' | 'd2'
export type StatusFilter = 'all' | 'returner' | 'newcomer' | 'departure'
export type QualityFilter = 'all' | 'q1' | 'q2' | 'q3' | 'q4'
export type PosRoleFilter = 'all' | 'Wing G' | 'Combo G' | 'PF/C' | 'C' | 'Wing F' | 'Scoring PG' | 'Stretch 4' | 'Pure PG'
export type YrFilter = 'all' | 'Fr' | 'So' | 'Jr' | 'Sr'

interface PlayerBrowseToolbarProps {
  division: Division
  year: number
  statusFilter: StatusFilter
  posRoleFilter: PosRoleFilter
  yrFilter: YrFilter
  confGroupFilter: ConfGroup
  conference: string
  qualityFilter: QualityFilter
  minShareThreshold: number
  conferences: string[]
  rowCount: number
  filteredCount: number
  onDivisionChange: (d: Division) => void
  onYearChange: (y: number) => void
  onStatusChange: (s: StatusFilter) => void
  onPosRoleChange: (p: PosRoleFilter) => void
  onYrChange: (y: YrFilter) => void
  onConfGroupChange: (g: ConfGroup) => void
  onConferenceChange: (c: string) => void
  onQualityChange: (q: QualityFilter) => void
  onMinShareChange: (n: number) => void
  playerQuery: string
  onPlayerQueryChange: (q: string) => void
  onColumnsClick: () => void
  columnsOpen: boolean
}

const SEASONS = [2026, 2025, 2024, 2023, 2022]
const CONF_GROUPS: ConfGroup[] = ['all', 'power', 'major-mid', 'mid-major', 'independent']
const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace"

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'returner',  label: 'Returner' },
  { value: 'newcomer',  label: 'Newcomer' },
  { value: 'departure', label: 'Departure' },
]
const POS_ROLE_OPTIONS: { value: PosRoleFilter; label: string }[] = [
  { value: 'all', label: 'All Roles' },
  { value: 'Wing G', label: 'Wing G' },
  { value: 'Combo G', label: 'Combo G' },
  { value: 'Scoring PG', label: 'Scoring PG' },
  { value: 'Pure PG', label: 'Pure PG' },
  { value: 'Wing F', label: 'Wing F' },
  { value: 'Stretch 4', label: 'Stretch 4' },
  { value: 'PF/C', label: 'PF/C' },
  { value: 'C', label: 'C' },
]
const YR_OPTIONS: { value: YrFilter; label: string }[] = [
  { value: 'all', label: 'All Classes' },
  { value: 'Fr',  label: 'Freshman' },
  { value: 'So',  label: 'Sophomore' },
  { value: 'Jr',  label: 'Junior' },
  { value: 'Sr',  label: 'Senior' },
]
const QUALITY_OPTIONS: { value: QualityFilter; label: string; title: string }[] = [
  { value: 'all', label: 'Quality', title: 'All teams' },
  { value: 'q1',  label: 'Q1',  title: 'Q1: rank 1–75' },
  { value: 'q2',  label: 'Q2',  title: 'Q2: rank 76–150' },
  { value: 'q3',  label: 'Q3',  title: 'Q3: rank 151–250' },
  { value: 'q4',  label: 'Q4',  title: 'Q4: rank 251+' },
]
const MIN_SHARE_OPTS = [
  { value: 0,   label: 'All min%' },
  { value: 3,   label: '≥3% min' },
  { value: 5,   label: '≥5% min' },
  { value: 8,   label: '≥8% min' },
  { value: 12,  label: '≥12% min' },
]

const SEG_BASE: React.CSSProperties = {
  fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const,
  letterSpacing: '0.06em', padding: '4px 10px', borderRadius: '4px',
  border: 'none', cursor: 'pointer', transition: 'all 0.1s', lineHeight: 1, fontFamily: MONO,
}
const SEG_ACTIVE: React.CSSProperties   = { ...SEG_BASE, backgroundColor: 'var(--bg-surface)', color: 'var(--text-strong)', boxShadow: 'var(--shadow-sm)' }
const SEG_INACTIVE: React.CSSProperties = { ...SEG_BASE, backgroundColor: 'transparent', color: 'var(--text-mid)' }
const SELECT: React.CSSProperties = {
  fontSize: '11px', fontWeight: 500, padding: '4px 10px', borderRadius: '6px',
  border: '1px solid var(--border-hi)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-strong)',
  appearance: 'none' as const, cursor: 'pointer', lineHeight: 1.4, fontFamily: MONO,
}

const DIVISION_OPTIONS: { value: Division; label: string }[] = [
  { value: 'd1', label: 'D1' },
  { value: 'd2', label: 'D2' },
]

export default function PlayerBrowseToolbar({
  division, year, statusFilter, posRoleFilter, yrFilter, confGroupFilter,
  conference, qualityFilter, minShareThreshold,
  conferences, rowCount, filteredCount,
  onDivisionChange, onYearChange, onStatusChange, onPosRoleChange, onYrChange,
  onConfGroupChange, onConferenceChange, onQualityChange, onMinShareChange,
  playerQuery, onPlayerQueryChange, onColumnsClick, columnsOpen,
}: PlayerBrowseToolbarProps) {
  const divider = <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-hi)', margin: '0 2px' }} />
  const isD2 = division === 'd2'

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>

      {/* Division toggle */}
      <div style={{ display: 'flex', padding: '2px', borderRadius: '6px', backgroundColor: 'var(--bg-subtle)' }}>
        {DIVISION_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => onDivisionChange(opt.value)}
            style={division === opt.value ? SEG_ACTIVE : SEG_INACTIVE}>
            {opt.label}
          </button>
        ))}
      </div>

      {/* Season */}
      <select value={year} onChange={e => onYearChange(Number(e.target.value))} style={SELECT}>
        {SEASONS.map(s => <option key={s} value={s}>{seasonLabel(s)}</option>)}
      </select>

      {divider}

      {/* Status segment */}
      <div style={{ display: 'flex', padding: '2px', borderRadius: '6px', backgroundColor: 'var(--bg-subtle)' }}>
        {STATUS_OPTIONS.map(opt => (
          <button key={opt.value} onClick={() => onStatusChange(opt.value)}
            style={statusFilter === opt.value ? SEG_ACTIVE : SEG_INACTIVE}>
            {opt.label}
          </button>
        ))}
      </div>

      {divider}

      {/* Pos role — D1 only (T-Rank) */}
      {!isD2 && (
        <select value={posRoleFilter} onChange={e => onPosRoleChange(e.target.value as PosRoleFilter)} style={{ ...SELECT, minWidth: '100px' }}>
          {POS_ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      {/* Class year — D1 only (T-Rank) */}
      {!isD2 && (
        <select value={yrFilter} onChange={e => onYrChange(e.target.value as YrFilter)} style={{ ...SELECT, minWidth: '104px' }}>
          {YR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}

      {(!isD2) && divider}

      {/* Conf group — D1 only (D2 all falls to mid-major) */}
      {!isD2 && (
        <select value={confGroupFilter} onChange={e => onConfGroupChange(e.target.value as ConfGroup)} style={{ ...SELECT, minWidth: '112px' }}>
          {CONF_GROUPS.map(g => <option key={g} value={g}>{CONF_GROUP_LABELS[g]}</option>)}
        </select>
      )}

      {/* Conference */}
      <select value={conference} onChange={e => onConferenceChange(e.target.value)} style={{ ...SELECT, minWidth: '130px', color: conference ? 'var(--text-strong)' : 'var(--text-mid)' }}>
        <option value="">All Conferences</option>
        {conferences.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      {/* Quality — D1 only (ratings-based) */}
      {!isD2 && (
        <select value={qualityFilter} onChange={e => onQualityChange(e.target.value as QualityFilter)} style={{ ...SELECT, minWidth: '80px' }}>
          {QUALITY_OPTIONS.map(o => <option key={o.value} value={o.value} title={o.title}>{o.label}</option>)}
        </select>
      )}

      {/* Min share threshold */}
      <select value={minShareThreshold} onChange={e => onMinShareChange(Number(e.target.value))} style={{ ...SELECT, minWidth: '88px' }}>
        {MIN_SHARE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>

      {divider}

      {/* Columns */}
      <button onClick={onColumnsClick} style={{
        ...SEG_BASE,
        backgroundColor: columnsOpen ? 'var(--brand-dim)' : 'transparent',
        color: columnsOpen ? 'var(--brand)' : 'var(--text-label)',
        border: '1px solid', borderColor: columnsOpen ? 'rgba(37,99,235,0.2)' : 'var(--border-hi)',
        borderRadius: '6px', padding: '4px 10px',
      }}>
        Columns ▾
      </button>

      {/* Player search */}
      <div style={{ marginLeft: 'auto', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-lo)', pointerEvents: 'none' }}>⌕</span>
        <input
          value={playerQuery}
          onChange={e => onPlayerQueryChange(e.target.value)}
          placeholder="Search players…"
          autoComplete="off"
          style={{ ...SELECT, padding: '4px 10px 4px 26px', width: '180px', outline: 'none' }}
        />
      </div>

      {/* Count */}
      <span style={{ fontSize: '11px', color: 'var(--text-mid)', fontFamily: MONO }}>
        {filteredCount !== rowCount
          ? <>{filteredCount.toLocaleString()} of {rowCount.toLocaleString()} players</>
          : <>{rowCount.toLocaleString()} players</>
        }
      </span>
    </div>
  )
}
