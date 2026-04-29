/* eslint-disable react/no-unescaped-entities */
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Methodology · Player Retention',
  description: 'How the Continuity Index, team flags, player roles, and data coverage work.',
}

// ─── Style constants ──────────────────────────────────────────────────────────

const MONO = "ui-monospace, 'SF Mono', 'Cascadia Code', Consolas, monospace"
const SANS = "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

const S: Record<string, React.CSSProperties> = {
  page: {
    maxWidth: '860px',
    margin: '0 auto',
    padding: '32px 24px 100px',
    fontFamily: SANS,
  },
  pageLabel: {
    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.1em', color: 'var(--text-mid)',
    marginBottom: '28px', display: 'block',
  },
  h1: {
    fontSize: '26px', fontWeight: 700, color: 'var(--text-hi)',
    letterSpacing: '-0.02em', marginBottom: '10px', lineHeight: 1.2,
  },
  lead: {
    fontSize: '14px', color: 'var(--text-body)', lineHeight: 1.7,
    marginBottom: '36px',
  },
  toc: {
    border: '1px solid var(--border-hi)', borderRadius: '8px',
    padding: '16px 20px', backgroundColor: 'var(--bg-out)',
    marginBottom: '48px',
  },
  tocLabel: {
    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text-mid)', marginBottom: '10px',
  },
  tocList: {
    listStyle: 'none', padding: 0, margin: 0,
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 24px',
  },
  tocItem: {
    fontSize: '12px', color: 'var(--brand)',
  },
  section: {
    marginBottom: '56px',
  },
  h2: {
    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.1em', color: 'var(--text-mid)',
    borderBottom: '1px solid var(--border-hi)', paddingBottom: '8px',
    marginBottom: '18px',
  },
  h3: {
    fontSize: '13px', fontWeight: 700, color: 'var(--text-hi)',
    marginBottom: '8px', marginTop: '20px',
  },
  body: {
    fontSize: '13px', color: 'var(--text-body)', lineHeight: 1.7,
    marginBottom: '14px',
  },
  formula: {
    backgroundColor: 'var(--bg-muted)', border: '1px solid var(--border-hi)',
    borderRadius: '6px', padding: '14px 16px',
    fontFamily: MONO, fontSize: '12px', color: 'var(--text-hi)',
    marginBottom: '16px', lineHeight: 1.7,
  },
  callout: {
    backgroundColor: 'var(--bg-out)', border: '1px solid var(--border-hi)',
    borderRadius: '8px', padding: '16px 18px', marginBottom: '16px',
  },
  calloutLabel: {
    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', color: 'var(--text-mid)', marginBottom: '6px',
  },
  table: {
    width: '100%', borderCollapse: 'collapse',
    fontFamily: MONO, fontSize: '12px', marginBottom: '14px',
  },
  th: {
    textAlign: 'left' as const, padding: '6px 10px',
    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.07em', color: 'var(--text-mid)',
    backgroundColor: 'var(--bg-muted)',
    borderBottom: '2px solid var(--border-hi)',
  },
  td: {
    padding: '6px 10px', borderBottom: '1px solid var(--border)',
    verticalAlign: 'top' as const, fontSize: '12px', color: 'var(--text-body)',
  },
  note: {
    fontSize: '11px', color: 'var(--text-mid)', lineHeight: 1.6,
    marginTop: '8px',
  },
  badge: {
    display: 'inline-block',
    fontSize: '9px', fontWeight: 700, letterSpacing: '0.06em',
    padding: '2px 6px', borderRadius: '3px', marginRight: '4px',
  },
  divider: {
    borderColor: 'var(--border)', margin: '0 0 48px',
  },
}

// ─── Helper components ────────────────────────────────────────────────────────

function SectionAnchor({ id, label }: { id: string; label: string }) {
  return (
    <div style={S.h2} id={id}>{label}</div>
  )
}

function Body({ children }: { children: React.ReactNode }) {
  return <p style={S.body}>{children}</p>
}

