/**
 * Fetches logo URLs for D2 teams that don't have one in d2-logos.json.
 *
 * Strategy (in order):
 *   1. Try NCAA CDN SVG using common slug transformations
 *   2. Fall back to scraping the team's Sidearm conference page for a logo <img>
 *
 * Updates data/registry/d2-logos.json in place.
 *
 * Usage:
 *   npx tsx scripts/fetch-missing-d2-logos.ts
 *   npx tsx scripts/fetch-missing-d2-logos.ts --dry-run
 */

import * as fs   from 'fs'
import * as path from 'path'

const REGISTRY_PATH   = path.resolve(process.cwd(), 'data', 'registry', 'teams.json')
const LOGOS_PATH      = path.resolve(process.cwd(), 'data', 'registry', 'd2-logos.json')
const CONF_URLS_PATH  = path.resolve(process.cwd(), 'data', 'registry', 'd2-conference-urls.json')

const dryRun  = process.argv.includes('--dry-run')
const DELAY   = 300  // ms between requests

const NCAA_CDN = 'https://www.ncaa.com/sites/default/files/images/logos/schools/bgd'

// ─── Slug candidates ──────────────────────────────────────────────────────────

/** Generate NCAA CDN slug candidates from our registry slug and display name. */
function ncaaCandidates(slug: string, displayName: string): string[] {
  const candidates = new Set<string>()

  // 1. Registry slug as-is
  candidates.add(slug)

  // 2. Replace "state" → "st"
  candidates.add(slug.replace(/-state$/, '-st').replace(/-state-/, '-st-'))

  // 3. Replace "university" → drop or shorten
  candidates.add(slug.replace(/-university$/, '').replace(/-university-/, '-'))

  // 4. Strip "-college" suffix
  candidates.add(slug.replace(/-college$/, ''))

  // 5. Common name abbreviations
  const name = displayName.toLowerCase()
  if (name.includes('oklahoma')) {
    candidates.add(slug.replace('oklahoma', 'okla'))
  }
  if (name.includes('california')) {
    candidates.add(slug.replace('california', 'cal'))
  }
  if (name.includes('saint')) {
    candidates.add(slug.replace('saint', 'st'))
  }
  if (name.includes('southern')) {
    candidates.add(slug.replace('southern', 's'))
  }
  if (name.includes('northern')) {
    candidates.add(slug.replace('northern', 'n'))
  }
  if (name.includes('eastern')) {
    candidates.add(slug.replace('eastern', 'e'))
  }
  if (name.includes('western')) {
    candidates.add(slug.replace('western', 'w'))
  }
  if (name.includes('northwestern')) {
    candidates.add(slug.replace('northwestern', 'nw'))
  }
  if (name.includes('southwestern')) {
    candidates.add(slug.replace('southwestern', 'sw'))
  }
  if (name.includes('southeastern')) {
    candidates.add(slug.replace('southeastern', 'se'))
  }
  if (name.includes('northeastern')) {
    candidates.add(slug.replace('northeastern', 'ne'))
  }
  if (name.includes('a&m') || name.includes('am')) {
    candidates.add(slug.replace('-am', '-a-m'))
  }

  // 6. Combine state→st + other abbreviations
  for (const c of [...candidates]) {
    candidates.add(c.replace(/-state(-|$)/, '-st$1'))
  }

  // 7. Known NCAA CDN overrides for tricky slugs
  const overrides: Record<string, string[]> = {
    'winston-salem-state':          ['winston-salem-st'],
    'southern-arkansas':            ['southern-ark', 's-arkansas'],
    'northwestern-oklahoma-state':  ['nw-okla-st', 'nw-oklahoma-st', 'northwestern-okla-st'],
    'southwestern-oklahoma-state':  ['sw-okla-st', 'sw-oklahoma-st'],
    'southeastern-oklahoma-state':  ['se-okla-st', 'se-oklahoma-st'],
    'arkansas-monticello':          ['ar-monticello', 'uar'],
    'west-texas-am':                ['west-texas-a-m', 'west-texas-am', 'wtamu'],
    'eastern-new-mexico':           ['e-new-mexico', 'eastern-nm', 'enmu'],
    'western-new-mexico':           ['w-new-mexico', 'western-nm', 'wnmu'],
    'ut-dallas':                    ['texas-dallas', 'ut-dallas'],
    'st-marys':                     ['st-marys-tx', 'stmarys'],
    'texas-am-kingsville':          ['tamu-kingsville', 'texas-a-m-kingsville', 'texas-am-kingsville'],
    'texas-am-international':       ['tamu-international', 'texas-a-m-international', 'texas-am-international'],
    'albany-state':                 ['albany-st'],
    'central-state':                ['central-st'],
    'cal-state-dominguez-hills':    ['cal-st-dominguez-hills', 'csudh'],
    'cal-state-san-bernardino':     ['cal-st-san-bernardino', 'csusb'],
    'uc-merced':                    ['california-merced', 'merced'],
    'san-francisco-state':          ['san-francisco-st', 'sfstate', 'sf-st'],
  }
  for (const extra of (overrides[slug] ?? [])) candidates.add(extra)

  // 8. Remove empty or unchanged-but-nonsensical entries
  return [...candidates].filter(c => c && c !== slug || c === slug)
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

async function tryUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) })
    return res.ok
  } catch {
    return false
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; player-retention-v2/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return await res.text()
  } catch {
    return null
  }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// ─── Sidearm fallback: extract team logo from conference stats HTML ───────────

