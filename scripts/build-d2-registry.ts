/**
 * Discovers all D2 teams from Sidearm conference stats pages and appends them
 * to data/registry/teams.json.
 *
 * For each conference in d2-conference-urls.json:
 *   1. Fetch conference stats HTML to find team links (school codes + display names)
 *   2. For each school, fetch the teamstats page to extract the numeric Sidearm team_code
 *   3. Map display name → slug using d2-team-aliases.json + auto-slugify
 *   4. Write RegistryEntry to teams.json (skips if slug already present)
 *
 * Flags:
 *   --conference NAME   process only this conference (key from d2-conference-urls.json)
 *   --dry-run           print plan, make no changes
 *   --delay N           ms between requests (default: 800)
 *   --skip-existing     skip conferences that already have teams in registry (default: false)
 *
 * Usage:
 *   npx tsx scripts/build-d2-registry.ts --dry-run
 *   npx tsx scripts/build-d2-registry.ts --conference GLIAC
 *   npx tsx scripts/build-d2-registry.ts --conference NSIC
 *   npx tsx scripts/build-d2-registry.ts --conference PSAC
 *   npx tsx scripts/build-d2-registry.ts   # all conferences
 */

import * as fs   from 'fs'
import * as path from 'path'

const CONF_URLS_PATH = path.resolve(process.cwd(), 'data', 'registry', 'd2-conference-urls.json')
const ALIASES_PATH   = path.resolve(process.cwd(), 'data', 'registry', 'd2-team-aliases.json')
const REGISTRY_PATH  = path.resolve(process.cwd(), 'data', 'registry', 'teams.json')

interface ConferenceConfig { url: string; path: string }
interface RegistryEntry {
  slug: string
  displayName: string
  shortName: string
  division: 'D1' | 'D2'
  conference: string
  externalIds: { cbbdTeamId?: number; cbbdName?: string; sidearmId?: string; masseyName?: string }
  logoUrl: string | null
}

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const dryRun       = args.includes('--dry-run')
const skipExisting = args.includes('--skip-existing')

function argVal(flag: string): string | null {
  const i = args.indexOf(flag)
  return i !== -1 ? (args[i + 1] ?? null) : null
}

