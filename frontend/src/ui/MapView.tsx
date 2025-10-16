import { useEffect, useMemo, useRef } from 'react'
import maplibregl, { LngLatLike } from 'maplibre-gl'
import type { GeoJSONSource, Map, MapLayerMouseEvent } from 'maplibre-gl'

type Station = { index: number; id: string; codes: string[]; name_zh?: string } & Record<string, any>
type StationWithCoords = Station & { lat: number; lng: number }

const STATION_SOURCE_ID = 'station-points'
const STATION_LAYER_ID = 'station-circles'
const STATION_SELECTED_LAYER_ID = 'station-circles-selected'

const MARKER_COLOR = '#FF6B6B'
const MARKER_SELECTED_COLOR = '#FF9F1C'

const DEFAULT_PADDING = { top: 16, right: 16, left: 16, extraBottom: 24 }

const createPadding = (bottom: number) => ({
  top: DEFAULT_PADDING.top,
  right: DEFAULT_PADDING.right,
  left: DEFAULT_PADDING.left,
  bottom: Math.max(0, bottom) + DEFAULT_PADDING.extraBottom
})

function stationGeoJsonInitial() {
  return {
    type: 'FeatureCollection' as const,
    features: [] as {
      type: 'Feature'
      geometry: { type: 'Point'; coordinates: [number, number] }
      properties: { id: string; title: string; codes: string[] }
    }[]
  }
}

