import type { DistrictFC } from './store'
import type { DistrictProps } from './types'

function inRing(lon: number, lat: number, ring: number[][]) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** District containing the point (ray casting over the simplified polygons), else the nearest by representative point. */
export function districtAt(fc: DistrictFC, lat: number, lon: number): DistrictProps | null {
  for (const f of fc.features) {
    const g = f.geometry
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const poly of polys) {
      if (inRing(lon, lat, poly[0]) && !poly.slice(1).some((hole) => inRing(lon, lat, hole))) return f.properties
    }
  }
  let best: DistrictProps | null = null, bd = Infinity
  for (const f of fc.features) {
    const d = (f.properties.lat - lat) ** 2 + (f.properties.lon - lon) ** 2
    if (d < bd) { bd = d; best = f.properties }
  }
  return best
}

export const INDIA_BBOX = { latMin: 6, latMax: 37.5, lonMin: 67, lonMax: 98 }
export const inIndia = (lat: number, lon: number) => lat >= INDIA_BBOX.latMin && lat <= INDIA_BBOX.latMax && lon >= INDIA_BBOX.lonMin && lon <= INDIA_BBOX.lonMax
