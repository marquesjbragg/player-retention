import { NextRequest } from 'next/server'
import { buildPlayerPageData } from '@/lib/team/playerPageData'
import { buildPlayerParagraph } from '@/lib/team/playerParagraph'

interface RouteParams {
  params: { id: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = params
  const { searchParams } = request.nextUrl

  const teamSlug = searchParams.get('team')
  const yearParam = searchParams.get('year')

  if (!teamSlug) {
    return Response.json(
      { success: false, error: { code: 'MISSING_TEAM', message: 'team query parameter is required' } },
      { status: 400 }
    )
  }

  const year = yearParam ? parseInt(yearParam, 10) : 2026
  if (isNaN(year) || year < 2022 || year > 2030) {
    return Response.json(
      { success: false, error: { code: 'INVALID_YEAR', message: 'year must be between 2022 and 2030' } },
      { status: 400 }
    )
  }

  try {
    const data = await buildPlayerPageData(id, teamSlug, year)

    if (!data) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Player ${id} not found on ${teamSlug} for season ${year}` } },
        { status: 404 }
      )
    }

    const summaryParagraph = buildPlayerParagraph(data)

    return Response.json({
      success: true,
      data: { ...data, summaryParagraph },
    })
  } catch (err) {
    console.error(`[/api/player/${id}] error:`, err)
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 }
    )
  }
}