const targetConf = argVal('--conference')
const delay      = parseInt(argVal('--delay') ?? '800') || 800

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/\(([a-z]+)\)/gi, '$1')
    .replace(/[.']/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

function resolveSlug(displayName: string, aliases: Record<string, string>): string {
  if (aliases[displayName]) return aliases[displayName]
  return slugify(displayName)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Conference stats page: extract team links ─────────────────────────────────

interface TeamLink { schoolCode: string; displayName: string }

function parseTeamLinks(html: string, sportPath: string): TeamLink[] {
  const results: TeamLink[] = []
  const seen = new Set<string>()

  // Match: /teamstats.aspx?path=mbball&year=YYYY&school=CODE">TEAM NAME</a>
  const re = new RegExp(
    `teamstats\\.aspx\\?path=${sportPath}&year=\\d+&school=([^"&]+)[^>]*>([^<]+)<\\/a>`,
    'gi'
  )
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const code = m[1].trim()
    const name = m[2].replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim()
    if (code && name && !seen.has(code)) {
      seen.add(code)
      results.push({ schoolCode: code, displayName: name })
    }
  }
  return results
}

// ── Teamstats page: extract numeric team_code ─────────────────────────────────

function extractTeamCode(html: string): string | null {
  const patterns = [
    // JavaScript variable assignments
    /var\s+team_id\s*=\s*['""]?(\d+)['""]?/i,
    /team_id\s*:\s*['""](\d+)['""]?/i,
    /teamId\s*=\s*['""]?(\d+)['""]?/i,
    // Knockout.js observable
    /team_id['"]\s*,\s*['""](\d+)['""]?/i,
    // Data attribute
    /data-team(?:-id)?=["'](\d+)["']/i,
    // JSON-like in script blocks
    /"team_code"\s*:\s*"(\d+)"/i,
    /team_code\s*[=:]\s*['""]?(\d+)['""]?/i,
    // Generic: any team_id number in a JS context
    /[^a-z]team_id[^a-z0-9]*(\d{2,6})[^a-z0-9]/i,
  ]
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }
  return null
}

// ── Fetchers ──────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; player-retention-v2/1.0)' },
    })
    if (!res.ok) {
      console.warn(`  HTTP ${res.status}: ${url}`)
      return null
    }
    return await res.text()
  } catch (err) {
    console.warn(`  Fetch error: ${url} — ${err}`)
    return null
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface DiscoveredTeam {
  conference: string
  schoolCode: string
  displayName: string
  sidearmId: string
  slug: string
}

async function main(): Promise<void> {
  const confUrls: Record<string, ConferenceConfig> = JSON.parse(
    fs.readFileSync(CONF_URLS_PATH, 'utf-8')
  )
  const aliases: Record<string, string> = fs.existsSync(ALIASES_PATH)
    ? JSON.parse(fs.readFileSync(ALIASES_PATH, 'utf-8'))
    : {}

  const registry: RegistryEntry[] = fs.existsSync(REGISTRY_PATH)
    ? JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'))
    : []

  const existingSlugs = new Set(registry.map(e => e.slug))

  const conferences = targetConf
    ? { [targetConf]: confUrls[targetConf] }
    : confUrls

  if (targetConf && !confUrls[targetConf]) {
    console.error(`Unknown conference: "${targetConf}". Available: ${Object.keys(confUrls).join(', ')}`)
    process.exit(1)
  }

  const discovered: DiscoveredTeam[] = []
  const failed: string[] = []
  const noTeamId: { conf: string; name: string; code: string }[] = []

  for (const [confName, confConfig] of Object.entries(conferences)) {
    if (skipExisting) {
      const hasExisting = registry.some(e => e.division === 'D2' && e.conference === confName)
      if (hasExisting) {
        console.log(`[skip] ${confName} — already has D2 entries in registry`)
        continue
      }
    }

    console.log(`\n── ${confName} ─────────────────────────`)

    // 1. Fetch conference stats page to find team links
    // Sidearm uses starting-year: year=2025 means 2025-26 season (our label 2026)
    const statsUrl  = `${confConfig.url}/stats.aspx?path=${confConfig.path}&year=2025`
    const statsHtml = await fetchHtml(statsUrl)
    await sleep(delay)

    if (!statsHtml) {
      console.warn(`  Could not fetch conference stats page: ${statsUrl}`)
      failed.push(confName)
      continue
    }

    const teamLinks = parseTeamLinks(statsHtml, confConfig.path)
    if (teamLinks.length === 0) {
      console.warn(`  No team links found on stats page — may need manual inspection`)
      failed.push(confName)
      continue
    }

    console.log(`  Found ${teamLinks.length} teams`)

    // 2. For each team, fetch teamstats page to get numeric team_code
    for (const link of teamLinks) {
      const teamUrl  = `${confConfig.url}/teamstats.aspx?path=${confConfig.path}&year=2025&school=${link.schoolCode}`
      const teamHtml = await fetchHtml(teamUrl)
      await sleep(delay)

      if (!teamHtml) {
        noTeamId.push({ conf: confName, name: link.displayName, code: link.schoolCode })
        continue
      }

      const teamCode = extractTeamCode(teamHtml)
      if (!teamCode) {
        console.warn(`  No team_code found for ${link.displayName} (${link.schoolCode})`)
        noTeamId.push({ conf: confName, name: link.displayName, code: link.schoolCode })
        continue
      }

      const slug = resolveSlug(link.displayName, aliases)
      discovered.push({
        conference: confName,
        schoolCode: link.schoolCode,
        displayName: link.displayName,
        sidearmId: teamCode,
        slug,
      })
      console.log(`  ✓ ${link.displayName} → slug: ${slug}  sidearmId: ${teamCode}`)
    }
  }

  // ── Summary ──────────────────────────────────────────────────────────────────

  console.log(`\n── Results ─────────────────────────────`)
  console.log(`  Discovered:      ${discovered.length}`)
  console.log(`  Missing team_id: ${noTeamId.length}`)
  console.log(`  Failed confs:    ${failed.length}`)

  if (noTeamId.length > 0) {
    console.log('\nMissing team_id (need manual sidearmId lookup):')
    noTeamId.forEach(t => console.log(`  ${t.conf} / ${t.name} (code: ${t.code})`))
  }

  // Detect slug collisions
  const newSlugs = new Map<string, DiscoveredTeam>()
  for (const team of discovered) {
    if (newSlugs.has(team.slug)) {
      console.warn(`\nSlug collision: "${team.slug}" → ${team.displayName} (${team.conference}) vs ${newSlugs.get(team.slug)!.displayName}`)
      console.warn(`  Add one of these to d2-team-aliases.json with a disambiguated slug`)
    } else {
      newSlugs.set(team.slug, team)
    }
  }

  if (dryRun) {
    console.log('\n[dry-run] Would add these entries:')
    for (const t of discovered) {
      const isNew = !existingSlugs.has(t.slug)
      console.log(`  ${isNew ? '+ NEW' : '= exists'} ${t.slug}  (${t.conference})`)
    }
    return
  }

  // ── Write to registry ─────────────────────────────────────────────────────────

  let added = 0
  let skipped = 0

  for (const team of discovered) {
    if (existingSlugs.has(team.slug)) {
      // Update sidearmId on existing D2 entry if missing
      const existing = registry.find(e => e.slug === team.slug)
      if (existing && existing.division === 'D2' && !existing.externalIds.sidearmId) {
        existing.externalIds.sidearmId = team.sidearmId
        console.log(`  Updated sidearmId for existing: ${team.slug}`)
        added++
      } else {
        skipped++
      }
      continue
    }

    registry.push({
      slug:        team.slug,
      displayName: team.displayName,
      shortName:   team.displayName,
      division:    'D2',
      conference:  team.conference,
      externalIds: { sidearmId: team.sidearmId },
      logoUrl:     null,
    })
    existingSlugs.add(team.slug)
    added++
  }

  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2))
  console.log(`\nWrote ${REGISTRY_PATH}`)
  console.log(`  Added/updated: ${added}`)
  console.log(`  Skipped (already present): ${skipped}`)
  console.log(`  Total registry entries: ${registry.length}`)
}

main().catch(err => { console.error(err); process.exit(1) })
