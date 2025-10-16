import { getAssetFromKV, NotFoundError } from '@cloudflare/kv-asset-handler'

export interface Env {
  __STATIC_CONTENT: KVNamespace
  TAIPEI_ETA_BASE: string
}

function jsonResponse(obj: any, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*'
    }
  })
}

async function handleApi(req: Request, env: Env) {
  const url = new URL(req.url)
  const { pathname, searchParams } = url

  if (pathname === '/api/health') {
    return jsonResponse({ ok: true })
  }

  if (pathname === '/api/mrt/taipei/stations') {
    // Serve the extracted dataset bundled at build time
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - esbuild json import
    const data = (await import('../../data/metro_taipei_stations_zh.json'))
    return jsonResponse(data.default ?? data)
  }

  if (pathname === '/api/mrt/taipei/station-locations') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore - esbuild json import
    const data = (await import('../../data/taipei_station_coords.json'))
    return jsonResponse(data.default ?? data)
  }

  if (pathname === '/api/mrt/taipei/eta') {
    const stationId = searchParams.get('stationId')
    if (!stationId) return jsonResponse({ error: 'stationId required' }, 400)
    const upstream = `${env.TAIPEI_ETA_BASE}${encodeURIComponent(stationId)}`
    const ures = await fetch(upstream, {
      headers: { 'user-agent': 'mrt-app/1.0 (+worker)' }
    })

    const passthroughContentType = ures.headers.get('content-type') || 'application/json'
    const upstreamBody = await ures.text()

    // Always normalize: parse JSON and attach etaSeconds/arriveAt/etaLabel; fallback to passthrough on errors.
    try {
      const now = Date.now()
      const raw = await ures.json()
      const arr: any[] = Array.isArray(raw)
        ? raw
        : Array.isArray((raw as any)?.items)
        ? (raw as any).items
        : Array.isArray((raw as any)?.result)
        ? (raw as any).result
        : []

      const parseEtaToSeconds = (v: unknown): number | null => {
        if (v == null) return null
        if (typeof v === 'number' && Number.isFinite(v)) return v
        const s = String(v).trim()
        if (!s) return null
        if (/進站/.test(s)) return 0
        if (/^\d{1,2}:\d{2}$/.test(s)) {
          const [m, sec] = s.split(':').map(n => parseInt(n, 10))
          if (Number.isFinite(m) && Number.isFinite(sec)) return m * 60 + sec
        }
        const n = Number(s)
        if (Number.isFinite(n)) return n
        return null
      }

      const formatEtaLabel = (secs: number): string => {
        if (secs === 0) return '進站中'
        const m = Math.floor(secs / 60)
        const s = Math.max(0, secs % 60)
        if (m === 0) return `${s}秒`
        return `${m}分${s}秒`
      }

      const out = arr.map((it: any) => {
        const base = parseEtaToSeconds(it?.estimateTime)
        const secondsAgo = Number(it?.secondsAgo) || 0
        const etaSeconds = base == null ? null : Math.max(0, base - Math.max(0, secondsAgo))
        const etaLabel = etaSeconds == null
          ? (it?.estimateTime ?? '-')
          : formatEtaLabel(etaSeconds)
        const arriveAt = etaSeconds == null ? null : now + etaSeconds * 1000
        return { ...it, etaSeconds, etaLabel, arriveAt }
      })

      return new Response(JSON.stringify(out), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*'
        }
      })
    } catch (e) {
      // Fallback to passthrough if normalization fails
      const body = await ures.text()
      return new Response(body, {
        status: ures.status,
        headers: {
          'content-type': ures.headers.get('content-type') || 'application/json',
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

    // Static assets: fall through to KV asset handler (serves frontend/dist)
    try {
      // try exact match first
      return await getAssetFromKV({ request: req, waitUntil: ctx.waitUntil.bind(ctx) }, { env })
    } catch (e) {
      if (e instanceof NotFoundError) {
        // SPA fallback to index.html
        const indexReq = new Request(new URL('/index.html', req.url), req)
        return await getAssetFromKV({ request: indexReq, waitUntil: ctx.waitUntil.bind(ctx) }, { env })
      }
      throw e
    }
  }
}
