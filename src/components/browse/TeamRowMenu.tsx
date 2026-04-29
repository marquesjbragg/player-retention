'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { BrowseRow } from '@/lib/types'

export interface TeamMenuState {
  row: BrowseRow
  x: number
  y: number
}

interface TeamRowMenuProps {
  state: TeamMenuState
  onClose: () => void
}

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace"

function MenuItem({
  label,
  sub,
  onClick,
  disabled,
}: {
  label: string
  sub?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="menu-item"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        textAlign: 'left',
        fontSize: '11px',
        fontFamily: MONO,
        padding: '5px 12px',
        border: 'none',
        backgroundColor: 'transparent',
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? 'var(--text-disabled)' : 'var(--text-body)',
        gap: '8px',
      }}
    >
      <span>{label}</span>
      {disabled && <span style={{ fontSize: '9px', color: 'var(--text-lo)', flexShrink: 0 }}>soon</span>}
      {sub && !disabled && <span style={{ fontSize: '9px', color: 'var(--text-disabled)', flexShrink: 0 }}>{sub}</span>}
    </button>
  )
}

export default function TeamRowMenu({ state, onClose }: TeamRowMenuProps) {
  const { row, x, y } = state
  const router = useRouter()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const teamUrl = `/team/${row.teamSlug}`
  const rank = row.masseyRank ?? row.ratingsRank
  const netRtg = row.ratingsRating !== null ? row.ratingsRating.toFixed(1) : null

  function copyStats() {
    const ci = row.continuityIndex !== null ? row.continuityIndex.toFixed(1) : '—'
    const wpct = (row.winPctDelta >= 0 ? '+' : '') + row.winPctDelta.toFixed(1)
    const rtg = netRtg ?? '—'
    const rankStr = rank !== null ? ` #${rank}` : ''
    navigator.clipboard.writeText(
      `${row.shortName}${rankStr} · CI: ${ci} · W% Δ: ${wpct} · Net Rtg: ${rtg}`
    ).catch(() => {})
    onClose()
  }

  function copyLink() {
    try {
      navigator.clipboard.writeText(window.location.origin + teamUrl)
    } catch { /* ignore */ }
    onClose()
  }

  // Keep menu inside viewport — if it would overflow right/bottom, flip it
  const menuWidth = 210
  const menuHeight = 220
  const adjustedX = x + menuWidth > window.innerWidth  ? x - menuWidth : x
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 1000,
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-hi)',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-menu)',
        minWidth: `${menuWidth}px`,
        overflow: 'hidden',
        fontFamily: MONO,
      }}
    >
      {/* Header */}
      <div style={{ padding: '8px 12px 6px', borderBottom: '1px solid var(--border-hi)', backgroundColor: 'var(--bg-raised)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-strong)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.shortName}
          </div>
          <div style={{ fontSize: '9px', color: 'var(--text-lo)', fontFamily: MONO, display: 'flex', gap: '6px', alignItems: 'baseline' }}>
            <span>{row.conference}{rank !== null && ` · #${rank}`}</span>
            {netRtg !== null && (
              <span style={{ fontWeight: 700, color: 'var(--text-mid)' }}>{netRtg}</span>
            )}
          </div>
        </div>
        {row.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={row.logoUrl} width={28} height={28} style={{ objectFit: 'contain', flexShrink: 0, opacity: 0.9 }} alt="" />
        ) : (
          <div style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: 'var(--bg-subtle)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '8px', color: 'var(--text-lo)', fontWeight: 700, lineHeight: 1 }}>
              {row.shortName.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Navigation group */}
      <div style={{ padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
        <MenuItem label="Open Team Page"  onClick={() => { router.push(teamUrl); onClose() }} />
        <MenuItem label="Open in New Tab" onClick={() => { window.open(teamUrl, '_blank'); onClose() }} />
      </div>

      {/* Copy group */}
      <div style={{ padding: '2px 0', borderBottom: '1px solid var(--border)' }}>
        <MenuItem label="Copy Team Link" onClick={copyLink} />
        <MenuItem label="Copy Stats"     onClick={copyStats} />
      </div>

      {/* Future / disabled */}
      <div style={{ padding: '2px 0' }}>
        <MenuItem label="View Retention Details" disabled />
        <MenuItem label="Compare with…"          disabled />
        <MenuItem label="Pin to Watchlist"        disabled />
      </div>
    </div>
  )
}
