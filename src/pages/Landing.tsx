import { useCallback, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Loader2, MapPin, Radio, Satellite, Target } from 'lucide-react'
import Hero from '../components/Hero'
import IndiaMap from '../components/IndiaMap'
import DetailPanel from '../components/DetailPanel'
import Legend from '../components/Legend'
import MapControls from '../components/MapControls'
import { useData } from '../lib/store'
import { colorFor, fmt } from '../lib/scale'
import { useReveal } from '../lib/useReveal'
import type { City } from '../lib/types'

export default function Landing() {
  const mapSection = useRef<HTMLDivElement>(null)
  const districts = useData((s) => s.districts)
  const errors = useData((s) => s.errors)
  const meta = useData((s) => s.meta)
  const metrics = useData((s) => s.metrics)
  const setSelected = useData((s) => s.setSelected)
  const [flyTo, setFlyTo] = useState<{ lat: number; lon: number } | null>(null)
  const [mapReady, setMapReady] = useState(false)
  useReveal([districts, metrics])

  const onPick = useCallback((c: City) => {
    setFlyTo({ lat: c.lat, lon: c.lon })
    if (districts) {
      let best = -1, bd = Infinity
      for (const f of districts.features) {
        const d = (f.properties.lat - c.lat) ** 2 + (f.properties.lon - c.lon) ** 2
        if (d < bd) { bd = d; best = f.properties.id }
      }
      if (best >= 0) setSelected(best)
    }
    mapSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [districts, setSelected])

  const ranked = useMemo(() => districts ? [...districts.features].filter((f) => f.properties.pred != null).sort((a, b) => (b.properties.pred ?? 0) - (a.properties.pred ?? 0)) : [], [districts])
  const worst = ranked.slice(0, 6)
  const ticker = ranked.slice(0, 24)
  const farthest = useMemo(() => districts ? [...districts.features].sort((a, b) => (b.properties.nearest_km ?? 0) - (a.properties.nearest_km ?? 0)).slice(0, 1)[0] : null, [districts])

  return (
    <>
      <Hero onExplore={() => mapSection.current?.scrollIntoView({ behavior: 'smooth' })} onPick={onPick} />

      {/* live ticker */}
      {ticker.length > 0 && (
        <div className="ticker mt-16 border-y border-line py-2.5 text-xs">
          <div className="ticker-track">
            {[...ticker, ...ticker].map((f, i) => (
              <button key={`${f.properties.id}-${i}`} onClick={() => { setSelected(f.properties.id); setFlyTo({ lat: f.properties.lat, lon: f.properties.lon }); mapSection.current?.scrollIntoView({ behavior: 'smooth' }) }} className="flex items-center gap-2 whitespace-nowrap text-ink-2 hover:text-ink">
                <span className="h-2 w-2 rounded-full" style={{ background: colorFor(f.properties.pred) }} />
                {f.properties.name} <span className="num text-ink">{fmt(f.properties.pred)}</span><span className="num text-ink-3">±{fmt(f.properties.unc)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* map */}
      <section ref={mapSection} className="relative scroll-mt-14">
        <div className="mx-auto max-w-7xl px-5 pb-4 pt-10 sm:px-8" data-reveal>
          <p className="eyebrow">The live map</p>
          <h2 className="mt-1 text-3xl sm:text-5xl">Every district, {meta ? meta.prediction_date : 'today'}.</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-2 sm:text-base">Colour is the predicted 24-hour PM2.5. Hover for the number and its error bar, click to pin. Black dots are the monitors we learn from; everything between them is inferred and labelled as such.</p>
        </div>
        <div className="relative mx-auto max-w-[1600px] px-0 sm:px-4" data-reveal="scale">
          <div className="relative overflow-hidden bg-cream-2 sm:rounded-3xl sm:border sm:border-line" style={{ height: 'min(84vh, 820px)', minHeight: 480 }}>
            <IndiaMap flyTo={flyTo} onReady={() => setMapReady(true)} />
            <div className="absolute left-14 top-4 z-10 w-[min(640px,calc(100%-5rem))] lg:w-[min(680px,calc(100%-440px))]"><MapControls /></div>
            {(!mapReady || !districts) && !errors.districts && (
              <div className="absolute inset-0 grid place-items-center bg-cream/70 backdrop-blur-sm">
                <div className="glass-light flex items-center gap-2 rounded-full px-4 py-2 text-sm text-ink-2"><Loader2 size={16} className="animate-spin" />{!districts ? 'Loading 735 districts…' : 'Rendering map…'}</div>
              </div>
            )}
            {errors.districts && (
              <div className="absolute inset-0 grid place-items-center bg-cream/80 p-6">
                <div className="card max-w-sm p-5 text-sm"><div className="mb-1 flex items-center gap-2 font-medium text-rust"><AlertTriangle size={16} />Couldn't load predictions</div><p className="text-ink-2">{errors.districts}. Run <code className="num">python ml/run_all.py</code>.</p></div>
              </div>
            )}
            {/* floating panels */}
            <div className="pointer-events-none absolute inset-0 hidden p-4 lg:block">
              <div className="pointer-events-auto absolute right-4 top-4 w-[360px] max-h-[calc(100%-2rem)] overflow-y-auto">
                <div className="glass-light rounded-2xl"><DetailPanel /></div>
              </div>
              <div className="pointer-events-auto absolute bottom-4 left-4 w-[330px]"><div className="glass-light rounded-2xl"><Legend compact /></div></div>
            </div>
          </div>
          {/* mobile: panels below the map */}
          <div className="space-y-3 px-5 pt-3 lg:hidden"><div className="card"><MapControls /></div><div className="card"><DetailPanel /></div><div className="card"><Legend compact /></div></div>
        </div>
      </section>

      {/* highlights */}
      <section className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="card p-6" data-reveal>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-ink-3"><Radio size={13} />Highest predicted today</div>
            <ol className="mt-4 space-y-2">
              {worst.map((f, i) => (
                <li key={f.properties.id}>
                  <button className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-sm hover:bg-cream-2" onClick={() => { setSelected(f.properties.id); setFlyTo({ lat: f.properties.lat, lon: f.properties.lon }); mapSection.current?.scrollIntoView({ behavior: 'smooth' }) }}>
                    <span className="flex items-center gap-2"><span className="num w-4 text-ink-3">{i + 1}</span>{f.properties.name}</span>
                    <span className="num flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFor(f.properties.pred) }} />{fmt(f.properties.pred)} <span className="text-ink-3">±{fmt(f.properties.unc)}</span></span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="card flex flex-col justify-between p-6" data-reveal>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-ink-3"><MapPin size={13} />The gap, in numbers</div>
            <div className="mt-4 space-y-4">
              <Big v={meta ? `${(meta.urban_pop_over_60 / 1e6).toFixed(1)} M` : '…'} l="urban residents in districts above India's own 24-h standard (60 µg/m³) today; counts GeoNames towns only" />
              <Big v={meta ? fmt(meta.districts_no_monitor_50km) : '…'} l="districts more than 50 km from any monitor" />
              <Big v={farthest ? `${fmt(farthest.properties.nearest_km)} km` : '…'} l={farthest ? `to the nearest monitor from ${farthest.properties.name}` : ''} />
            </div>
          </div>
          <div className="card flex flex-col justify-between bg-night p-6 text-cream" data-reveal>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-cream/60"><Target size={13} />Where to measure next</div>
            <p className="mt-4 text-2xl leading-snug">Twenty towns, {fmt((useData.getState().placement?.sites ?? []).reduce((a, s) => a + s.pop, 0))} people, no monitor within 25 km.</p>
            <a href="/placement" className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-cream px-4 py-2 text-sm font-medium text-night transition hover:bg-haze">See the ranked list</a>
          </div>
        </div>
      </section>

      {/* how */}
      <section className="border-t border-line bg-cream-2/40">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:px-8 md:grid-cols-3">
          <Step n="01" icon={<Radio size={16} />} title="Learn from the monitors that exist" text="Daily PM2.5 from the OpenAQ network across India is matched to the satellite-assimilated aerosol and weather that Copernicus publishes for the same place and day." />
          <Step n="02" icon={<Satellite size={16} />} title="Prove it on cities we hid" text="We hold out whole cities, predict them cold, and publish the error next to the raw satellite model's error on the same rows. If we didn't beat it, you'd see that here." />
          <Step n="03" icon={<Target size={16} />} title="Say where to measure next" text="Where the model is least sure, the most people live, and the nearest monitor is farthest away: that's where the next instrument earns its keep." />
        </div>
      </section>
    </>
  )
}

function Big({ v, l }: { v: string; l: string }) {
  return <div><div className="num text-3xl leading-none">{v}</div><div className="mt-1 text-xs text-ink-3">{l}</div></div>
}

function Step({ n, icon, title, text }: { n: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <div data-reveal>
      <div className="flex items-center gap-2 text-xs text-ochre-2"><span className="num">{n}</span>{icon}</div>
      <h3 className="mt-3 text-2xl">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{text}</p>
    </div>
  )
}
