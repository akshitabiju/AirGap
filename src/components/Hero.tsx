import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ChevronRight, Clock3, Flame, LocateFixed, Satellite, ShieldCheck, Wind } from 'lucide-react'
import { useData } from '../lib/store'
import { band, colorFor, fmt } from '../lib/scale'
import { useParallax } from '../lib/useReveal'

const LON0 = 68, LON1 = 97.5, LAT0 = 6.5, LAT1 = 36
const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const MY0 = merc(LAT0), MY1 = merc(LAT1)
/** Web-Mercator fit of India's bounding box into a w x h box (same look as the MapLibre map below). */
function projector(w: number, h: number) {
  const pad = 0.04
  w *= 1 - 2 * pad; h *= 1 - 2 * pad
  const sc = Math.min(w / ((LON1 - LON0) * (Math.PI / 180)), h / (MY1 - MY0))
  const pw = (LON1 - LON0) * (Math.PI / 180) * sc, ph = (MY1 - MY0) * sc
  const ox = (w - pw) / 2 + w * pad / (1 - 2 * pad), oy = (h - ph) / 2 + h * pad / (1 - 2 * pad)
  return { X: (lon: number) => ox + (lon - LON0) * (Math.PI / 180) * sc, Y: (lat: number) => oy + (MY1 - merc(lat)) * sc, sc }
}

/* India drawn from the live district predictions: district fills, glowing state names, pulsing hotspots. */
function IndiaGlow() {
  const ref = useRef<HTMLCanvasElement>(null)
  const districts = useData((s) => s.districts)
  useEffect(() => {
    const cv = ref.current
    if (!cv || !districts) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const parent = cv.parentElement as HTMLElement
    const base = document.createElement('canvas')   // static layer (districts + labels), redrawn on resize only
    let W = 0, H = 0, dpr = 1
    let X = (lon: number) => lon, Y = (lat: number) => lat

    const drawBase = () => {
      W = parent.clientWidth; H = parent.clientHeight
      if (!W || !H) return
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      for (const c of [cv, base]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
      const b = base.getContext('2d')!
      b.setTransform(dpr, 0, 0, dpr, 0, 0)
      const pr = projector(W, H)
      X = pr.X; Y = pr.Y
      const tracePolys = (f: (typeof districts.features)[number]) => {
        const g = f.geometry
        const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
        for (const poly of polys) {
          b.beginPath()
          for (const ring of poly) { ring.forEach(([lon, lat], i) => (i ? b.lineTo(X(lon), Y(lat)) : b.moveTo(X(lon), Y(lat)))); b.closePath() }
        }
      }
      b.shadowColor = 'rgba(94,234,212,0.7)'; b.shadowBlur = 22; b.globalAlpha = 0.55
      for (const f of districts.features) { b.fillStyle = colorFor(f.properties.pred); tracePolys(f); b.fill() }
      b.shadowBlur = 0; b.globalAlpha = 0.5; b.strokeStyle = 'rgba(244,247,246,0.35)'; b.lineWidth = 0.4
      for (const f of districts.features) { tracePolys(f); b.stroke() }
      b.globalAlpha = 1
    }

    const blit = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(base, 0, 0)
    }
    drawBase(); blit()
    const ro = new ResizeObserver(() => { drawBase(); blit() }); ro.observe(parent)
    return () => { ro.disconnect() }
  }, [districts])
  return <canvas ref={ref} style={{ display: 'block', width: '100%', height: '100%' }} aria-hidden />
}


