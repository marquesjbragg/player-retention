'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { usePlayerBrowse } from '@/hooks/usePlayerBrowse'
import PlayerBrowseToolbar, {
  type Division, type StatusFilter, type PosRoleFilter, type YrFilter, type QualityFilter,
} from './PlayerBrowseToolbar'
import {
  PlayerBrowseTable, ALL_COLUMNS, DEFAULT_VISIBLE,
  type SortKey, type ColumnId, type ColDef,
} from './PlayerBrowseTable'
import type { PlayerBrowseRow } from '@/hooks/usePlayerBrowse'
import type { ConfGroup } from '@/lib/utils/conferenceGroups'
import { getConfGroup } from '@/lib/utils/conferenceGroups'

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace"

const ALL_POPOVER_GROUPS: { id: string; label: string; cols: ColDef[] }[] = [
  { id: 'identity',   label: 'Identity',    cols: ALL_COLUMNS.filter(c => c.group === 'identity'   && !c.always) },
  { id: 'continuity', label: 'Continuity',  cols: ALL_COLUMNS.filter(c => c.group === 'continuity') },
  { id: 'efficiency', label: 'Efficiency',  cols: ALL_COLUMNS.filter(c => c.group === 'efficiency') },
  { id: 'context',    label: 'Context',     cols: ALL_COLUMNS.filter(c => c.group === 'context')    },
]

// T-Rank columns are always null for D2 — hide them from the popover and default visible set
const D2_TRANK_COLS = new Set<ColumnId>(['posRole', 'yr', 'ht', 'usg', 'bpm', 'obpm', 'dbpm', 'ortg', 'drtg'])

const D2_DEFAULT_VISIBLE: Set<ColumnId> = new Set<ColumnId>([
  'player', 'team', 'status', 'roleTier',
  'minShare', 'ptsShare', 'minShareDelta', 'ptsShareDelta',
  'tsPct', 'teamCi', 'teamFlag',
])

function qualityTier(row: PlayerBrowseRow): QualityFilter {
  const rank = row.teamMasseyRank ?? row.teamRatingsRank
  if (rank === null) return 'all'
  if (rank <= 75)  return 'q1'
  if (rank <= 150) return 'q2'
  if (rank <= 250) return 'q3'
  return 'q4'
}

