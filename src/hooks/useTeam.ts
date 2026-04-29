'use client'

import { useQuery } from '@tanstack/react-query'
import type { TeamPageData } from '@/lib/team/teamPageData'

export interface TeamApiData extends TeamPageData {
  summaryParagraph: string | null
}

export function useTeam(slug: string, year: number) {
  return useQuery<TeamApiData>({
    queryKey: ['team', slug, year],
    queryFn: async () => {
      const res = await fetch(`/api/team/${slug}?year=${year}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to load team data')
      return json.data as TeamApiData
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
