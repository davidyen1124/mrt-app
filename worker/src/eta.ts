import { codeOnLine, findStation, linesAt, network, type Line, type LocalizedName, type Station } from './network'

type UnknownRecord = Record<string, unknown>

export type ArrivalStatus = 'countdown' | 'arriving' | 'ended' | 'notice'

export type Arrival = {
  line: string | null
  /** 'up' travels toward higher station numbers on the line, 'down' toward lower ones. */
  direction: 'up' | 'down' | null
  destination: { code: string; stationId: string | null; name: LocalizedName }
  status: ArrivalStatus
  /** Seconds until arrival at fetch time, already corrected for upstream data age. */
  seconds: number | null
  label: string | null
  platform: string | null
}

export type ArrivalsPayload = {
  stationId: string
  fetchedAt: number
  arrivals: Arrival[]
}

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null

const extractRecords = (value: unknown): UnknownRecord[] => {
  if (Array.isArray(value)) return value.filter(isRecord)
  if (isRecord(value)) {
    for (const key of ['items', 'result', 'data'] as const) {
      const nested = extractRecords(value[key])
      if (nested.length) return nested
    }
  }
  return []
}

const toName = (value: unknown): LocalizedName => {
  if (typeof value === 'string') return { zh: value, en: '' }
  if (isRecord(value)) {
    return {
      zh: typeof value.zh === 'string' ? value.zh.trim() : '',
      en: typeof value.en === 'string' ? value.en.trim() : ''
    }
  }
  return { zh: '', en: '' }
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim())
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Upstream sends seconds, "mm:ss", or status text such as 列車進站 / 末班已過. */
export function parseEstimate(value: unknown): { status: ArrivalStatus; seconds: number | null; label: string | null } {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value <= 0 ? { status: 'arriving', seconds: 0, label: null } : { status: 'countdown', seconds: value, label: null }
  }
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) return { status: 'notice', seconds: null, label: null }
  if (/進站|到站|arriv/i.test(text)) return { status: 'arriving', seconds: 0, label: text }
  if (/末班|已過|停止|結束|收班/.test(text)) return { status: 'ended', seconds: null, label: text }
  const clock = text.match(/^(\d{1,2}):(\d{2})$/)
  if (clock) {
    const seconds = Number(clock[1]) * 60 + Number(clock[2])
    return seconds <= 0 ? { status: 'arriving', seconds: 0, label: null } : { status: 'countdown', seconds, label: null }
  }
  const minutesText = text.match(/^(\d+)\s*分(?:\s*(\d+)\s*秒)?$/)
  if (minutesText) {
    return { status: 'countdown', seconds: Number(minutesText[1]) * 60 + Number(minutesText[2] ?? 0), label: null }
  }
  const numeric = toNumber(text)
  if (numeric != null) return parseEstimate(numeric)
  return { status: 'notice', seconds: null, label: text }
}

const normalize = (text: string) => text.replace(/\s+/g, '').replace(/臺/g, '台').replace(/線$/, '')

function resolveLine(station: Station, candidates: Line[], destinationCodes: string[], routeName: LocalizedName): Line | null {
  const serving = candidates.filter(line => destinationCodes.some(code => line.stations.includes(code)))
  if (serving.length === 1) return serving[0]
  const pool = serving.length ? serving : candidates
  if (routeName.zh) {
    const route = normalize(routeName.zh)
    const named = pool.find(line => !line.branchOf && normalize(line.name.zh) === route)
    if (named) return named
  }
  if (pool.length === 1) return pool[0]
  const prefix = destinationCodes[0]?.match(/^[A-Z]+/)?.[0]
  return pool.find(line => line.code === prefix && !line.branchOf) ?? pool.find(line => !line.branchOf) ?? null
}

function resolveDirection(station: Station, line: Line, destinationCodes: string[]): 'up' | 'down' | null {
  const here = codeOnLine(station, line)
  const there = destinationCodes.find(code => line.stations.includes(code))
  if (!here || !there) return null
  const from = line.stations.indexOf(here)
  const to = line.stations.indexOf(there)
  if (from === to) return null
  return to > from ? 'up' : 'down'
}

export function normalizeArrivals(station: Station, upstream: unknown[]): Arrival[] {
  const candidates = linesAt(station)
  const seen = new Set<string>()
  const arrivals: Arrival[] = []

  for (const record of upstream.flatMap(extractRecords)) {
    const destinationCode = typeof record.destinationStationId === 'string' ? record.destinationStationId.trim().toUpperCase() : ''
    const destinationStation = destinationCode ? findStation(destinationCode) : undefined
    const destinationCodes = destinationStation?.codes ?? (destinationCode ? [destinationCode] : [])
    const upstreamName = toName(record.stationName)
    const name: LocalizedName = {
      zh: destinationStation?.name.zh || upstreamName.zh,
      en: destinationStation?.name.en || upstreamName.en
    }

    const line = resolveLine(station, candidates, destinationCodes, toName(record.routeName))
    const direction = line ? resolveDirection(station, line, destinationCodes) : null
    const platform = typeof record.platform === 'string' && record.platform.trim() ? record.platform.trim() : null

    // A destination equal to this station means the train terminates here; it never departs toward it.
    if (destinationStation && destinationStation.id === station.id) continue

    const key = `${line?.id ?? '?'}|${destinationCode || name.zh}`
    if (seen.has(key)) continue
    seen.add(key)

    const estimate = parseEstimate(record.estimateTime)
    const age = Math.max(0, toNumber(record.secondsAgo) ?? 0)
    const seconds = estimate.seconds == null ? null : Math.max(0, estimate.seconds - age)

    arrivals.push({
      line: line?.id ?? null,
      direction,
      destination: { code: destinationCode, stationId: destinationStation?.id ?? null, name },
      status: estimate.status === 'countdown' && seconds === 0 ? 'arriving' : estimate.status,
      seconds,
      label: estimate.label,
      platform
    })
  }

  const lineOrder = (id: string | null) => {
    const index = network.lines.findIndex(line => line.id === id)
    return index < 0 ? Number.MAX_SAFE_INTEGER : index
  }

  return arrivals.sort(
    (a, b) =>
      lineOrder(a.line) - lineOrder(b.line) ||
      (a.direction ?? '').localeCompare(b.direction ?? '') ||
      (a.seconds ?? Number.MAX_SAFE_INTEGER) - (b.seconds ?? Number.MAX_SAFE_INTEGER)
  )
}

/**
 * Bus+ answers per platform group, so a merged station such as 板橋 (BL07 + Y16) needs one request per code
 * that the upstream does not already cover. Asking for every code keeps this simple and the results are deduped.
 */
export async function fetchArrivals(station: Station, base: string, fetcher: typeof fetch = fetch): Promise<ArrivalsPayload> {
  const responses = await Promise.all(
    station.codes.map(async code => {
      const response = await fetcher(`${base}${encodeURIComponent(code)}`, {
        headers: { 'user-agent': 'mrt-app/2.0 (+https://github.com/davidyen1124/mrt-app)' },
        cf: { cacheTtl: 5, cacheEverything: true }
      } as RequestInit)
      if (!response.ok) return []
      try {
        return (await response.json()) as unknown
      } catch {
        return []
      }
    })
  )

  return {
    stationId: station.id,
    fetchedAt: Date.now(),
    arrivals: normalizeArrivals(station, responses)
  }
}
