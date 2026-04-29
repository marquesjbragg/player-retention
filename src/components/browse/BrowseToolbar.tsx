'use client'

import type { BrowseRow } from '@/lib/types'
import type { ConfGroup } from '@/lib/utils/conferenceGroups'
import { CONF_GROUP_LABELS } from '@/lib/utils/conferenceGroups'
import { seasonLabel } from '@/lib/utils/formatting'
import TeamSearchBar from './TeamSearchBar'
import PlayerSearchBar from './PlayerSearchBar'

export type QualityFilter = 'all' | 'q1' | 'q2' | 'q3' | 'q4' | 'unranked'

interface BrowseToolbarProps {
  division: 'D1' | 'D2'
  season: number
  conference: string
  qualityFilter: QualityFilter
  confGroupFilter: ConfGroup
  conferences: string[]
  rows: BrowseRow[]
  rowCount: number
  filteredCount: number
  coverage: { full: number; statsOnly: number; noPlayerData: number; unavailable: number } | null
  hideEmpty: boolean
  onDivisionChange: (d: 'D1' | 'D2') => void
  onSeasonChange: (s: number) => void
  onConferenceChange: (c: string) => void
  onQualityFilterChange: (f: QualityFilter) => void
  onConfGroupFilterChange: (g: ConfGroup) => void
  onHideEmptyToggle: () => void
  onColumnsClick: () => void
  columnsOpen: boolean
}

const D1_SEASONS = [2026, 2025, 2024, 2023, 2022]
const D2_SEASONS = [2026, 2025, 2024, 2023, 2022]

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace"

const SEG_BASE: React.CSSProperties = {
  fontSize: '10px',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  padding: '4px 10px',
  borderRadius: '4px',
  border: 'none',
  cursor: 'pointer',
  transition: 'all 0.1s',
  lineHeight: 1,
  fontFamily: MONO,
}

const SEG_ACTIVE: React.CSSProperties   = { ...SEG_BASE, backgroundColor: 'var(--bg-surface)', color: 'var(--text-strong)', boxShadow: 'var(--shadow-sm)' }
const SEG_INACTIVE: React.CSSProperties = { ...SEG_BASE, backgroundColor: 'transparent', color: 'var(--text-mid)' }

const SELECT_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 500,
  padding: '4px 10px',
  borderRadius: '6px',
  border: '1px solid var(--border-hi)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-strong)',
  appearance: 'none' as const,
  cursor: 'pointer',
  lineHeight: 1.4,
  fontFamily: MONO,
}

const QUALITY_SEGMENTS: { value: QualityFilter; label: string; title: string }[] = [
  { value: 'all',      label: 'Quality',  title: 'All teams' },
  { value: 'q1',       label: 'Q1',       title: 'Q1: rank 1–75' },
  { value: 'q2',       label: 'Q2',       title: 'Q2: rank 76–150' },
  { value: 'q3',       label: 'Q3',       title: 'Q3: rank 151–250' },
  { value: 'q4',       label: 'Q4',       title: 'Q4: rank 251+' },
  { value: 'unranked', label: 'Unranked', title: 'Unranked: no Massey or net rating' },
]

const CONF_GROUP_SEGMENTS: ConfGroup[] = ['all', 'power', 'major-mid', 'mid-major', 'independent']

