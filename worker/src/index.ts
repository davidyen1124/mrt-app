import type { Options } from '@cloudflare/kv-asset-handler'
import { getAssetFromKV, NotFoundError } from '@cloudflare/kv-asset-handler'

export interface Env {
  __STATIC_CONTENT: KVNamespace
  TAIPEI_ETA_BASE: string
  TAIPEI_CAR_WEIGHT_USERNAME?: string
  TAIPEI_CAR_WEIGHT_PASSWORD?: string
}

type UnknownRecord = Record<string, unknown>

interface JsonModule extends UnknownRecord {
  default: unknown
}

interface UpstreamEta extends UnknownRecord {
  estimateTime?: unknown
  secondsAgo?: unknown
}

type EtaWithArrival = UpstreamEta & {
  arriveAt: number | null
}

type DirectionId = '1' | '2'

interface CarWeightRecord extends UnknownRecord {
  CID: DirectionId
  StationID: string
  Cart1L: string
  Cart2L: string
  Cart3L: string
  Cart4L: string
  Cart5L: string
  Cart6L: string
}

type CarLoadRecommendation = {
  directionId: DirectionId
  directionLabel: string
  carLoads: number[]
  bestCars: number[]
}

const CAR_WEIGHT_ENDPOINT = 'https://api.metro.taipei/metroapi/CarWeight.asmx'

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null

const isJsonModule = (value: unknown): value is JsonModule =>
  isRecord(value) && 'default' in value

const unwrapJsonModule = (value: unknown): unknown =>
  isJsonModule(value) ? value.default : value

const isUpstreamEta = (value: unknown): value is UpstreamEta => isRecord(value)

const extractEtaArray = (value: unknown): UpstreamEta[] => {
  if (Array.isArray(value)) {
    return value.filter(isUpstreamEta)
  }

  if (isRecord(value)) {
    const candidateKeys = ['items', 'result'] as const
    for (const key of candidateKeys) {
      if (key in value) {
        const nested = extractEtaArray(value[key])
        if (nested.length > 0) return nested
      }
    }
  }

  return []
}

const parseEtaToSeconds = (value: unknown): number | null => {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (/進站/.test(trimmed)) return 0
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [minutes, seconds] = trimmed.split(':').map(segment => Number.parseInt(segment, 10))
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return minutes * 60 + seconds
    }
  }
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) ? numeric : null
}

const stationPrefix = (stationId: string): string => {
  const match = stationId.trim().toUpperCase().match(/^[A-Z]+/)
  return match ? match[0] : ''
}

const stationNumber = (stationId: string): number | null => {
  const match = stationId.trim().match(/\d+/)
  if (!match) return null
  const parsed = Number.parseInt(match[0], 10)
  return Number.isFinite(parsed) ? parsed : null
}

const directionLabelFor = (stationId: string, directionId: DirectionId): string => {
  switch (stationPrefix(stationId)) {
    case 'R':
      return directionId === '1' ? '往象山' : '往淡水'
    case 'B':
    case 'BL':
      return directionId === '1' ? '往頂埔' : '往南港展覽館'
    case 'G':
      return directionId === '1' ? '往新店' : '往松山'
    case 'O':
      return directionId === '1' ? '往南勢角' : '往新莊／蘆洲'
    default:
      return directionId === '1' ? '方向 1' : '方向 2'
  }
}

const isDirectionId = (value: unknown): value is DirectionId =>
  value === '1' || value === '2'

const normalizeCarWeightRecord = (value: unknown): CarWeightRecord | null => {
  if (!isRecord(value)) return null
  const requiredKeys = [
    'CID',
    'StationID',
    'Cart1L',
    'Cart2L',
    'Cart3L',
    'Cart4L',
    'Cart5L',
    'Cart6L'
  ] as const

  for (const key of requiredKeys) {
    if (typeof value[key] !== 'string') return null
  }

  if (!isDirectionId(value.CID)) return null

  const record = value as Record<(typeof requiredKeys)[number], string>

  return {
    ...value,
    CID: value.CID,
    StationID: record.StationID,
    Cart1L: record.Cart1L,
    Cart2L: record.Cart2L,
    Cart3L: record.Cart3L,
    Cart4L: record.Cart4L,
    Cart5L: record.Cart5L,
    Cart6L: record.Cart6L
  }
}

const extractCarWeightPayload = (rawBody: string): unknown => {
  const trimmed = rawBody.trim()
  const jsonEndIndex = trimmed.indexOf('<')
  const jsonString = jsonEndIndex >= 0 ? trimmed.slice(0, jsonEndIndex).trim() : trimmed
  return jsonString ? JSON.parse(jsonString) : []
}

