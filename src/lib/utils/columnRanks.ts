import type { BrowseRow } from '@/lib/types'

export interface RankColConfig {
  colId: string
  accessor: keyof BrowseRow
  // true = rank 1 is the highest value (e.g. CI, Win%)
  // false = rank 1 is the lowest value (e.g. ratingsRank, deptMin%, oppPpgDelta)
  higherIsBetter: boolean
}

// Lower opp PPG delta = opponents scored less relative to Y1 = defensive improvement.
// Lower departure % = more production stayed = better continuity.
// Lower rank number (ratingsRank, masseyRank) = better team placement.
export const RANK_COL_CONFIGS: RankColConfig[] = [
  { colId: 'ci',          accessor: 'continuityIndex',       higherIsBetter: true  },
  { colId: 'retMin',      accessor: 'returningMinutesPct',   higherIsBetter: true  },
  { colId: 'retPts',      accessor: 'returningPointsPct',    higherIsBetter: true  },
  { colId: 'retStarts',   accessor: 'returningStartsPct',    higherIsBetter: true  },
  { colId: 'deptMin',     accessor: 'deptMinutesPct',        higherIsBetter: false },
  { colId: 'deptPts',     accessor: 'deptPointsPct',         higherIsBetter: false },
  { colId: 'newMin',      accessor: 'newcomerMinutesPct',    higherIsBetter: true  },
  { colId: 'newPts',      accessor: 'newcomerPointsPct',     higherIsBetter: true  },
  { colId: 'returners',   accessor: 'returningPlayersCount', higherIsBetter: true  },
  { colId: 'newPlayers',  accessor: 'newPlayersCount',       higherIsBetter: true  },
  { colId: 'year1Wpct',   accessor: 'year1WinPct',           higherIsBetter: true  },
  { colId: 'year2Wpct',   accessor: 'year2WinPct',           higherIsBetter: true  },
  { colId: 'wpctDelta',   accessor: 'winPctDelta',           higherIsBetter: true  },
  { colId: 'ppgDelta',    accessor: 'ppgDelta',              higherIsBetter: true  },
  { colId: 'oppPpgDelta', accessor: 'oppPpgDelta',           higherIsBetter: false },
  { colId: 'ratingsRank', accessor: 'ratingsRank',           higherIsBetter: false },
  { colId: 'ratingsRtg',  accessor: 'ratingsRating',         higherIsBetter: true  },
  { colId: 'masseyRank',  accessor: 'masseyRank',            higherIsBetter: false },
  { colId: 'masseyRtg',   accessor: 'masseyRating',          higherIsBetter: true  },
]

// Computes per-column ranks over the provided rows (pre-filter, so rank 1 is always
// among all loaded teams regardless of active filters).
// Returns Map<teamSlug, Map<colId, rank>> — missing entry = no rank (null value).
// Ties share the same rank (dense-style: 1, 1, 3, 4...).
export function computeColumnRanks(rows: BrowseRow[]): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>()

  for (const config of RANK_COL_CONFIGS) {
    const withValues: Array<{ slug: string; value: number }> = []
    for (const row of rows) {
      const val = row[config.accessor] as number | null | undefined
      if (val !== null && val !== undefined) {
        withValues.push({ slug: row.teamSlug, value: val })
      }
    }

    withValues.sort((a, b) =>
      config.higherIsBetter ? b.value - a.value : a.value - b.value
    )

    let rank = 1
    for (let i = 0; i < withValues.length; i++) {
      if (i > 0 && withValues[i].value !== withValues[i - 1].value) {
        rank = i + 1
      }
      const { slug } = withValues[i]
      if (!result.has(slug)) result.set(slug, new Map())
      result.get(slug)!.set(config.colId, rank)
    }
  }

  return result
}