export default function BrowseToolbar({
  division, season, conference, qualityFilter, confGroupFilter,
  conferences, rows, rowCount, filteredCount, coverage,
  hideEmpty,
  onDivisionChange, onSeasonChange, onConferenceChange,
  onQualityFilterChange, onConfGroupFilterChange,
  onHideEmptyToggle,
  onColumnsClick, columnsOpen,
}: BrowseToolbarProps) {
  const divider = <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-hi)', margin: '0 2px' }} />
  const isD2 = division === 'D2'
  const seasons = isD2 ? D2_SEASONS : D1_SEASONS

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>

      {/* Division toggle */}
      <div style={{ display: 'flex', padding: '2px', borderRadius: '6px', backgroundColor: 'var(--bg-subtle)' }}>
        {(['D1', 'D2'] as const).map(d => (
          <button
            key={d}
            onClick={() => onDivisionChange(d)}
            style={division === d ? SEG_ACTIVE : SEG_INACTIVE}
          >
            {d}
          </button>
        ))}
      </div>

      {divider}

      {/* Season select */}
      <select value={season} onChange={e => onSeasonChange(Number(e.target.value))} style={SELECT_STYLE}>
        {seasons.map(s => <option key={s} value={s}>{seasonLabel(s)}</option>)}
      </select>

      {/* Conference select */}
      <select
        value={conference}
        onChange={e => onConferenceChange(e.target.value)}
        style={{ ...SELECT_STYLE, minWidth: '130px', color: conference ? 'var(--text-strong)' : 'var(--text-mid)' }}
      >
        <option value="">All Conferences</option>
        {conferences.map(c => <option key={c} value={c}>{c}</option>)}
      </select>

      {divider}

      {/* Conference type and quality dropdowns — D1 only */}
      {!isD2 && (
        <>
          <select
            value={confGroupFilter}
            onChange={e => onConfGroupFilterChange(e.target.value as ConfGroup)}
            style={{ ...SELECT_STYLE, minWidth: '112px' }}
          >
            {CONF_GROUP_SEGMENTS.map(g => (
              <option key={g} value={g}>{CONF_GROUP_LABELS[g]}</option>
            ))}
          </select>

          <select
            value={qualityFilter}
            onChange={e => onQualityFilterChange(e.target.value as QualityFilter)}
            style={{ ...SELECT_STYLE, minWidth: '96px' }}
          >
            {QUALITY_SEGMENTS.map(seg => (
              <option key={seg.value} value={seg.value} title={seg.title}>{seg.label}</option>
            ))}
          </select>

          {divider}
        </>
      )}
      {isD2 && divider}

      {/* Hide n/a toggle */}
      <button
        onClick={onHideEmptyToggle}
        style={{
          ...SEG_BASE,
          backgroundColor: hideEmpty ? 'var(--brand-dim)' : 'transparent',
          color: hideEmpty ? 'var(--brand)' : 'var(--text-label)',
          border: '1px solid',
          borderColor: hideEmpty ? 'rgba(37,99,235,0.2)' : 'var(--border-hi)',
          borderRadius: '6px',
          padding: '4px 10px',
        }}
      >
        Hide n/a
      </button>

      {/* Filters (column visibility) toggle */}
      <button
        onClick={onColumnsClick}
        style={{
          ...SEG_BASE,
          backgroundColor: columnsOpen ? 'var(--brand-dim)' : 'transparent',
          color: columnsOpen ? 'var(--brand)' : 'var(--text-label)',
          border: '1px solid',
          borderColor: columnsOpen ? 'rgba(37,99,235,0.2)' : 'var(--border-hi)',
          borderRadius: '6px',
          padding: '4px 10px',
        }}
      >
        Filters ▾
      </button>

      {/* Search: team + player */}
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <TeamSearchBar rows={rows} />
        <PlayerSearchBar rows={rows} />
      </div>

      {/* Row count + coverage */}
      <span style={{ fontSize: '11px', color: 'var(--text-mid)', fontFamily: MONO }}>
        {filteredCount !== rowCount
          ? <>{filteredCount.toLocaleString()} of {rowCount.toLocaleString()} teams</>
          : <>{rowCount.toLocaleString()} teams</>
        }
        {coverage && (
          <span style={{ color: 'var(--text-lo)', marginLeft: '6px' }}>
            · {coverage.full} full · {coverage.statsOnly} stats-only · {coverage.unavailable} n/a
          </span>
        )}
      </span>
    </div>
  )
}