function normSearch(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function PlayerBrowsePage() {
  const [division, setDivision]               = useState<Division>('d1')
  const [year, setYear]                       = useState(2026)
  const [status, setStatus]                   = useState<StatusFilter>('all')
  const [posRole, setPosRole]                 = useState<PosRoleFilter>('all')
  const [yr, setYr]                           = useState<YrFilter>('all')
  const [confGroup, setConfGroup]             = useState<ConfGroup>('all')
  const [conference, setConference]           = useState('')
  const [quality, setQuality]                 = useState<QualityFilter>('all')
  const [minShareThreshold, setMinShare]      = useState(5)
  const [playerQuery, setPlayerQuery]         = useState('')
  const [displayLimit, setDisplayLimit]       = useState(250)
  const [sortKey, setSortKey]                 = useState<SortKey | null>('minShare')
  const [sortDir, setSortDir]                 = useState<'asc' | 'desc'>('desc')
  const [visibleCols, setVisibleCols]         = useState<Set<ColumnId>>(DEFAULT_VISIBLE)
  const [columnsOpen, setColumnsOpen]         = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  const { data, isPending, isError, error } = usePlayerBrowse(year, division)

  useEffect(() => {
    if (!columnsOpen) return
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setColumnsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [columnsOpen])

  const conferences = useMemo(() => {
    if (!data) return []
    return Array.from(new Set(data.map(r => r.conference))).sort()
  }, [data])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = normSearch(playerQuery)
    return data.filter(row => {
      if (status !== 'all' && row.status !== status) return false
      if (posRole !== 'all' && row.positionRole !== posRole) return false
      if (yr !== 'all' && row.yr !== yr) return false
      if (confGroup !== 'all' && getConfGroup(row.conference) !== confGroup) return false
      if (conference && row.conference !== conference) return false
      if (quality !== 'all' && qualityTier(row) !== quality) return false
      if (row.minShare < minShareThreshold && row.status !== 'departure') return false
      if (q.length >= 2 && !normSearch(row.playerName).includes(q)) return false
      return true
    })
  }, [data, status, posRole, yr, confGroup, conference, quality, minShareThreshold, playerQuery])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      // Text columns sort asc by default; numeric columns desc
      setSortDir(['playerName', 'teamName', 'positionRole', 'yr', 'status'].includes(key) ? 'asc' : 'desc')
    }
  }

  function handleDivisionChange(div: Division) {
    setDivision(div)
    setPosRole('all')
    setYr('all')
    setQuality('all')
    setConfGroup('all')
    setConference('')
    setDisplayLimit(250)
    setVisibleCols(div === 'd2' ? D2_DEFAULT_VISIBLE : DEFAULT_VISIBLE)
  }

  function handleYearChange(y: number) {
    setYear(y)
    setConference('')
    setDisplayLimit(250)
  }

  function toggleCol(id: ColumnId) {
    const col = ALL_COLUMNS.find(c => c.id === id)
    if (!col || col.always) return
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleGroup(groupId: string) {
    const group = popoverGroups.find(g => g.id === groupId)
    if (!group) return
    const allVis = group.cols.every(c => visibleCols.has(c.id))
    setVisibleCols(prev => {
      const next = new Set(prev)
      group.cols.forEach(c => allVis ? next.delete(c.id) : next.add(c.id))
      return next
    })
  }

  const popoverGroups = division === 'd2'
    ? ALL_POPOVER_GROUPS
        .map(g => ({ ...g, cols: g.cols.filter(c => !D2_TRANK_COLS.has(c.id)) }))
        .filter(g => g.cols.length > 0)
    : ALL_POPOVER_GROUPS

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '16px 24px 60px', fontFamily: MONO }}>

      {/* Page label */}
      <div style={{ marginBottom: '10px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-mid)' }}>
          Players · Player Retention
        </span>
        <span style={{ marginLeft: '10px', fontSize: '10px', color: 'var(--text-disabled)' }}>
          which players matter most to the continuity story
        </span>
      </div>

      {isError && (
        <div style={{ fontSize: '12px', color: 'var(--negative)', marginBottom: '12px' }}>
          Failed to load player data: {(error as Error)?.message ?? 'Unknown error'}
        </div>
      )}

      {/* Toolbar + Columns popover */}
      <div style={{ position: 'relative' }} ref={popoverRef}>
        <PlayerBrowseToolbar
          division={division}
          year={year}
          statusFilter={status}
          posRoleFilter={posRole}
          yrFilter={yr}
          confGroupFilter={confGroup}
          conference={conference}
          qualityFilter={quality}
          minShareThreshold={minShareThreshold}
          conferences={conferences}
          rowCount={data?.length ?? 0}
          filteredCount={filtered.length}
          onDivisionChange={handleDivisionChange}
          onYearChange={handleYearChange}
          onStatusChange={setStatus}
          onPosRoleChange={setPosRole}
          onYrChange={setYr}
          onConfGroupChange={setConfGroup}
          onConferenceChange={setConference}
          onQualityChange={setQuality}
          onMinShareChange={setMinShare}
          playerQuery={playerQuery}
          onPlayerQueryChange={setPlayerQuery}
          onColumnsClick={() => setColumnsOpen(o => !o)}
          columnsOpen={columnsOpen}
        />

        {/* Columns popover */}
        {columnsOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 100,
            backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-hi)',
            borderRadius: '8px', boxShadow: 'var(--shadow-menu)',
            padding: '14px 16px', minWidth: '340px', maxWidth: '520px', marginTop: '4px',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-mid)', marginBottom: '12px' }}>
              Column Visibility
            </div>
            {popoverGroups.map(group => {
              const allVis = group.cols.every(c => visibleCols.has(c.id))
              const someVis = group.cols.some(c => visibleCols.has(c.id))
              return (
                <div key={group.id} style={{ marginBottom: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '5px' }}>
                    <input type="checkbox" checked={allVis}
                      ref={el => { if (el) el.indeterminate = someVis && !allVis }}
                      onChange={() => toggleGroup(group.id)}
                      style={{ width: '13px', height: '13px', accentColor: 'var(--brand)', cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-strong)' }}>{group.label}</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '20px' }}>
                    {group.cols.map(col => (
                      <label key={col.id} style={{
                        display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer',
                        padding: '2px 6px', borderRadius: '4px', backgroundColor: visibleCols.has(col.id) ? 'var(--brand-dim)' : 'var(--bg-muted)',
                        border: '1px solid', borderColor: visibleCols.has(col.id) ? 'rgba(37,99,235,0.15)' : 'transparent',
                      }}>
                        <input type="checkbox" checked={visibleCols.has(col.id)} onChange={() => toggleCol(col.id)}
                          style={{ width: '11px', height: '11px', accentColor: 'var(--brand)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '10px', color: visibleCols.has(col.id) ? 'var(--brand)' : 'var(--text-label)' }}>{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px', display: 'flex', gap: '8px' }}>
              <button onClick={() => setVisibleCols(DEFAULT_VISIBLE)} style={{ fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-hi)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-label)', cursor: 'pointer', fontFamily: MONO }}>
                Reset
              </button>
              <button onClick={() => setColumnsOpen(false)} style={{ fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--brand)', color: 'white', cursor: 'pointer', fontFamily: MONO }}>
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      <PlayerBrowseTable
        rows={filtered.slice(0, displayLimit)}
        isLoading={isPending}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        visibleCols={visibleCols}
      />

      {!isPending && filtered.length > displayLimit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', padding: '8px 0' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-mid)', fontFamily: MONO }}>
            Showing {displayLimit.toLocaleString()} of {filtered.length.toLocaleString()}
          </span>
          {[50, 100, 250].map(n => {
            const next = displayLimit + n
            if (next - n >= filtered.length) return null
            return (
              <button key={n} onClick={() => setDisplayLimit(d => d + n)} style={{
                fontSize: '10px', fontWeight: 600, padding: '3px 10px', borderRadius: '4px',
                border: '1px solid var(--border-hi)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-label)',
                cursor: 'pointer', fontFamily: MONO,
              }}>
                +{n}
              </button>
            )
          })}
          <button onClick={() => setDisplayLimit(filtered.length)} style={{
            fontSize: '10px', fontWeight: 600, padding: '3px 10px', borderRadius: '4px',
            border: '1px solid var(--border-hi)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-label)',
            cursor: 'pointer', fontFamily: MONO,
          }}>
            Show all
          </button>
        </div>
      )}
    </div>
  )
}
