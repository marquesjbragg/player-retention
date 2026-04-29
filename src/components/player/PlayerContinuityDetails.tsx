'use client'

import type { PlayerApiData } from '@/hooks/usePlayer'
import type { PlayerStatus } from '@/lib/team/roleUtils'
import { buildContinuityLabel } from '@/lib/team/roleUtils'

interface Props {
  data: PlayerApiData
}

function Row({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: '130px', flexShrink: 0, fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-lo)' }}>
        {label}
      </div>
      <div style={{ fontSize: '11px', color: color ?? 'var(--text-hi)', flex: 1, lineHeight: 1.5 }}>
        {value}
      </div>
    </div>
  )
}

const STATUS_LABELS: Record<PlayerStatus, { label: string; color: string }> = {
  returner:  { label: 'Returner',  color: 'var(--badge-green-fg)' },
  newcomer:  { label: 'Newcomer',  color: 'var(--badge-blue-fg)'  },
  departure: { label: 'Departure', color: 'var(--badge-gray-fg)'  },
}

const CONF_NOTES: Record<string, string> = {
  exact:  'Exact ID match — high confidence',
  fuzzy:  'Fuzzy name match — verified',
  low:    'Low-confidence match — review recommended',
  manual: 'Manual override applied',
}

export function PlayerContinuityDetails({ data }: Props) {
  const {
    status, matchConfidence, isQualified, belowThresholdInfo,
    minShare, retention, roleTag,
  } = data

  const statusStyle = STATUS_LABELS[status]
  const continuityLabel = buildContinuityLabel(roleTag, status, isQualified)

  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-mid)', marginBottom: '6px' }}>
        Continuity Details
      </div>

      <div style={{ border: '1px solid var(--border-hi)', borderRadius: '6px', padding: '0 12px' }}>
        <Row
          label="Status"
          value={<span style={{ fontWeight: 700, color: statusStyle.color }}>{statusStyle.label}</span>}
        />

        <Row
          label="Role"
          value={<span style={{ fontWeight: 700, color: 'var(--text-hi)' }}>{continuityLabel}</span>}
        />

        <Row
          label="Qualified"
          value={
            isQualified
              ? <span style={{ color: 'var(--positive)' }}>✓ Included in CI</span>
              : <span style={{ color: 'var(--badge-amber-fg)' }}>Sub-threshold — excluded from CI</span>
          }
        />

        {belowThresholdInfo && (
          <Row
            label="Threshold"
            value={belowThresholdInfo.exclusionLabel}
            color="var(--text-mid)"
          />
        )}

        {matchConfidence && (
          <Row
            label="Match"
            value={
              <span style={{ color: matchConfidence === 'exact' ? 'var(--text-mid)' : 'var(--badge-amber-fg)' }}>
                {CONF_NOTES[matchConfidence] ?? matchConfidence}
              </span>
            }
          />
        )}

        <Row
          label="Min Share"
          value={`${minShare.toFixed(1)}% of team minutes`}
        />

        {retention && isQualified && status === 'returner' && (
          <Row
            label="CI Contribution"
            value={`Counted in ${retention.continuityIndex.toFixed(1)} CI (team's returning ${retention.returningMinutesPct.toFixed(1)}% min pool)`}
            color="var(--text-mid)"
          />
        )}
      </div>
    </div>
  )
}
