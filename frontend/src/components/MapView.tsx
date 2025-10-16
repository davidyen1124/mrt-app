import type { Station } from '@/types/station'
import type { Feature, FeatureCollection, Point } from 'geojson'
import type { GeoJSONSource, MapLayerMouseEvent, Map as MaplibreMap } from 'maplibre-gl'
import maplibregl, { LngLatLike } from 'maplibre-gl'
import { useEffect, useMemo, useRef } from 'react'

type StationWithCoords = Station & { lat: number; lng: number }
type StationFeatureProperties = { id: string; title: string; codes: string[] }
type StationFeature = Feature<Point, StationFeatureProperties>
type StationFeatureCollection = FeatureCollection<Point, StationFeatureProperties>

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function stationGeoJsonInitial(): StationFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: []
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
  const mapRef = useRef<MaplibreMap | null>(null)
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

  const stationsWithCoords = useMemo(() => {
    const out: StationWithCoords[] = []
    const asNum = (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value) ? value : null
    const swapIfNeeded = (a: number, b: number) =>
      a > 60 && b < 60 ? { lat: b, lng: a } : { lat: a, lng: b }

    for (const station of stations) {
      const providedCoords = coordsById?.[station.id]
      const lookupLat = asNum(providedCoords?.lat)
      const lookupLng = asNum(providedCoords?.lng)
      if (lookupLat != null && lookupLng != null) {
        out.push({ ...station, lat: lookupLat, lng: lookupLng })
        continue
      }

      let lat: number | null = null
      let lng: number | null = null

      const directLat = asNum(station.lat)
      const directLng = asNum(station.lng)
      if (directLat != null && directLng != null) {
        lat = directLat
        lng = directLng
      } else {
        const altLat = asNum(station['latitude'])
        const altLng = asNum(station['longitude'])
        if (altLat != null && altLng != null) {
          lat = altLat
          lng = altLng
        } else {
          const location = station['location']
          if (Array.isArray(location) && location.length >= 2) {
            const first = asNum(location[0])
            const second = asNum(location[1])
            if (first != null && second != null) {
              const swapped = swapIfNeeded(first, second)
              lat = swapped.lat
              lng = swapped.lng
            }
          } else {
            const position = station['position']
            if (isRecord(position)) {
              const posLat = asNum(position.lat)
              const posLng = asNum(position.lng)
              if (posLat != null && posLng != null) {
                lat = posLat
                lng = posLng
              }
            }
          }
        }
      }

      if (lat != null && lng != null) {
        out.push({ ...station, lat, lng })
      }
    }
    return out
  }, [stations, coordsById])

  const uniqueStations = useMemo(() => {
    const seen = new globalThis.Map<string, StationWithCoords>()
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
      type: 'FeatureCollection',
      features: uniqueStations.map<StationFeature>(station => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [station.lng, station.lat]
        },
        properties: {
          id: station.id,
          title: station.name_zh ?? '',
          codes: station.codes ?? []
        }
      }))
    } satisfies StationFeatureCollection
  }, [uniqueStations])

  useEffect(() => {
    if (mapRef.current) return
    const container = ref.current
    if (!container) return

    const mapInstance = new maplibregl.Map({
      container,
      style: styleUrl,
      center: [121.5654, 25.033] as LngLatLike,
      zoom: 11,
      attributionControl: false,
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

    mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    const geolocate = new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showAccuracyCircle: false
    })
    mapInstance.addControl(geolocate, 'top-right')
    requestAnimationFrame(() => {
      if (mapReadyRef.current && mapRef.current) mapRef.current.resize()
      else mapInstance.resize()
    })

    geolocate.on('geolocate', (position: GeolocationPosition) => {
      const { latitude: lat, longitude: lng } = position.coords
      if (typeof lat !== 'number' || typeof lng !== 'number') return
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
    }

    mapInstance.on('load', handleLoad)

    return () => {
      mapInstance.off('load', handleLoad)
      mapInstance.off('click', STATION_LAYER_ID, handleClick)
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

  useEffect(() => {
    stationGeoJsonRef.current = stationGeoJson
    const map = mapRef.current
    if (!map || !mapReadyRef.current) return
    const source = map.getSource(STATION_SOURCE_ID) as GeoJSONSource | undefined
    if (source) source.setData(stationGeoJson)
  }, [stationGeoJson])

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

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="h-full w-full" />
    </div>
  )
}

export default MapView
