import * as fs from 'fs'
import * as path from 'path'

export interface RegistryEntry {
  slug: string
  displayName: string
  shortName: string
  division: 'D1' | 'D2'
  conference: string
  externalIds: {
    cbbdTeamId?: number
    cbbdName?: string
    sidearmId?: string
    masseyName?: string
  }
  logoUrl: string | null
}

const REGISTRY_PATH = path.resolve(process.cwd(), 'data/registry/teams.json')

let _cache: RegistryEntry[] | null = null

function load(): RegistryEntry[] {
  if (_cache) return _cache
  if (!fs.existsSync(REGISTRY_PATH)) {
    throw new Error(`TeamRegistry not found at ${REGISTRY_PATH}. Run scripts/build-team-registry.ts first.`)
  }
  _cache = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8')) as RegistryEntry[]
  return _cache
}

export const TeamRegistry = {
  getAll(): RegistryEntry[] {
    return load()
  },

  getBySlug(slug: string): RegistryEntry | null {
    return load().find(e => e.slug === slug) ?? null
  },

  getByCbbdName(cbbdName: string): RegistryEntry | null {
    return load().find(e => e.externalIds.cbbdName === cbbdName) ?? null
  },

  getByCbbdTeamId(cbbdTeamId: number): RegistryEntry | null {
    return load().find(e => e.externalIds.cbbdTeamId === cbbdTeamId) ?? null
  },

  getConferences(division?: 'D1' | 'D2'): string[] {
    const entries = division ? load().filter(e => e.division === division) : load()
    const seen = new Set<string>()
    entries.forEach(e => seen.add(e.conference))
    return Array.from(seen).sort()
  },

  /** Invalidate the in-memory cache — useful after registry rebuild in the same process. */
  reset() {
    _cache = null
  },
}
