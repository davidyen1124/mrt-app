import { fetchCarLoad } from './carLoad'
import { fetchArrivals } from './eta'
import { faresFrom } from './fares'
import { findStation, network } from './network'

export interface Env {
  ASSETS: Fetcher
  TAIPEI_ETA_BASE: string
  TAIPEI_CAR_WEIGHT_USERNAME?: string
  TAIPEI_CAR_WEIGHT_PASSWORD?: string
}

const json = (body: unknown, status = 200, maxAge = 0) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': maxAge > 0 ? `public, max-age=${maxAge}` : 'no-store'
    }
  })

const stationParam = (url: URL) => {
  const raw = url.searchParams.get('stationId') ?? url.searchParams.get('from')
  return raw ? findStation(raw) : undefined
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)

  switch (url.pathname) {
    case '/api/health':
      return json({ ok: true, stations: network.meta.stationCount, generatedAt: network.meta.generatedAt })

    case '/api/mrt/taipei/network':
    case '/api/mrt/taipei/stations':
      return json(network, 200, 3600)

    case '/api/mrt/taipei/fares': {
      const station = stationParam(url)
      if (!station) return json({ error: 'unknown station; pass ?from=<code>' }, 400)
      return json({ from: station.id, fares: faresFrom(station) }, 200, 3600)
    }

    case '/api/mrt/taipei/eta': {
      const station = stationParam(url)
      if (!station) return json({ error: 'unknown station; pass ?stationId=<code>' }, 400)
      try {
        return json(await fetchArrivals(station, env.TAIPEI_ETA_BASE))
      } catch {
        return json({ error: 'arrivals upstream unavailable' }, 502)
      }
    }

    case '/api/mrt/taipei/car-load': {
      const station = stationParam(url)
      if (!station) return json({ error: 'unknown station; pass ?stationId=<code>' }, 400)
      const { TAIPEI_CAR_WEIGHT_USERNAME: username, TAIPEI_CAR_WEIGHT_PASSWORD: password } = env
      if (!username || !password) return json({ error: 'car load API credentials are not configured' }, 503)
      try {
        const recommendations = await fetchCarLoad(station.codes, username, password)
        return json({ stationId: station.id, recommendations })
      } catch {
        return json({ error: 'car load upstream unavailable' }, 502)
      }
    }

    default:
      return json({ error: 'not found' }, 404)
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) return handleApi(request, env)
    // Static files and SPA routes are served by the assets binding (see wrangler.toml).
    return env.ASSETS.fetch(request)
  }
}
