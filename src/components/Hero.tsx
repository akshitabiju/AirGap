import { useEffect, useRef } from 'react'
import { ArrowDown, ChevronRight, Satellite, ShieldCheck, Wind } from 'lucide-react'
import { useData } from '../lib/store'
import { colorFor, fmt } from '../lib/scale'
import { useParallax } from '../lib/useReveal'
import Search from './Search'
import type { City } from '../lib/types'

/* India drawn from the live district predictions, glowing in the haze. */
function IndiaGlow() {
  const ref = useRef<HTMLCanvasElement>(null)
  const districts = useData((s) => s.districts)
  useEffect(() => {
    const cv = ref.current
    if (!cv || !districts) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const parent = cv.parentElement as HTMLElement
    const draw = () => {
      const r = { width: parent.clientWidth, height: parent.clientHeight }
      if (!r.width || !r.height) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, r.width, r.height)
      const lon0 = 68, lon1 = 97.5, lat0 = 6.5, lat1 = 36
      const s = Math.min(r.width / (lon1 - lon0), r.height / ((lat1 - lat0) * 1.05))
      const ox = (r.width - (lon1 - lon0) * s) / 2, oy = (r.height - (lat1 - lat0) * s * 1.05) / 2
      const X = (lon: number) => ox + (lon - lon0) * s
      const Y = (lat: number) => oy + (lat1 - lat) * s * 1.05
      ctx.shadowColor = 'rgba(94,234,212,0.75)'; ctx.shadowBlur = 22
      for (const f of districts.features) {
        const g = f.geometry
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
        ctx.fillStyle = colorFor(f.properties.pred)
        ctx.globalAlpha = 0.55
        for (const poly of polys) {
          ctx.beginPath()
          for (const ring of poly) { ring.forEach(([lon, lat], i) => (i ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat)))); ctx.closePath() }
          ctx.fill()
        }
      }
      ctx.shadowBlur = 0; ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(244,247,246,0.35)'; ctx.lineWidth = 0.4
      for (const f of districts.features) {
        const g = f.geometry
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
        for (const poly of polys) {
          ctx.beginPath()
          for (const ring of poly) { ring.forEach(([lon, lat], i) => (i ? ctx.lineTo(X(lon), Y(lat)) : ctx.moveTo(X(lon), Y(lat)))); ctx.closePath() }
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }
    draw()
    const ro = new ResizeObserver(draw); ro.observe(parent)
    return () => ro.disconnect()
  }, [districts])
  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden />
}

/* Drifting aerosol particles over the sky. */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('static')
    let w = 0, h = 0, raf = 0, visible = true
    const pts = Array.from({ length: 360 }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() }))
    const parent = cv.parentElement as HTMLElement
    const resize = () => { w = parent.clientWidth; h = parent.clientHeight; if (!w || !h) return; const dpr = Math.min(window.devicePixelRatio || 1, 2); cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(parent)
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }); io.observe(cv)
    const field = (x: number, y: number, t: number) => Math.sin(x * 3.1 + t * 0.00022) * Math.cos(y * 2.3 - t * 0.00017) + 0.35 * Math.sin((x + y) * 5.2 + t * 0.0003)
    const step = (t: number) => {
      raf = requestAnimationFrame(step)
      if (!visible) return
      ctx.clearRect(0, 0, w, h)
      for (const p of pts) {
        const ang = field(p.x, p.y, t) * Math.PI
        const sp = 0.0005 + 0.0004 * p.a
        p.x += Math.cos(ang) * sp * 1.4; p.y += Math.sin(ang) * sp
        if (p.x < -0.02 || p.x > 1.02 || p.y < -0.02 || p.y > 1.02) { p.x = Math.random(); p.y = Math.random() }
        const warm = p.a > 0.75
        ctx.beginPath(); ctx.arc(p.x * w, p.y * h, warm ? 1.6 : 1, 0, Math.PI * 2)
        ctx.fillStyle = warm ? `rgba(94,234,212,${0.35 + 0.4 * p.a})` : `rgba(244,247,246,${0.12 + 0.22 * p.a})`
        ctx.fill()
      }
    }
    if (reduce) step(0); else raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [])
  return <canvas ref={ref} className="absolute inset-0" style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden />
}

