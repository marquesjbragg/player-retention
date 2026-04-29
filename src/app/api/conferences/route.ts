import { NextRequest } from 'next/server'
import { TeamRegistry } from '@/lib/registry/TeamRegistry'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const division = (searchParams.get('division') ?? 'D1') as 'D1' | 'D2'

  try {
    const conferences = TeamRegistry.getConferences(division)
    return Response.json({ success: true, data: { division, conferences } })
  } catch (err) {
    return Response.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: String(err) } },
      { status: 500 }
    )
  }
}
