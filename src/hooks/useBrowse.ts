'use client'

import { useQuery } from '@tanstack/react-query'
import type { BrowseRow } from '@/lib/types'

export interface BrowseApiData {
  rows: BrowseRow[]
  count: number
  year1: number
  year2: number
  coverage: {
    full: number
    statsOnly: number
    noPlayerData: number
    unavailable: number
  }
}

export function useBrowse(division: 'D1' | 'D2', season: number) {
  return useQuery<BrowseApiData>({
    queryKey: ['browse', division, season],
    queryFn: async () => {
      const res = await fetch(`/api/browse?division=${division}&season=${season}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error?.message ?? 'API error')
      return json.data as BrowseApiData
    },
  })
}
