'use client'

interface Props {
  text: string | null
  dataStatus: string
}

export function SummaryParagraph({ text, dataStatus }: Props) {
  if (!text) {
    const msg = dataStatus === 'stats-only'
      ? 'Player-level data is not available for this season pair. Continuity analysis requires individual player stats for both seasons.'
      : dataStatus === 'unavailable'
      ? 'No data is available for this team and season combination.'
      : 'Insufficient data to generate a summary for this season pair.'

    return (
      <div style={{
        padding: '11px 14px',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        backgroundColor: 'var(--bg-out)',
        marginBottom: '16px',
      }}>
        <p style={{ fontSize: '12px', color: 'var(--text-mid)', margin: 0, lineHeight: 1.6 }}>
          {msg}
        </p>
      </div>
    )
  }

  return (
    <div style={{
      padding: '11px 14px',
      border: '1px solid var(--border-hi)',
      borderLeft: '3px solid var(--brand)',
      borderRadius: '4px',
      backgroundColor: 'var(--brand-glow)',
      marginBottom: '16px',
    }}>
      <p style={{
        fontSize: '12px',
        color: 'var(--text-hi)',
        margin: 0,
        lineHeight: 1.75,
        letterSpacing: '0.005em',
      }}>
        {text}
      </p>
    </div>
  )
}
