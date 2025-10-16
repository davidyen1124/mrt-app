import { useCallback, useEffect, useMemo, useReducer, useState } from 'react'
import MapView from './MapView'

type Station = { index: number; id: string; codes: string[]; name_zh?: string }
type Line = { line_index?: number; line_code?: string; stations: Station[] }

async function fetchStations(): Promise<Line[]> {
  const r = await fetch('/api/mrt/taipei/stations')
  const data = await r.json()
  const lines = (data && (data.lines ?? data.lines?.lines)) || []
  return lines as Line[]
}

async function fetchTaipeiCoords(): Promise<Record<string, { lat: number; lng: number }>> {
  try {
    const r = await fetch('/api/mrt/taipei/station-locations')
    const m = await r.json()
    const out: Record<string, { lat: number; lng: number }> = {}
    for (const k of Object.keys(m || {})) {
      const v = m[k]
      if (v && typeof v.lat === 'number' && typeof v.lng === 'number') out[k] = { lat: v.lat, lng: v.lng }
    }
    return out
  } catch {
    return {}
  }
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
    fetchStations().then(setLines)
    fetchTaipeiCoords().then(setCoordsById)
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

  const panelState: 'idle' | 'search' | 'station' = selected ? 'station' : isSearching ? 'search' : 'idle'
  const expandedBaseHeight = Math.round(Math.max(320, Math.min(600, viewportHeight * 0.5)))
  const compactBaseHeight = 92
  const sheetHeightPx = isExpanded ? expandedBaseHeight : compactBaseHeight

  return (
    <div className="h-full flex flex-col">
      <header
        className="p-3 border-b bg-white sticky top-0 z-10"
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <h1 className="text-lg font-semibold">台北捷運 Taipei MRT</h1>
      </header>
      <main className="flex-1 min-h-0 relative overflow-hidden">
        {/* Interactive map */}
        <MapView
          stations={lines.flatMap(l => l.stations)}
          coordsById={coordsById}
          selected={selected}
          onStationClick={handleStationSelect}
          bottomOffsetPx={sheetHeightPx}
          viewportHeight={viewportHeight}
        />

        {/* Bottom sheet (expandable) */}
        <div className="absolute inset-x-0 bottom-0 pointer-events-none">
          <div
            className="pointer-events-auto mx-auto w-full max-w-xl rounded-t-2xl bg-white shadow-[0_-8px_24px_rgba(0,0,0,.08)] flex flex-col"
            style={{
              height: `${sheetHeightPx}px`,
              paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
              transition: 'height .25s ease',
            }}
          >
            <SheetHandle expanded={isExpanded} onToggle={handleToggleSheet} />
            <div className={isExpanded ? 'flex flex-1 flex-col gap-3 px-4 overflow-hidden' : 'px-4 pb-2'}>
              <div className="flex items-center gap-2 pt-1">
                <input
                  className="flex-1 rounded-md border px-3 py-3 text-base leading-tight"
                  placeholder="搜尋「忠孝新生」"
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  />
                {q && <button className="text-sm text-gray-500" onClick={() => setQ('')}>清除</button>}
              </div>
              {isExpanded && (
                <div className="flex-1 overflow-y-auto">
                  {panelState === 'station' && selected && <EtaPanel station={selected} />}
                  {panelState === 'search' && (
                    filtered.length ? (
                      <ul className="divide-y">
                        {filtered.map((s, i) => (
                          <li key={s.id + i}>
                            <button
                              type="button"
                              className="w-full py-2 flex items-center justify-between text-left"
                              onClick={() => handleStationSelect(s)}
                            >
                              <div>
                                <div className="text-base">{s.name_zh}</div>
                              </div>
                              <div className="text-sm text-blue-600 whitespace-nowrap">查看</div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="py-6 text-center text-gray-500 text-sm">沒有符合的站點</div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

type EtaItem = {
  routeName?: any
  destinationStationId?: string
  stationName?: any
  estimateTime?: number
}

type EnrichedEtaItem = EtaItem & { arriveAt: number | null }

function EtaPanel({ station }: { station: Station }) {
  const [items, setItems] = useState<EnrichedEtaItem[]>([])
  // Ticks every second to force re-render so the countdown decreases.
  const [, forceRender] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        const r = await fetch(`/api/mrt/taipei/eta?stationId=${encodeURIComponent(station.id)}&normalized=1`)
        const raw = await r.json()
        const data: EtaItem[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as any)?.items)
          ? (raw as any).items
          : Array.isArray((raw as any)?.result)
          ? (raw as any).result
          : []
        if (cancelled) return
        const enriched: EnrichedEtaItem[] = (data || []).map((it: any) => ({
          ...it,
          arriveAt: Number.isFinite(it?.arriveAt) ? Number(it.arriveAt) : null,
        }))
        setItems(enriched)
      } catch (e) {
        if (!cancelled) setItems([])
      }
    }

    // Initial load
    load()
    // Poll the API periodically to refresh ETAs and new trains
    const poll = setInterval(load, 15000)
    // Local one-second ticker to decrease displayed seconds
    const t = setInterval(() => forceRender(), 1000)

    return () => {
      cancelled = true
      clearInterval(poll)
      clearInterval(t)
    }
  }, [station.id])

  const renderEta = (it: EnrichedEtaItem) => {
    if (it.arriveAt == null) return (it as any)?.etaLabel ?? (it as any)?.estimateTime ?? '-'
    const remaining = Math.max(0, Math.round((it.arriveAt - Date.now()) / 1000))
    if (remaining === 0) return '進站中'
    const m = Math.floor(remaining / 60)
    const s = Math.max(0, remaining % 60)
    return m === 0 ? `${s}秒` : `${m}分${s}秒`
  }

  return (
    <div className="border rounded-lg p-3">
      <div className="font-semibold text-base">{station.name_zh}</div>
      <ul className="mt-2 divide-y">
        {items.map((it, i) => (
          <li key={i} className="py-2 flex items-center justify-between">
            <div className="text-sm truncate">
              {(it as any)?.routeName?.zh || (it as any)?.routeName || '路線'}
              <span className="mx-1">→</span>
              {((it as any)?.stationName?.zh || (it as any)?.stationName || (it as any)?.destinationStationName?.zh || it.destinationStationId) as any}
            </div>
            <div className="text-sm font-medium whitespace-nowrap">{renderEta(it)}</div>
          </li>
        ))}
        {!items.length && <li className="py-6 text-center text-gray-500 text-sm">尚無即時資訊</li>}
      </ul>
    </div>
  )
}

function SheetHandle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-label={expanded ? 'Collapse panel' : 'Expand panel'}
      className="h-8 w-full flex items-center justify-center"
      onClick={onToggle}
    >
      <span className="h-1.5 w-12 rounded-full bg-gray-200" />
    </button>
  )
}
