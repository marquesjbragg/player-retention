'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { useBrowse } from '@/hooks/useBrowse'
import BrowseToolbar, { type QualityFilter } from './BrowseToolbar'
import BrowseTable, { type SortKey, ALL_COLUMNS, DEFAULT_VISIBLE_COLS, getDefaultVisibleCols, type ColGroup } from './BrowseTable'
import TeamRowMenu, { type TeamMenuState } from './TeamRowMenu'
import { getConfGroup, type ConfGroup } from '@/lib/utils/conferenceGroups'
import { computeColumnRanks } from '@/lib/utils/columnRanks'
import type { BrowseRow } from '@/lib/types'

// ─── Column group config (for the Filters popover) ────────────────────────────

const POPOVER_GROUPS: { id: ColGroup; label: string; description: string }[] = [
  { id: 'continuity', label: 'Continuity',  description: 'CI, returning min/pts/starts, departing min/pts' },
  { id: 'newcomers',  label: 'Newcomers',   description: 'New min%, new pts%, roster counts' },
  { id: 'season',     label: 'Season',      description: 'Win%, PPG, and opponent PPG deltas' },
  { id: 'context',    label: 'Context',     description: 'Flag, net rating, Massey, rank, status' },
]

const COL_LABELS: Record<string, string> = {
  ci:          'CI (index)',
  retMin:      'Ret. Min%',
  retPts:      'Ret. Pts%',
  retStarts:   'Ret. Starts%',
  deptMin:     'Dept. Min%',
  deptPts:     'Dept. Pts%',
  newMin:      'New Min%',
  newPts:      'New Pts%',
  returners:   'Returners',
  newPlayers:  'Newcomers',
  year1Wpct:   'Y1 Win%',
  year2Wpct:   'Y2 Win%',
  wpctDelta:   'W% Δ',
  ppgDelta:    'PPG Δ',
  oppPpgDelta: 'Opp PPG Δ',
  ratingsRank: 'Net Rank',
  ratingsRtg:  'Net Rtg',
  masseyRank:  'Massey Rank',
  masseyRtg:   'Massey Rtg',
  flag:        'Flag',
  dataStatus:  'Status',
}

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace"

// ─── Explainer card ───────────────────────────────────────────────────────────

function ExplainerCard({ label, body }: { label: string; body: string }) {
  return (
    <div style={{
      flex: '1 1 200px',
      minWidth: '160px',
      maxWidth: '280px',
      border: '1px solid var(--border-hi)',
      borderRadius: '6px',
      padding: '10px 12px',
      backgroundColor: 'var(--bg-surface)',
    }}>
      <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--brand)', marginBottom: '5px', fontFamily: MONO }}>
        {label}
      </div>
      <div style={{ fontSize: '11px', color: 'var(--text-label)', lineHeight: 1.5, fontFamily: MONO }}>
        {body}
      </div>
    </div>
  )
}

// ─── Persist helpers ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'browse-state'

interface SavedState {
  division?: 'D1' | 'D2'
  season?: number
  conference?: string
  qualityFilter?: QualityFilter
  confGroupFilter?: ConfGroup
  sortKey?: SortKey | null
  sortDir?: 'asc' | 'desc'
  visibleCols?: string[]
}

function loadSavedState(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as SavedState) : null
  } catch {
    return null
  }
}