function Formula({ children }: { children: React.ReactNode }) {
  return <div style={S.formula}>{children}</div>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MethodologyPage() {
  return (
    <div style={S.page}>

      {/* Header */}
      <span style={S.pageLabel}>Methodology</span>
      <h1 style={S.h1}>How It Works</h1>
      <p style={S.lead}>
        This tool measures roster continuity — how much of a team's on-court production
        carried over from one season to the next — and connects that to year-over-year
        performance change. It covers Division I and Division II college basketball, seasons
        2022 through 2026.
      </p>

      {/* Table of contents */}
      <div style={S.toc}>
        <div style={S.tocLabel}>Contents</div>
        <ol style={S.tocList}>
          {[
            ['#ci', 'Continuity Index'],
            ['#components', 'CI Components'],
            ['#departed-newcomer', 'Departed & Newcomer Production'],
            ['#threshold', 'Participation Threshold'],
            ['#flags', 'Team Flags'],
            ['#status', 'Player Status Labels'],
            ['#tiers', 'Player Role Tiers'],
            ['#players-browse', 'Players Browse'],
            ['#d1-d2', 'D1 vs D2 Coverage'],
            ['#ratings', 'Ratings Context'],
            ['#matching', 'Player Identity & Matching'],
            ['#limitations', 'Known Limitations'],
          ].map(([href, label]) => (
            <li key={href} style={S.tocItem}>
              <a href={href} style={{ color: 'var(--brand)', textDecoration: 'none', fontSize: '12px' }}>
                {label}
              </a>
            </li>
          ))}
        </ol>
      </div>

      {/* ── 1. Continuity Index ──────────────────────────────────────────────── */}
      <div style={S.section} id="ci">
        <SectionAnchor id="ci-anchor" label="The Continuity Index" />

        <Body>
          The <strong>Continuity Index (CI)</strong> is a 0–100 score that measures how
          much of a team's on-court production returned from Year 1 to Year 2. It is the
          central metric in this tool.
        </Body>

        <Body>
          The CI is <em>not</em> a head count. Two teams could each return 7 players, but
          one might be returning 85% of its production while the other returns only 50% —
          because the players who left were stars, not reserves.
        </Body>

        <Formula>
          <div style={{ color: 'var(--text-mid)', marginBottom: '4px' }}>Standard (starts data available)</div>
          CI = (Returning Minutes % + Returning Starts % + Returning Points %) / 3{'\n\n'}
          <div style={{ color: 'var(--text-mid)', marginBottom: '4px' }}>Fallback (starts unavailable)</div>
          CI = (Returning Minutes % + Returning Points %) / 2
        </Formula>

        {/* Worked example */}
        <div style={S.callout}>
          <div style={S.calloutLabel}>Worked example — one team, one season pair</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Player</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Y1 Min</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Y1 Pts</th>
                <th style={{ ...S.th, textAlign: 'right' }}>Y1 GS</th>
                <th style={{ ...S.th, textAlign: 'center' }}>Y2 status</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Marcus T.', '820', '380', '30', 'Returner'],
                ['Devon W.',  '680', '290', '22', 'Returner'],
                ['Jamal H.',  '510', '195', '15', 'Returner'],
                ['Chris B.',  '340', '148', ' 8', 'Departed'],
                ['Terry M.',  '180', ' 42', ' 0', 'Departed'],
              ].map(([name, min, pts, gs, status]) => (
                <tr key={name}>
                  <td style={S.td}>{name}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{min}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{pts}</td>
                  <td style={{ ...S.td, textAlign: 'right' }}>{gs}</td>
                  <td style={{ ...S.td, textAlign: 'center' }}>
                    <span style={{
                      ...S.badge,
                      backgroundColor: status === 'Returner' ? 'var(--badge-green-bg)' : 'var(--badge-gray-bg)',
                      color: status === 'Returner' ? 'var(--badge-green-fg)' : 'var(--badge-gray-fg)',
                    }}>
                      {status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor: 'var(--bg-muted)' }}>
                <td style={{ ...S.td, fontWeight: 700 }}>Team total</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>2,530</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>1,055</td>
                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700 }}>75</td>
                <td style={S.td} />
              </tr>
            </tbody>
          </table>

          <div style={{ fontFamily: MONO, fontSize: '12px', color: 'var(--text-body)', lineHeight: 1.8 }}>
            <div>Returning Minutes % = (820 + 680 + 510) / 2,530 = <strong style={{ color: 'var(--text-hi)' }}>79.4%</strong></div>
            <div>Returning Starts %  = (30 + 22 + 15) / 75 = <strong style={{ color: 'var(--text-hi)' }}>89.3%</strong></div>
            <div>Returning Points %  = (380 + 290 + 195) / 1,055 = <strong style={{ color: 'var(--text-hi)' }}>82.0%</strong></div>
            <div style={{ marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
              CI = (79.4 + 89.3 + 82.0) / 3 = <strong style={{ color: 'var(--brand)', fontSize: '13px' }}>83.6</strong>
            </div>
          </div>
        </div>

        <p style={S.note}>
          A CI of 83.6 means roughly 83–84% of this team's production by these three
          dimensions returned. Chris B. leaving cost meaningful points and starts. Terry M.'s
          departure was minor. The returning core was intact.
        </p>
      </div>

      <hr style={S.divider} />

      {/* ── 2. CI Components ────────────────────────────────────────────────────── */}
      <div style={S.section} id="components">
        <SectionAnchor id="components-anchor" label="CI Components" />

        <Body>
          All three components look at the same question from different angles. Each uses
          Year 1 as the denominator — what share of what was there in Year 1 came back?
        </Body>

        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '22%' }}>Component</th>
              <th style={{ ...S.th, width: '40%' }}>What it measures</th>
              <th style={S.th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)' }}>Returning Minutes %</td>
              <td style={S.td}>Share of Year 1 total minutes logged by players who returned in Year 2</td>
              <td style={S.td}>
                Most structurally neutral component — reflects deployment regardless of scoring
                system or pace. Always available.
              </td>
            </tr>
            <tr>
              <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)' }}>Returning Starts %</td>
              <td style={S.td}>Share of Year 1 starting lineup appearances held by returning players</td>
              <td style={S.td}>
                Captures role continuity above the starting/reserve divide. May be unavailable
                when the data source doesn't report starts (see fallback below).
              </td>
            </tr>
            <tr>
              <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)' }}>Returning Points %</td>
              <td style={S.td}>Share of Year 1 total scoring from returning players</td>
              <td style={S.td}>
                Most volatile component — sensitive to system changes. A returning player in a
                new offense may score more or fewer points than their Year 1 baseline.
              </td>
            </tr>
          </tbody>
        </table>

        <div style={S.callout}>
          <div style={S.calloutLabel}>Starts data fallback</div>
          <div style={{ fontSize: '12px', color: 'var(--text-body)', lineHeight: 1.6 }}>
            If starts data is unavailable for a team-season (all null, or all zero), the CI
            falls back to the two-component average of Minutes % and Points % only. The UI
            flags this with <em>dataQuality: partial</em>. For D1 teams (CBBD source), starts
            are always available. For D2 (Sidearm source), some schools don't report starts —
            partial CI is more common there.
          </div>
        </div>
      </div>

      <hr style={S.divider} />

      {/* ── 3. Departed & Newcomer Production ─────────────────────────────────── */}
      <div style={S.section} id="departed-newcomer">
        <SectionAnchor id="departed-newcomer-anchor" label="Departed & Newcomer Production" />

        <Body>
          The CI measures what came back. Two supplemental metrics measure the other
          side: what left, and what replaced it.
        </Body>

        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '28%' }}>Metric</th>
              <th style={{ ...S.th, width: '32%' }}>Definition</th>
              <th style={S.th}>Denominator</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)' }}>Departed Minutes %</td>
              <td style={S.td}>Minutes played by non-returning Year 1 players</td>
              <td style={S.td}>Year 1 total minutes — same as CI</td>
            </tr>
            <tr>
              <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)' }}>Departed Points %</td>
              <td style={S.td}>Points scored by non-returning Year 1 players</td>
              <td style={S.td}>Year 1 total points — same as CI</td>
            </tr>
            <tr>
              <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)' }}>Newcomer Minutes %</td>
              <td style={S.td}>Minutes played by players new to Year 2</td>
              <td style={S.td}><strong>Year 2 total minutes</strong> — different denominator</td>
            </tr>
            <tr>
              <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)' }}>Newcomer Points %</td>
              <td style={S.td}>Points scored by players new to Year 2</td>
              <td style={S.td}><strong>Year 2 total points</strong> — different denominator</td>
            </tr>
          </tbody>
        </table>

        <div style={S.callout}>
          <div style={S.calloutLabel}>Why the denominators differ — an important detail</div>
          <div style={{ fontSize: '12px', color: 'var(--text-body)', lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px' }}>
              Departed Min% is measured against Year 1 total minutes (the year they played).
              Newcomer Min% is measured against Year 2 total minutes (the year they arrived).
              These are two different pools, so they don't sum to 100% together — and that's
              correct, not an error.
            </p>
            <p style={{ margin: 0 }}>
              <strong>Example:</strong> A team loses 20% of its Year 1 minutes to departures
              (Departed Min% = 20). But returners play more in Year 2, and new players fill
              the rest — so newcomers account for 30% of Year 2 minutes (Newcomer Min% = 30).
              The gap (20 → 30) reflects how much extra production returners added, plus how
              much of the new production pool newcomers claimed.
            </p>
          </div>
        </div>

        <p style={S.note}>
          These metrics are context for the CI, not replacements for it. A team with a low CI
          that has a Newcomer Min% of 65% is rebuilding around new players. Whether that's good
          or bad depends on the quality of those newcomers — which the CI doesn't score.
        </p>
      </div>

      <hr style={S.divider} />

      {/* ── 4. Participation Threshold ──────────────────────────────────────────── */}
      <div style={S.section} id="threshold">
        <SectionAnchor id="threshold-anchor" label="Minimum Participation Threshold" />

        <Body>
          Not every rostered player is included in CI calculations. Players who barely
          appeared in Year 1 are excluded from the denominator to avoid diluting the
          metric with noise. The threshold uses OR logic — a player qualifies if they
          pass <em>either</em> check.
        </Body>

        <Formula>
          Qualifies if:{'  '}minutesPlayed &ge; 30 (total season){'\n'}
          {'          '}OR games &ge; ceil(teamGames &times; 0.20)
        </Formula>

        <Body>
          A player is excluded only if they fail <em>both</em> checks. For a 32-game season,
          the games check requires at least 7 appearances. A player with 25 minutes in 10
          games passes on games. A player with 45 total minutes in 2 games passes on minutes.
        </Body>

        <Body>
          Excluded players remain visible in the team's player table with an explicit label
          showing which condition(s) they failed — for example:{' '}
          <code style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--text-hi)', backgroundColor: 'var(--bg-muted)', padding: '1px 5px', borderRadius: '3px' }}>
            4 min &lt; 30 AND 2 GP &lt; 7 (20% of 32 games)
          </code>
          . The threshold applies only to Year 1 players in the denominator. Year 2 players
          are counted in full for newcomer displays.
        </Body>
      </div>

      <hr style={S.divider} />

      {/* ── 5. Team Flags ───────────────────────────────────────────────────────── */}
      <div style={S.section} id="flags">
        <SectionAnchor id="flags-anchor" label="Team Flags & Patterns" />

        <Body>
          Every team-season pair with full data (both player and team-season records available)
          gets a pattern flag based on where its CI falls and which direction its win percentage
          moved. The flag describes <em>what happened</em> — it does not explain why.
        </Body>

        <div style={{ overflowX: 'auto', marginBottom: '16px' }}>
          <table style={{ ...S.table, minWidth: '480px' }}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: '22%' }}>CI Band</th>
                <th style={{ ...S.th, textAlign: 'center', width: '25%' }}>
                  <span style={{ color: 'var(--positive)' }}>▲ Improved</span>
                  <div style={{ fontSize: '8px', fontWeight: 400, color: 'var(--text-lo)' }}>W% Δ &gt; +5pp</div>
                </th>
                <th style={{ ...S.th, textAlign: 'center', width: '25%' }}>
                  Stable
                  <div style={{ fontSize: '8px', fontWeight: 400, color: 'var(--text-lo)' }}>W% Δ ±5pp</div>
                </th>
                <th style={{ ...S.th, textAlign: 'center' }}>
                  <span style={{ color: 'var(--negative)' }}>▼ Declined</span>
                  <div style={{ fontSize: '8px', fontWeight: 400, color: 'var(--text-lo)' }}>W% Δ &lt; −5pp</div>
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                {
                  band: 'High CI ≥ 70',
                  improve: { label: 'HIGH CI · IMPROVED', bg: 'var(--badge-green-bg)', fg: 'var(--badge-green-fg)', note: 'Core returned and built on it' },
                  stable:  { label: 'HIGH CI · STABLE',   bg: 'var(--badge-green-bg)', fg: 'var(--badge-green-fg)', note: 'Returning core held the trajectory' },
                  decline: { label: 'HIGH CI · DECLINED', bg: 'var(--badge-red-bg)',   fg: 'var(--badge-red-fg)',   note: 'Notable — personnel wasn\'t the issue' },
                },
                {
                  band: 'Mid CI 40–69',
                  improve: { label: 'MID CI · IMPROVED', bg: 'var(--badge-amber-bg)', fg: 'var(--badge-amber-fg)', note: 'Newcomers filled the gap well' },
                  stable:  { label: 'MID CI · STABLE',   bg: 'var(--badge-amber-bg)', fg: 'var(--badge-amber-fg)', note: 'Moderate turnover, similar result' },
                  decline: { label: 'MID CI · DECLINED', bg: 'var(--badge-red-bg)',   fg: 'var(--badge-red-fg)',   note: 'Turnover wasn\'t replaced' },
                },
                {
                  band: 'Low CI < 40',
                  improve: { label: 'LOW CI · IMPROVED', bg: 'var(--badge-amber-bg)', fg: 'var(--badge-amber-fg)', note: 'Rebuilt roster outperformed' },
                  stable:  { label: 'LOW CI · STABLE',   bg: 'var(--badge-red-bg)',   fg: 'var(--badge-red-fg)',   note: 'Production was replenished' },
                  decline: { label: 'LOW CI · DECLINED', bg: 'var(--badge-red-bg)',   fg: 'var(--badge-red-fg)',   note: 'Personnel loss translated directly' },
                },
              ].map(row => (
                <tr key={row.band}>
                  <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)', fontSize: '11px' }}>
                    {row.band}
                  </td>
                  {[row.improve, row.stable, row.decline].map(cell => (
                    <td key={cell.label} style={{ ...S.td, textAlign: 'center', verticalAlign: 'middle' }}>
                      <span style={{ ...S.badge, backgroundColor: cell.bg, color: cell.fg, display: 'block', marginBottom: '4px', fontSize: '8px' }}>
                        {cell.label}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-lo)', display: 'block' }}>{cell.note}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.callout}>
          <div style={S.calloutLabel}>Why two teams with the same CI can go in opposite directions</div>
          <div style={{ fontSize: '12px', color: 'var(--text-body)', lineHeight: 1.65 }}>
            <p style={{ margin: '0 0 8px' }}>
              Consider two teams, both at CI = 65 (Mid CI). One improved by +12pp W%, the
              other declined by −10pp W%. The CI tells you both retained similar levels of
              production — but it doesn't tell you:
            </p>
            <ul style={{ margin: '0 0 8px', paddingLeft: '16px' }}>
              <li>Whether the returning players regressed or developed</li>
              <li>Whether newcomers were high-impact transfers or untested freshmen</li>
              <li>Whether a coaching change reset the system</li>
              <li>Whether conference opponents got stronger or weaker</li>
            </ul>
            <p style={{ margin: 0 }}>
              The flag is the start of the question, not the answer. <strong>HIGH CI · DECLINED</strong>{' '}
              is the most analytically interesting flag — the team kept its core but got worse.
              That pattern usually points to development regression, schedule change, or coaching
              disruption, not personnel loss.
            </p>
          </div>
        </div>

        <p style={S.note}>
          Teams without player data (stats-only) receive a <em>stats-only</em> marker instead
          of a flag. Teams with no data at all receive no flag.
        </p>
      </div>

      <hr style={S.divider} />

      {/* ── 6. Player Status Labels ─────────────────────────────────────────────── */}
      <div style={S.section} id="status">
        <SectionAnchor id="status-anchor" label="Player Status Labels" />

        <Body>
          Every player on the Players page and team roster tables carries a status label
          relative to a specific team and year pair.
        </Body>

        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '18%' }}>Status</th>
              <th style={{ ...S.th, width: '42%' }}>Definition</th>
              <th style={S.th}>Year shown</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={S.td}>
                <span style={{ ...S.badge, backgroundColor: 'var(--badge-green-bg)', color: 'var(--badge-green-fg)' }}>RETURNER</span>
              </td>
              <td style={S.td}>
                Player matched from the Year 1 roster via player ID or name matching.
                Contributed to the CI denominator if above the participation threshold.
              </td>
              <td style={S.td}>Year 2 stats shown</td>
            </tr>
            <tr>
              <td style={S.td}>
                <span style={{ ...S.badge, backgroundColor: 'var(--badge-blue-bg)', color: 'var(--badge-blue-fg)' }}>NEWCOMER</span>
              </td>
              <td style={S.td}>
                Player present in Year 2 with no match in the Year 1 qualified player pool.
                Includes freshmen, transfers in, and any Year 1 below-threshold players who
                played more in Year 2.
              </td>
              <td style={S.td}>Year 2 stats shown</td>
            </tr>
            <tr>
              <td style={S.td}>
                <span style={{ ...S.badge, backgroundColor: 'var(--badge-gray-bg)', color: 'var(--badge-gray-fg)' }}>DEPARTURE</span>
              </td>
              <td style={S.td}>
                Player present in Year 1 (above threshold) with no match in Year 2.
                Includes graduates, transfers out, and players who did not return.
              </td>
              <td style={S.td}>Year 1 (final) stats shown</td>
            </tr>
          </tbody>
        </table>

        <p style={S.note}>
          Status is always relative to a specific team-year pair. A transfer who moved
          from Team A to Team B appears as a Departure on Team A and a Newcomer on Team B.
          Cross-team transfer history is not tracked.
        </p>
      </div>

      <hr style={S.divider} />

      {/* ── 7. Player Role Tiers ─────────────────────────────────────────────────── */}
      <div style={S.section} id="tiers">
        <SectionAnchor id="tiers-anchor" label="Player Role Tiers" />

        <Body>
          Each player is classified into a role tier based on their share of team minutes
          and points. The tier reflects their weight in the team's continuity story — a
          Lead Returner departing has a very different meaning than a Fringe Departure.
        </Body>

        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '20%' }}>Tier</th>
              <th style={{ ...S.th, width: '30%' }}>Primary threshold</th>
              <th style={S.th}>What it means</th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                tier: 'Lead', bg: 'var(--badge-blue-bg)', fg: 'var(--badge-blue-fg)',
                threshold: 'max(Min%, Pts%) ≥ 20%',
                note: "Primary contributor. Losing or gaining a Lead piece significantly shifts the team's CI.",
              },
              {
                tier: 'Core', bg: 'var(--badge-sky-bg)', fg: 'var(--badge-sky-fg)',
                threshold: 'max(Min%, Pts%) ≥ 14%',
                note: 'Meaningful rotation role. Multiple Core pieces departing can tip the CI into Mid territory.',
              },
              {
                tier: 'Rotation', bg: 'var(--badge-amber-bg)', fg: 'var(--badge-amber-fg)',
                threshold: 'max(Min%, Pts%) ≥ 8%',
                note: 'Regular contributor. Important depth, but individual impact on CI is moderate.',
              },
              {
                tier: 'Bench', bg: 'var(--badge-gray-bg)', fg: 'var(--badge-gray-fg)',
                threshold: 'max(Min%, Pts%) ≥ 3%',
                note: 'Limited minutes. Appears in the roster table but minimal CI contribution.',
              },
              {
                tier: 'Fringe', bg: 'var(--bg-muted)', fg: 'var(--text-mid)',
                threshold: 'max(Min%, Pts%) < 3%',
                note: 'Minimal appearance. May be below the participation threshold entirely.',
              },
            ].map(row => (
              <tr key={row.tier}>
                <td style={S.td}>
                  <span style={{ ...S.badge, backgroundColor: row.bg, color: row.fg }}>{row.tier.toUpperCase()}</span>
                </td>
                <td style={{ ...S.td, fontFamily: MONO, fontSize: '11px' }}>{row.threshold}</td>
                <td style={S.td}>{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={S.callout}>
          <div style={S.calloutLabel}>Starts bump</div>
          <div style={{ fontSize: '12px', color: 'var(--text-body)', lineHeight: 1.6 }}>
            A player who starts ≥50% of games and is near the next threshold gets bumped
            one tier up. A Core player (14–19% share) who also starts regularly is promoted
            to Lead. This reflects that consistent starters carry role weight beyond their
            raw share numbers, and a team replacing two starting Core players faces meaningful
            continuity risk even if the CI doesn't immediately show it.
          </div>
        </div>

        <p style={S.note}>
          For D1 players, T-Rank's position role (Wing G, Combo G, Pure PG, etc.) is shown
          alongside the tier as a secondary descriptor. These are separate classifications
          from different systems. The T-Rank role describes what kind of player they are;
          the tier describes how much they contributed to this team.
        </p>
      </div>

      <hr style={S.divider} />

      {/* ── 8. Players Browse ───────────────────────────────────────────────────── */}
      <div style={S.section} id="players-browse">
        <SectionAnchor id="players-browse-anchor" label="Players Browse" />

        <Body>
          The Players page shows every player across all teams in a single browsable table,
          filtered and sorted by continuity and performance signals. It is designed to surface
          players whose minutes share, departure, or role change has the highest potential
          impact on team continuity stories.
        </Body>

        <div style={S.h3}>Filters and what they mean</div>

        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '25%' }}>Filter</th>
              <th style={S.th}>What it does</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['D1 / D2 toggle', 'Switches the entire player pool between divisions. T-Rank columns and D1-only filters are hidden when viewing D2.'],
              ['Status', 'Filter to Returners, Newcomers, or Departures only.'],
              ['Min% threshold', 'Hide players below a minimum minutes share. Default is 5%. Useful for focusing on players who actually move the needle on CI.'],
              ['Pos Role (D1 only)', 'T-Rank position role taxonomy: Wing G, Combo G, Pure PG, Scoring PG, Wing F, Stretch 4, PF/C, C.'],
              ['Class Year (D1 only)', 'T-Rank eligibility year: Fr / So / Jr / Sr.'],
              ['Conf Group (D1 only)', 'Filter by conference tier: Power, Major Mid, Mid-Major.'],
              ['Conference', 'Filter to a specific conference.'],
              ['Quality (D1 only)', 'Filters by team net rating rank: Q1 (rank 1–75), Q2 (76–150), Q3 (151–250), Q4 (251+).'],
              ['Player search', 'Name search across the current division\'s player pool.'],
            ].map(([f, d]) => (
              <tr key={f as string}>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)', fontSize: '11px' }}>{f}</td>
                <td style={S.td}>{d}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={S.h3}>Team CI in the player table</div>
        <Body>
          The Team CI column in the Players table uses a simplified two-component calculation
          (Returning Min% + Returning Pts%, averaged) based on exact player ID matching —
          not the full RetentionEngine. No participation threshold is applied. This version
          is computed for performance across all teams simultaneously, and is a fast approximation.
          The CI shown on a team's detail page uses the full engine with name matching,
          threshold filtering, and starts data if available.
        </Body>
      </div>

      <hr style={S.divider} />

      {/* ── 9. D1 vs D2 Coverage ─────────────────────────────────────────────────── */}
      <div style={S.section} id="d1-d2">
        <SectionAnchor id="d1-d2-anchor" label="D1 vs D2 — Data Coverage" />

        <Body>
          Division I and Division II data come from different sources and have meaningfully
          different levels of enrichment. The core continuity metrics are available for both.
          The richer efficiency and role context is D1-only.
        </Body>

        <table style={{ ...S.table, marginBottom: '20px' }}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '38%' }}>Data field</th>
              <th style={{ ...S.th, textAlign: 'center', width: '18%' }}>D1</th>
              <th style={{ ...S.th, textAlign: 'center', width: '18%' }}>D2</th>
              <th style={S.th}>Notes</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Teams covered', '364', '282', 'D1: all NCAA DI. D2: 22 conferences via Sidearm.'],
              ['Player data source', 'CBBD', 'Sidearm Sports', 'Different APIs, same normalized shape.'],
              ['Seasons available', '2022–2026', '2022–2026', 'All 5 seasons seeded for both divisions.'],
              ['Box score stats', '✓ Full', '✓ Full', 'G, GS, Min, Pts, Reb, Ast, Stl, Blk, TO, FG, 3P, FT.'],
              ['Games started (GS)', '✓ Always reported', '⚠ Sometimes missing', 'D2: partial CI (no starts) is more common.'],
              ['Eligibility year', '✓ T-Rank enriched', '✗ Usually null', 'Sidearm API returns year=0 for most players.'],
              ['Position role', '✓ T-Rank (8 roles)', '✗ Not available', 'Raw position (G/F/C) shown for D2 where present.'],
              ['USG%, BPM, ORtg, DRtg', '✓ T-Rank enriched', '✗ Not available', 'T-Rank covers D1 only.'],
              ['Net ratings (team)', '✓ CBBD + Massey', '✗ Not available', 'No equivalent D2 adjusted efficiency source.'],
              ['Team logos', '✓ ~99% coverage', '✓ ~96% coverage', '270 of 282 D2 teams have logos.'],
              ['Player ID type', 'CBBD numeric ID', 'Sidearm sdrm_id', 'Both are stable for year-over-year matching.'],
            ].map(([field, d1, d2, note]) => (
              <tr key={field as string}>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)', fontSize: '11px' }}>{field}</td>
                <td style={{ ...S.td, textAlign: 'center', color: String(d1).startsWith('✓') ? 'var(--positive)' : String(d1).startsWith('⚠') ? 'var(--badge-amber-fg)' : 'var(--text-mid)' }}>{d1}</td>
                <td style={{ ...S.td, textAlign: 'center', color: String(d2).startsWith('✓') ? 'var(--positive)' : String(d2).startsWith('⚠') ? 'var(--badge-amber-fg)' : 'var(--negative)' }}>{d2}</td>
                <td style={{ ...S.td, fontSize: '11px', color: 'var(--text-mid)' }}>{note}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Body>
          The CI formula, participation threshold, player matching logic, and team flag
          system are identical for D1 and D2. The division doesn't change what continuity
          means — it changes how richly each player's role can be described.
        </Body>
      </div>

      <hr style={S.divider} />

      {/* ── 10. Ratings Context ─────────────────────────────────────────────────── */}
      <div style={S.section} id="ratings">
        <SectionAnchor id="ratings-anchor" label="Ratings Context" />

        <Body>
          Team ratings appear in the Browse table and team detail pages to provide program
          quality context alongside continuity. They are not inputs to the CI — they are
          interpretive context.
        </Body>

        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '22%' }}>Source</th>
              <th style={{ ...S.th, width: '12%' }}>Division</th>
              <th style={S.th}>What it provides</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)' }}>CBBD (NET ratings)</td>
              <td style={S.td}>D1</td>
              <td style={S.td}>
                Adjusted efficiency margin (AEM), offensive and defensive efficiency components,
                overall rank (1–364). The same adjusted efficiency framework used by the NCAA
                selection committee. Season-end snapshot.
              </td>
            </tr>
            <tr>
              <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)' }}>Massey Ratings</td>
              <td style={S.td}>D1</td>
              <td style={S.td}>
                Composite analytical ranking. Used as a secondary signal alongside CBBD. The
                Browse table shows both where available; the team detail page shows which source
                each rating comes from.
              </td>
            </tr>
          </tbody>
        </table>

        <Body>
          D2 has no publicly available adjusted efficiency ratings comparable to CBBD or
          Massey. The Quality filter (Q1–Q4) in the Players Browse is a D1-only feature
          based on CBBD rank buckets (Q1: 1–75, Q2: 76–150, Q3: 151–250, Q4: 251+).
        </Body>

        <p style={S.note}>
          Ratings rank direction: lower rank = stronger team (rank 1 is the best). When
          comparing Year 1 to Year 2, a rank that dropped from #50 to #30 is an improvement.
          The UI shows this as ▲20 → #30.
        </p>
      </div>

      <hr style={S.divider} />

      {/* ── 11. Player Identity & Matching ─────────────────────────────────────── */}
      <div style={S.section} id="matching">
        <SectionAnchor id="matching-anchor" label="Player Identity & Matching" />

        <Body>
          Identifying which Year 1 players returned in Year 2 is the highest-risk step in
          the data pipeline. The approach differs slightly by division.
        </Body>

        <div style={S.h3}>D1 — CBBD Player IDs</div>
        <Body>
          CBBD provides a stable numeric player ID across seasons. Returning player
          identification for D1 starts with exact ID matching before name matching,
          making it highly reliable.
        </Body>

        <div style={S.h3}>D2 — Sidearm Player IDs</div>
        <Body>
          Sidearm's conference stats API provides a <code style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--text-hi)', backgroundColor: 'var(--bg-muted)', padding: '1px 5px', borderRadius: '3px' }}>sdrm_id</code> for most
          players (e.g., <code style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--text-hi)', backgroundColor: 'var(--bg-muted)', padding: '1px 5px', borderRadius: '3px' }}>553-4268</code>). When present, this is
          used as the primary matching key. For players without a stable ID, the system
          falls back to a name-derived key — which is more fragile across seasons.
        </Body>

        <div style={S.h3}>Name matching (both divisions)</div>
        <Body>
          When ID matching is unavailable or ambiguous, player names are normalized and
          compared using Jaro-Winkler string similarity.
        </Body>

        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '22%' }}>Tier</th>
              <th style={{ ...S.th, width: '28%' }}>Threshold</th>
              <th style={{ ...S.th, width: '18%' }}>Confidence</th>
              <th style={S.th}>Handling</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Exact', 'Normalized name strings identical', 'exact', 'Auto-accepted silently'],
              ['Fuzzy', 'Jaro-Winkler ≥ 0.88', 'fuzzy', 'Auto-accepted, flagged with yellow indicator in roster table'],
              ['Low-confidence', 'Jaro-Winkler 0.75–0.87', 'low', 'Excluded from calculations; shown in warnings section'],
              ['No match', 'Similarity < 0.75', '—', 'Player treated as non-returning'],
            ].map(([tier, threshold, conf, handling]) => (
              <tr key={tier as string}>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)' }}>{tier}</td>
                <td style={{ ...S.td, fontFamily: MONO, fontSize: '11px' }}>{threshold}</td>
                <td style={S.td}>{conf}</td>
                <td style={S.td}>{handling}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <Body>
          Name normalization before matching: lowercase, trim, remove periods
          (D.J. → dj), strip Jr./Sr./II/III, reverse "Last,First" Sidearm format.
          Manual overrides can force a specific Year 1 → Year 2 match that the algorithm
          placed in low-confidence. Overrides are stored per team-year pair.
        </Body>
      </div>

      <hr style={S.divider} />

      {/* ── 12. Known Limitations ────────────────────────────────────────────────── */}
      <div style={S.section} id="limitations">
        <SectionAnchor id="limitations-anchor" label="Known Limitations" />

        <Body>
          The CI is an incomplete picture of Year 2 roster quality. These limitations are
          not edge cases — they are structural realities of what the metric measures.
        </Body>

        <table style={S.table}>
          <thead>
            <tr>
              <th style={{ ...S.th, width: '32%' }}>Limitation</th>
              <th style={S.th}>What it means in practice</th>
            </tr>
          </thead>
          <tbody>
            {[
              [
                'Transfer additions are not scored',
                'A team with a low CI that acquires several high-impact transfers may significantly outperform the score\'s implication. The CI measures what was kept, not what was acquired. Newcomer Min% is the best available proxy for how much new production was absorbed.',
              ],
              [
                'Coaching changes are not tracked',
                'A new head coach overrides the meaning of personnel continuity. High CI under a new coach means the players are the same; the system, deployment, and culture may not be. This is one of the strongest confounders in the analysis and is not yet controlled for.',
              ],
              [
                'Points % is system-sensitive',
                'If a team shifts from a slow to a fast pace, or restructures shot distribution between seasons, the same returners may score more or fewer points independent of their development. This adds noise to Returning Points % that doesn\'t exist in Returning Minutes %.',
              ],
              [
                'Schedule strength is not adjusted',
                'Win percentage change is not adjusted for opponent quality. An improved record may reflect a weaker conference or an easier non-conference slate, not true on-court improvement.',
              ],
              [
                'Redshirt players are excluded',
                'A player who was medically or academically absent in Year 1 has zero stats and falls below the threshold. If they play in Year 2, they appear as a Newcomer — which is technically correct for the CI but misses the roster continuity context.',
              ],
              [
                'Name matching introduces margin of error',
                'Despite fuzzy matching and normalization, some returning players will be missed — particularly with unusual name spellings, nicknames, or mid-career legal name changes. A small percentage of CI scores have latent errors from missed matches.',
              ],
              [
                'Cross-team transfer history is not tracked',
                'A player\'s path (departed Team A, joined Team B) is not linked. There is no way to identify that a Newcomer on Team B was a Departure on Team A within the same season.',
              ],
              [
                'D2 eligibility year usually null',
                'The Sidearm conference stats API does not reliably report eligibility year (returns 0 for most players). Class-year based filtering and analysis is not available for D2.',
              ],
            ].map(([lim, detail]) => (
              <tr key={lim as string}>
                <td style={{ ...S.td, fontWeight: 600, color: 'var(--text-hi)', fontSize: '11px' }}>{lim}</td>
                <td style={{ ...S.td, fontSize: '12px' }}>{detail}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={S.callout}>
          <div style={S.calloutLabel}>On reproducibility</div>
          <div style={{ fontSize: '12px', color: 'var(--text-body)', lineHeight: 1.6 }}>
            All player and team data is fetched from source APIs and written to a local cache.
            Completed seasons are marked <em>frozen</em> and are never re-fetched. The current
            season (2025–26) is re-fetched on a 6-hour TTL. This means all historical analysis
            is reproducible against a fixed dataset, and the current-season data is
            periodically refreshed as the season progresses.
          </div>
        </div>
      </div>

    </div>
  )
}
