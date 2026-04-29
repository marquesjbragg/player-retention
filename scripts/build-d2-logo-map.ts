/**
 * Converts data/logos/NCAA Division II Logos.csv → data/registry/d2-logos.json
 *
 * CSV format: Team,Logo_URL
 * Output format: { "team-slug": "https://..." }
 *
 * Slug derivation:
 *   1. Try direct match from d2-team-aliases.json (NCAA logo name → slug)
 *   2. Fall back to auto-slugify of the CSV name
 *
 * Any unmatched names are logged — add them to d2-team-aliases.json to resolve.
 *
 * Usage:
 *   npx tsx scripts/build-d2-logo-map.ts
 *   npx tsx scripts/build-d2-logo-map.ts --dry-run
 */

import * as fs   from 'fs'
import * as path from 'path'

const CSV_PATH     = path.resolve(process.cwd(), 'data', 'logos', 'NCAA Division II Logos.csv')
const ALIASES_PATH = path.resolve(process.cwd(), 'data', 'registry', 'd2-team-aliases.json')
const OUTPUT_PATH  = path.resolve(process.cwd(), 'data', 'registry', 'd2-logos.json')

const dryRun = process.argv.includes('--dry-run')

// ─── NCAA logo name → slug expansion table ────────────────────────────────────
// Handles abbreviations NCAA.com uses that don't match Sidearm/registry names.
// These are NCAA-logo-specific and separate from d2-team-aliases.json.

