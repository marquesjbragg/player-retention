'use client'

import { useQuery } from '@tanstack/react-query'
import type { PlayerAppearance } from '@/app/api/player/[id]/seasons/route'

export type { PlayerAppearance }

export function usePlayerSeasons(athleteId: string) {
  return useQuery<PlayerAppearance[]>({
    queryKey: ['player-seasons', athleteId],
    queryFn: async () => {
      const res = await fetch(`/api/player/${athleteId}/seasons`)
      const json = await res.json()
      if (!json.success) return []
      return json.data as PlayerAppearance[]
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}
