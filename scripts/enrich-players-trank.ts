/**
 * enrich-players-trank.ts
 *
 * Reads a T-Rank season CSV and appends tRank* fields to matching player
 * entries in the CBBD player cache. Non-destructive: only adds new keys,
 * never overwrites existing CBBD fields.
 *
 * Usage:
 *   npx tsx scripts/enrich-players-trank.ts --year=2026
 *   npx tsx scripts/enrich-players-trank.ts --year=2025   (after adding data/t-rank/d1/2025.csv)
 *
 * Safe to re-run — idempotent, overwrites tRank* fields only.
 */

import * as fs from 'fs'
import * as path from 'path'

// ─── Config ───────────────────────────────────────────────────────────────────

const PROJECT_ROOT = path.resolve(__dirname, '..')
const TRANK_DIR    = path.join(PROJECT_ROOT, 'data/t-rank/d1')
const CACHE_DIR    = path.join(PROJECT_ROOT, 'data/cache/d1/cbbd/players')
const ALIASES_FILE = path.join(PROJECT_ROOT, 'data/t-rank/team-aliases.json')

// ─── CLI arg ──────────────────────────────────────────────────────────────────

const yearArg = process.argv.find(a => a.startsWith('--year='))
if (!yearArg) {
  console.error('Usage: npx tsx scripts/enrich-players-trank.ts --year=YYYY')
  process.exit(1)
}
const YEAR = parseInt(yearArg.replace('--year=', ''), 10)
if (isNaN(YEAR) || YEAR < 2021 || YEAR > 2030) {
  console.error('Invalid year:', YEAR)
  process.exit(1)
}

// ─── CSV parser (handles quoted fields with embedded commas) ──────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') { inQuote = !inQuote; continue }
    if (c === ',' && !inQuote) { fields.push(cur); cur = ''; continue }
    cur += c
  }
  fields.push(cur)
  return fields
}

// ─── Name normalizer ──────────────────────────────────────────────────────────

function normName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // strip accents
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Auto-slugify for T-Rank team names ───────────────────────────────────────

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

// ─── Load aliases ─────────────────────────────────────────────────────────────

const rawAliases = JSON.parse(fs.readFileSync(ALIASES_FILE, 'utf-8')) as Record<string, string>
const ALIASES: Record<string, string> = {}
for (const [k, v] of Object.entries(rawAliases)) {
  if (!k.startsWith('_')) ALIASES[k] = v
}

function trankTeamToSlug(trankTeam: string): string | null {
  if (ALIASES[trankTeam]) return ALIASES[trankTeam]
  const auto = slugify(trankTeam)
  const yearDir = path.join(CACHE_DIR, String(YEAR))
  if (fs.existsSync(path.join(yearDir, `${auto}.json`))) return auto
  return null
}

// ─── Load T-Rank CSV ──────────────────────────────────────────────────────────

const csvPath = path.join(TRANK_DIR, `${YEAR}.csv`)
if (!fs.existsSync(csvPath)) {
  console.error(`T-Rank CSV not found: ${csvPath}`)
  process.exit(1)
}

const lines = fs.readFileSync(csvPath, 'utf-8').split('\n')
const header = parseCSVLine(lines[0])

const idx = {
  player_name:   header.indexOf('player_name'),
  team:          header.indexOf('team'),
  year:          header.indexOf('year'),
  pid:           header.indexOf('pid'),
  position_role: header.indexOf('position_role'),
  yr:            header.indexOf('yr'),
  ht:            header.indexOf('ht'),
  usg:           header.indexOf('usg'),
  Ortg:          header.indexOf('Ortg'),
  drtg:          header.indexOf('drtg'),
  bpm:           header.indexOf('bpm'),
  obpm:          header.indexOf('obpm'),
  dbpm:          header.indexOf('dbpm'),
}

// Validate all required columns exist
for (const [name, i] of Object.entries(idx)) {
  if (i === -1) { console.error(`Missing column in CSV: ${name}`); process.exit(1) }
}

// ─── Build T-Rank index: slug → [{ normName, fields }] ───────────────────────

interface TRankEntry {
  normName: string
  pid: number
  positionRole: string
  yr: string
  ht: string
  usg: number
  ortg: number
  drtg: number
  bpm: number
  obpm: number
  dbpm: number
}

const trankBySlug = new Map<string, TRankEntry[]>()
let csvSkipped = 0

