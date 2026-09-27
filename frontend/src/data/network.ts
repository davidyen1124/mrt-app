import networkJson from '@data/taipei_network.json'
import linesGeoJson from '@data/taipei_lines.geo.json'
import type { FeatureCollection, LineString, MultiLineString } from 'geojson'

export type Lang = 'zh' | 'en'
export type LocalizedName = { zh: string; en: string }
export type Direction = 'up' | 'down'

export type Line = {
  id: string
  code: string
  name: LocalizedName
  color: string
  onColor: string
  branchOf?: string
  stations: string[]
  segments: string[][]
}

export type FacilityRow = { line?: string; text: string }

export type Departure = { line: string; to: string; first: string[]; last: string[] }

export type Station = {
  id: string
  codes: string[]
  name: LocalizedName
  lat: number
  lng: number
  lines: string[]
  facilities: { restroom: FacilityRow[]; info: FacilityRow[]; lockers: FacilityRow[]; bikes: FacilityRow[] }
  departures: Departure[]
  note?: string
}

type NetworkFile = {
  meta: { generatedAt: string; source: string; overrides: string[]; stationCount: number }
  lines: Line[]
  stations: Station[]
}

const data = networkJson as unknown as NetworkFile

export const networkMeta = data.meta
export const lines: Line[] = data.lines
export const stations: Station[] = data.stations
export const lineGeometry = linesGeoJson as unknown as FeatureCollection<LineString | MultiLineString, { line: string }>

const stationByCode = new Map<string, Station>()
for (const station of stations) for (const code of station.codes) stationByCode.set(code, station)
const lineById = new Map(lines.map(line => [line.id, line]))

export const findStation = (code: string | null | undefined) =>
  code ? stationByCode.get(code.trim().toUpperCase()) : undefined

export const findLine = (id: string | null | undefined) => (id ? lineById.get(id.trim().toUpperCase()) : undefined)

export const mainLines = lines.filter(line => !line.branchOf)
export const branchesOf = (line: Line) => lines.filter(candidate => candidate.branchOf === line.id)

/** Every line that stops here, branches included (北投 → R and RA). */
export const linesAt = (station: Station) =>
  lines.filter(line => line.stations.some(code => station.codes.includes(code)))

export const codeOnLine = (station: Station, line: Line) => station.codes.find(code => line.stations.includes(code))

export const lineIdForCode = (code: string) => {
  if (code === 'R22A') return 'RA'
  if (code === 'G03A') return 'GA'
  return code.match(/^[A-Z]+/)?.[0] ?? ''
}

export const lineForCode = (code: string) => findLine(lineIdForCode(code))

const terminusCodes = new Set(
  lines.filter(line => !line.branchOf).flatMap(line => line.segments.flatMap(segment => [segment[0], segment[segment.length - 1]]))
)
// Branch ends (新北投, 小碧潭) are terminus stations too; the shared junction station is not.
for (const line of lines.filter(item => item.branchOf)) terminusCodes.add(line.stations[line.stations.length - 1])
// 大橋頭 starts the Luzhou segment but is a through station.
for (const line of lines) for (const segment of line.segments.slice(1)) terminusCodes.delete(segment[0])

export const isTerminus = (code: string) => terminusCodes.has(code)

export const primaryLine = (station: Station) => findLine(station.lines[0])!

export const isTransfer = (station: Station) => station.codes.length > 1

export const stationName = (station: Pick<Station, 'name'>, lang: Lang) =>
  lang === 'en' ? station.name.en || station.name.zh : station.name.zh

export const lineName = (line: Line, lang: Lang) => (lang === 'en' ? line.name.en : line.name.zh)

/** Adjacent stations on a line. Forks (大橋頭 on the Orange line) can have two neighbours in one direction. */
export function neighbours(station: Station, line: Line): { prev: Station[]; next: Station[] } {
  const code = codeOnLine(station, line)
  const prev = new Set<Station>()
  const next = new Set<Station>()
  if (!code) return { prev: [], next: [] }
  for (const segment of line.segments) {
    const index = segment.indexOf(code)
    if (index < 0) continue
    const before = findStation(segment[index - 1])
    const after = findStation(segment[index + 1])
    if (before) prev.add(before)
    if (after) next.add(after)
  }
  return { prev: [...prev], next: [...next] }
}

/** Terminal stations reached by travelling in a direction from this station (both ends of a fork). */
export function terminalsToward(station: Station, line: Line, direction: Direction): Station[] {
  const start = codeOnLine(station, line)
  if (!start) return []
  const rank = (code: string) => line.stations.indexOf(code)
  const onward = (code: string) =>
    line.segments.flatMap(segment => {
      const index = segment.indexOf(code)
      if (index < 0) return []
      return [segment[index - 1], segment[index + 1]].filter(
        (item): item is string => Boolean(item) && (direction === 'up' ? rank(item!) > rank(code) : rank(item!) < rank(code))
      )
    })
  const ends = new Set<string>()
  const queue = onward(start)
  const seen = new Set(queue)
  while (queue.length) {
    const code = queue.shift()!
    const next = onward(code).filter(item => !seen.has(item))
    if (!onward(code).length) ends.add(code)
    next.forEach(item => {
      seen.add(item)
      queue.push(item)
    })
  }
  return [...ends]
    .sort((a, b) => rank(a) - rank(b))
    .map(findStation)
    .filter((item): item is Station => Boolean(item))
}

export const distanceMeters = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371000 * Math.asin(Math.sqrt(h))
}

export const nearestStations = (point: { lat: number; lng: number }, count = 3) =>
  stations
    .map(station => ({ station, meters: distanceMeters(point, station) }))
    .sort((a, b) => a.meters - b.meters)
    .slice(0, count)

const fold = (text: string) =>
  text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/臺/g, '台')
    .replace(/[\s/／·・\-–—'’.()（）]/g, '')

type SearchEntry = { station: Station; zh: string; en: string; codes: string[] }
const searchIndex: SearchEntry[] = stations.map(station => ({
  station,
  zh: fold(station.name.zh),
  en: fold(station.name.en),
  codes: station.codes.map(code => code.toLowerCase())
}))

export function searchStations(query: string): Station[] {
  const q = fold(query)
  if (!q) return []
  const scored: { station: Station; score: number }[] = []
  for (const entry of searchIndex) {
    let score = 0
    if (entry.codes.includes(q)) score = 100
    else if (entry.zh === q || entry.en === q) score = 90
    else if (entry.zh.startsWith(q) || entry.en.startsWith(q)) score = 70
    else if (entry.codes.some(code => code.startsWith(q))) score = 60
    else if (entry.zh.includes(q) || entry.en.includes(q)) score = 40
    if (score) scored.push({ station: entry.station, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.station.id.localeCompare(b.station.id)).map(item => item.station)
}
