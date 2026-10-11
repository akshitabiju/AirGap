import { create } from 'zustand'
import type { City, Forecast, History, Hourly, Meta, Metrics, Placement, States, Station, ViewMode } from './types'
import type { FeatureCollection, Geometry } from 'geojson'
import type { DistrictProps } from './types'

export type DistrictFC = FeatureCollection<Geometry, DistrictProps>

interface State {
  districts: DistrictFC | null
  stations: Station[] | null
  metrics: Metrics | null
  placement: Placement | null
  meta: Meta | null
  cities: City[] | null
  history: History | null
  forecast: Forecast | null
  hourly: Hourly | null
  states: States | null
  day: number | null            // index into history series; null = latest day
  setDay: (d: number | null) => void
  view: ViewMode
  setView: (v: ViewMode) => void
  errors: Record<string, string>
  loading: boolean
  load: () => Promise<void>
  selected: number | null
  setSelected: (id: number | null) => void
  hovered: number | null
  setHovered: (id: number | null) => void
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { cache: 'no-cache' })
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`)
  return r.json() as Promise<T>
}

export const useData = create<State>((set, get) => ({
  districts: null, stations: null, metrics: null, placement: null, meta: null, cities: null,
  history: null, forecast: null, hourly: null, states: null, day: null, view: 'pred',
  setDay: (day) => set({ day }), setView: (view) => set({ view }),
  errors: {}, loading: false, selected: null, hovered: null,
  setSelected: (id) => set({ selected: id }),
  setHovered: (id) => set({ hovered: id }),
  load: async () => {
    if (get().loading || get().districts) return
    set({ loading: true })
    const jobs: [keyof State, string][] = [
      ['districts', '/data/districts.geojson'], ['stations', '/data/stations.json'],
      ['metrics', '/data/metrics.json'], ['placement', '/data/placement.json'],
      ['meta', '/data/meta.json'], ['cities', '/data/cities.json'], ['history', '/data/history.json'], ['forecast', '/data/forecast.json'], ['hourly', '/data/hourly.json'], ['states', '/data/states.json'],
    ]
    const results = await Promise.allSettled(jobs.map(([, p]) => getJson<unknown>(p)))
    const patch: Partial<State> = {}; const errors: Record<string, string> = {}
    results.forEach((r, i) => {
      const key = jobs[i][0]
      if (r.status === 'fulfilled') (patch as Record<string, unknown>)[key] = r.value
      else errors[key] = String(r.reason)
    })
    // Append the forecast days to each district's history so the timeline runs past today.
    const h = patch.history as History | undefined, f = patch.forecast as Forecast | undefined
    if (h && f && h.forecastFrom == null) {
      let n = 0
      for (const [id, s] of Object.entries(h.series)) {
        n = s.length
        const fs = f.series[id]
        if (fs) s.push(...fs.map(([d, p, , , c]) => [d, p, c] as [string, number, number]))
      }
      h.forecastFrom = n
    }
    set({ ...patch, errors, loading: false })
  },
}))
