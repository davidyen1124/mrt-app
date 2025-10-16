#!/usr/bin/env node
// Geocode Taipei MRT stations using Geoapify and write coordinates JSON.
// Usage: GEOAPIFY_API_KEY=xxxx node scripts/geocode-taipei-stations.mjs

import fs from 'node:fs/promises'
import path from 'node:path'

const API_KEY = process.env.GEOAPIFY_API_KEY || ''
if (!API_KEY) {
  console.error('Set GEOAPIFY_API_KEY in env')
  process.exit(1)
}

const root = path.resolve(process.cwd(), '..')
const dataPath = path.join(root, 'data', 'metro_taipei_stations_zh.json')
const outPath = path.join(root, 'data', 'taipei_station_coords.json')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const fetchJSON = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'mrt-geocode/1.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return await res.json()
}

const buildQueries = (nameZh) => {
  const base = nameZh.replace(/\s+/g, '')
  // Try different phrasing orders
  return [
    `${base} 捷運站 台北 台灣`,
    `${base} 捷運站 新北 台灣`,
    `${base} 台北捷運 站 台灣`,
    `${base} 捷運 台北`,
    `${base} MRT Taipei Taiwan`,
  ]
}

const geocodeOne = async (text) => {
  const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete')
  url.searchParams.set('text', text)
  url.searchParams.set('apiKey', API_KEY)
  url.searchParams.set('limit', '1')
  url.searchParams.set('lang', 'zh')
  url.searchParams.set('filter', 'countrycode:tw')
  // bias to Taipei bounding box (rough): lon 121.3..121.7, lat 24.9..25.2
  url.searchParams.set('bias', 'rect:121.3,24.9,121.7,25.2')
  try {
    const data = await fetchJSON(url.toString())
    const f = data?.features?.[0]
    if (!f) return null
    const { lat, lon } = f.properties || {}
    if (typeof lat === 'number' && typeof lon === 'number') return { lat, lng: lon, src: f.properties?.formatted }
    return null
  } catch (e) {
    return null
  }
}

const main = async () => {
  const raw = JSON.parse(await fs.readFile(dataPath, 'utf-8'))
  const lines = raw?.lines || raw?.lines?.lines || raw
  const stations = []
  for (const L of lines) for (const s of L.stations) stations.push(s)

  let out = {}
  try {
    const prev = JSON.parse(await fs.readFile(outPath, 'utf-8'))
    if (prev && typeof prev === 'object') out = prev
  } catch {}
  let i = 0
  for (const s of stations) {
    i++
    // Skip if we already have non-null coords
    const prev = out[s.id]
    if (prev && typeof prev.lat === 'number' && typeof prev.lng === 'number') {
      if (i % 10 === 0) console.log(`Skip cached ${i}`)
      continue
    }
    const name = s.name_zh || s.id
    const qs = buildQueries(name)
    let hit = null
    for (const q of qs) {
      hit = await geocodeOne(q)
      if (hit) break
      await sleep(120)
    }
    if (hit) out[s.id] = { id: s.id, lat: hit.lat, lng: hit.lng, matched: hit.src, name_zh: s.name_zh }
    else out[s.id] = { id: s.id, lat: null, lng: null, matched: null, name_zh: s.name_zh }
    // Write partial progress every 20
    if (i % 20 === 0) {
      await fs.writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf-8')
    }
    if (i % 10 === 0) console.log(`Geocoded ${i}/${stations.length}`)
    await sleep(120)
  }
  await fs.writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf-8')
  console.log('Wrote', outPath)
}

main().catch(e => { console.error(e); process.exit(1) })
