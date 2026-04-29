'use client'

import { useQuery } from '@tanstack/react-query'
import type { PlayerPageData } from '@/lib/team/playerPageData'

export interface PlayerApiData extends PlayerPageData {
  summaryParagraph: string
}

export function usePlayer(athleteId: string, teamSlug: string, year: number) {
  return useQuery<PlayerApiData>({
    queryKey: ['player', athleteId, teamSlug, year],
    queryFn: async () => {
      const res = await fetch(`/api/player/${athleteId}?team=${teamSlug}&year=${year}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to load player data')
      return json.data as PlayerApiData
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
