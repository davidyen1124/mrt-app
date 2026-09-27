import {
  findLine,
  isTransfer,
  lineGeometry,
  lines,
  mapPosition,
  primaryLine,
  stations,
  type Lang,
  type Line,
  type Station
} from '@/data/network'
import type { ExpressionSpecification, GeoJSONSource, LngLatBoundsLike, Map as MapInstance, MapLayerMouseEvent } from 'maplibre-gl'
import maplibregl from 'maplibre-gl'
import { useEffect, useMemo, useRef } from 'react'

const STYLE = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark'
}

const THEME = {
  light: { casing: '#ffffff', ink: '#16181b', halo: 'rgba(255,255,255,0.95)', label: '#1c1f24', dot: '#ffffff' },
  dark: { casing: '#0c0e11', ink: '#f2f3f5', halo: 'rgba(12,14,17,0.92)', label: '#e9ebee', dot: '#16191e' }
}

const NETWORK_BOUNDS: LngLatBoundsLike = (() => {
  const lngs = stations.map(station => station.lng)
  const lats = stations.map(station => station.lat)
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)]
  ]
})()

export type MapInsets = { top: number; bottom: number; left: number; right: number }

const paddingFor = (insets: MapInsets) => ({
  top: insets.top + 16,
  bottom: insets.bottom + 16,
  left: insets.left + 16,
  right: insets.right + 16
})

type MapViewProps = {
  dark: boolean
  lang: Lang
  selected: Station | null
  focusLine: Line | null
  travelMinutes: Map<string, number> | null
  user: { lat: number; lng: number } | null
  followUser: number
  insets: MapInsets
  onStationClick: (station: Station) => void
  onBackgroundClick: () => void
}

const lineFeatures = () => ({
  type: 'FeatureCollection' as const,
  features: lineGeometry.features.map(feature => {
    const line = findLine(feature.properties.line)
    return {
      ...feature,
      properties: { line: feature.properties.line, color: line?.color ?? '#999', branch: line?.branchOf ? 1 : 0 }
    }
  })
})

const timeLabel = (lang: Lang): ExpressionSpecification => [
  'format',
  ['get', 'name'],
  { 'font-scale': 0.82 },
  '\n',
  {},
  ['concat', ['to-string', ['get', 'minutes']], lang === 'en' ? ' min' : ' 分'],
  { 'font-scale': 1.05 }
]

const stationFeatures = (lang: Lang, minutes: Map<string, number> | null) => ({
  type: 'FeatureCollection' as const,
  features: stations.map(station => {
    const travel = minutes?.get(station.id)
    return {
      type: 'Feature' as const,
      id: stations.indexOf(station),
      geometry: { type: 'Point' as const, coordinates: mapPosition(station) },
      properties: {
        id: station.id,
        name: lang === 'en' ? station.name.en || station.name.zh : station.name.zh,
        sub: lang === 'en' ? station.name.zh : station.name.en,
        color: primaryLine(station).color,
        transfer: isTransfer(station) ? 1 : 0,
        // Comma-wrapped so ['in', ',R,', …] never matches BR.
        lines: `,${station.lines.join(',')},`,
        ...(travel != null ? { minutes: travel } : {})
      }
    }
  })
})

