import { Suspense } from 'react'
import { TeamPage } from '@/components/team/TeamPage'

interface Props {
  params: { slug: string }
  searchParams: { year?: string }
}

export default function TeamResearchPage({ params, searchParams }: Props) {
  const { slug } = params
  const year = searchParams.year ? parseInt(searchParams.year, 10) : 2026

  return (
    <div style={{
      maxWidth: '900px',
      margin: '0 auto',
      padding: '32px 24px 64px',
      fontFamily: 'var(--mono)',
    }}>
      <Suspense fallback={
        <div style={{ fontSize: '11px', color: 'var(--text-lo)', padding: '40px 0' }}>
          Loading…
        </div>
      }>
        <TeamPage slug={slug} year={year} />
      </Suspense>
    </div>
  )
}
