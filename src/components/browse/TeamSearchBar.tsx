'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import type { BrowseRow } from '@/lib/types'

interface TeamSearchBarProps {
  rows: BrowseRow[]
}

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace"

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
}

// Common search aliases: normalized query → normalized team fragment that should match
const ALIASES: Record<string, string> = {
  'uconn':    'connecticut',
  'ole miss': 'mississippi',
  'uncg':     'unc greensboro',
}

function matches(row: BrowseRow, q: string): boolean {
  const nq = norm(q)
  if (nq.length < 2) return false
  const expanded = ALIASES[nq] ?? nq
  return norm(row.teamName).includes(expanded) || norm(row.shortName).includes(expanded)
}

export default function TeamSearchBar({ rows }: TeamSearchBarProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (query.length < 2) return []
    return rows.filter(r => matches(r, query)).slice(0, 8)
  }, [query, rows])

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

  function handleSelect(row: BrowseRow) {
    setQuery('')
    setOpen(false)
    router.push(`/team/${row.teamSlug}`)
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
          placeholder="Search teams…"
          autoComplete="off"
          style={{
            fontSize: '11px',
            fontFamily: MONO,
            padding: '4px 10px 4px 26px',
            borderRadius: '6px',
            border: '1px solid var(--border-hi)',
            backgroundColor: 'var(--bg-surface)',
            color: 'var(--text-strong)',
            width: '180px',
            outline: 'none',
          }}
        />
      </div>

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 4px)',
          left: 0,
          zIndex: 200,
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-hi)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-menu)',
          minWidth: '260px',
          overflow: 'hidden',
        }}>
          {results.map((row, i) => {
            const rank = row.masseyRank ?? row.ratingsRank
            return (
              <button
                key={row.teamSlug}
                onClick={() => handleSelect(row)}
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
                {row.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.logoUrl} width={22} height={22} style={{ objectFit: 'contain', flexShrink: 0 }} alt="" />
                ) : (
                  <div style={{ width: 22, height: 22, borderRadius: '3px', backgroundColor: 'var(--bg-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: '7px', color: 'var(--text-lo)', fontWeight: 700 }}>{row.shortName.substring(0, 2).toUpperCase()}</span>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.shortName}
                  </div>
                  <div style={{ fontSize: '9px', color: 'var(--text-lo)', fontFamily: MONO }}>
                    {row.conference}{rank !== null && <span style={{ marginLeft: '4px' }}>#{rank}</span>}
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
