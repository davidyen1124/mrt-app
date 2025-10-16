import MapView from '@/components/MapView'
import StationSheet, { type SheetMode } from '@/components/StationSheet'
import useTaipeiStations from '@/hooks/useTaipeiStations'
import useViewportHeight from '@/hooks/useViewportHeight'
import type { Station } from '@/types/station'
import { useCallback, useMemo, useState } from 'react'

export default function App() {
  const { stations, coordsById } = useTaipeiStations()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Station | null>(null)
  const viewportHeight = useViewportHeight()

  const sheetMode: SheetMode = useMemo(() => {
    const trimmed = query.trim()
    if (trimmed) return 'search'
    if (selected) return 'station'
    return 'idle'
  }, [query, selected])

  const filtered = useMemo(() => {
    const normalize = (str: string) =>
      (str || '')
        .replace(/\s+/g, '')
        .replace(/臺/g, '台')
    const normalizedQuery = normalize(query.trim())
    if (!normalizedQuery) return [] as Station[]
    const result: Station[] = []
    for (const station of stations) {
      const hay = normalize([station.id, station.name_zh, ...(station.codes || [])].join(' '))
      if (hay.includes(normalizedQuery)) result.push(station)
    }
    return result
  }, [query, stations])

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (value.trim().length > 0) {
        setSelected(null)
      }
    },
    []
  )

  const handleClearQuery = useCallback(() => {
    setQuery('')
    setSelected(null)
  }, [])

  const handleStationSelect = useCallback((station: Station) => {
    setSelected(station)
    setQuery('')
  }, [])

  const isExpanded = sheetMode !== 'idle'

  const handleToggleSheet = useCallback(() => {
    if (sheetMode === 'idle') return
    setSelected(null)
    setQuery('')
  }, [sheetMode])

  const expandedBaseHeight = Math.round(Math.max(320, Math.min(600, viewportHeight * 0.5)))
  const compactBaseHeight = 92
  const sheetHeightPx = isExpanded ? expandedBaseHeight : compactBaseHeight

  return (
    <div className="h-full flex flex-col">
      <main className="flex-1 min-h-0 relative overflow-hidden">
        <MapView
          stations={stations}
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
