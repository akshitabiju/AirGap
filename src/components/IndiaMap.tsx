import { useEffect, useRef, useState } from 'react'
import { Map as MLMap, NavigationControl, setWorkerUrl, type MapMouseEvent } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useData } from '../lib/store'
import { MAP_COLOR_EXPR } from '../lib/scale'
import type { PlacementSite } from '../lib/types'

const STYLE = 'https://tiles.openfreemap.org/styles/positron'
// Vite 8 / Rolldown can't resolve MapLibre's inline worker blob; serve the worker as a static file instead.
setWorkerUrl(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/maplibre-gl-worker.mjs`)
const INDIA_BOUNDS: [[number, number], [number, number]] = [[68.0, 7.0], [97.0, 35.5]]

interface Props {
  mode?: 'districts' | 'placement'
  sites?: PlacementSite[]
  highlightSite?: number | null
  flyTo?: { lat: number; lon: number } | null
  className?: string
  onReady?: () => void
}

export default function IndiaMap({ mode = 'districts', sites, highlightSite, flyTo, className = '', onReady }: Props) {
  const el = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MLMap | null>(null)
  const ready = useRef(false)
  const [loaded, setLoaded] = useState(false)
  const districts = useData((s) => s.districts)
  const stations = useData((s) => s.stations)
  const selected = useData((s) => s.selected)
  const setSelected = useData((s) => s.setSelected)
  const setHovered = useData((s) => s.setHovered)
  const hoverId = useRef<number | null>(null)

  // Create the map once.
  useEffect(() => {
    if (!el.current || mapRef.current) return
    const map = new MLMap({
      container: el.current,
      style: STYLE,
      bounds: INDIA_BOUNDS,
      fitBoundsOptions: { padding: 12 },
      attributionControl: { compact: true },
      maxBounds: [[55, -5], [110, 45]],
      minZoom: 3.2,
      maxZoom: 11,
      dragRotate: false,
      pitchWithRotate: false,
    })
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.on('load', () => {
      ready.current = true
      setLoaded(true)   // triggers the paint effect with the *current* data, not a stale closure
      onReady?.()
    })
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      ready.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Add data layers as data arrives. Idempotent.
  function paint() {
    const map = mapRef.current
    if (!map || !ready.current || !districts) return
    const firstSymbol = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
    if (!map.getSource('districts')) {
      map.addSource('districts', { type: 'geojson', data: districts, promoteId: 'id' })
      map.addLayer(
        {
          id: 'district-fill',
          type: 'fill',
          source: 'districts',
          paint: {
            'fill-color': MAP_COLOR_EXPR,
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'hover'], false], 0.95,
              ['boolean', ['feature-state', 'selected'], false], 1,
              0.72,
            ],
          },
        },
        firstSymbol,
      )
      map.addLayer(
        {
          id: 'district-line',
          type: 'line',
          source: 'districts',
          paint: {
            'line-color': '#1b1a17',
            'line-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false], 0.9,
              ['boolean', ['feature-state', 'hover'], false], 0.5,
              0.12,
            ],
            'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 1.6, 0.5],
          },
        },
        firstSymbol,
      )
      map.on('mousemove', 'district-fill', (e: MapMouseEvent) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['district-fill'] })[0]
        const id = f ? (f.id as number) : null
        if (id !== hoverId.current) {
          if (hoverId.current != null) map.setFeatureState({ source: 'districts', id: hoverId.current }, { hover: false })
          if (id != null) map.setFeatureState({ source: 'districts', id }, { hover: true })
          hoverId.current = id
          setHovered(id)
        }
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'district-fill', () => {
        if (hoverId.current != null) map.setFeatureState({ source: 'districts', id: hoverId.current }, { hover: false })
        hoverId.current = null
        setHovered(null)
        map.getCanvas().style.cursor = ''
      })
      map.on('click', 'district-fill', (e: MapMouseEvent) => {
        const f = map.queryRenderedFeatures(e.point, { layers: ['district-fill'] })[0]
        setSelected(f ? (f.id as number) : null)
      })
    }
    if (stations && !map.getSource('stations')) {
      map.addSource('stations', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: stations.map((s) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
            properties: { name: s.name, v: s.last_value ?? null },
          })),
        },
      })
      map.addLayer({
        id: 'stations',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1.6, 8, 4],
          'circle-color': '#1b1a17',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#f5efe4',
          'circle-stroke-width': 0.6,
        },
      })
    }
    if (mode === 'placement' && sites && !map.getSource('sites')) {
      map.addSource('sites', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: sites.map((s) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [s.lon, s.lat] },
            properties: { rank: s.rank, name: s.name },
          })),
        },
      })
      map.addLayer({ id: 'sites-halo', type: 'circle', source: 'sites', paint: { 'circle-radius': 14, 'circle-color': '#e0a458', 'circle-opacity': 0.25 } })
      map.addLayer({
        id: 'sites',
        type: 'circle',
        source: 'sites',
        paint: { 'circle-radius': 7, 'circle-color': '#e0a458', 'circle-stroke-color': '#1b1a17', 'circle-stroke-width': 1.4 },
      })
      map.addLayer({
        id: 'sites-label',
        type: 'symbol',
        source: 'sites',
        layout: { 'text-field': ['to-string', ['get', 'rank']], 'text-size': 10, 'text-font': ['Noto Sans Bold'], 'text-allow-overlap': true },
        paint: { 'text-color': '#1b1a17' },
      })
      map.setPaintProperty('district-fill', 'fill-opacity', 0.45)
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { paint() }, [loaded, districts, stations, sites, mode])

  // Selected feature state.
  const prevSel = useRef<number | null>(null)
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded || !map.getSource('districts')) return
    if (prevSel.current != null) map.setFeatureState({ source: 'districts', id: prevSel.current }, { selected: false })
    if (selected != null) map.setFeatureState({ source: 'districts', id: selected }, { selected: true })
    prevSel.current = selected
  }, [selected, districts, loaded])

  // Highlight a placement site.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !loaded || !map.getLayer('sites')) return
    const r = highlightSite ?? -1
    map.setPaintProperty('sites', 'circle-radius', ['case', ['==', ['get', 'rank'], r], 11, 7])
    map.setPaintProperty('sites-halo', 'circle-radius', ['case', ['==', ['get', 'rank'], r], 24, 14])
  }, [highlightSite, loaded])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTo) return
    map.flyTo({ center: [flyTo.lon, flyTo.lat], zoom: Math.max(map.getZoom(), 6.2), duration: 1400, essential: true })
  }, [flyTo])

  return <div ref={el} className={`h-full w-full ${className}`} />
}