export default function MapView(props: MapViewProps) {
  const { dark, lang, selected, focusLine, travelMinutes, user, followUser, insets, onStationClick, onBackgroundClick } = props
  const container = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<MapInstance | null>(null)
  const readyRef = useRef(false)
  const applyRef = useRef<() => void>(() => {})
  const pinRef = useRef<maplibregl.Marker | null>(null)
  const userRef = useRef<maplibregl.Marker | null>(null)
  const latest = useRef(props)
  latest.current = props

  const theme = dark ? THEME.dark : THEME.light
  const stationData = useMemo(() => stationFeatures(lang, travelMinutes), [lang, travelMinutes])
  const padding = useMemo(() => paddingFor(insets), [insets])

  // Create the map once.
  useEffect(() => {
    if (!container.current) return
    const map = new maplibregl.Map({
      container: container.current,
      style: latest.current.dark ? STYLE.dark : STYLE.light,
      bounds: NETWORK_BOUNDS,
      fitBoundsOptions: { padding: 40 },
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      maxZoom: 18,
      minZoom: 9,
      localIdeographFontFamily: '"PingFang TC", "Noto Sans TC", "Microsoft JhengHei", sans-serif'
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    mapRef.current = map

    let readyOnce = false
    const addOverlay = () => {
      const current = latest.current
      const colors = current.dark ? THEME.dark : THEME.light
      for (const layer of map.getStyle().layers ?? []) {
        // Our station names are the only text on the map: basemap road, place and POI labels (and its own
        // copies of station names) sat right under ours and made both hard to read.
        if (layer.type === 'symbol') map.setLayoutProperty(layer.id, 'visibility', 'none')
        // Our own line geometry replaces the basemap's subway tracks.
        else if (layer.id.startsWith('railway_transit')) map.setLayoutProperty(layer.id, 'visibility', 'none')
        // Keep TRA/HSR tracks as quiet context under the metro lines.
        else if (layer.type === 'line' && layer.id.startsWith('railway')) map.setPaintProperty(layer.id, 'line-opacity', 0.35)
      }
      if (!map.getSource('mrt-lines')) map.addSource('mrt-lines', { type: 'geojson', data: lineFeatures() })
      if (!map.getSource('mrt-stations')) {
        map.addSource('mrt-stations', { type: 'geojson', data: stationFeatures(current.lang, current.travelMinutes) })
      }

      // Branch lines draw slightly thinner; zoom must stay the top-level interpolation input.
      const branchFactor: ExpressionSpecification = ['case', ['==', ['get', 'branch'], 1], 0.75, 1]
      const width = (scale: number): ExpressionSpecification => [
        'interpolate', ['exponential', 1.6], ['zoom'],
        9, ['*', 1.8 * scale, branchFactor],
        12, ['*', 3.8 * scale, branchFactor],
        15, ['*', 7 * scale, branchFactor],
        18, ['*', 12 * scale, branchFactor]
      ]
      map.addLayer({
        id: 'mrt-lines-casing',
        type: 'line',
        source: 'mrt-lines',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': colors.casing, 'line-width': width(1.9), 'line-opacity': 0.9 }
      })
      map.addLayer({
        id: 'mrt-lines',
        type: 'line',
        source: 'mrt-lines',
        layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['-', 0, ['get', 'branch']] },
        paint: { 'line-color': ['get', 'color'], 'line-width': width(1) }
      })
      map.addLayer({
        id: 'mrt-stations',
        type: 'circle',
        source: 'mrt-stations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 9, ['case', ['==', ['get', 'transfer'], 1], 2.6, 1.6], 12, ['case', ['==', ['get', 'transfer'], 1], 5, 3.6], 15, ['case', ['==', ['get', 'transfer'], 1], 8.5, 6.5], 18, 11],
          'circle-color': colors.dot,
          'circle-stroke-color': ['case', ['==', ['get', 'transfer'], 1], colors.ink, ['get', 'color']],
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 9, 1, 12, 2, 15, 3, 18, 3.6]
        }
      })
      const label = (extra: Partial<maplibregl.SymbolLayerSpecification>): maplibregl.SymbolLayerSpecification => ({
        id: 'mrt-labels',
        type: 'symbol',
        source: 'mrt-stations',
        ...extra,
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Regular'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 13.5],
          'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
          'text-radial-offset': 0.95,
          'text-padding': 3,
          'symbol-sort-key': ['-', 0, ['get', 'transfer']],
          ...extra.layout
        },
        paint: {
          'text-color': colors.label,
          'text-halo-color': colors.halo,
          'text-halo-width': 1.6,
          'text-halo-blur': 0.4,
          ...extra.paint
        }
      })
      map.addLayer(label({ minzoom: 11.6 }))
      map.addLayer(
        label({
          id: 'mrt-time-labels',
          filter: ['has', 'minutes'],
          layout: {
            'text-field': timeLabel(current.lang),
            'text-font': ['Noto Sans Bold'],
            'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10.5, 14, 13],
            'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
            'text-radial-offset': 0.8,
            visibility: 'none'
          }
        })
      )
      map.addLayer(
        label({
          id: 'mrt-selected-label',
          filter: ['==', ['get', 'id'], '__none__'],
          layout: {
            'text-field': ['format', ['get', 'name'], {}, '\n', {}, ['get', 'sub'], { 'font-scale': 0.78 }],
            'text-font': ['Noto Sans Bold'],
            'text-size': 15,
            'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
            'text-radial-offset': 1.35,
            'text-allow-overlap': true,
            'text-ignore-placement': true
          },
          paint: { 'text-halo-width': 2.2 }
        })
      )
      const firstLoad = !readyOnce
      readyOnce = true
      readyRef.current = true
      applyState()
      // Deep links arrive before the map is ready; jump straight to the selection on first load.
      if (firstLoad && current.selected && !current.travelMinutes) {
        map.jumpTo({ center: mapPosition(current.selected), zoom: 14.5, padding: paddingFor(current.insets) })
      }
      if (firstLoad) {
        // Start with the attribution collapsed to its (i) button; it expands on tap.
        map.once('idle', () =>
          map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show')
        )
      }
    }

    const applyState = () => {
      if (!readyRef.current) return
      const current = latest.current
      const focus = current.focusLine
      const focusIds = focus ? [focus.id, ...lines.filter(line => line.branchOf === focus.id).map(line => line.id)] : null
      map.setPaintProperty('mrt-lines', 'line-opacity', focusIds ? ['case', ['in', ['get', 'line'], ['literal', focusIds]], 1, 0.16] : 1)
      map.setPaintProperty('mrt-lines-casing', 'line-opacity', focusIds ? ['case', ['in', ['get', 'line'], ['literal', focusIds]], 0.9, 0] : 0.9)
      const stationOpacity: ExpressionSpecification | number = focusIds
        ? ['case', ['any', ...focusIds.map(id => ['in', `,${id},`, ['get', 'lines']] as ExpressionSpecification)], 1, 0.25]
        : 1
      map.setPaintProperty('mrt-stations', 'circle-opacity', stationOpacity)
      map.setPaintProperty('mrt-stations', 'circle-stroke-opacity', stationOpacity)
      map.setPaintProperty('mrt-labels', 'text-opacity', stationOpacity)
      const timeMode = Boolean(current.travelMinutes)
      map.setLayoutProperty('mrt-time-labels', 'visibility', timeMode ? 'visible' : 'none')
      map.setLayoutProperty('mrt-labels', 'visibility', timeMode ? 'none' : 'visible')
      // The selected station is labelled only by the highlighted layer; drawing it in the regular layers too
      // stacked two copies of the same name.
      const selectedId = current.selected?.id ?? '__none__'
      map.setFilter('mrt-selected-label', ['==', ['get', 'id'], selectedId])
      map.setFilter('mrt-labels', ['!=', ['get', 'id'], selectedId])
      map.setFilter('mrt-time-labels', ['all', ['has', 'minutes'], ['!=', ['get', 'id'], selectedId]])
    }

    const onStationClickHandler = (event: MapLayerMouseEvent) => {
      const id = event.features?.[0]?.properties?.id
      const station = stations.find(item => item.id === id)
      if (station) latest.current.onStationClick(station)
    }
    const onMapClick = (event: maplibregl.MapMouseEvent) => {
      if (!readyRef.current) return
      const hits = map.queryRenderedFeatures(
        [
          [event.point.x - 14, event.point.y - 14],
          [event.point.x + 14, event.point.y + 14]
        ],
        { layers: ['mrt-stations'] }
      )
      if (hits.length) onStationClickHandler({ ...event, features: hits } as unknown as MapLayerMouseEvent)
      else latest.current.onBackgroundClick()
    }
    const setPointer = (value: string) => () => (map.getCanvas().style.cursor = value)

    map.on('style.load', addOverlay)
    map.on('click', onMapClick)
    map.on('mouseenter', 'mrt-stations', setPointer('pointer'))
    map.on('mouseleave', 'mrt-stations', setPointer(''))
    applyRef.current = applyState

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)

    return () => {
      observer.disconnect()
      readyRef.current = false
      map.remove()
      mapRef.current = null
    }
  }, [])

  // Swap basemap with the colour scheme; overlays are re-added on style.load.
  const firstStyle = useRef(true)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (firstStyle.current) {
      firstStyle.current = false
      return
    }
    readyRef.current = false
    map.setStyle(dark ? STYLE.dark : STYLE.light)
  }, [dark])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !readyRef.current) return
    ;(map.getSource('mrt-stations') as GeoJSONSource | undefined)?.setData(stationData)
    if (map.getLayer('mrt-time-labels')) map.setLayoutProperty('mrt-time-labels', 'text-field', timeLabel(lang))
  }, [stationData, lang])

  useEffect(() => applyRef.current(), [selected, focusLine, travelMinutes, dark])

  // Keep the attribution button above the sheet.
  useEffect(() => {
    container.current?.style.setProperty('--map-inset-bottom', `${insets.bottom}px`)
  }, [insets.bottom])

  // Selected station pin.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    pinRef.current?.remove()
    pinRef.current = null
    if (!selected) return
    const element = document.createElement('div')
    element.className = 'station-pin'
    element.style.setProperty('--pin-color', primaryLine(selected).color)
    pinRef.current = new maplibregl.Marker({ element }).setLngLat(mapPosition(selected)).addTo(map)
  }, [selected])

  // Camera: one effect decides what to frame, and re-frames it whenever the sheet changes the padding.
  // (Separate padding-only eases would cancel an in-flight fitBounds.)
  const timeMode = Boolean(travelMinutes)
  const cameraKey = `${selected?.id ?? ''}|${focusLine?.id ?? ''}|${timeMode}`
  const lastCameraKey = useRef<string | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const targetChanged = lastCameraKey.current !== cameraKey
    lastCameraKey.current = cameraKey
    if (timeMode) {
      map.fitBounds(NETWORK_BOUNDS, { padding, duration: 700 })
    } else if (selected) {
      map.easeTo({
        center: mapPosition(selected),
        zoom: targetChanged ? Math.max(map.getZoom(), 14.5) : map.getZoom(),
        padding,
        duration: 650
      })
    } else if (focusLine) {
      const members = stations.filter(station => station.codes.some(code => focusLine.stations.includes(code)))
      const lngs = members.map(station => mapPosition(station)[0])
      const lats = members.map(station => mapPosition(station)[1])
      map.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)]
        ],
        { padding, duration: 700, maxZoom: 14 }
      )
    } else {
      map.easeTo({ padding, duration: 450 })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraKey, padding])

  // User location dot.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!user) {
      userRef.current?.remove()
      userRef.current = null
      return
    }
    if (!userRef.current) {
      const element = document.createElement('div')
      element.className = 'user-dot'
      userRef.current = new maplibregl.Marker({ element }).setLngLat([user.lng, user.lat]).addTo(map)
    } else {
      userRef.current.setLngLat([user.lng, user.lat])
    }
  }, [user])

  useEffect(() => {
    const map = mapRef.current
    const current = latest.current.user
    if (!map || !followUser || !current) return
    map.easeTo({ center: [current.lng, current.lat], zoom: Math.max(map.getZoom(), 15), padding, duration: 700 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followUser])

  // MapLibre's unlayered CSS forces `position: relative` on the map element, so size it from a wrapper.
  return (
    <div className="absolute inset-0 bg-canvas">
      <div ref={container} className="h-full w-full" aria-label="Taipei Metro map" role="application" />
    </div>
  )
}
