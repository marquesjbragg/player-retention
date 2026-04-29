'use client'

import { useQuery } from '@tanstack/react-query'
import type { PlayerBrowseRow } from '@/app/api/browse/player-table/route'

export type { PlayerBrowseRow }

export function usePlayerBrowse(year: number, division: 'd1' | 'd2' = 'd1') {
  return useQuery<PlayerBrowseRow[]>({
    queryKey: ['player-browse', year, division],
    queryFn: async () => {
      const res = await fetch(`/api/browse/player-table?year=${year}&division=${division}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'Failed to load player browse data')
      return json.data as PlayerBrowseRow[]
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })
}
