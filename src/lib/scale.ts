// CPCB National AQI breakpoints for 24-hour PM2.5 (µg/m³). Source: CPCB, 2014.
export const BANDS = [
  { max: 30, label: 'Good', color: '#4f8463' },
  { max: 60, label: 'Satisfactory', color: '#9db99a' },
  { max: 90, label: 'Moderate', color: '#e0c45c' },
  { max: 120, label: 'Poor', color: '#e0a458' },
  { max: 250, label: 'Very poor', color: '#b5462d' },
  { max: Infinity, label: 'Severe', color: '#5a1f16' },
] as const

export function band(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return { max: 0, label: 'No data', color: '#d9d2c3' }
  return BANDS.find((b) => v <= b.max) ?? BANDS[BANDS.length - 1]
}

/** Continuous interpolation between band colours so the map doesn't look posterised. */
export function colorFor(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '#d9d2c3'
  const stops: [number, string][] = [
    [0, '#5f9470'], [30, '#8fb58a'], [60, '#d9c565'], [90, '#dfa352'], [120, '#c9623a'], [250, '#8a2f1c'], [400, '#4a160f'],
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
export const MAP_COLOR_EXPR = [
  'case', ['==', ['get', 'pred'], null], '#d9d2c3',
  ['interpolate', ['linear'], ['get', 'pred'],
    0, '#5f9470', 30, '#8fb58a', 60, '#d9c565', 90, '#dfa352', 120, '#c9623a', 250, '#8a2f1c', 400, '#4a160f'],
] as unknown as import('maplibre-gl').ExpressionSpecification

export const WHO_GUIDELINE_24H = 15   // WHO 2021 AQG, 24-hour PM2.5
export const INDIA_NAAQS_24H = 60     // India NAAQS 2009, 24-hour PM2.5

export const fmt = (v: number | null | undefined, d = 0) => (v == null || Number.isNaN(v) ? '—' : v.toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d }))
