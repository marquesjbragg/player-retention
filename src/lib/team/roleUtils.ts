// Pure role-tier logic — no server imports. Safe to use in client components.

export type PlayerStatus  = 'returner' | 'newcomer' | 'departure'
export type RoleTag       = 'lead' | 'core' | 'rotation' | 'bench' | 'fringe'
export type UsageModifier = 'high' | 'moderate' | 'low'

export function computeRoleTag(
  minShare: number,
  ptsShare: number,
  gamesStarted: number | null,
  games: number,
): RoleTag {
  const share = Math.max(minShare, ptsShare)

  let tier: RoleTag
  if (share >= 20)      tier = 'lead'
  else if (share >= 14) tier = 'core'
  else if (share >= 8)  tier = 'rotation'
  else if (share >= 3)  tier = 'bench'
  else                  tier = 'fringe'

  // Starts bump: one tier up if ≥50% start rate and meaningfully near next threshold
  const startsRatio = gamesStarted !== null && games > 0 ? gamesStarted / games : 0
  if (startsRatio >= 0.5) {
    if      (tier === 'core'     && share >= 12) tier = 'lead'
    else if (tier === 'rotation' && share >= 6)  tier = 'core'
    else if (tier === 'bench'    && share >= 6)  tier = 'rotation'
  }

  return tier
}

// Style modifier: usage % as a secondary descriptor (not a tier driver)
export function usageModifier(usg: number | null | undefined): UsageModifier | null {
  if (usg == null) return null
  if (usg >= 24)   return 'high'
  if (usg >= 18)   return 'moderate'
  return 'low'
}

export function buildContinuityLabel(
  role: RoleTag,
  status: PlayerStatus,
  isQualified: boolean,
): string {
  if (!isQualified) return 'Below-Threshold Returner'

  const tier: Record<RoleTag, string> = {
    lead:     'Lead',
    core:     'Core',
    rotation: 'Rotation',
    bench:    'Bench',
    fringe:   'Fringe',
  }
  const t = tier[role]

  if (status === 'returner') return `${t} Returner`
  if (status === 'newcomer') {
    if (role === 'bench' || role === 'fringe') return `${t} Newcomer`
    return `Incoming ${t} Piece`
  }
  // departure
  if (role === 'bench' || role === 'fringe') return `${t} Departure`
  return `Lost ${t} Piece`
}