export function MapView({
  stations,
  coordsById,
  selected,
  onStationClick,
  styleUrl = 'https://tiles.openfreemap.org/styles/liberty',
  bottomOffsetPx = 0,
  viewportHeight
}: {
  stations: Station[]
  coordsById?: Record<string, { lat: number; lng: number }>
  selected: Station | null
  onStationClick: (s: Station) => void
  styleUrl?: string
  bottomOffsetPx?: number
  viewportHeight?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<Map | null>(null)
  const mapReadyRef = useRef(false)
  const stationLookupRef = useRef<Record<string, StationWithCoords>>({})
  const onStationClickRef = useRef(onStationClick)
  const stationsListRef = useRef<StationWithCoords[]>([])
  const stationGeoJsonRef = useRef(stationGeoJsonInitial())
  const bottomOffsetRef = useRef(bottomOffsetPx)

  useEffect(() => {
    onStationClickRef.current = onStationClick
  }, [onStationClick])

  useEffect(() => {
    bottomOffsetRef.current = bottomOffsetPx
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    map.setPadding(createPadding(bottomOffsetPx))
  }, [bottomOffsetPx])

  // Try to infer coordinates from various common shapes
  const stationsWithCoords = useMemo(() => {
    const out: StationWithCoords[] = []
    const asNum = (v: any) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
    const swapIfNeeded = (a: number, b: number) =>
      // Taiwan: lat ~ 21..26, lng ~ 119..123
      a > 60 && b < 60 ? { lat: b, lng: a } : { lat: a, lng: b }

    for (const s of stations || []) {
      // Prefer provided coords mapping by id
      if (coordsById && coordsById[s.id] && typeof coordsById[s.id].lat === 'number') {
        const { lat, lng } = coordsById[s.id]
        out.push({ ...s, lat, lng })
        continue
      }
      let lat: number | null = null
      let lng: number | null = null
      if (asNum((s as any).lat) && asNum((s as any).lng)) {
        lat = asNum((s as any).lat)
        lng = asNum((s as any).lng)
      } else if (asNum((s as any).latitude) && asNum((s as any).longitude)) {
        lat = asNum((s as any).latitude)
        lng = asNum((s as any).longitude)
      } else if (Array.isArray((s as any).location) && (s as any).location.length >= 2) {
        const a = asNum((s as any).location[0])
        const b = asNum((s as any).location[1])
        if (a != null && b != null) {
          const sw = swapIfNeeded(a, b)
          lat = sw.lat
          lng = sw.lng
        }
      } else if ((s as any).position && asNum((s as any).position.lat) && asNum((s as any).position.lng)) {
        lat = asNum((s as any).position.lat)
        lng = asNum((s as any).position.lng)
      }
      if (lat != null && lng != null) out.push({ ...s, lat, lng })
    }
    return out
  }, [stations, coordsById])

  const uniqueStations = useMemo(() => {
    const seen = new Map<string, StationWithCoords>()
    for (const s of stationsWithCoords) {
      if (!seen.has(s.id)) seen.set(s.id, s)
    }
    return Array.from(seen.values())
  }, [stationsWithCoords])

  const stationLookup = useMemo(() => {
    const lookup: Record<string, StationWithCoords> = {}
    for (const s of uniqueStations) lookup[s.id] = s
    return lookup
  }, [uniqueStations])

  useEffect(() => {
    stationLookupRef.current = stationLookup
    stationsListRef.current = uniqueStations
  }, [stationLookup, uniqueStations])

  const stationGeoJson = useMemo(() => {
    return {
      type: 'FeatureCollection' as const,
      features: uniqueStations.map((s) => ({
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [s.lng, s.lat] as [number, number]
        },
        properties: {
          id: s.id,
          title: s.name_zh ?? '',
          codes: s.codes ?? []
        }
      }))
    }
  }, [uniqueStations])

  // Initialize map once
  useEffect(() => {
    if (mapRef.current) return
    const container = ref.current
    if (!container) return

    const mapInstance = new maplibregl.Map({
      container,
      style: styleUrl,
      center: [121.5654, 25.033] as LngLatLike, // Taipei City Hall approx
      zoom: 11,
      attributionControl: true,
      scrollZoom: true,
      dragPan: true,
      pitchWithRotate: false,
      dragRotate: false
    })
    mapRef.current = mapInstance
    mapInstance.dragRotate.disable()
    if (mapInstance.touchZoomRotate && mapInstance.touchZoomRotate.disableRotation) {
      mapInstance.touchZoomRotate.disableRotation()
    }

    // Controls: nav + geolocate at top-right (avoid bottom sheet overlap)
    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
      showAccuracyCircle: false
    })
    mapInstance.addControl(geolocate, 'top-right')
    requestAnimationFrame(() => {
      if (mapReadyRef.current && mapRef.current) mapRef.current.resize()
      else mapInstance.resize()
    })

    geolocate.on('geolocate', (e: any) => {
      const { latitude: lat, longitude: lng } = e.coords || {}
      if (typeof lat !== 'number' || typeof lng !== 'number') return
      // Snap to nearest station if we have coordinates
      const currentStations = stationsListRef.current
      if (currentStations.length) {
        let best: StationWithCoords | null = null
        let bestDistance = Infinity
        for (const s of currentStations) {
          const d = Math.hypot(s.lat - lat, s.lng - lng)
          if (d < bestDistance) {
            bestDistance = d
            best = s
          }
        }
        if (best) onStationClickRef.current(best)
      }
    })

    const handleClick = (event: MapLayerMouseEvent) => {
      const feature = event.features ? event.features[0] : undefined
      const stationId = feature?.properties?.id
      if (typeof stationId !== 'string') return
      const station = stationLookupRef.current[stationId]
      if (station) onStationClickRef.current(station)
    }

    const handleMouseEnter = () => {
      mapInstance.getCanvas().style.cursor = 'pointer'
    }
    const handleMouseLeave = () => {
      mapInstance.getCanvas().style.cursor = ''
    }

    const handleLoad = () => {
      mapReadyRef.current = true
      mapInstance.setPadding(createPadding(bottomOffsetRef.current))
      mapInstance.addSource(STATION_SOURCE_ID, {
        type: 'geojson',
        data: stationGeoJsonRef.current
      })
      mapInstance.addLayer({
        id: STATION_LAYER_ID,
        type: 'circle',
        source: STATION_SOURCE_ID,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5.5, 13, 7.5, 18, 11],
          'circle-color': MARKER_COLOR,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2,
          'circle-opacity': 0.9
        }
      })
      mapInstance.addLayer({
        id: STATION_SELECTED_LAYER_ID,
        type: 'circle',
        source: STATION_SOURCE_ID,
        filter: ['==', ['get', 'id'], '__none__'],
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 7.5, 13, 10, 18, 15],
          'circle-color': MARKER_SELECTED_COLOR,
          'circle-stroke-color': '#FFFFFF',
          'circle-stroke-width': 2.5
        }
      })
      mapInstance.on('click', STATION_LAYER_ID, handleClick)
      mapInstance.on('mouseenter', STATION_LAYER_ID, handleMouseEnter)
      mapInstance.on('mouseleave', STATION_LAYER_ID, handleMouseLeave)
    }

    mapInstance.on('load', handleLoad)

    return () => {
      mapInstance.off('load', handleLoad)
      mapInstance.off('click', STATION_LAYER_ID, handleClick)
      mapInstance.off('mouseenter', STATION_LAYER_ID, handleMouseEnter)
      mapInstance.off('mouseleave', STATION_LAYER_ID, handleMouseLeave)
      mapReadyRef.current = false
      mapInstance.remove()
      mapRef.current = null
    }
  }, [styleUrl])

  useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const container = ref.current
    if (!container) return
    const observer = new ResizeObserver(() => {
      const map = mapRef.current
      if (map && mapReadyRef.current) {
        map.resize()
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Keep GeoJSON source in sync with station coordinates
  useEffect(() => {
    stationGeoJsonRef.current = stationGeoJson
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    const source = map.getSource(STATION_SOURCE_ID) as GeoJSONSource | undefined
    if (source) source.setData(stationGeoJson as any)
  }, [stationGeoJson])

  // Focus/center on selected station if it has coordinates
  useEffect(() => {
    const map = mapRef.current
    if (!map || !selected || !mapReadyRef.current) return
    const s = stationLookup[selected.id]
    if (s) {
      map.easeTo({
        center: [s.lng, s.lat],
        zoom: Math.max(13, map.getZoom()),
        duration: 450,
        padding: createPadding(bottomOffsetRef.current)
      })
    }
  }, [selected, stationLookup, bottomOffsetPx])

  // Update selected layer filter when selection changes
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    if (!map.getLayer(STATION_SELECTED_LAYER_ID)) return
    const target = selected?.id
    map.setFilter(
      STATION_SELECTED_LAYER_ID,
      target ? ['==', ['get', 'id'], target] : ['==', ['get', 'id'], '__none__']
    )
  }, [selected])

  useEffect(() => {
    if (typeof viewportHeight !== 'number') return
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    map.resize()
  }, [viewportHeight])

  return <div ref={ref} className="absolute inset-0" />
}

export default MapView
