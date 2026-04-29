import { NextRequest } from 'next/server'
import { buildBrowseRows } from '@/lib/browse/BrowseRowBuilder'
import type { Division } from '@/lib/types'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const season   = parseInt(searchParams.get('season') ?? '2025', 10)
  const division = (searchParams.get('division') ?? 'D1') as Division
  const conference = searchParams.get('conference') ?? undefined

  if (isNaN(season) || season < 2020 || season > 2030) {
    return Response.json(
      { success: false, error: { code: 'INVALID_SEASON', message: 'season must be a year between 2020 and 2030' } },
      { status: 400 }
    )
  }

  if (division !== 'D1' && division !== 'D2') {
    return Response.json(
      { success: false, error: { code: 'INVALID_DIVISION', message: 'division must be D1 or D2' } },
      { status: 400 }
    )
  }

  const year1 = season - 1
  const year2 = season

  try {
    const rows = await buildBrowseRows({ division, conference, year1, year2 })

    const full       = rows.filter(r => r.dataStatus === 'full').length
    const statsOnly  = rows.filter(r => r.dataStatus === 'stats-only').length
    const noPlayer   = rows.filter(r => r.dataStatus === 'no-player-data').length
    const unavail    = rows.filter(r => r.dataStatus === 'unavailable').length

    return Response.json({
      success: true,
      data: {
        rows,
        count:  rows.length,
        year1,
        year2,
        filters: { division, conference: conference ?? null },
        coverage: { full, statsOnly, noPlayerData: noPlayer, unavailable: unavail },
      },
    })
  } catch (err) {
    console.error('[/api/browse] error:', err)
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 }
    )
  }
}
