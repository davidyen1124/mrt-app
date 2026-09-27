import { findLine, findStation, type Line, type Station } from '@/data/network'
import { useCallback, useSyncExternalStore } from 'react'

export type StationTab = 'live' | 'times' | 'fares' | 'facilities'
export const STATION_TABS: StationTab[] = ['live', 'times', 'fares', 'facilities']

export type Route =
  | { name: 'home' }
  | { name: 'station'; station: Station; tab: StationTab }
  | { name: 'line'; line: Line }

export function parseRoute(pathname: string): Route {
  const [kind, id, tab] = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (kind === 'station') {
    const station = findStation(id)
    if (station) {
      return { name: 'station', station, tab: STATION_TABS.includes(tab as StationTab) ? (tab as StationTab) : 'live' }
    }
  }
  if (kind === 'line') {
    const line = findLine(id)
    if (line) return { name: 'line', line }
  }
  return { name: 'home' }
}

export const stationPath = (station: Station, tab: StationTab = 'live') =>
  tab === 'live' ? `/station/${station.id}` : `/station/${station.id}/${tab}`
export const linePath = (line: Line) => `/line/${line.id}`

const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
  }
}

export function useRoute() {
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname, () => '/')
  const route = parseRoute(pathname)

  const navigate = useCallback((path: string, options: { replace?: boolean } = {}) => {
    if (path === window.location.pathname) return
    const depth = (window.history.state?.depth ?? 0) + (options.replace ? 0 : 1)
    window.history[options.replace ? 'replaceState' : 'pushState']({ depth }, '', path)
    notify()
  }, [])

  /** Go back when we navigated here in-app; otherwise replace, so the back button never leaves the app unexpectedly. */
  const back = useCallback(
    (fallback = '/') => {
      if ((window.history.state?.depth ?? 0) > 0) window.history.back()
      else navigate(fallback, { replace: true })
    },
    [navigate]
  )

  return { route, navigate, back }
}
