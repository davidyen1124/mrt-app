import type { Direction, LocalizedName, Station } from '@/data/network'
import { usePolling } from '@/hooks/usePolling'

export type Arrival = {
  line: string | null
  direction: Direction | null
  destination: { code: string; stationId: string | null; name: LocalizedName }
  status: 'countdown' | 'arriving' | 'ended' | 'notice'
  /** Absolute client-clock time of arrival, derived when the response is received. */
  arriveAt: number | null
  label: string | null
}

export type CarLoad = {
  line: string
  direction: Direction
  carLoads: number[]
  bestCars: number[]
}

export type Fare = { to: string; minutes: number; fare: number; concession: number | null }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isDirection = (value: unknown): value is Direction => value === 'up' || value === 'down'
const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every(item => typeof item === 'number' && Number.isFinite(item))

function parseArrivals(value: unknown): Arrival[] | null {
  if (!isRecord(value) || !Array.isArray(value.arrivals)) return null
  const receivedAt = Date.now()
  return value.arrivals.flatMap((item): Arrival[] => {
    if (!isRecord(item) || !isRecord(item.destination)) return []
    const destination = item.destination
    const name = isRecord(destination.name) ? destination.name : {}
    const status = item.status
    if (status !== 'countdown' && status !== 'arriving' && status !== 'ended' && status !== 'notice') return []
    const seconds = typeof item.seconds === 'number' && Number.isFinite(item.seconds) ? item.seconds : null
    return [
      {
        line: typeof item.line === 'string' ? item.line : null,
        direction: isDirection(item.direction) ? item.direction : null,
        destination: {
          code: typeof destination.code === 'string' ? destination.code : '',
          stationId: typeof destination.stationId === 'string' ? destination.stationId : null,
          name: { zh: typeof name.zh === 'string' ? name.zh : '', en: typeof name.en === 'string' ? name.en : '' }
        },
        status,
        arriveAt: seconds == null ? null : receivedAt + seconds * 1000,
        label: typeof item.label === 'string' ? item.label : null
      }
    ]
  })
}

function parseCarLoads(value: unknown): CarLoad[] | null {
  if (!isRecord(value) || !Array.isArray(value.recommendations)) return null
  return value.recommendations.flatMap((item): CarLoad[] => {
    if (!isRecord(item) || typeof item.line !== 'string' || !isDirection(item.direction)) return []
    if (!isNumberArray(item.carLoads) || !isNumberArray(item.bestCars)) return []
    return [{ line: item.line, direction: item.direction, carLoads: item.carLoads, bestCars: item.bestCars }]
  })
}

function parseFares(value: unknown): Fare[] | null {
  if (!isRecord(value) || !Array.isArray(value.fares)) return null
  return value.fares.flatMap((item): Fare[] => {
    if (!isRecord(item) || typeof item.to !== 'string') return []
    if (typeof item.minutes !== 'number' || typeof item.fare !== 'number') return []
    return [{ to: item.to, minutes: item.minutes, fare: item.fare, concession: typeof item.concession === 'number' ? item.concession : null }]
  })
}

export const useArrivals = (station: Station) =>
  usePolling(`/api/mrt/taipei/eta?stationId=${encodeURIComponent(station.id)}`, 15000, parseArrivals)

export const useCarLoads = (station: Station) =>
  usePolling(`/api/mrt/taipei/car-load?stationId=${encodeURIComponent(station.id)}`, 20000, parseCarLoads)

export const useFares = (station: Station | null) =>
  usePolling(station ? `/api/mrt/taipei/fares?from=${encodeURIComponent(station.id)}` : null, 0, parseFares)
