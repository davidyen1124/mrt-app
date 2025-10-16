#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())
const dataPath = path.join(root, 'data', 'metro_taipei_stations_zh.json')

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function main() {
  if (!fs.existsSync(dataPath)) {
    console.error(`Data file not found: ${dataPath}`)
    process.exit(1)
  }
  const data = readJson(dataPath)
  const lines = data.lines || []

  const codeToName = new Map()
  const codeToEntries = new Map()

  for (const line of lines) {
    for (const s of line.stations || []) {
      const name = s.name_zh
      for (const code of s.codes || []) {
        if (name) codeToName.set(code, name)
        if (!codeToEntries.has(code)) codeToEntries.set(code, [])
        codeToEntries.get(code).push(s)
      }
    }
  }

  const missing = []
  for (const [code] of codeToEntries) {
    if (!codeToName.has(code)) missing.push(code)
  }
  missing.sort((a, b) => a.localeCompare(b))

  const groups = {}
  for (const c of missing) {
    const m = c.match(/^([A-Z]+)(\d+)/)
    const p = m ? m[1] : '?'
    ;(groups[p] || (groups[p] = [])).push(c)
  }

  console.log('Stations referenced with no Chinese name:', missing.length)
  for (const p of Object.keys(groups).sort()) {
    console.log(`- ${p}: ${groups[p].join(', ')}`)
  }

  // Optional: identify numeric gaps per prefix for extra sanity
  const byPrefix = {}
  for (const c of codeToEntries.keys()) {
    const m = c.match(/^([A-Z]+)(\d+)/)
    if (!m) continue
    const p = m[1], n = Number(m[2])
    ;(byPrefix[p] || (byPrefix[p] = new Set())).add(n)
  }
  for (const p of Object.keys(byPrefix).sort()) {
    const nums = [...byPrefix[p]].sort((a, b) => a - b)
    if (nums.length < 2) continue
    const min = nums[0], max = nums[nums.length - 1]
    const gaps = []
    for (let i = min; i <= max; i++) if (!byPrefix[p].has(i)) gaps.push(i)
    if (gaps.length) console.log(`Gaps in ${p} ${min}-${max}: ${gaps.join(', ')}`)
  }
}

main()