const parseCarLoad = (value: string): number => {
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0
}

const rankCarLoads = (record: CarWeightRecord) => {
  const carLoads = [
    record.Cart1L,
    record.Cart2L,
    record.Cart3L,
    record.Cart4L,
    record.Cart5L,
    record.Cart6L
  ].map(parseCarLoad)
  const sorted = carLoads
    .map((loadLevel, index) => ({ car: index + 1, loadLevel }))
    .sort((a, b) => a.loadLevel - b.loadLevel)
  const bestPositiveLoad = sorted.find(item => item.loadLevel > 0)?.loadLevel
  const bestLoad = bestPositiveLoad ?? sorted[0]?.loadLevel ?? 0
  const bestCars = sorted
    .filter(item => item.loadLevel === bestLoad)
    .map(item => item.car)

  return {
    carLoads,
    bestCars
  }
}

const nearestTrainByDirection = (
  records: CarWeightRecord[],
  requestedStationId: string,
  directionId: DirectionId
): CarWeightRecord | null => {
  const requestedPrefix = stationPrefix(requestedStationId)
  const requestedNumber = stationNumber(requestedStationId)
  if (!requestedPrefix || requestedNumber == null) return null

  const matchingRecords = records.filter(record => {
    if (record.CID !== directionId) return false
    return stationPrefix(record.StationID) === requestedPrefix
  })

  let bestRecord: CarWeightRecord | null = null
  let bestDistance = Number.POSITIVE_INFINITY

  for (const record of matchingRecords) {
    const recordNumber = stationNumber(record.StationID)
    if (recordNumber == null) continue
    const isApproaching =
      directionId === '1' ? recordNumber <= requestedNumber : recordNumber >= requestedNumber
    if (!isApproaching) continue

    const distance = Math.abs(requestedNumber - recordNumber)
    if (distance < bestDistance) {
      bestRecord = record
      bestDistance = distance
    }
  }

  return bestRecord
}

const buildCarWeightSoapBody = (username: string, password: string): string => `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
xmlns:xsd="http://www.w3.org/2001/XMLSchema"
xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
<soap:Body>
<getCarWeightByInfoEx xmlns="http://tempuri.org/">
<userName>${username}</userName>
<passWord>${password}</passWord>
</getCarWeightByInfoEx>
</soap:Body>
</soap:Envelope>`

function jsonResponse<T>(obj: T, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*'
    }
  })
}