function extractLogoFromHtml(html: string, displayName: string): string | null {
  // Try to find an NCAA CDN logo URL embedded in the page
  const ncaaMatch = html.match(/https:\/\/[^"']*ncaa\.com[^"']*logos[^"']*\.svg/g)
  if (ncaaMatch) return ncaaMatch[0]

  // Look for img tags with "logo" in src
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+logo[s]?[^"']*)["']/gi)
  for (const m of imgMatches) {
    const src = m[1]
    if (src.includes('site') || src.includes('conference') || src.includes('responsive')) continue
    if (src.startsWith('http')) return src
  }

  // Look for team-specific image in conference /images/logos/ directory
  const localImgMatches = html.matchAll(/["'](\/images\/logos\/[^"']+\.(png|jpg|svg))["']/gi)
  for (const m of localImgMatches) {
    const src = m[1]
    if (src.includes('site.')) continue
    return src  // caller will prepend conf base URL
  }

  return null
}

// ─── Main ──────────────────────────────────────────────────────────────────────

interface RegistryEntry {
  slug: string
  displayName: string
  division: 'D1' | 'D2'
  conference: string
  externalIds: { sidearmId?: string }
}

interface ConferenceConfig { url: string; path: string }

async function main() {
  const registry: RegistryEntry[] = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
  const logos: Record<string, string> = JSON.parse(fs.readFileSync(LOGOS_PATH, 'utf-8'))
  const confUrls: Record<string, ConferenceConfig> = JSON.parse(fs.readFileSync(CONF_URLS_PATH, 'utf-8'))

  const missing = registry.filter(e => e.division === 'D2' && !logos[e.slug])
  console.log(`\nFetching logos for ${missing.length} teams without a logo...\n`)

  let found = 0
  let failed = 0

  // Track Sidearm URLs already assigned to a team — skip if the same URL
  // would be assigned again (it's the conference page's "first logo", not team-specific)
  const usedSidearmUrls = new Set<string>(Object.values(logos))

  for (const team of missing) {
    const candidates = ncaaCandidates(team.slug, team.displayName)
    let logoUrl: string | null = null

    // 1. Try NCAA CDN candidates
    for (const candidate of candidates) {
      const url = `${NCAA_CDN}/${candidate}.svg`
      if (await tryUrl(url)) {
        logoUrl = url
        console.log(`[NCAA]  ${team.slug} → ${candidate}.svg`)
        break
      }
      await sleep(50)
    }

    // 2. Fall back to Sidearm conference page (only accept unique URLs — shared
    //    URLs are the conference page's first-team logo, not team-specific)
    if (!logoUrl) {
      const confConfig = confUrls[team.conference]
      if (confConfig && team.externalIds.sidearmId) {
        const statsUrl = `${confConfig.url}/stats.aspx?path=${confConfig.path}&year=2025`
        const html = await fetchHtml(statsUrl)
        await sleep(DELAY)

        if (html) {
          const extracted = extractLogoFromHtml(html, team.displayName)
          if (extracted) {
            const candidate = extracted.startsWith('http')
              ? extracted
              : `${confConfig.url}${extracted}`
            if (!usedSidearmUrls.has(candidate)) {
              logoUrl = candidate
              usedSidearmUrls.add(candidate)
              console.log(`[SIDEARM] ${team.slug} → ${logoUrl}`)
            } else {
              console.log(`[SKIP]  ${team.slug} — Sidearm URL is a duplicate (conference first-logo)`)
            }
          }
        }
      }
    }

    await sleep(DELAY)

    if (logoUrl) {
      logos[team.slug] = logoUrl
      found++
    } else {
      console.log(`[MISS]  ${team.slug} (${team.conference}) — no logo found`)
      failed++
    }
  }

  console.log(`\n── Results ─────────────────────────────────────────────`)
  console.log(`  Found:  ${found}`)
  console.log(`  Missed: ${failed}`)

  if (dryRun) {
    console.log('\n[dry-run] Would update d2-logos.json')
    return
  }

  fs.writeFileSync(LOGOS_PATH, JSON.stringify(logos, null, 2))
  console.log(`\nWrote ${LOGOS_PATH} (total: ${Object.keys(logos).length} entries)`)
}

main().catch(err => { console.error(err); process.exit(1) })
