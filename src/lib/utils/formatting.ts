export function fmtCI(v: number | null): string {
  if (v === null) return '—'
  return v.toFixed(1)
}

export function fmtPct(v: number | null): string {
  if (v === null) return '—'
  return v.toFixed(1) + '%'
}

export function fmtPctDelta(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'
}

export function fmtDelta(v: number): string {
  return (v >= 0 ? '+' : '') + v.toFixed(1)
}

export function fmtRank(v: number | null): string {
  if (v === null) return '—'
  return String(v)
}

export function fmtRating(v: number | null): string {
  if (v === null) return '—'
  return (v > 0 ? '+' : '') + v.toFixed(1)
}

export function deltaHex(v: number, higherIsBetter: boolean): string {
  if (Math.abs(v) < 0.05) return 'var(--text-mid)'
  const good = higherIsBetter ? v > 0 : v < 0
  return good ? 'var(--positive)' : 'var(--negative)'
}

export function seasonLabel(year2: number): string {
  return `${year2 - 1}–${String(year2).slice(-2)}`
}
