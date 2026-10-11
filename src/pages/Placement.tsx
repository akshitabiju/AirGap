import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import IndiaMap from '../components/IndiaMap'
import { useData } from '../lib/store'
import { fmt } from '../lib/scale'

export default function PlacementPage() {
  const placement = useData((s) => s.placement)
  const err = useData((s) => s.errors.placement)
  const [hi, setHi] = useState<number | null>(null)
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number } | null>(null)

  if (err) return <div className="mx-auto max-w-7xl px-5 py-24 text-sm text-ink-2 sm:px-8">Couldn't load placement: {err}</div>
  if (!placement) return <div className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-24 text-sm text-ink-2 sm:px-8"><Loader2 size={16} className="animate-spin" />Loading recommendations…</div>

  const sites = placement.sites
  const params = placement.params as { n_candidates: number; min_pop: number; cover_km: number; median_unc: number }
  const people = sites.reduce((a, s) => a + s.pop, 0)

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <div className="hero-sky relative -mx-5 -mt-12 overflow-hidden px-5 pb-14 pt-16 text-cream sm:-mx-8 sm:rounded-b-[2.5rem] sm:px-10">
        <div className="haze haze-a" style={{ width: '50vw', height: '40vh', left: '-10vw', top: '-10%', background: 'rgba(217,100,58,0.3)' }} />
        <div className="relative">
      <p className="rise text-xs uppercase tracking-[0.18em] text-cream/60">Next 20 monitors</p>
      <h1 className="rise rise-1 mt-2 max-w-3xl !text-cream text-4xl sm:text-6xl">If you could only buy twenty instruments, <em className="italic text-haze">put them here.</em></h1>
      <p className="rise rise-2 mt-4 max-w-2xl text-cream/75">
        {fmt(params.n_candidates)} towns of {fmt(params.min_pop)}+ people have no PM2.5 monitor within {params.cover_km} km. We rank them by how many people live there, how unsure our model is for that district, and how far the nearest monitor is, then pick greedily so the twenty spread out instead of clustering.
        Together these twenty cover <strong className="text-haze">{fmt(people)}</strong> people who currently rely on inference.
      </p>
        </div>
      </div>

      <div className="rise rise-3 mt-10 grid gap-4 lg:grid-cols-12">
        <div className="overflow-hidden rounded-2xl border border-line bg-cream-2 lg:col-span-7" style={{ height: 'min(70vh, 640px)', minHeight: 420 }}>
          <IndiaMap mode="placement" sites={sites} highlightSite={hi} flyTo={flyTo} />
        </div>
        <ol className="max-h-[640px] space-y-1.5 overflow-y-auto pr-1 lg:col-span-5">
          {sites.map((s) => (
            <li key={s.rank}>
              <button
                onMouseEnter={() => setHi(s.rank)} onMouseLeave={() => setHi(null)}
                onClick={() => setFlyTo({ lat: s.lat, lon: s.lon })}
                className={`card w-full p-3.5 text-left transition-colors hover:bg-cream-2/70 ${hi === s.rank ? 'bg-cream-2/70' : ''}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <div className="flex items-baseline gap-2.5">
                    <span className="num grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ochre text-xs text-ink">{s.rank}</span>
                    <span className="font-medium">{s.name}</span>
                    {s.district && <span className="text-xs text-ink-3">{s.district}</span>}
                  </div>
                  <span className="num text-xs text-ink-3">score {fmt(s.score, 1)}</span>
                </div>
                <div className="num mt-2 grid grid-cols-4 gap-2 text-[11px] text-ink-2">
                  <Cell k="people" v={fmt(s.pop)} />
                  <Cell k="nearest monitor" v={`${fmt(s.nearest_km)} km`} />
                  <Cell k="predicted" v={s.pred != null ? `${fmt(s.pred)} ±${fmt(s.unc)}` : '—'} />
                  <Cell k="weights p·u·d" v={`${s.score_breakdown.pop_weight}·${s.score_breakdown.unc_weight}·${s.score_breakdown.dist_weight}`} />
                </div>
                {s.score_breakdown.coverage_penalty > 0.05 && <p className="mt-1.5 text-[11px] text-ink-3">Score reduced by {fmt(s.score_breakdown.coverage_penalty, 1)} because an earlier pick is nearby.</p>}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-3">
        <div><h3 className="text-xl">People</h3><p className="mt-2 text-sm text-ink-2">log₁₀ of town population. Doubling a town's size matters, but a city of 2 million shouldn't swamp everything, so the scale is logarithmic.</p></div>
        <div><h3 className="text-xl">Uncertainty</h3><p className="mt-2 text-sm text-ink-2">The district's 68 % interval half-width from the quantile models, divided by the national median ({fmt(params.median_unc)} µg/m³). A new monitor is worth most where the model is least sure.</p></div>
        <div><h3 className="text-xl">Distance</h3><p className="mt-2 text-sm text-ink-2">Kilometres to the nearest existing monitor, in units of 50 km, capped at 3. After each pick, that pick counts as a monitor, which is what pushes the list to spread across the country.</p></div>
      </div>
      <p className="mt-8 text-xs text-ink-3">{placement.method} Generated {placement.generated_at.slice(0, 16).replace('T', ' ')} UTC. Candidates and weights are in <code className="num">public/data/placement.json</code>.</p>
    </div>
  )
}

function Cell({ k, v }: { k: string; v: string }) {
  return <span><span className="block text-[10px] uppercase tracking-wider text-ink-3">{k}</span>{v}</span>
}
