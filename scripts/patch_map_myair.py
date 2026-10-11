"""Detailed basemap + station popups + MyAir section. One-off."""
import pathlib, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def patch(path, pairs):
    p = pathlib.Path(path); s = p.read_text(encoding="utf-8")
    for a, b in pairs:
        if a not in s: raise SystemExit(f"{path}: missing {a[:70]!r}")
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")

patch("src/components/IndiaMap.tsx", [
    ("import { Map as MLMap, NavigationControl, setWorkerUrl, type MapMouseEvent } from 'maplibre-gl'",
     "import { Map as MLMap, NavigationControl, Popup, setWorkerUrl, type MapMouseEvent } from 'maplibre-gl'"),
    # detailed street-level basemap (roads, towns, POIs at high zoom), no key
    ("const STYLE = 'https://tiles.openfreemap.org/styles/positron'", "const STYLE = 'https://tiles.openfreemap.org/styles/liberty'"),
    ("      minZoom: 3.2,\n      maxZoom: 11,", "      minZoom: 3.2,\n      maxZoom: 15,"),
    # station layer: bigger at high zoom, coloured by measured value, hover popup
    ("""      map.addLayer({
        id: 'stations',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1.6, 8, 4],
          'circle-color': '#0c1a1e',
          'circle-opacity': 0.85,
          'circle-stroke-color': '#f4f7f6',
          'circle-stroke-width': 0.6,
        },
      })""",
     """      map.addLayer({
        id: 'stations',
        type: 'circle',
        source: 'stations',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 1.8, 8, 5, 12, 9],
          'circle-color': ['case', ['==', ['get', 'v'], null], '#0c1a1e', ['interpolate', ['linear'], ['get', 'v'], 0, '#24a883', 30, '#7cc46a', 60, '#f2cf4a', 90, '#f0913a', 120, '#e2603f', 250, '#b8325a', 400, '#5a1f6e']],
          'circle-opacity': 0.95,
          'circle-stroke-color': '#0c1a1e',
          'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 4, 0.4, 10, 1.2],
        },
      })
      map.addLayer({
        id: 'stations-label', type: 'symbol', source: 'stations', minzoom: 9,
        layout: { 'text-field': ['case', ['==', ['get', 'v'], null], '', ['to-string', ['get', 'v']]], 'text-size': 11, 'text-font': ['Noto Sans Bold'], 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-allow-overlap': false },
        paint: { 'text-color': '#0c1a1e', 'text-halo-color': '#f4f7f6', 'text-halo-width': 1.2 },
      })
      const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10, className: 'airgap-popup' })
      map.on('mouseenter', 'stations', (e) => {
        const f = e.features?.[0]
        if (!f) return
        const p = f.properties as { name: string; v: number | null; date: string | null; provider: string | null }
        const [lon, lat] = (f.geometry as GeoJSON.Point).coordinates
        popup.setLngLat([lon, lat]).setHTML(
          `<div class="text-xs"><div class="font-medium">${p.name}</div><div class="num">${p.v != null ? `${p.v} µg/m³` : 'no recent data'}<span class="text-ink-3"> · measured ${p.date ?? ''}</span></div><div class="text-ink-3">${p.provider ?? ''}</div></div>`,
        ).addTo(map)
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'stations', () => { popup.remove(); map.getCanvas().style.cursor = '' })"""),
    ("properties: { name: s.name, v: s.last_value ?? null },", "properties: { name: s.name, v: s.last_value ?? null, date: s.last_date ?? null, provider: s.provider ?? null },"),
    # softer district fill so streets show through when zoomed in
    ("              ['boolean', ['feature-state', 'selected'], false], 1,\n              0.72,",
     "              ['boolean', ['feature-state', 'selected'], false], 0.9,\n              ['interpolate', ['linear'], ['zoom'], 5, 0.72, 9, 0.5, 13, 0.3],"),
])

patch("src/index.css", [
    ("/* Scrollbar */", """.airgap-popup .maplibregl-popup-content { background: rgba(244,247,246,0.94); color: var(--color-ink); border: 1px solid var(--color-line-2); border-radius: 10px; padding: 8px 10px; box-shadow: 0 10px 30px -10px rgba(12,26,30,0.4); font-family: var(--font-sans); }
.airgap-popup .maplibregl-popup-tip { border-top-color: rgba(244,247,246,0.94) !important; }

/* Scrollbar */"""),
])

patch("src/pages/Landing.tsx", [
    ("import MapControls from '../components/MapControls'", "import MapControls from '../components/MapControls'\nimport MyAir from '../components/MyAir'"),
    ("      {/* live ticker */}", """      <MyAir onLocate={(d) => { setSelected(d.id); setFlyTo({ lat: d.lat, lon: d.lon }); mapSection.current?.scrollIntoView({ behavior: 'smooth' }) }} />

      {/* live ticker */}"""),
    ('<div className="ticker mt-16 border-y border-line py-2.5 text-xs">', '<div className="ticker mt-14 border-y border-line py-2.5 text-xs">'),
])
print("map + my-air patched")
