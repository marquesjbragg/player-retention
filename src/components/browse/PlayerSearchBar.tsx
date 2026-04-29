'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import type { PlayerIndexEntry } from '@/app/api/browse/players/route'
import type { BrowseRow } from '@/lib/types'

interface PlayerSearchBarProps {
  rows: BrowseRow[]  // for team display name + logo lookup
}

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace"

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

function usePlayerIndex() {
  return useQuery<PlayerIndexEntry[]>({
    queryKey: ['player-index'],
    queryFn: async () => {
      const res = await fetch('/api/browse/players')
      const json = await res.json()
      if (!json.success) return []
      return json.data as PlayerIndexEntry[]
    },
    staleTime: 10 * 60 * 1000,
  })
}

export default function PlayerSearchBar({ rows }: PlayerSearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: players } = usePlayerIndex()

  const teamBySlug = useMemo(() => {
    const map = new Map<string, BrowseRow>()
    rows.forEach(r => map.set(r.teamSlug, r))
    return map
  }, [rows])

  const results = useMemo(() => {
    if (!players || query.length < 2) return []
    const q = norm(query)
    return players.filter(p => norm(p.name).includes(q)).slice(0, 8)
  }, [players, query])

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleSelect(entry: PlayerIndexEntry) {
    setQuery('')
    setOpen(false)
    router.push(`/player/${entry.athleteId}?team=${entry.teamSlug}&year=${entry.year}`)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px', color: 'var(--text-lo)', pointerEvents: 'none', userSelect: 'none' }}>
          ⌕
        </span>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => { if (query.length >= 2) setOpen(true) }}
          onKeyDown={handleKey}
          placeholder="Search players…"
          autoComplete="off"
          style={{
            fontSize: '11px',
            fontFamily: MONO,
            padding: '4px 10px 4px 26px',
            borderRadius: '6px',
            border: '1px solid var(--border-hi)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-strong)',
            width: '168px',
            outline: 'none',
          }}
        />
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          right: 0,
          zIndex: 200,
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-hi)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-menu)',
          minWidth: '240px',
          overflow: 'hidden',
        }}>
          {results.map((entry, i) => {
            const team = teamBySlug.get(entry.teamSlug)
            const teamLabel = team?.shortName ?? entry.teamSlug
            const logoUrl   = team?.logoUrl
            const seasonLabel = `${entry.year - 1}–${String(entry.year).slice(2)}`
            return (
              <button
                key={`${entry.athleteId}-${entry.year}`}
                onClick={() => handleSelect(entry)}
                className="search-result-item"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '7px 12px',
                  border: 'none',
                  borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: MONO,
                }}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} width={18} height={18} style={{ objectFit: 'contain', flexShrink: 0, opacity: 0.85 }} alt="" />
                ) : (
                  <div style={{ width: 18, height: 18, borderRadius: '3px', backgroundColor: 'var(--bg-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '6px', color: 'var(--text-lo)', fontWeight: 700 }}>{teamLabel.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {entry.name}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-lo)', fontFamily: MONO }}>
                    {teamLabel} · {seasonLabel}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
