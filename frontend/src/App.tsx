import { useCallback, useEffect, useMemo, useState } from 'react'
import MapView from '@/components/MapView'
import StationSheet, { type PanelState } from '@/components/StationSheet'
import type { Line } from '@/types/line'
import type { Station } from '@/types/station'

async function fetchStations(): Promise<Line[]> {
  try {
    const r = await fetch('/api/mrt/taipei/stations')
    const data = await r.json()
    if (Array.isArray(data?.lines)) {
      return data.lines as Line[]
    }
    return []
  } catch {
    return []
  }
}

function extractCoords(lines: Line[]): Record<string, { lat: number; lng: number }> {
  const out: Record<string, { lat: number; lng: number }> = {}
  for (const line of lines) {
    for (const station of line.stations) {
      if (typeof station.lat === 'number' && typeof station.lng === 'number') {
        out[station.id] = { lat: station.lat, lng: station.lng }
      }
    }
  }
  return out
}

export default function App() {
  const [lines, setLines] = useState<Line[]>([])
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<Station | null>(null)
  const [coordsById, setCoordsById] = useState<Record<string, { lat: number; lng: number }>>({})
  const [isExpanded, setIsExpanded] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 720 : window.innerHeight
  )
  const isSearching = q.trim().length > 0
  const filtered = useMemo(() => {
    const normalize = (str: string) =>
      (str || '')
        .replace(/\s+/g, '')
        .replace(/臺/g, '台')
    const query = normalize(q.trim())
    if (!query) return [] as Station[]
    const result: Station[] = []
    for (const L of lines) {
      for (const s of L.stations) {
        const hay = normalize([s.id, s.name_zh, ...(s.codes || [])].join(' '))
        if (hay.includes(query)) result.push(s)
      }
    }
    return result
  }, [q, lines])

  useEffect(() => {
    fetchStations().then(fetchedLines => {
      setLines(fetchedLines)
      setCoordsById(extractCoords(fetchedLines))
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const shouldExpand = Boolean(selected || isSearching)
    setIsExpanded(shouldExpand)
  }, [selected, isSearching])

  useEffect(() => {
    if (isSearching && selected) {
      setSelected(null)
    }
  }, [isSearching, selected])

  const handleStationSelect = useCallback((station: Station) => {
    setSelected(station)
    setQ('')
  }, [])

  const handleToggleSheet = useCallback(() => {
    if (!isExpanded) return
    setSelected(null)
    setQ('')
    setIsExpanded(false)
  }, [isExpanded])

  const panelState: PanelState = selected ? 'station' : isSearching ? 'search' : 'idle'
  const expandedBaseHeight = Math.round(Math.max(320, Math.min(600, viewportHeight * 0.5)))
  const compactBaseHeight = 92
  const sheetHeightPx = isExpanded ? expandedBaseHeight : compactBaseHeight

  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 min-h-0 relative overflow-hidden">
        <MapView
          stations={lines.flatMap(l => l.stations)}
          coordsById={coordsById}
          selected={selected}
          onStationClick={handleStationSelect}
          bottomOffsetPx={sheetHeightPx}
          viewportHeight={viewportHeight}
        />

        <StationSheet
          expanded={isExpanded}
          sheetHeightPx={sheetHeightPx}
          query={q}
          onQueryChange={setQ}
          onClearQuery={() => setQ('')}
          panelState={panelState}
          selected={selected}
          results={filtered}
          onStationSelect={handleStationSelect}
          onToggle={handleToggleSheet}
        />
      </main>
    </div>
  )
}