const NCAA_LOGO_EXPANSIONS: Record<string, string> = {
  // State abbreviations
  'Cal St. East Bay':        'cal-state-east-bay',
  'Cal St. Monterey Bay':    'cal-state-monterey-bay',
  'Cal St. Los Angeles':     'cal-state-la',
  'Cal St. San Bernardino':  'cal-state-san-bernardino',
  'Colo. School of Mines':   'colorado-school-of-mines',
  'N.C. Central':            'nc-central',
  'N.C. A&T':                'nc-at',
  'Northern Mich.':          'northern-michigan',
  'Grand Valley St.':        'grand-valley-state',
  'Ferris St.':              'ferris-state',
  'Saginaw Valley St.':      'saginaw-valley-state',
  'Lake Superior St.':       'lake-superior-state',
  'Michigan Tech':           'michigan-tech',
  'Minn. State Mankato':     'minnesota-state-mankato',
  'Minn. State Moorhead':    'minnesota-state-moorhead',
  'Bemidji St.':             'bemidji-state',
  'Minn. Duluth':            'minnesota-duluth',
  'SW Minnesota St.':        'southwest-minnesota-state',
  'Concordia-St. Paul':      'concordia-st-paul',
  'S. Dakota Mines':         'south-dakota-mines',
  'Black Hills St.':         'black-hills-state',
  'Chadron St.':             'chadron-state',
  'Wayne St. (NE)':          'wayne-state-ne',
  'N. State':                'northern-state',
  'Augustana (SD)':          'augustana-sd',
  'Sioux Falls':             'sioux-falls',
  'Fort Hays St.':           'fort-hays-state',
  'Emporia St.':             'emporia-state',
  'Pittsburg St.':           'pittsburg-state',
  'Nebraska-Kearney':        'nebraska-kearney',
  'NW Missouri St.':         'northwest-missouri-state',
  'Central Mo.':             'central-missouri',
  'Mo. Southern St.':        'missouri-southern',
  'Mo. Western St.':         'missouri-western',
  'Northeastern St.':        'northeastern-state',
  'Washburn':                'washburn',
  'Newman':                  'newman',
  'Rogers St.':              'rogers-state',
  'Colo. Mesa':              'colorado-mesa',
  'Western Colo.':           'western-colorado',
  'Colo. Christian':         'colorado-christian',
  'Fort Lewis':              'fort-lewis',
  'N.M. Highlands':          'new-mexico-highlands',
  'Colo.-Colo. Springs':     'uccs',
  'CSU Pueblo':              'csu-pueblo',
  'MSU Denver':              'metro-state',
  'Regis':                   'regis',
  'Westminster (UT)':        'westminster-ut',
  'Fayetteville St.':        'fayetteville-state',
  'Virginia Union':          'virginia-union',
  'Winston-Salem St.':       'winston-salem-state',
  'E. City State':           'elizabeth-city-state',
  'Shaw':                    'shaw',
  'Johnson C. Smith':        'johnson-c-smith',
  'Claflin':                 'claflin',
  'Bluefield St.':           'bluefield-state',
  'Lenoir-Rhyne':            'lenoir-rhyne',
  'UNC Pembroke':            'unc-pembroke',
  'Belmont Abbey':           'belmont-abbey',
  'Queens (NC)':             'queens-nc',
  'W. Texas A&M':            'west-texas-am',
  'Lubbock Christian':       'lubbock-christian',
  'Angelo St.':              'angelo-state',
  'Sul Ross St.':            'sul-ross-state',
  'E. New Mexico':           'eastern-new-mexico',
  'UT Dallas':               'ut-dallas',
  'St. Edward\'s':           'st-edwards',
  'Valdosta St.':            'valdosta-state',
  'West Florida':            'west-florida',
  'West Ala.':               'west-alabama',
  'Delta St.':               'delta-state',
  'Trevecca':                'trevecca',
  'Christian Brothers':      'christian-brothers',
  'Auburn-Montgomery':       'auburn-montgomery',
  'Montevallo':              'montevallo',
  'Miss. College':           'mississippi-college',
  'N. Georgia':              'north-georgia',
  'Lander':                  'lander',
  'Flagler':                 'flagler',
  'Clayton St.':             'clayton-state',
  'Ga. Southwestern':        'georgia-southwestern',
  'Ga. College':             'georgia-college',
  'USC Aiken':               'south-carolina-aiken',
  'Columbus St.':            'columbus-state',
  'Middle Ga. St.':          'middle-georgia-state',
  'USC Beaufort':            'uscb',
  'S. NH':                   'southern-new-hampshire',
  'Franklin Pierce':         'franklin-pierce',
  'Saint Anselm':            'saint-anselm',
  'Assumption':              'assumption',
  'Merrimack':               'merrimack',
  'St. Michael\'s':          'saint-michaels',
  'Am. International':       'american-international',
  'Adelphi':                 'adelphi',
  'Stonehill':               'stonehill',
  'Le Moyne':                'le-moyne',
  'Pace':                    'pace',
  'Pitt-Johnstown':          'pitt-johnstown',
  'Pitt-Bradford':           'pitt-bradford',
  'Shippensburg':            'shippensburg',
  'Slippery Rock':           'slippery-rock',
  'East Stroudsburg':        'east-stroudsburg',
  'Kutztown':                'kutztown',
  'Bloomsburg':              'bloomsburg',
  'Clarion':                 'clarion',
  'Edinboro':                'edinboro',
  'Mansfield':               'mansfield',
  'Lock Haven':              'lock-haven',
  'West Chester':            'west-chester',
  'Millersville':            'millersville',
  'Cal. (PA)':               'california-pa',
  'Indiana (PA)':            'indiana-pa',
  'Shepherd':                'shepherd',
  'Gannon':                  'gannon',
  'Saint Leo':               'saint-leo',
  'Rollins':                 'rollins',
  'Barry':                   'barry',
  'Embry-Riddle':            'embry-riddle',
  'Nova Southeastern':       'nova-southeastern',
  'Fla. Tech':               'florida-tech',
  'Fla. Southern':           'florida-southern',
  'Palm Beach Atl.':         'palm-beach-atlantic',
  'Tampa':                   'tampa',
  'Eckerd':                  'eckerd',
  'Lynn':                    'lynn',
  'Saint Martin\'s':         'saint-martins',
  'Pt. Loma':                'point-loma',
  'Concordia (CA)':          'concordia-irvine',
  'Cal Baptist':             'california-baptist',
  'Azusa Pacific':           'azusa-pacific',
  'Biola':                   'biola',
  'Dominguez Hills':         'cal-state-dominguez-hills',
  'Alaska Anchorage':        'alaska-anchorage',
  'Alaska Fairbanks':        'alaska-fairbanks',
  'Chaminade':               'chaminade',
  'Hawaii Hilo':             'hawaii-hilo',
  'Sonoma St.':              'sonoma-state',
  'Stanislaus St.':          'stanislaus-state',
  'Cal Poly Pomona':         'cal-poly-pomona',
  'Holy Names':              'holy-names',
  'Dominican (CA)':          'dominican-ca',
  'W. New Mexico':           'western-new-mexico',
  'Central Wash.':           'central-washington',
  'Frostburg St.':           'frostburg-state',
  'W. Va. Wesleyan':         'west-virginia-wesleyan',
  'W. Va. State':            'west-virginia-state',
  'Glenville St.':           'glenville-state',
  'Fairmont St.':            'fairmont-state',
  'Concord':                 'concord',
  'Wheeling':                'wheeling',
  'Alderson Broaddus':       'alderson-broaddus',
  'Davis & Elkins':          'davis-elkins',
  'Salem':                   'salem',
  'W. Liberty':              'west-liberty',
  'Ashland':                 'ashland',
  'Hillsdale':               'hillsdale',
  'Findlay':                 'findlay',
  'Tiffin':                  'tiffin',
  'Walsh':                   'walsh',
  'Malone':                  'malone',
  'Cedarville':              'cedarville',
  'Ohio Dominican':          'ohio-dominican',
  'Otterbein':               'otterbein',
  'Lake Erie':               'lake-erie',
  'Notre Dame (OH)':         'notre-dame-oh',
  'Ursuline':                'ursuline',
  'Rockhurst':               'rockhurst',
  'Drury':                   'drury',
  'Truman St.':              'truman-state',
  'Mo. S&T':                 'missouri-st',
  'Upper Iowa':              'upper-iowa',
  'Indianapolis':            'indianapolis',
  'S. Indiana':              'southern-indiana',
  'Lewis':                   'lewis',
  'Quincy':                  'quincy',
  'Wis.-Parkside':           'parkside',
  'Wm. Jewell':              'william-jewell',
  'DBU':                     'dallas-baptist',
  'Anderson (SC)':           'anderson-sc',
  'Mount Olive':             'mount-olive',
  'Chowan':                  'chowan',
  'Young Harris':            'young-harris',
  'Emmanuel (GA)':           'emmanuel',
  'Catawba':                 'catawba',
  'Wingate':                 'wingate',
  'Barton':                  'barton',
  'Pfeiffer':                'pfeiffer',
  'S. Wesleyan':             'southern-wesleyan',
  'Lincoln (PA)':            'lincoln-pa',
  'Chestnut Hill':           'chestnut-hill',
  'Holy Family':             'holy-family',
  'Wilmington (DE)':         'wilmington-de',
  'Goldey-Beacom':           'goldey-beacom',
  'Caldwell':                'caldwell',
  'Felician':                'felician',
  'Georgian Court':          'georgian-court',
  'Daemen':                  'daemen',
  'Post':                    'post',
  'Jefferson':               'jefferson',
  'Dominican':               'dominican-ny',
  'Bridgeport':              'bridgeport',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function csvNameToSlug(name: string, aliases: Record<string, string>): string | null {
  // 1. Explicit expansion table (NCAA logo abbreviations)
  if (NCAA_LOGO_EXPANSIONS[name]) return NCAA_LOGO_EXPANSIONS[name]
  // 2. Global alias table
  if (aliases[name]) return aliases[name]
  // 3. Auto-slugify fallback
  const auto = slugify(name)
  return auto || null
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`)
    process.exit(1)
  }

  const aliases: Record<string, string> = fs.existsSync(ALIASES_PATH)
    ? JSON.parse(fs.readFileSync(ALIASES_PATH, 'utf-8'))
    : {}

  const lines = fs.readFileSync(CSV_PATH, 'utf-8').split('\n')
  const logoMap: Record<string, string> = {}
  const unmatched: string[] = []
  const duplicates: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Simple CSV split: first comma separates name from URL
    const firstComma = line.indexOf(',')
    if (firstComma === -1) continue
    const rawName = line.slice(0, firstComma).trim().replace(/^"|"$/g, '')
    const rawUrl  = line.slice(firstComma + 1).trim().replace(/^"|"$/g, '')

    if (!rawName || !rawUrl) continue

    const slug = csvNameToSlug(rawName, aliases)
    if (!slug) {
      unmatched.push(rawName)
      continue
    }

    if (logoMap[slug]) {
      duplicates.push(`${rawName} → ${slug} (collision)`)
    } else {
      logoMap[slug] = rawUrl
    }
  }

  console.log(`\nD2 Logo Map Build`)
  console.log(`  Matched:   ${Object.keys(logoMap).length}`)
  console.log(`  Unmatched: ${unmatched.length}`)
  console.log(`  Dupes:     ${duplicates.length}`)

  if (unmatched.length > 0) {
    console.log('\nUnmatched names (add to NCAA_LOGO_EXPANSIONS or d2-team-aliases.json):')
    unmatched.forEach(n => console.log(`  "${n}"`))
  }
  if (duplicates.length > 0) {
    console.log('\nDuplicate slugs:')
    duplicates.forEach(d => console.log(`  ${d}`))
  }

  if (dryRun) {
    console.log('\n[dry-run] Would write:', OUTPUT_PATH)
    return
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(logoMap, null, 2))
  console.log(`\nWrote: ${OUTPUT_PATH}`)
}

main()
