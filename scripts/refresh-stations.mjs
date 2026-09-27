#!/usr/bin/env node
// Rebuilds data/taipei_network.json and data/taipei_fares.json from the public Bus+ station feed.
//
//   node scripts/refresh-stations.mjs            # fetch live feed
//   node scripts/refresh-stations.mjs feed.json  # rebuild from a saved copy of the feed
//
// Bus+ publishes one record per line platform (e.g. BL12 and R10 for Taipei Main Station). We merge
// those into physical stations, attach official line metadata, and apply data/station_overrides.json
// for stations the feed has not picked up yet.

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const FEED_URL = 'https://apis.bus-plus.tw/v2/mrt/taipei/stations'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = join(root, 'data')

const LINES = [
  { id: 'BR', code: 'BR', name: { zh: '文湖線', en: 'Wenhu Line' }, color: '#C48C31', onColor: '#FFFFFF', segments: [range('BR', 1, 24)] },
  { id: 'R', code: 'R', name: { zh: '淡水信義線', en: 'Tamsui–Xinyi Line' }, color: '#E3002C', onColor: '#FFFFFF', segments: [range('R', 1, 28)] },
  { id: 'RA', code: 'R', name: { zh: '新北投支線', en: 'Xinbeitou Branch' }, color: '#FD92A3', onColor: '#3B0A14', branchOf: 'R', segments: [['R22', 'R22A']] },
  { id: 'G', code: 'G', name: { zh: '松山新店線', en: 'Songshan–Xindian Line' }, color: '#008659', onColor: '#FFFFFF', segments: [range('G', 1, 19)] },
  { id: 'GA', code: 'G', name: { zh: '小碧潭支線', en: 'Xiaobitan Branch' }, color: '#CFDB00', onColor: '#232600', branchOf: 'G', segments: [['G03', 'G03A']] },
  { id: 'O', code: 'O', name: { zh: '中和新蘆線', en: 'Zhonghe–Xinlu Line' }, color: '#F8B61C', onColor: '#2B1A00', segments: [range('O', 1, 21), ['O12', ...range('O', 50, 54)]] },
  { id: 'BL', code: 'BL', name: { zh: '板南線', en: 'Bannan Line' }, color: '#0070BD', onColor: '#FFFFFF', segments: [range('BL', 1, 23)] },
  { id: 'Y', code: 'Y', name: { zh: '環狀線', en: 'Circular Line' }, color: '#FFDB00', onColor: '#2B2400', segments: [range('Y', 7, 20)] }
]

function range(prefix, from, to) {
  const out = []
  for (let n = from; n <= to; n += 1) out.push(`${prefix}${String(n).padStart(2, '0')}`)
  return out
}

const lineForCode = code => {
  if (code === 'R22A') return 'RA'
  if (code === 'G03A') return 'GA'
  return code.match(/^[A-Z]+/)?.[0] ?? null
}

// Upstream typos, keyed by station code.
const NAME_FIXES = {
  O52: { en: 'St. Ignatius High School' }
}

const clean = value => (typeof value === 'string' ? value.replace(/\r/g, '').replace(/\n{2,}/g, '\n').trim() : '')
const round = value => Math.round(value * 1e6) / 1e6

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

async function loadFeed(path) {
  if (path) return JSON.parse(await readFile(path, 'utf8'))
  const response = await fetch(FEED_URL, { headers: { 'user-agent': 'mrt-app data refresh (+https://github.com/davidyen1124/mrt-app)' } })
  if (!response.ok) throw new Error(`Bus+ feed responded ${response.status}`)
  return response.json()
}

function buildStations(feed, overrides) {
  const records = [...feed, ...overrides.records]
  const byName = new Map()

  for (const record of records) {
    const code = record.stationId
    const lineId = lineForCode(code)
    if (!lineId || !LINES.some(line => line.id === lineId)) {
      console.warn(`skipping ${code}: unknown line`)
      continue
    }
    const fixed = { ...record, stationName: { ...record.stationName, ...NAME_FIXES[code] } }
    const key = fixed.stationName.zh
    const entry = byName.get(key) ?? { records: [], codes: new Set() }
    entry.records.push({ ...fixed, lineId })
    entry.codes.add(code)
    byName.set(key, entry)
  }

  const stations = []
  for (const [nameZh, { records: group }] of byName) {
    const lineOrder = id => LINES.findIndex(line => line.id === id)
    group.sort((a, b) => lineOrder(a.lineId) - lineOrder(b.lineId))
    const codes = group.map(record => record.stationId)
    const lat = group.reduce((sum, record) => sum + record.latitude, 0) / group.length
    const lng = group.reduce((sum, record) => sum + record.longitude, 0) / group.length

    const facility = field => {
      const texts = group.map(record => clean(record[field]))
      // Most transfer stations repeat the same text under every line; only label rows by line when the
      // lines genuinely differ (板橋: separate BL and Y concourses).
      const differs = new Set(texts).size > 1
      const seen = new Set()
      const rows = []
      group.forEach((record, index) => {
        const text = texts[index]
        if (!text || seen.has(text)) return
        seen.add(text)
        rows.push(differs ? { line: record.lineId, text } : { text })
      })
      return rows
    }

    stations.push({
      id: codes[0],
      codes,
      name: { zh: nameZh, en: group.find(record => record.stationName.en)?.stationName.en ?? '' },
      lat: round(lat),
      lng: round(lng),
      lines: [...new Set(group.map(record => record.lineId))],
      facilities: {
        restroom: facility('lavatoryDescription'),
        info: facility('infoCenterDescription'),
        lockers: facility('closetDescription'),
        bikes: facility('bikeInfo')
      },
      departures: group.flatMap(record =>
        (record.departureTimes ?? []).map(item => ({
          line: record.lineId,
          to: item.destinationStationId,
          first: item.weekdayFirst ?? [],
          last: item.weekdayLast ?? []
        }))
      ),
      ...(group.some(record => record.note) ? { note: group.find(record => record.note).note } : {})
    })
  }
  return stations
}