function saveState(s: SavedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch { /* ignore */ }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function BrowsePage() {
  const [division, setDivision]           = useState<'D1' | 'D2'>('D1')
  const [season, setSeason]               = useState<number>(2026)
  const [conference, setConference]       = useState<string>('')
  const [qualityFilter, setQuality]       = useState<QualityFilter>('all')
  const [confGroupFilter, setConfGroup]   = useState<ConfGroup>('all')
  const [sortKey, setSortKey]             = useState<SortKey | null>('continuityIndex')
  const [sortDir, setSortDir]             = useState<'asc' | 'desc'>('desc')
  const [columnsOpen, setColumnsOpen]     = useState(false)
  const [visibleCols, setVisibleCols]     = useState<Set<string>>(DEFAULT_VISIBLE_COLS)
  const [hideEmpty, setHideEmpty]         = useState(false)
  const [menuState, setMenuState]         = useState<TeamMenuState | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  const { data, isPending, isError, error } = useBrowse(division, season)

  // Restore state from localStorage on mount
  useEffect(() => {
    const saved = loadSavedState()
    if (!saved) return
    if (saved.division === 'D1' || saved.division === 'D2') setDivision(saved.division)
    if (typeof saved.season === 'number') setSeason(saved.season)
    if (typeof saved.conference === 'string') setConference(saved.conference)
    if (saved.qualityFilter) setQuality(saved.qualityFilter)
    if (saved.confGroupFilter) setConfGroup(saved.confGroupFilter)
    if (saved.sortKey !== undefined) setSortKey(saved.sortKey)
    if (saved.sortDir) setSortDir(saved.sortDir)
    if (Array.isArray(saved.visibleCols)) setVisibleCols(new Set(saved.visibleCols))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist state on every change
  useEffect(() => {
    saveState({ division, season, conference, qualityFilter, confGroupFilter, sortKey, sortDir, visibleCols: Array.from(visibleCols) })
  }, [division, season, conference, qualityFilter, confGroupFilter, sortKey, sortDir, visibleCols])

  // Close columns popover on outside click
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

  // Derive conference list from fetched rows
  const conferences = useMemo(() => {
    if (!data?.rows) return []
    const seen = new Set<string>()
    data.rows.forEach(r => seen.add(r.conference))
    return Array.from(seen).sort()
  }, [data?.rows])

  // Quality tier helper: Massey rank preferred, falls back to net rank
  function qualityTier(row: { masseyRank: number | null; ratingsRank: number | null }): QualityFilter {
    const rank = row.masseyRank ?? row.ratingsRank
    if (rank === null) return 'unranked'
    if (rank <= 75)  return 'q1'
    if (rank <= 150) return 'q2'
    if (rank <= 250) return 'q3'
    return 'q4'
  }

  // Client-side filtering
  const filteredRows = useMemo(() => {
    if (!data?.rows) return []
    return data.rows.filter(row => {
      if (hideEmpty && row.dataStatus === 'unavailable') return false
      if (conference && row.conference !== conference) return false
      if (confGroupFilter !== 'all' && getConfGroup(row.conference) !== confGroupFilter) return false
      if (qualityFilter !== 'all' && qualityTier(row) !== qualityFilter) return false
      return true
    })
  }, [data?.rows, conference, confGroupFilter, qualityFilter, hideEmpty])

  // Column ranks computed over ALL rows (pre-filter) so rank 1 always means #1 among all loaded teams
  const columnRanks = useMemo(() => {
    if (!data?.rows) return new Map<string, Map<string, number>>()
    return computeColumnRanks(data.rows)
  }, [data?.rows])

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir(key === 'teamName' || key === 'ratingsRank' || key === 'masseyRank' || key === 'outlierFlag' ? 'asc' : 'desc')
    }
  }

  function handleDivisionChange(d: 'D1' | 'D2') {
    setDivision(d)
    setConference('')
    setQuality('all')
    setConfGroup('all')
    setVisibleCols(getDefaultVisibleCols(d))
    setSortKey('continuityIndex')
    setSortDir('desc')
    if (d === 'D2' && season > 2026) setSeason(2026)
    if (d === 'D1' && season < 2022) setSeason(2026)
  }

  function handleSeasonChange(s: number) {
    setSeason(s)
    setConference('')
    setQuality('all')
    setConfGroup('all')
  }

  function toggleCol(id: string) {
    const col = ALL_COLUMNS.find(c => c.id === id)
    if (!col || col.always) return
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  function toggleGroup(groupId: ColGroup) {
    const groupCols = ALL_COLUMNS.filter(c => c.group === groupId && !c.always)
    const allVisible = groupCols.every(c => visibleCols.has(c.id))
    setVisibleCols(prev => {
      const next = new Set(prev)
      groupCols.forEach(c => {
        if (allVisible) { next.delete(c.id) } else { next.add(c.id) }
      })
      return next
    })
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '16px 24px 60px', fontFamily: MONO }}>

      {/* Page label */}
      <div style={{ marginBottom: '10px' }}>
        <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-lo)' }}>
          Browse · Player Retention
        </span>
      </div>

      {/* Context explainer */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <ExplainerCard
          label="Continuity Index (CI)"
          body="0–100 score. What fraction of a team's Year 1 production (minutes, starts, points) returned in Year 2. Higher = more returning production."
        />
        <ExplainerCard
          label="Returning Production"
          body="Ret. Min% and Ret. Pts%: share of Year 1 minutes/points played by returning players. Core components of CI."
        />
        <ExplainerCard
          label="Newcomer Production"
          body="New Min% and New Pts%: share of Year 2 minutes/points contributed by new players (transfers, freshmen, walk-ons)."
        />
        <ExplainerCard
          label="Pattern Flags"
          body="Low ↑: low CI + improved (overachieved). High ↓: high CI + declined (underperformed). All tiers flag at W% Δ > ±5 pp."
        />
      </div>

      {/* Error state */}
      {isError && (
        <div style={{ fontSize: '12px', color: 'var(--negative)', marginBottom: '12px' }}>
          Failed to load data: {(error as Error)?.message ?? 'Unknown error'}
        </div>
      )}

      {/* Toolbar + Filters popover wrapper */}
      <div style={{ position: 'relative' }} ref={popoverRef}>
        <BrowseToolbar
          division={division}
          season={season}
          conference={conference}
          qualityFilter={qualityFilter}
          confGroupFilter={confGroupFilter}
          conferences={conferences}
          rows={data?.rows ?? []}
          rowCount={data?.rows.length ?? 0}
          filteredCount={filteredRows.length}
          coverage={data?.coverage ?? null}
          hideEmpty={hideEmpty}
          onDivisionChange={handleDivisionChange}
          onSeasonChange={handleSeasonChange}
          onConferenceChange={setConference}
          onQualityFilterChange={setQuality}
          onConfGroupFilterChange={setConfGroup}
          onHideEmptyToggle={() => setHideEmpty(v => !v)}
          onColumnsClick={() => setColumnsOpen(o => !o)}
          columnsOpen={columnsOpen}
        />

        {/* Filters popover */}
        {columnsOpen && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-hi)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-md)',
            padding: '14px 16px',
            minWidth: '320px',
            maxWidth: '480px',
            marginTop: '4px',
          }}>
            <div style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-mid)', marginBottom: '12px' }}>
              Filters
            </div>

            {POPOVER_GROUPS.map(group => {
              const groupCols = ALL_COLUMNS.filter(c => c.group === group.id && !c.always)
              const allVisible = groupCols.every(c => visibleCols.has(c.id))
              const someVisible = groupCols.some(c => visibleCols.has(c.id))

              return (
                <div key={group.id} style={{ marginBottom: '12px' }}>
                  {/* Group header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={allVisible}
                        ref={el => { if (el) el.indeterminate = someVisible && !allVisible }}
                        onChange={() => toggleGroup(group.id)}
                        style={{ width: '13px', height: '13px', accentColor: 'var(--brand)', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-hi)' }}>{group.label}</span>
                    </label>
                    <span style={{ fontSize: '10px', color: 'var(--text-lo)' }}>{group.description}</span>
                  </div>

                  {/* Individual columns */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', paddingLeft: '20px' }}>
                    {groupCols.map(col => (
                      <label
                        key={col.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: '2px 6px', borderRadius: '4px', backgroundColor: visibleCols.has(col.id) ? 'var(--brand-dim)' : 'var(--bg-muted)', border: '1px solid', borderColor: visibleCols.has(col.id) ? 'rgba(37,99,235,0.15)' : 'transparent' }}
                      >
                        <input
                          type="checkbox"
                          checked={visibleCols.has(col.id)}
                          onChange={() => toggleCol(col.id)}
                          style={{ width: '11px', height: '11px', accentColor: 'var(--brand)', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '10px', color: visibleCols.has(col.id) ? 'var(--brand)' : 'var(--text-label)' }}>
                          {COL_LABELS[col.id] ?? col.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '4px', display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setVisibleCols(DEFAULT_VISIBLE_COLS)}
                style={{ fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-hi)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-label)', cursor: 'pointer', fontFamily: MONO }}
              >
                Reset to default
              </button>
              <button
                onClick={() => setColumnsOpen(false)}
                style={{ fontSize: '10px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', border: 'none', backgroundColor: 'var(--brand)', color: 'white', cursor: 'pointer', fontFamily: MONO }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      <BrowseTable
        rows={filteredRows}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        isLoading={isPending}
        visibleCols={visibleCols}
        columnRanks={columnRanks}
        onTeamMenuOpen={(row: BrowseRow, x: number, y: number) => setMenuState({ row, x, y })}
      />

      {menuState && (
        <TeamRowMenu
          state={menuState}
          onClose={() => setMenuState(null)}
        />
      )}
    </div>
  )
}
