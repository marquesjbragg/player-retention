'use client'

import { useRouter } from 'next/navigation'
import { usePlayer } from '@/hooks/usePlayer'
import { usePlayerSeasons } from '@/hooks/usePlayerSeasons'
import { PlayerHeader }           from './PlayerHeader'
import { PlayerStrip }            from './PlayerStrip'
import { PlayerYoY }              from './PlayerYoY'
import { PlayerRoleProfile }      from './PlayerRoleProfile'
import { PlayerStatsTable }       from './PlayerStatsTable'
import { PlayerContinuityDetails } from './PlayerContinuityDetails'
import { PlayerTeamContext }       from './PlayerTeamContext'

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, 'DejaVu Sans Mono', monospace"

function seasonLabel(year: number): string {
  return `${year - 1}–${String(year).slice(2)}`
}

interface Props {
  athleteId: string
  teamSlug: string
  year: number
}

export function PlayerPage({ athleteId, teamSlug, year }: Props) {
  const router = useRouter()
  const { data, isLoading, error } = usePlayer(athleteId, teamSlug, year)
  const { data: seasons } = usePlayerSeasons(athleteId)

  const currentDivision: 'D1' | 'D2' = athleteId.startsWith('sidearm-') ? 'D2' : 'D1'

  function handleSeasonChange(appearance: { year: number; teamSlug: string; playerId: string }) {
    // Cross-division seasons have a different playerId — navigate to that page
    router.push(`/player/${appearance.playerId}?team=${appearance.teamSlug}&year=${appearance.year}`)
  }

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-lo)', fontFamily: 'var(--mono)' }}>
          Loading…
        </span>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ padding: '40px 0' }}>
        <div style={{ fontSize: '12px', color: 'var(--negative)', marginBottom: '12px' }}>
          {error?.message ?? 'Player not found or data unavailable.'}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Identity */}
      <PlayerHeader data={data} />

      {/* Key metrics strip */}
      <PlayerStrip data={data} />

      {/* Season selector — only when player has multiple seasons */}
      {seasons && seasons.length > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '14px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-lo)', fontFamily: MONO }}>
            Season
          </span>
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {seasons.map(s => {
              const active = s.year === year && s.teamSlug === teamSlug
              const isCrossDiv = s.division !== currentDivision
              const isCrossTeam = s.teamSlug !== teamSlug
              const hoverKey = `${s.year}:${s.teamSlug}`
              const titleStr = isCrossTeam
                ? `${s.teamSlug}${isCrossDiv ? ` (${s.division})` : ''}`
                : undefined
              return (
                <button
                  key={hoverKey}
                  onClick={() => handleSeasonChange(s)}
                  title={titleStr}
                  className={`season-btn${active ? ' active' : ''}`}
                  style={{
                    fontSize: '10px',
                    fontWeight: active ? 700 : 500,
                    fontFamily: MONO,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    border: '1px solid',
                    borderColor: active ? 'var(--brand)' : 'var(--border-hi)',
                    backgroundColor: active ? 'var(--brand-dim)' : 'transparent',
                    color: active ? 'var(--brand)' : isCrossDiv ? 'var(--text-lo)' : 'var(--text-mid)',
                    cursor: active ? 'default' : 'pointer',
                    transition: 'all 0.1s',
                    letterSpacing: '0.01em',
                    opacity: isCrossDiv ? 0.8 : 1,
                  }}
                >
                  {seasonLabel(s.year)}
                  {isCrossDiv && (
                    <span style={{ marginLeft: '4px', fontSize: '8px', opacity: 0.75, fontWeight: 600 }}>
                      {s.division}
                    </span>
                  )}
                  {!isCrossDiv && isCrossTeam && (
                    <span style={{ marginLeft: '4px', fontSize: '8px', opacity: 0.6 }}>↗</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Year-over-year (returners only) */}
      <PlayerYoY data={data} />

      {/* Interpretation paragraph */}
      {data.summaryParagraph && (
        <div style={{
          padding: '11px 14px',
          border: '1px solid var(--border-hi)',
          borderLeft: '3px solid var(--brand)',
          borderRadius: '4px',
          backgroundColor: 'var(--brand-glow)',
          marginBottom: '16px',
        }}>
          <p style={{ fontSize: '12px', color: 'var(--text-hi)', margin: 0, lineHeight: 1.75, letterSpacing: '0.005em' }}>
            {data.summaryParagraph}
          </p>
        </div>
      )}

      {/* Role profile bars */}
      <PlayerRoleProfile data={data} />

      {/* Season stats */}
      <PlayerStatsTable data={data} />

      {/* Continuity details */}
      <PlayerContinuityDetails data={data} />

      {/* Team context */}
      <PlayerTeamContext data={data} />

      {/* Data quality warnings */}
      {data.retention?.warnings && data.retention.warnings.length > 0 && (
        <div style={{ marginTop: '6px', padding: '8px 10px', backgroundColor: 'var(--badge-amber-bg)', border: '1px solid var(--badge-amber-bg)', borderRadius: '4px' }}>
          {data.retention.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: '10px', color: 'var(--badge-amber-fg)' }}>⚠ {w}</div>
          ))}
        </div>
      )}
    </div>
  )
}
