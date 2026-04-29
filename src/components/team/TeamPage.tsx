'use client'

import Link from 'next/link'
import { useTeam } from '@/hooks/useTeam'
import { TeamHeader }       from './TeamHeader'
import { YearPairSelector } from './YearPairSelector'
import { SeasonComparison } from './SeasonComparison'
import { ContinuityStrip }  from './ContinuityStrip'
import { SummaryParagraph } from './SummaryParagraph'
import { PatternCallout }   from './PatternCallout'
import { StatDeltasGrid }   from './StatDeltasGrid'
import { RosterTables }     from './RosterTables'
import { RatingsContext }   from './RatingsContext'

interface Props {
  slug: string
  year: number
}

function winPct(wins: number, losses: number): number {
  const total = wins + losses
  if (total === 0) return 0
  return Math.round((wins / total) * 10000) / 100
}

export function TeamPage({ slug, year }: Props) {
  const { data, isLoading, error } = useTeam(slug, year)

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
          {error?.message ?? 'Team not found or data unavailable.'}
        </div>
        <Link href="/browse" style={{ fontSize: '11px', color: 'var(--brand)', textDecoration: 'none' }}>
          ← Back to Browse
        </Link>
      </div>
    )
  }

  const y1WinPct = data.teamSeason1
    ? winPct(data.teamSeason1.wins, data.teamSeason1.losses)
    : 0
  const y2WinPct = data.teamSeason2
    ? winPct(data.teamSeason2.wins, data.teamSeason2.losses)
    : 0

  return (
    <div>
      {/* Back link */}
      <div style={{ marginBottom: '10px' }}>
        <Link
          href="/browse"
          style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-lo)', textDecoration: 'none' }}
        >
          ← Browse
        </Link>
      </div>

      {/* Team header */}
      <TeamHeader
        identity={data.identity}
        teamSeason2={data.teamSeason2}
        coachYear2={data.coachYear2}
        ratings2={data.ratings2}
        massey2={data.massey2}
      />

      {/* Year-pair selector */}
      <YearPairSelector
        slug={slug}
        currentYear={data.yearPair.year2}
        availableYears={data.availableYears}
      />

      {/* Season comparison snapshot */}
      <SeasonComparison
        teamSeason1={data.teamSeason1}
        teamSeason2={data.teamSeason2}
        ratings1={data.ratings1}
        ratings2={data.ratings2}
        year1={data.yearPair.year1}
        year2={data.yearPair.year2}
      />

      {/* Continuity summary strip */}
      <ContinuityStrip
        retention={data.retention}
        ratings1={data.ratings1}
        ratings2={data.ratings2}
        year1WinPct={y1WinPct}
        year2WinPct={y2WinPct}
        dataStatus={data.dataStatus}
      />

      {/* Pattern callout — primes the narrative */}
      <PatternCallout flag={data.outlierFlag} />

      {/* Summary paragraph */}
      <SummaryParagraph
        text={data.summaryParagraph}
        dataStatus={data.dataStatus}
      />

      {/* Stat deltas grid */}
      <StatDeltasGrid deltas={data.deltas} />

      {/* Roster tables */}
      <RosterTables
        retention={data.retention}
        teamSlug={slug}
        year2={data.yearPair.year2}
      />

      {/* Ratings context */}
      <RatingsContext
        ratings1={data.ratings1}
        ratings2={data.ratings2}
        massey1={data.massey1}
        massey2={data.massey2}
        year1={data.yearPair.year1}
        year2={data.yearPair.year2}
      />

      {/* Data quality footnote */}
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