/* Clickable pollution hotspots over the glow: orange = 60-90 (Moderate), red = 90+ (Poor or worse). */
function Hotspots({ onOpen }: { onOpen: (district: string) => void }) {
  const states = useData((s) => s.states)
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [open, setOpen] = useState<number | null>(null)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])
  const hot = (states?.hotspots ?? []).filter((h) => h.pred >= 60).slice(0, 25)
  const { w, h } = size
  const { X, Y } = projector(w, h)
  const sel = open != null ? hot[open] : null
  return (
    <div ref={host} className="absolute inset-0" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null) }}>
      {w > 0 && hot.map((d, i) => {
        const red = d.pred >= 90
        return (
          <button key={`${d.district}-${i}`} onClick={() => setOpen(open === i ? null : i)} onMouseEnter={() => setOpen(i)}
            className="group absolute -translate-x-1/2 -translate-y-1/2 pointer-events-auto" style={{ left: X(d.lon), top: Y(d.lat) }}
            aria-label={`${d.district}, ${d.state}: ${d.pred} µg/m³`}>
            <span className={`pulse-ring absolute inset-0 m-auto h-5 w-5 rounded-full ${red ? 'bg-[#d9455f]' : 'bg-[#f0913a]'} opacity-40`} style={{ animationDelay: `${(i % 7) * 0.3}s` }} />
            <span className={`block h-3 w-3 rounded-full border border-night/60 ${red ? 'bg-[#d9455f] shadow-[0_0_14px_3px_rgba(217,69,95,0.8)]' : 'bg-[#f0913a] shadow-[0_0_14px_3px_rgba(240,145,58,0.8)]'} transition group-hover:scale-125`} />
          </button>
        )
      })}
      {sel && (
        <div className="glass pointer-events-auto absolute z-10 w-56 rounded-2xl p-3 text-left text-xs text-cream"
          style={{ left: Math.min(Math.max(X(sel.lon) + 14, 8), w - 232), top: Math.min(Math.max(Y(sel.lat) - 20, 8), h - 120) }}>
          <div className="text-sm font-medium">{sel.district}</div>
          <div className="text-cream/65">{sel.state}</div>
          <div className="num mt-1.5 text-2xl leading-none" style={{ color: colorFor(sel.pred) }}>{fmt(sel.pred)} <span className="text-xs text-cream/60">µg/m³</span></div>
          <div className="mt-0.5 text-[11px]" style={{ color: band(sel.pred).color }}>{band(sel.pred).label} · {(sel.pred / 15).toFixed(1)}× WHO guideline</div>
          <button onClick={() => onOpen(sel.district)} className="mt-2 rounded-full bg-cream px-3 py-1 text-[11px] font-medium text-night hover:bg-haze">Open on the map</button>
        </div>
      )}
    </div>
  )
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

/* Window size, for laying the map out without CSS calc. */
function useViewport() {
  const [v, setV] = useState({ w: typeof window === 'undefined' ? 1280 : window.innerWidth, h: typeof window === 'undefined' ? 800 : window.innerHeight })
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on); return () => window.removeEventListener('resize', on)
  }, [])
  return v
}

/* Live IST clock. */
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const id = window.setInterval(() => setNow(new Date()), 1000); return () => window.clearInterval(id) }, [])
  const time = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const date = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' })
  return (
    <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-cream/85">
      <Clock3 size={13} className="text-haze" /><span className="num">{time}</span><span className="text-cream/50">IST · {date}</span>
    </div>
  )
}

