import { create } from 'zustand'
import type { City, Meta, Metrics, Placement, Station } from './types'
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
  errors: {}, loading: false, selected: null, hovered: null,
  setSelected: (id) => set({ selected: id }),
  setHovered: (id) => set({ hovered: id }),
  load: async () => {
    if (get().loading || get().districts) return
    set({ loading: true })
    const jobs: [keyof State, string][] = [
      ['districts', '/data/districts.geojson'], ['stations', '/data/stations.json'],
      ['metrics', '/data/metrics.json'], ['placement', '/data/placement.json'],
      ['meta', '/data/meta.json'], ['cities', '/data/cities.json'],
    ]
    const results = await Promise.allSettled(jobs.map(([, p]) => getJson<unknown>(p)))
    const patch: Partial<State> = {}; const errors: Record<string, string> = {}
    results.forEach((r, i) => {
      const key = jobs[i][0]
      if (r.status === 'fulfilled') (patch as Record<string, unknown>)[key] = r.value
      else errors[key] = String(r.reason)
    })
    set({ ...patch, errors, loading: false })
  },
}))
