type UnknownRecord = Record<string, unknown>
type DirectionId = '1' | '2'

type CarWeightRecord = {
  CID: DirectionId
  StationID: string
  loads: number[]
}

export type CarLoadRecommendation = {
  line: string
  directionId: DirectionId
  directionLabel: string
  /** Matches the arrivals feed: 'down' runs toward lower station numbers, 'up' toward higher ones. */
  direction: 'up' | 'down'
  carLoads: number[]
  bestCars: number[]
}

const CAR_WEIGHT_ENDPOINT = 'https://api.metro.taipei/metroapi/CarWeight.asmx'
const CAR_KEYS = ['Cart1L', 'Cart2L', 'Cart3L', 'Cart4L', 'Cart5L', 'Cart6L'] as const

const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null

const stationPrefix = (stationId: string) => stationId.trim().toUpperCase().match(/^[A-Z]+/)?.[0] ?? ''

const stationNumber = (stationId: string): number | null => {
  const match = stationId.trim().match(/\d+/)
  return match ? Number.parseInt(match[0], 10) : null
}

const DIRECTION_LABELS: Record<string, [string, string]> = {
  R: ['往象山', '往淡水'],
  BL: ['往頂埔', '往南港展覽館'],
  G: ['往新店', '往松山'],
  O: ['往南勢角', '往新莊／蘆洲']
}

const directionLabelFor = (stationId: string, directionId: DirectionId) => {
  const labels = DIRECTION_LABELS[stationPrefix(stationId)] ?? ['方向 1', '方向 2']
  return directionId === '1' ? labels[0] : labels[1]
}

const toRecord = (value: unknown): CarWeightRecord | null => {
  if (!isRecord(value)) return null
  if (value.CID !== '1' && value.CID !== '2') return null
  if (typeof value.StationID !== 'string') return null
  if (!CAR_KEYS.every(key => typeof value[key] === 'string')) return null
  return {
    CID: value.CID,
    StationID: value.StationID,
    loads: CAR_KEYS.map(key => Math.max(0, Number.parseInt(String(value[key]), 10) || 0))
  }
}

const rankCars = (loads: number[]) => {
  const ordered = loads.map((load, index) => ({ car: index + 1, load })).sort((a, b) => a.load - b.load)
  const best = ordered.find(item => item.load > 0)?.load ?? ordered[0]?.load ?? 0
  return ordered.filter(item => item.load === best).map(item => item.car)
}

const nearestTrain = (records: CarWeightRecord[], stationId: string, directionId: DirectionId) => {
  const prefix = stationPrefix(stationId)
  const target = stationNumber(stationId)
  if (!prefix || target == null) return null

  let best: CarWeightRecord | null = null
  let bestDistance = Number.POSITIVE_INFINITY
  for (const record of records) {
    if (record.CID !== directionId || stationPrefix(record.StationID) !== prefix) continue
    const position = stationNumber(record.StationID)
    if (position == null) continue
    const approaching = directionId === '1' ? position <= target : position >= target
    if (!approaching) continue
    const distance = Math.abs(target - position)
    if (distance < bestDistance) {
      best = record
      bestDistance = distance
    }
  }
  return best
}

const soapBody = (username: string, password: string) => `<?xml version="1.0" encoding="utf-8"?>
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

/** The endpoint returns a JSON array followed by a SOAP envelope; keep only the JSON prefix. */
const parsePayload = (body: string): unknown => {
  const trimmed = body.trim()
  const end = trimmed.indexOf('<')
  const json = (end >= 0 ? trimmed.slice(0, end) : trimmed).trim()
  return json ? JSON.parse(json) : []
}

export async function fetchCarLoad(
  stationCodes: string[],
  username: string,
  password: string,
  fetcher: typeof fetch = fetch
): Promise<CarLoadRecommendation[]> {
  const response = await fetcher(CAR_WEIGHT_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'text/xml; charset=utf-8', 'user-agent': 'mrt-app/2.0 (+worker)' },
    body: soapBody(username, password)
  })
  if (!response.ok) throw new Error(`car load upstream responded ${response.status}`)

  const parsed = parsePayload(await response.text())
  const records = Array.isArray(parsed) ? parsed.map(toRecord).filter((record): record is CarWeightRecord => Boolean(record)) : []

  const recommendations: CarLoadRecommendation[] = []
  for (const code of stationCodes) {
    if (!DIRECTION_LABELS[stationPrefix(code)]) continue
    for (const directionId of ['1', '2'] as const) {
      const record = nearestTrain(records, code, directionId)
      if (!record) continue
      recommendations.push({
        line: stationPrefix(code),
        directionId,
        directionLabel: directionLabelFor(code, directionId),
        direction: directionId === '1' ? 'down' : 'up',
        carLoads: record.loads,
        bestCars: rankCars(record.loads)
      })
    }
  }
  return recommendations
}