export default function Hero({ onExplore, onCheck }: { onExplore: () => void; onCheck: () => void }) {
  const meta = useData((s) => s.meta)
  const districts = useData((s) => s.districts)
  const setSelected = useData((s) => s.setSelected)
  const onOpenDistrict = (name: string) => {
    const f = districts?.features.find((x) => x.properties.name === name)
    if (f) setSelected(f.properties.id)
    onExplore()
  }
  const metrics = useData((s) => s.metrics)
  const states = useData((s) => s.states)
  const host = useRef<HTMLElement>(null)
  useParallax(host)
  const gain = metrics ? Math.round(((metrics.overall.cams_mae - metrics.overall.mae) / metrics.overall.cams_mae) * 100) : null
  const vp = useViewport()
  const desktop = vp.w >= 1024
  const mapH = desktop ? Math.min(vp.h - 130, 940) : Math.round(vp.h * 0.5)
  const mapW = desktop ? Math.min(Math.round(mapH * 0.98), Math.round(vp.w * 0.5)) : Math.round(vp.w * 0.7)
  const mapBox: React.CSSProperties = desktop
    ? { right: '1%', top: 104, width: mapW, height: mapH }
    : { right: '-8%', top: '12%', width: mapW, height: mapH }
  const worstState = states ? [...states.states].filter((s) => s.n_districts).sort((a, b) => (b.mean_pred ?? 0) - (a.mean_pred ?? 0))[0] : null
  const top = states?.hotspots[0]

  return (
    <section ref={host} className="hero-sky relative overflow-hidden text-cream" style={{ minHeight: 'max(100svh, 720px)' }}>
      <div className="haze haze-a" style={{ width: '70vw', height: '50vh', left: '-10vw', top: '35%', background: 'rgba(56,189,248,0.22)' }} />
      <div className="haze haze-b" style={{ width: '60vw', height: '45vh', right: '-15vw', top: '20%', background: 'rgba(94,234,212,0.2)' }} />
      <div className="haze haze-a" style={{ width: '40vw', height: '30vh', left: '30vw', top: '-10%', background: 'rgba(129,140,248,0.2)', animationDuration: '34s' }} />
      <Particles />

      {/* glowing India, sized to the viewport so the whole country is on the first screen */}
      <div className="float-2 pointer-events-none absolute z-10 opacity-95" style={mapBox}>
        <IndiaGlow />
        <Hotspots onOpen={onOpenDistrict} />
      </div>
      {/* live readout over the map */}
      <div className="pointer-events-none absolute right-4 top-[72px] z-20 hidden flex-col items-end gap-2 lg:flex">
        <Clock />
        {worstState && top && (
          <div className="glass rounded-2xl px-3.5 py-2.5 text-xs text-cream/85">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-cream/55"><Flame size={11} className="text-rust" />Most polluted right now</div>
            <div className="mt-1 text-sm text-cream"><span className="font-medium">{worstState.name}</span> <span className="num text-cream/70">· state mean {fmt(worstState.mean_pred)} µg/m³</span></div>
            <div className="num mt-0.5 text-[11px] text-cream/65">worst spot: {top.district}, {top.state} · {fmt(top.pred)} µg/m³</div>
            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-cream/55"><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#f0913a]" />60–90 moderate</span><span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-[#d9455f]" />90+ poor or worse</span></div>
          </div>
        )}
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-cream to-transparent" />

      <div className="relative z-[5] mx-auto flex max-w-7xl flex-col justify-center px-5 pb-24 pt-28 sm:px-8 sm:pt-32 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto" style={{ minHeight: 'max(100svh, 720px)' }}>
        <div className="max-w-3xl lg:max-w-[52%]">
          <p className="rise inline-flex items-center gap-2 rounded-full border border-cream/20 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cream/80 backdrop-blur">
            <Satellite size={13} className="text-haze" /> Daily air guide for every district in India · {meta?.prediction_date ?? '…'}
          </p>
          <h1 className="rise rise-1 mt-6 text-[2.6rem] leading-[1] text-cream sm:text-5xl lg:text-[4.4rem] xl:text-[5rem]">
            Should you <span className="shimmer-text italic">step out</span> today?<br />
            <span className="text-haze">Every district</span> has an answer now.
          </h1>
          <p className="rise rise-2 mt-6 max-w-xl text-lg leading-relaxed text-cream/75">
            India measures air in about {meta ? fmt(Math.round((meta.ground_truth as { stations: number }).stations / 10) * 10) : '570'} places; 368 districts have no monitor within 50 km. AirGap gives every district today's PM2.5, the cleanest hours to go outside, plain advice for you or your child, a three-day forecast, and a one-tap WhatsApp share. In English and Hindi. Checked against real monitors, with the error shown.
          </p>
          <div className="rise rise-3 mt-8 flex flex-wrap items-center gap-3">
            <button onClick={onCheck} className="group inline-flex items-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-haze">
              <LocateFixed size={15} /> Check your air <ArrowDown size={15} className="transition group-hover:translate-y-0.5" />
            </button>
            <button onClick={onExplore} className="inline-flex items-center gap-1.5 rounded-full border border-cream/25 px-5 py-2.5 text-sm text-cream/90 backdrop-blur transition hover:bg-white/10">
              Explore the live map <ChevronRight size={15} />
            </button>
            <a href="/accuracy" className="inline-flex items-center gap-1.5 rounded-full border border-cream/25 px-5 py-2.5 text-sm text-cream/90 backdrop-blur transition hover:bg-white/10">
              See the proof <ChevronRight size={15} />
            </a>
          </div>
        </div>

        <div className="float-1 mt-10 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-[52%]">
          <Glass icon={<Wind size={14} />} label="Districts predicted" value={meta ? fmt(meta.n_districts) : '…'} />
          <Glass icon={<Satellite size={14} />} label="Monitors learned from" value={meta ? fmt(meta.n_stations) : '…'} />
          <Glass icon={<ShieldCheck size={14} />} label="Held-out-city error" value={metrics ? `${fmt(metrics.overall.mae, 1)}` : '…'} unit="µg/m³ MAE" />
          <Glass icon={<ShieldCheck size={14} />} label="Better than satellite" value={gain != null ? `${gain}%` : '…'} unit="lower error" accent />
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
