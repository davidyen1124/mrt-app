import MapView from '@/components/MapView'
import StationSheet, { type SheetMode } from '@/components/StationSheet'
import type { Line } from '@/types/line'
import type { Station } from '@/types/station'
import { useCallback, useEffect, useMemo, useState } from 'react'

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
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Station | null>(null)
  const [coordsById, setCoordsById] = useState<Record<string, { lat: number; lng: number }>>({})
  const [sheetMode, setSheetMode] = useState<SheetMode>('idle')
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === 'undefined' ? 720 : window.innerHeight
  )
  const hasQuery = query.trim().length > 0
  const filtered = useMemo(() => {
    const normalize = (str: string) =>
      (str || '')
        .replace(/\s+/g, '')
        .replace(/臺/g, '台')
    const normalizedQuery = normalize(query.trim())
    if (!normalizedQuery) return [] as Station[]
    const result: Station[] = []
    for (const L of lines) {
      for (const s of L.stations) {
        const hay = normalize([s.id, s.name_zh, ...(s.codes || [])].join(' '))
        if (hay.includes(normalizedQuery)) result.push(s)
      }
    }
    return result
  }, [query, lines])

  useEffect(() => {
    let isCancelled = false
    const loadStations = async () => {
      const fetchedLines = await fetchStations()
      if (!isCancelled) {
        setLines(fetchedLines)
        setCoordsById(extractCoords(fetchedLines))
      }
    }
    loadStations()
    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewportHeight(window.innerHeight)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (sheetMode === 'station' && !selected) {
      setSheetMode(hasQuery ? 'search' : 'idle')
    }
  }, [selected, sheetMode, hasQuery])

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      const trimmed = value.trim()
      if (trimmed) {
        setSheetMode('search')
      } else if (selected) {
        setSheetMode('station')
      } else {
        setSheetMode('idle')
      }
    },
    [selected]
  )

  const handleClearQuery = useCallback(() => {
    handleQueryChange('')
  }, [handleQueryChange])

  const handleStationSelect = useCallback((station: Station) => {
    setSelected(station)
    setQuery('')
    setSheetMode('station')
  }, [])

  const isExpanded = sheetMode !== 'idle'

  const handleToggleSheet = useCallback(() => {
    if (sheetMode === 'idle') return
    setSelected(null)
    setQuery('')
    setSheetMode('idle')
  }, [sheetMode])

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
          query={query}
          onQueryChange={handleQueryChange}
          onClearQuery={handleClearQuery}
          mode={sheetMode}
          selected={selected}
          results={filtered}
          onStationSelect={handleStationSelect}
          onToggle={handleToggleSheet}
        />
      </main>
    </div>
  )
}
