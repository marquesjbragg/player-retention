'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

const NAV_LINKS: { href: string; label: string; exact?: boolean }[] = [
  { href: '/browse',         label: 'Browse',      exact: true  },
  { href: '/browse/players', label: 'Players',     exact: false },
  { href: '/methodology',    label: 'Methodology', exact: false },
]

function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    setDark(document.documentElement.getAttribute('data-theme') === 'dark')
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.setAttribute('data-theme', 'dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.removeAttribute('data-theme')
      localStorage.setItem('theme', 'light')
    }
  }

  return (
    <button
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        fontSize: '13px',
        width: '28px',
        height: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '6px',
        border: '1px solid var(--border-hi)',
        backgroundColor: 'transparent',
        color: 'var(--text-mid)',
        cursor: 'pointer',
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {dark ? '☀' : '◐'}
    </button>
  )
}

export default function Navbar() {
  const pathname = usePathname()

  return (
    <header
      className="sticky top-0 z-50"
      style={{ backgroundColor: 'var(--nav-bg)', borderBottom: '1px solid var(--border-hi)' }}
    >
      <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between h-10">
        <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-hi)', letterSpacing: '-0.01em' }}>
          Player Retention
        </span>
        <nav className="flex items-center gap-1">
          {NAV_LINKS.map(link => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
            return (
              <Link
                key={link.href}
                href={link.href}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '4px 10px',
                  borderRadius: '5px',
                  transition: 'all 0.1s',
                  color: active ? 'var(--brand)' : 'var(--text-mid)',
                  backgroundColor: active ? 'var(--brand-dim)' : 'transparent',
                  textDecoration: 'none',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-hi)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = 'var(--text-mid)' }}
              >
                {link.label}
              </Link>
            )
          })}
          <div style={{ width: 1, height: 16, backgroundColor: 'var(--border-hi)', margin: '0 4px' }} />
          <ThemeToggle />
        </nav>
      </div>
    </header>
  )
}
