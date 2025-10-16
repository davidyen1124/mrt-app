#!/usr/bin/env node
/**
 * Refresh Taipei MRT station coordinates using the Geoapify autocomplete API.
 *
 * Usage:
 *   GEOAPIFY_API_KEY=xxxx scripts/refresh-taipei-station-coords.mjs
 *
 * The script queries Geoapify for every station found in
 * `data/metro_taipei_stations_zh.json`, writes the updated coordinates to
 * `data/taipei_station_coords.json`, and prints a short diff summary so you
 * can spot stations that moved unusually far (e.g. fuzzy matches).
 */

import fs from 'node:fs/promises'
import path from 'node:path'

const API_KEY = process.env.GEOAPIFY_API_KEY || ''
if (!API_KEY) {
  console.error('Set GEOAPIFY_API_KEY before running this script.')
  process.exit(1)
}

const root = path.resolve(process.cwd())
const stationsPath = path.join(root, 'data', 'metro_taipei_stations_zh.json')
const outputPath = path.join(root, 'data', 'taipei_station_coords.json')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const haversineMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 6371000
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const readJson = async (p) => JSON.parse(await fs.readFile(p, 'utf-8'))

const fetchJSON = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'mrt-refresh/1.0' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const buildQueries = (station) => {
  const out = new Set()
  const zi = (station.name_zh || '').replace(/\s+/g, '')
  if (zi) {
    out.add(`捷運${zi}站`)
    out.add(`${zi} 捷運站`)
    out.add(`${zi} 捷運 台北`)
  }
  out.add(`${station.id} 捷運站`)
  out.add(`${station.id} MRT Taipei`)
  out.add(station.id)
  return [...out]
}

const isCoordinatePlausible = (lat, lng) =>
  typeof lat === 'number' &&
  typeof lng === 'number' &&
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= 24.7 &&
  lat <= 25.3 &&
  lng >= 121.0 &&
  lng <= 121.8

const pickFeature = (features) => {
  if (!Array.isArray(features)) return null
  for (const f of features) {
    const props = f?.properties
    if (!props) continue
    const lat = props.lat
    const lng = props.lon
    if (!isCoordinatePlausible(lat, lng)) continue
    if ((props.country_code || '').toLowerCase() !== 'tw') continue
    return {
      lat,
      lng,
      formatted: props.formatted || props.name || null,
      confidence: props.rank?.confidence ?? null
    }
  }
  return null
}

const geocodeStation = async (station) => {
  const queries = buildQueries(station)
  for (const q of queries) {
    const url = new URL('https://api.geoapify.com/v1/geocode/autocomplete')
    url.searchParams.set('text', q)
    url.searchParams.set('apiKey', API_KEY)
    url.searchParams.set('limit', '5')
    url.searchParams.set('lang', 'zh')
    url.searchParams.set('filter', 'countrycode:tw')
    url.searchParams.set('bias', 'rect:121.1,24.7,121.8,25.3')
    try {
      const data = await fetchJSON(url.toString())
      const feature = pickFeature(data?.features)
      if (feature) return { ...feature, query: q }
    } catch (err) {
      console.error(`Failed ${station.id} (${q}):`, err.message)
    }
    await sleep(200)
  }
  return null
}

const main = async () => {
  const raw = await readJson(stationsPath)
  const lines = raw?.lines || []
  const stations = []
  for (const line of lines) for (const station of line.stations || []) stations.push(station)

  let previous = {}
  try {
    previous = await readJson(outputPath)
  } catch {
    previous = {}
  }

  const updated = {}
  const summary = []
  let missing = 0

  for (const station of stations) {
    const hit = await geocodeStation(station)
    if (!hit) {
      missing++
      updated[station.id] = {
        id: station.id,
        lat: null,
        lng: null,
        matched: null,
        name_zh: station.name_zh
      }
      console.warn(`⚠️  ${station.id} ${station.name_zh || ''} → no match`)
      continue
    }
    const prev = previous[station.id]
    let diff = null
    if (prev && typeof prev.lat === 'number' && typeof prev.lng === 'number') {
      diff = haversineMeters(prev.lat, prev.lng, hit.lat, hit.lng)
    }
    updated[station.id] = {
      id: station.id,
      lat: hit.lat,
      lng: hit.lng,
      matched: hit.formatted,
      name_zh: station.name_zh,
      query: hit.query,
      confidence: hit.confidence
    }
    summary.push({
      id: station.id,
      name: station.name_zh,
      diff,
      matched: hit.formatted,
      query: hit.query
    })
    if (diff != null && diff > 150) {
      console.log(
        `• ${station.id} ${station.name_zh || ''} shifted ${(diff / 1000).toFixed(2)} km (matched: ${hit.formatted || 'n/a'})`
      )
    }
    await sleep(120)
  }

  await fs.writeFile(outputPath, JSON.stringify(updated, null, 2) + '\n', 'utf-8')
  console.log(`Wrote ${outputPath}`)

  summary.sort((a, b) => (b.diff || 0) - (a.diff || 0))
  const topChanges = summary.filter((s) => (s.diff || 0) > 0).slice(0, 10)
  if (topChanges.length) {
    console.log('\nLargest movements vs previous data:')
    for (const item of topChanges) {
      const km = (item.diff / 1000).toFixed(2)
      console.log(`  ${item.id} ${item.name || ''}: ${km} km (query: ${item.query})`)
    }
  }
  if (missing) {
    console.log(`\nStations without matches: ${missing}`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
