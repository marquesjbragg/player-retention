import { Suspense } from 'react'
import { PlayerPage } from '@/components/player/PlayerPage'

interface Props {
  params: { id: string }
  searchParams: { team?: string; year?: string }
}

export default function PlayerResearchPage({ params, searchParams }: Props) {
  const { id } = params
  const teamSlug = searchParams.team ?? ''
  const year = searchParams.year ? parseInt(searchParams.year, 10) : 2026

  return (
    <div style={{
      maxWidth: '720px',
      margin: '0 auto',
      padding: '32px 24px 64px',
      fontFamily: 'var(--mono)',
    }}>
      <Suspense fallback={
        <div style={{ fontSize: '11px', color: 'var(--text-lo)', padding: '40px 0' }}>
          Loading…
        </div>
      }>
        <PlayerPage athleteId={id} teamSlug={teamSlug} year={year} />
      </Suspense>
    </div>
  )
}