function buildFares(feed, stations) {
  const idForCode = new Map()
  stations.forEach(station => station.codes.forEach(code => idForCode.set(code, station.id)))
  const order = stations.map(station => station.id)
  const indexOf = new Map(order.map((id, index) => [id, index]))
  const rows = order.map(() => new Array(order.length).fill(''))

  for (const record of feed) {
    const from = idForCode.get(record.stationId)
    if (!from) continue
    const row = rows[indexOf.get(from)]
    for (const item of record.datas ?? []) {
      const to = idForCode.get(item.stationId.split(' ')[0])
      if (!to || to === from) continue
      const cell = row[indexOf.get(to)]
      const [minutes, fare, concession] = item.travelAndFareData.map(value => Number.parseInt(value, 10))
      if (!Number.isFinite(minutes) || !Number.isFinite(fare)) continue
      // Keep the fastest option when two platform records describe the same physical pair.
      if (cell && Number(cell.split(',')[0]) <= minutes) continue
      row[indexOf.get(to)] = `${minutes},${fare},${Number.isFinite(concession) ? concession : ''}`
    }
  }

  // Fares are symmetric; fill pairs only published in one direction (e.g. stations added via overrides).
  rows.forEach((row, from) =>
    row.forEach((cell, to) => {
      if (!cell && from !== to && rows[to][from]) row[to] = rows[to][from]
    })
  )

  return { stations: order, rows: rows.map(row => row.join(';')) }
}

async function main() {
  const feed = await loadFeed(process.argv[2])
  const overrides = JSON.parse(await readFile(join(dataDir, 'station_overrides.json'), 'utf8'))
  const known = new Set(feed.map(record => record.stationId))
  overrides.records = overrides.records.filter(record => {
    if (known.has(record.stationId)) {
      console.log(`override ${record.stationId} is now in the Bus+ feed; drop it from station_overrides.json`)
      return false
    }
    return true
  })

  const stations = buildStations(feed, overrides)
  const stationIds = new Set(stations.flatMap(station => station.codes))
  const lines = LINES.map(({ segments, ...line }) => {
    const missing = segments.flat().filter(code => !stationIds.has(code))
    if (missing.length) throw new Error(`line ${line.id} references unknown stations: ${missing.join(', ')}`)
    const stationsInOrder = [...new Set(segments.flat())]
    return { ...line, stations: stationsInOrder, segments }
  })

  const generatedAt = new Date().toISOString()
  const network = {
    meta: {
      generatedAt,
      source: FEED_URL,
      overrides: overrides.records.map(record => record.stationId),
      stationCount: stations.length
    },
    lines,
    stations
  }
  const fares = {
    meta: { generatedAt, source: FEED_URL, format: 'minutes,fare,concession' },
    ...buildFares([...feed, ...overrides.records], stations)
  }

  // Only rewrite when the data itself changed, so scheduled refreshes don't churn timestamps.
  const previous = await readJson(join(dataDir, 'taipei_network.json'))
  const previousFares = await readJson(join(dataDir, 'taipei_fares.json'))
  const same =
    previous &&
    previousFares &&
    JSON.stringify({ lines: previous.lines, stations: previous.stations, overrides: previous.meta?.overrides }) ===
      JSON.stringify({ lines: network.lines, stations: network.stations, overrides: network.meta.overrides }) &&
    JSON.stringify([previousFares.stations, previousFares.rows]) === JSON.stringify([fares.stations, fares.rows])
  if (same) {
    console.log(`no changes (${stations.length} stations across ${lines.length} lines)`)
    return
  }

  await writeFile(join(dataDir, 'taipei_network.json'), `${JSON.stringify(network, null, 1)}\n`)
  await writeFile(join(dataDir, 'taipei_fares.json'), `${JSON.stringify(fares)}\n`)
  console.log(`wrote ${stations.length} stations across ${lines.length} lines`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
