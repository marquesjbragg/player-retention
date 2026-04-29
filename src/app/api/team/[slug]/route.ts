import { NextRequest } from 'next/server'
import { buildTeamPageData, getAvailableYears } from '@/lib/team/teamPageData'
import { buildSummaryParagraph } from '@/lib/team/summaryParagraph'

interface RouteParams {
  params: { slug: string }
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { slug } = params
  const { searchParams } = request.nextUrl

  const yearParam = searchParams.get('year')
  const requestedYear = yearParam ? parseInt(yearParam, 10) : null

  if (requestedYear !== null && (isNaN(requestedYear) || requestedYear < 2022 || requestedYear > 2030)) {
    return Response.json(
      { success: false, error: { code: 'INVALID_YEAR', message: 'year must be between 2022 and 2030' } },
      { status: 400 }
    )
  }

  // Determine year2: use requested year, or fall back to most recent available
  const availableYears = await getAvailableYears(slug)

  if (availableYears.length === 0) {
    return Response.json(
      { success: false, error: { code: 'NO_DATA', message: `No data available for team "${slug}"` } },
      { status: 404 }
    )
  }

  const year2 = requestedYear && availableYears.includes(requestedYear)
    ? requestedYear
    : availableYears[0]

  try {
    const data = await buildTeamPageData(slug, year2)

    if (!data) {
      return Response.json(
        { success: false, error: { code: 'NOT_FOUND', message: `Team "${slug}" not found in registry` } },
        { status: 404 }
      )
    }

    const summaryParagraph = buildSummaryParagraph(data)

    return Response.json({
      success: true,
      data: {
        ...data,
        summaryParagraph,
      },
    })
  } catch (err) {
    console.error(`[/api/team/${slug}] error:`, err)
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 }
    )
  }
}
