import type { Options } from '@cloudflare/kv-asset-handler'
import { getAssetFromKV, NotFoundError } from '@cloudflare/kv-asset-handler'

export interface Env {
  __STATIC_CONTENT: KVNamespace
  TAIPEI_ETA_BASE: string
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
    return jsonResponse(unwrapJsonModule(dataModule))
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
