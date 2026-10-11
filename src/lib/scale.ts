// CPCB National AQI breakpoints for 24-hour PM2.5 (µg/m³). Source: CPCB, 2014.
export const BANDS = [
  { max: 30, label: 'Good', color: '#2fb58b' },
  { max: 60, label: 'Satisfactory', color: '#9ccf5f' },
  { max: 90, label: 'Moderate', color: '#f2cf4a' },
  { max: 120, label: 'Poor', color: '#f0913a' },
  { max: 250, label: 'Very poor', color: '#d9455f' },
  { max: Infinity, label: 'Severe', color: '#6e2a7a' },
] as const

export function band(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return { max: 0, label: 'No data', color: '#cfd8d6' }
  return BANDS.find((b) => v <= b.max) ?? BANDS[BANDS.length - 1]
}

/** Continuous interpolation between band colours so the map doesn't look posterised. */
export function colorFor(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '#cfd8d6'
  const stops: [number, string][] = [
    [0, '#24a883'], [30, '#7cc46a'], [60, '#f2cf4a'], [90, '#f0913a'], [120, '#e2603f'], [250, '#b8325a'], [400, '#5a1f6e'],
  ]
  if (v <= stops[0][0]) return stops[0][1]
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const [x0, c0] = stops[i - 1]; const [x1, c1] = stops[i]
      return mix(c0, c1, (v - x0) / (x1 - x0))
    }
  }
  return stops[stops.length - 1][1]
}

function hex(c: string) { return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) }
function mix(a: string, b: string, t: number) {
  const [r0, g0, b0] = hex(a); const [r1, g1, b1] = hex(b)
  const r = Math.round(r0 + (r1 - r0) * t), g = Math.round(g0 + (g1 - g0) * t), bl = Math.round(b0 + (b1 - b0) * t)
  return `#${[r, g, bl].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/** MapLibre interpolate expression mirroring colorFor(). */
type Expr = import('maplibre-gl').ExpressionSpecification
/** Value to colour: the scrubbed day's value from feature-state if present, else today's. */
const V = ['coalesce', ['feature-state', 'v'], ['get', 'pred']]
export const MAP_COLOR_EXPR = [
  'case', ['==', V, null], '#cfd8d6',
  ['interpolate', ['linear'], V,
    0, '#24a883', 30, '#7cc46a', 60, '#f2cf4a', 90, '#f0913a', 120, '#e2603f', 250, '#b8325a', 400, '#5a1f6e'],
] as unknown as Expr
/** Uncertainty: one hue, light -> dark (sequential). */
export const UNC_COLOR_EXPR = [
  'case', ['==', ['get', 'unc'], null], '#cfd8d6',
  ['interpolate', ['linear'], ['get', 'unc'], 5, '#e3efec', 12, '#b2dcd4', 20, '#5fb8b0', 30, '#16697a', 45, '#0a3540'],
] as unknown as Expr
/** Distance to nearest monitor: one hue, light -> dark. */
export const DIST_COLOR_EXPR = [
  'interpolate', ['linear'], ['get', 'nearest_km'], 0, '#eef3f1', 25, '#f3dca3', 60, '#e9a85a', 120, '#d1495b', 250, '#5a1f6e',
] as unknown as Expr
export const VIEW_LEGEND = {
  unc: { title: '68 % interval half-width, µg/m³', stops: ['#e3efec', '#b2dcd4', '#5fb8b0', '#16697a', '#0a3540'], labels: ['5', '12', '20', '30', '45+'] },
  dist: { title: 'Distance to nearest monitor, km', stops: ['#eef3f1', '#f3dca3', '#e9a85a', '#d1495b', '#5a1f6e'], labels: ['0', '25', '60', '120', '250+'] },
}

export const WHO_GUIDELINE_24H = 15   // WHO 2021 AQG, 24-hour PM2.5
export const INDIA_NAAQS_24H = 60     // India NAAQS 2009, 24-hour PM2.5

export const fmt = (v: number | null | undefined, d = 0) => (v == null || Number.isNaN(v) ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }))
