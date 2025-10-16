import type { Line } from '@/types/line'
import { useEffect, useMemo, useState } from 'react'

async function fetchStations(): Promise<Line[]> {
  try {
    const response = await fetch('/api/mrt/taipei/stations')
    const data = await response.json()
    if (Array.isArray((data as any)?.lines)) {
      return (data as any).lines as Line[]
    }
    return []
  } catch {
    return []
  }
}

function extractCoords(lines: Line[]): Record<string, { lat: number; lng: number }> {
  const lookup: Record<string, { lat: number; lng: number }> = {}
  for (const line of lines) {
    for (const station of line.stations) {
      if (typeof station.lat === 'number' && typeof station.lng === 'number') {
        lookup[station.id] = { lat: station.lat, lng: station.lng }
      }
    }
  }
  return lookup
}

export function useTaipeiStations() {
  const [lines, setLines] = useState<Line[]>([])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const fetched = await fetchStations()
      if (!cancelled) {
        setLines(fetched)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const coordsById = useMemo(() => extractCoords(lines), [lines])
  const stations = useMemo(() => lines.flatMap(line => line.stations), [lines])

  return { lines, stations, coordsById }
}

export default useTaipeiStations
