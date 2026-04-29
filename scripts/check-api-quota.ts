/**
 * Makes a single CBBD API call and logs response status + rate-limit headers.
 * Does NOT print the API key.
 * Run: npx tsx scripts/check-api-quota.ts
 */
import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

async function main() {
  const key = process.env.CBB_DATA_API_KEY
  if (!key) { console.error('CBB_DATA_API_KEY not set'); process.exit(1) }

  const url = 'https://api.collegebasketballdata.com/stats/team/season?season=2025&team=Iowa+State'
  console.log(`Testing: ${url}`)
  console.log(`Key present: yes (length ${key.length})`)

  const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } })

  console.log(`\nStatus: ${res.status} ${res.statusText}`)
  console.log('\nRate-limit headers:')
  const rl = ['retry-after','x-ratelimit-limit','x-ratelimit-remaining','x-ratelimit-reset','x-rate-limit-limit','x-rate-limit-remaining','x-rate-limit-reset','cf-ray','ratelimit-limit','ratelimit-remaining','ratelimit-reset']
  for (const h of rl) {
    const v = res.headers.get(h)
    if (v) console.log(`  ${h}: ${v}`)
  }

  if (res.status === 429) {
    try {
      const body = await res.json()
      console.log('\nResponse body:', JSON.stringify(body).slice(0, 400))
    } catch { /* ignore */ }
  } else if (res.ok) {
    const data = await res.json() as unknown[]
    console.log(`\nData: ${Array.isArray(data) ? data.length + ' records' : 'object'}`)
  }
}

main().catch(console.error)