async function handleApi(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const { pathname, searchParams } = url

  if (pathname === '/api/health') {
    return jsonResponse({ ok: true })
  }

  if (pathname === '/api/mrt/taipei/stations') {
    const dataModule = await import('../../data/taipei_stations_combined.json')
    const rawData = unwrapJsonModule(dataModule)

    const normalizeStringArray = (value: unknown): string[] => {
      if (!Array.isArray(value)) return []
      return value.filter((item): item is string => typeof item === 'string')
    }

    const normalizeStation = (value: unknown) => {
      if (!isRecord(value)) return null
      const id = value.id
      if (typeof id !== 'string') return null

      const station: Record<string, unknown> = {
        id,
        codes: normalizeStringArray(value.codes)
      }

      const numericKeys = ['lat', 'lng', 'index'] as const
      for (const key of numericKeys) {
        const candidate = value[key]
        if (typeof candidate === 'number' && Number.isFinite(candidate)) {
          station[key] = candidate
        }
      }

      if (typeof value.name_zh === 'string') {
        station.name_zh = value.name_zh
      }

      return station
    }

    const normalizeLine = (value: unknown) => {
      if (!isRecord(value)) return null
      const rawStations = value.stations
      if (!Array.isArray(rawStations)) return null

      const stations = rawStations
        .map(normalizeStation)
        .filter((station): station is Record<string, unknown> => Boolean(station))

      const line: Record<string, unknown> = { stations }

      if (typeof value.line_index === 'number' && Number.isFinite(value.line_index)) {
        line.line_index = value.line_index
      }

      if (typeof value.line_code === 'string') {
        line.line_code = value.line_code
      }

      return line
    }

    const rawLines = isRecord(rawData) && Array.isArray(rawData.lines) ? rawData.lines : []
    const lines = rawLines
      .map(normalizeLine)
      .filter((line): line is Record<string, unknown> => Boolean(line))

    return jsonResponse({ lines })
  }

  if (pathname === '/api/mrt/taipei/eta') {
    const stationId = searchParams.get('stationId')
    if (!stationId) return jsonResponse({ error: 'stationId required' }, 400)

    const upstream = `${env.TAIPEI_ETA_BASE}${encodeURIComponent(stationId)}`
    const upstreamResponse = await fetch(upstream, {
      headers: { 'user-agent': 'mrt-app/1.0 (+worker)' }
    })
    const passthroughContentType =
      upstreamResponse.headers.get('content-type') || 'application/json'
    const upstreamBody = await upstreamResponse.text()

    try {
      const raw: unknown = upstreamBody ? (JSON.parse(upstreamBody) as unknown) : []
      const records = extractEtaArray(raw)
      const now = Date.now()

      const normalizedPayload: EtaWithArrival[] = records.map(entry => {
        const baseSeconds = parseEtaToSeconds(entry.estimateTime)
        const secondsAgoValue = entry.secondsAgo
        let secondsAgo = 0

        if (typeof secondsAgoValue === 'number' && Number.isFinite(secondsAgoValue)) {
          secondsAgo = Math.max(0, secondsAgoValue)
        } else if (typeof secondsAgoValue === 'string') {
          const parsedValue = Number.parseFloat(secondsAgoValue)
          if (Number.isFinite(parsedValue)) {
            secondsAgo = Math.max(0, parsedValue)
          }
        }

        const etaSeconds = baseSeconds == null ? null : Math.max(0, baseSeconds - secondsAgo)
        const arriveAt = etaSeconds == null ? null : now + etaSeconds * 1000

        const normalizedEntry: EtaWithArrival = {
          ...entry,
          arriveAt
        }

        return normalizedEntry
      })

      return new Response(JSON.stringify(normalizedPayload), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*'
        }
      })
    } catch {
      return new Response(upstreamBody, {
        status: upstreamResponse.status,
        headers: {
          'content-type': passthroughContentType,
          'access-control-allow-origin': '*'
        }
      })
    }
  }

  if (pathname === '/api/mrt/taipei/car-load') {
    const stationId = searchParams.get('stationId')?.trim().toUpperCase()
    if (!stationId) return jsonResponse({ error: 'stationId required' }, 400)

    const username = env.TAIPEI_CAR_WEIGHT_USERNAME
    const password = env.TAIPEI_CAR_WEIGHT_PASSWORD
    if (!username || !password) {
      return jsonResponse({ error: 'car load API credentials are not configured' }, 503)
    }

    const upstreamResponse = await fetch(CAR_WEIGHT_ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'text/xml; charset=utf-8',
        'user-agent': 'mrt-app/1.0 (+worker)'
      },
      body: buildCarWeightSoapBody(username, password)
    })

    const rawBody = await upstreamResponse.text()
    if (!upstreamResponse.ok) {
      return jsonResponse(
        { error: 'car load upstream request failed', status: upstreamResponse.status },
        502
      )
    }

    try {
      const parsed = extractCarWeightPayload(rawBody)
      const records = Array.isArray(parsed)
        ? parsed
            .map(normalizeCarWeightRecord)
            .filter((record): record is CarWeightRecord => Boolean(record))
        : []

      const recommendations = (['1', '2'] as const).reduce<CarLoadRecommendation[]>(
        (acc, directionId) => {
          const record = nearestTrainByDirection(records, stationId, directionId)
          if (!record) return acc
          const ranking = rankCarLoads(record)
          acc.push({
            directionId,
            directionLabel: directionLabelFor(stationId, directionId),
            ...ranking
          })
          return acc
        },
        []
      )

      return jsonResponse({
        stationId,
        recommendations
      })
    } catch {
      return jsonResponse({ error: 'could not parse car load upstream response' }, 502)
    }
  }

  return jsonResponse({ error: 'not found' }, 404)
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url)
    if (url.pathname.startsWith('/api/')) {
      return handleApi(req, env)
    }

    const waitUntil = ctx.waitUntil.bind(ctx)
    const assetOptions: Partial<Options> = {
      ASSET_NAMESPACE: env.__STATIC_CONTENT
    }

    try {
      return await getAssetFromKV({ request: req, waitUntil }, assetOptions)
    } catch (error) {
      if (error instanceof NotFoundError) {
        const indexReq = new Request(new URL('/index.html', req.url), req)
        return await getAssetFromKV({ request: indexReq, waitUntil }, assetOptions)
      }
      throw error
    }
  }
}