for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue
  const row = parseCSVLine(line)

  // Validate year column matches expected year
  const rowYear = parseInt(row[idx.year], 10)
  if (rowYear !== YEAR) {
    csvSkipped++
    continue
  }

  const trankTeam = row[idx.team]
  const slug = trankTeamToSlug(trankTeam)
  if (!slug) continue  // unmappable team — logged at end

  const entry: TRankEntry = {
    normName:     normName(row[idx.player_name]),
    pid:          parseInt(row[idx.pid], 10),
    positionRole: row[idx.position_role] ?? '',
    yr:           row[idx.yr] ?? '',
    ht:           row[idx.ht] ?? '',
    usg:          parseFloat(row[idx.usg]) || 0,
    ortg:         parseFloat(row[idx.Ortg]) || 0,
    drtg:         parseFloat(row[idx.drtg]) || 0,
    bpm:          parseFloat(row[idx.bpm]) || 0,
    obpm:         parseFloat(row[idx.obpm]) || 0,
    dbpm:         parseFloat(row[idx.dbpm]) || 0,
  }

  if (!trankBySlug.has(slug)) trankBySlug.set(slug, [])
  trankBySlug.get(slug)!.push(entry)
}

// ─── Enrich player cache files ────────────────────────────────────────────────

const yearDir = path.join(CACHE_DIR, String(YEAR))
if (!fs.existsSync(yearDir)) {
  console.error(`Player cache directory not found: ${yearDir}`)
  process.exit(1)
}

let matched = 0
let unmatched = 0
let skippedNoTRank = 0
let ambiguous = 0

const teamFiles = fs.readdirSync(yearDir).filter(f => f.endsWith('.json'))

for (const file of teamFiles) {
  const slug = file.replace('.json', '')
  const filePath = path.join(yearDir, file)
  const cacheEntry = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    data: Record<string, unknown>[]
    fetchedAt: string
    frozen: boolean
  }

  const players = cacheEntry.data
  if (!Array.isArray(players)) continue

  const trankPlayers = trankBySlug.get(slug) ?? []
  if (trankPlayers.length === 0) {
    skippedNoTRank += players.length
    continue
  }

  // Build a lookup: normName → TRankEntry (check for duplicates on same team)
  const trankLookup = new Map<string, TRankEntry | 'AMBIGUOUS'>()
  for (const tp of trankPlayers) {
    if (trankLookup.has(tp.normName)) {
      trankLookup.set(tp.normName, 'AMBIGUOUS')
    } else {
      trankLookup.set(tp.normName, tp)
    }
  }

  let fileModified = false
  for (const player of players) {
    const pName = player.playerName as string
    const norm = normName(pName)
    const match = trankLookup.get(norm)

    if (!match) {
      unmatched++
      continue
    }
    if (match === 'AMBIGUOUS') {
      console.warn(`  AMBIGUOUS name match: "${pName}" on ${slug} — skipping`)
      ambiguous++
      continue
    }

    // Only add tRank* fields — never touch existing CBBD fields
    player.tRankPid          = match.pid
    player.tRankPositionRole = match.positionRole || undefined
    player.tRankYr           = match.yr || undefined
    player.tRankHt           = match.ht || undefined
    player.tRankUsg          = match.usg || undefined
    player.tRankOrtg         = match.ortg || undefined
    player.tRankDrtg         = match.drtg || undefined
    player.tRankBpm          = match.bpm !== 0 ? match.bpm : undefined
    player.tRankObpm         = match.obpm !== 0 ? match.obpm : undefined
    player.tRankDbpm         = match.dbpm !== 0 ? match.dbpm : undefined

    matched++
    fileModified = true
  }

  if (fileModified) {
    fs.writeFileSync(filePath, JSON.stringify(cacheEntry, null, 2))
  }
}

// ─── Report unmappable T-Rank teams ──────────────────────────────────────────

const allTrankTeams = new Set<string>()
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim()
  if (!line) continue
  const row = parseCSVLine(line)
  if (parseInt(row[idx.year], 10) === YEAR) allTrankTeams.add(row[idx.team])
}
const unmappedTeams = Array.from(allTrankTeams).filter(t => !trankTeamToSlug(t)).sort()

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\nT-Rank enrichment — ${YEAR}`)
console.log(`  CSV rows scanned:     ${lines.length - 1 - csvSkipped}`)
console.log(`  Teams mapped:         ${trankBySlug.size}`)
console.log(`  Players matched:      ${matched}`)
console.log(`  Players unmatched:    ${unmatched}`)
console.log(`  Ambiguous names:      ${ambiguous}`)
console.log(`  No T-Rank coverage:   ${skippedNoTRank} (likely low-minute players)`)
if (unmappedTeams.length > 0) {
  console.log(`  Unmapped T-Rank teams (${unmappedTeams.length}):`)
  unmappedTeams.forEach(t => console.log(`    - "${t}"`))
}
console.log()
