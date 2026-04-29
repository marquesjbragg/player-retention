'use client'

import type { OutlierFlag } from '@/lib/types'

interface Props {
  flag: OutlierFlag
}

interface FlagConfig {
  tier: 'high' | 'mid' | 'low' | 'stats'
  label: string
  interpretation: string
}

const FLAG_MAP: Record<NonNullable<OutlierFlag>, FlagConfig> = {
  'high-ci-improve': {
    tier: 'high',
    label: 'HIGH CI · IMPROVED',
    interpretation: 'Strong continuity with better results — a returning core that leveled up.',
  },
  'high-ci-stable': {
    tier: 'high',
    label: 'HIGH CI · STABLE',
    interpretation: 'Retained core held steady — program continuity reflected in consistent outcomes.',
  },
  'high-ci-decline': {
    tier: 'high',
    label: 'HIGH CI · DECLINED',
    interpretation: 'High returnee rate but results dipped — roster wasn\'t the variable.',
  },
  'mid-ci-improve': {
    tier: 'mid',
    label: 'MID CI · IMPROVED',
    interpretation: 'Balanced turnover with positive results — the new pieces fit.',
  },
  'mid-ci-stable': {
    tier: 'mid',
    label: 'MID CI · STABLE',
    interpretation: 'Average continuity, average outcomes — right in the D1 bell curve.',
  },
  'mid-ci-decline': {
    tier: 'mid',
    label: 'MID CI · DECLINED',
    interpretation: 'Moderate continuity didn\'t translate to gains on the court this year.',
  },
  'low-ci-improve': {
    tier: 'low',
    label: 'LOW CI · IMPROVED',
    interpretation: 'Heavy turnover paired with better results — a successful rebuild.',
  },
  'low-ci-stable': {
    tier: 'low',
    label: 'LOW CI · STABLE',
    interpretation: 'Significant movement, similar outcomes — still finding the right mix.',
  },
  'low-ci-decline': {
    tier: 'low',
    label: 'LOW CI · DECLINED',
    interpretation: 'Major departures and falling results — program in transition.',
  },
  'stats-only': {
    tier: 'stats',
    label: 'STATS ONLY',
    interpretation: 'CI unavailable for this transition — record change shown without player-level data.',
  },
}

const TIER_COLORS: Record<string, { border: string; bg: string; label: string }> = {
  high:  { border: 'var(--positive)',        bg: 'var(--badge-green-bg)',  label: 'var(--badge-green-fg)'  },
  mid:   { border: 'var(--badge-amber-fg)',  bg: 'var(--badge-amber-bg)',  label: 'var(--badge-amber-fg)'  },
  low:   { border: 'var(--negative)',        bg: 'var(--badge-red-bg)',    label: 'var(--badge-red-fg)'    },
  stats: { border: 'var(--badge-silver-fg)', bg: 'var(--badge-silver-bg)', label: 'var(--badge-gray-fg)'   },
}

export function PatternCallout({ flag }: Props) {
  if (!flag) return null
  const config = FLAG_MAP[flag]
  const colors = TIER_COLORS[config.tier]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '8px 12px',
      marginBottom: '8px',
      borderLeft: `3px solid ${colors.border}`,
      backgroundColor: colors.bg,
      borderRadius: '0 5px 5px 0',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: '9px',
          fontWeight: 700,
          letterSpacing: '0.09em',
          color: colors.label,
          marginBottom: '3px',
          fontFamily: 'var(--mono)',
        }}>
          {config.label}
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-mid)', lineHeight: 1.5 }}>
          {config.interpretation}
        </div>
      </div>
    </div>
  )
}
