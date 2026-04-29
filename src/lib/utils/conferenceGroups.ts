export type ConfGroup = 'all' | 'power' | 'major-mid' | 'mid-major' | 'independent'

const POWER = new Set(['ACC', 'Big 12', 'Big East', 'Big Ten', 'SEC'])

const MAJOR_MID = new Set(['A-10', 'American', 'Mountain West', 'WCC'])

export function getConfGroup(conference: string): ConfGroup {
  if (POWER.has(conference))     return 'power'
  if (MAJOR_MID.has(conference)) return 'major-mid'
  if (!conference)               return 'independent'
  return 'mid-major'
}

export const CONF_GROUP_LABELS: Record<ConfGroup, string> = {
  'all':         'Conference Type',
  'power':       'Power',
  'major-mid':   'Major Mid',
  'mid-major':   'Mid-Major',
  'independent': 'Indep.',
}
