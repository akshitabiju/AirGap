import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import Hero from '../components/Hero'
import IndiaMap from '../components/IndiaMap'
import DetailPanel from '../components/DetailPanel'
import Legend from '../components/Legend'
import Search from '../components/Search'
import { useData } from '../lib/store'
import { fmt } from '../lib/scale'
import type { City } from '../lib/types'

export default function Landing() {
  const mapSection = useRef<HTMLDivElement>(null)
  const districts = useData((s) => s.districts)
  const errors = useData((s) => s.errors)
  const meta = useData((s) => s.meta)
  const setSelected = useData((s) => s.setSelected)
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number } | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const onPick = useCallback((c: City) => {
    setFlyTo({ lat: c.lat, lon: c.lon })
    if (districts) {
      // Nearest district representative point: cheap and good enough for a jump.
      let best = -1, bd = Infinity
      for (const f of districts.features) {
        const d = (f.properties.lat - c.lat) ** 2 + (f.properties.lon - c.lon) ** 2
        if (d < bd) { bd = d; best = f.properties.id }
      }
      if (best >= 0) setSelected(best)
    }
    mapSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [districts, setSelected])

  const worst = useMemo(() => {
    if (!districts) return []
    return [...districts.features].filter((f) => f.properties.pred != null).sort((a, b) => (b.properties.pred ?? 0) - (a.properties.pred ?? 0)).slice(0, 5)
  }, [districts])

  return (
    <>
      <Hero onExplore={() => mapSection.current?.scrollIntoView({ behavior: 'smooth' })} />

      <section ref={mapSection} className="mx-auto max-w-7xl scroll-mt-16 px-5 py-10 sm:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">The map</p>
            <h2 className="mt-1 text-3xl sm:text-4xl">Every district, {meta ? meta.prediction_date : 'today'}.</h2>
            <p className="mt-2 max-w-xl text-sm text-ink-2">Colour is the predicted 24-hour mean PM2.5. Hover for the number and its error bar, click to pin. Dots are the monitors; everything between them is inferred.</p>
          </div>
          <div className="w-full sm:w-80"><Search onPick={onPick} /></div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="relative overflow-hidden rounded-2xl border border-line bg-cream-2 lg:col-span-8" style={{ height: 'min(72vh, 680px)', minHeight: 420 }}>
            <IndiaMap flyTo={flyTo} onReady={() => setMapReady(true)} />
            {(!mapReady || !districts) && !errors.districts && (
              <div className="absolute inset-0 grid place-items-center bg-cream/70 backdrop-blur-sm">
                <div className="flex items-center gap-2 text-sm text-ink-2"><Loader2 size={16} className="animate-spin" />{!districts ? 'Loading 735 districts…' : 'Rendering map…'}</div>
              </div>
            )}
            {errors.districts && (
              <div className="absolute inset-0 grid place-items-center bg-cream/80 p-6">
                <div className="card max-w-sm p-5 text-sm"><div className="mb-1 flex items-center gap-2 font-medium text-rust"><AlertTriangle size={16} />Couldn't load predictions</div><p className="text-ink-2">{errors.districts}. Run <code className="num">python ml/run_all.py</code> to generate <code className="num">public/data/</code>.</p></div>
              </div>
            )}
            <div className="pointer-events-none absolute bottom-3 left-3 w-[min(320px,calc(100%-24px))]"><Legend compact /></div>
          </div>
          <aside className="space-y-4 lg:col-span-4">
            <DetailPanel />
            {worst.length > 0 && (
              <div className="card p-5">
                <div className="eyebrow mb-3">Highest predicted today</div>
                <ol className="space-y-1.5 text-sm">
                  {worst.map((f, i) => (
                    <li key={f.properties.id}>
                      <button className="flex w-full items-center justify-between rounded-lg px-2 py-1 text-left hover:bg-cream-2" onClick={() => { setSelected(f.properties.id); setFlyTo({ lat: f.properties.lat, lon: f.properties.lon }) }}>
                        <span><span className="num mr-2 text-ink-3">{i + 1}</span>{f.properties.name}</span>
                        <span className="num">{fmt(f.properties.pred)} <span className="text-ink-3">± {fmt(f.properties.unc)}</span></span>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </aside>
        </div>
      </section>

      <section className="border-t border-line bg-cream-2/40">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-14 sm:px-8 md:grid-cols-3">
          <Step n="01" title="Learn from the monitors that exist" text="Daily PM2.5 from the OpenAQ network across India is matched to the satellite-assimilated aerosol and weather that Copernicus publishes for the same place and day." />
          <Step n="02" title="Prove it on cities we hid" text="We hold out whole cities, predict them cold, and publish the error next to the raw satellite model's error on the same rows. If we didn't beat it, you'd see that here." />
          <Step n="03" title="Say where to measure next" text="Where the model is least sure, the most people live, and the nearest monitor is farthest away: that's where the next instrument earns its keep." />
        </div>
      </section>
    </>
  )
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div>
      <div className="num text-xs text-ochre-2">{n}</div>
      <h3 className="mt-2 text-2xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{text}</p>
    </div>
  )
}