export default function Hero({ onExplore, onPick }: { onExplore: () => void; onPick: (c: City) => void }) {
  const meta = useData((s) => s.meta)
  const metrics = useData((s) => s.metrics)
  const host = useRef<HTMLElement>(null)
  useParallax(host)
  const gain = metrics ? Math.round(((metrics.overall.cams_mae - metrics.overall.mae) / metrics.overall.cams_mae) * 100) : null

  return (
    <section ref={host} className="hero-sky relative overflow-hidden text-cream" style={{ height: 'max(100svh, 720px)' }}>
      {/* atmosphere */}
      <div className="haze haze-a" style={{ width: '70vw', height: '50vh', left: '-10vw', top: '35%', background: 'rgba(56,189,248,0.22)' }} />
      <div className="haze haze-b" style={{ width: '60vw', height: '45vh', right: '-15vw', top: '20%', background: 'rgba(94,234,212,0.2)' }} />
      <div className="haze haze-a" style={{ width: '40vw', height: '30vh', left: '30vw', top: '-10%', background: 'rgba(129,140,248,0.2)', animationDuration: '34s' }} />
      <Particles />
      {/* glowing India */}
      <div className="float-2 pointer-events-none absolute right-[-4%] top-[8%] h-[88%] w-[58%] opacity-90 lg:right-[2%] lg:w-[46%]">
        <IndiaGlow />
      </div>
      {/* orbit ring */}
      <div className="float-3 pointer-events-none absolute right-[6%] top-[14%] hidden h-[62vh] w-[62vh] rounded-full border border-cream/10 lg:block">
        <div className="spin-slow absolute inset-0 rounded-full border border-dashed border-cream/15">
          <span className="absolute -top-2 left-1/2 grid h-4 w-4 -translate-x-1/2 place-items-center rounded-full bg-haze shadow-[0_0_24px_6px_rgba(94,234,212,0.55)]" />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-cream to-transparent" />

      <div className="relative mx-auto flex h-full max-w-7xl flex-col justify-center px-5 pb-24 pt-20 sm:px-8">
        <div className="max-w-3xl">
          <p className="rise inline-flex items-center gap-2 rounded-full border border-cream/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cream/80 backdrop-blur">
            <Satellite size={13} className="text-haze" /> Live satellite + ground truth · updated {meta?.prediction_date ?? '…'}
          </p>
          <h1 className="rise rise-1 mt-6 text-[2.9rem] leading-[0.98] text-cream sm:text-6xl lg:text-[5.4rem]">
            The air in <span className="shimmer-text italic">735 districts.</span><br />
            Measured in <span className="text-haze">{meta ? fmt(Math.round((meta.ground_truth as { stations: number }).stations / 10) * 10) : '…'}</span> places.
          </h1>
          <p className="rise rise-2 mt-6 max-w-xl text-lg leading-relaxed text-cream/75">
            AirGap learns from every public PM2.5 monitor in India, reads today's satellite aerosol and weather for every district, and tells you what the air is probably like where nobody is checking. With an error bar you can check, and the twenty places that need a monitor most.
          </p>
          <div className="rise rise-3 mt-8 flex flex-wrap items-center gap-3">
            <button onClick={onExplore} className="group inline-flex items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-haze">
              Explore the live map <ArrowDown size={15} className="transition group-hover:translate-y-0.5" />
            </button>
            <a href="/accuracy" className="inline-flex items-center gap-1.5 rounded-full border border-cream/25 px-5 py-2.5 text-sm text-cream/90 backdrop-blur transition hover:bg-white/10">
              See the proof <ChevronRight size={15} />
            </a>
          </div>
        </div>

        {/* floating glass stats */}
        <div className="float-1 mt-14 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          <Glass icon={<Wind size={14} />} label="Districts predicted" value={meta ? fmt(meta.n_districts) : '…'} />
          <Glass icon={<Satellite size={14} />} label="Monitors learned from" value={meta ? fmt(meta.n_stations) : '…'} />
          <Glass icon={<ShieldCheck size={14} />} label="Held-out-city error" value={metrics ? `${fmt(metrics.overall.mae, 1)}` : '…'} unit="µg/m³ MAE" />
          <Glass icon={<ShieldCheck size={14} />} label="Better than satellite" value={gain != null ? `${gain}%` : '…'} unit="lower error" accent />
        </div>
      </div>

      {/* glass search bar overlapping the hero edge, like a booking widget */}
      <div className="absolute inset-x-0 bottom-0 z-10 mx-auto max-w-4xl translate-y-1/2 px-5 sm:px-8">
        <div className="tilt glass-light rounded-2xl p-3 text-ink sm:flex sm:items-center sm:gap-3 sm:p-3.5">
          <div className="px-2 pb-2 sm:pb-0">
            <div className="eyebrow">Your district</div>
            <div className="text-sm text-ink-2">What's the air like where you are?</div>
          </div>
          <div className="flex-1"><Search onPick={onPick} /></div>
        </div>
      </div>
    </section>
  )
}

function Glass({ icon, label, value, unit, accent }: { icon: React.ReactNode; label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="glass rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-cream/60">{icon}{label}</div>
      <div className={`num mt-1.5 text-2xl leading-none sm:text-3xl ${accent ? 'text-haze' : 'text-cream'}`}>{value}</div>
      {unit && <div className="mt-1 text-[10px] text-cream/55">{unit}</div>}
    </div>
  )
}
