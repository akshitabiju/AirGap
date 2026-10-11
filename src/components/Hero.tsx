import { useEffect, useRef } from 'react'
import { ArrowDown } from 'lucide-react'
import { useData } from '../lib/store'
import { fmt } from '../lib/scale'

/**
 * Flow-field of drifting particles: a quiet nod to aerosol transport.
 * Pure canvas, no deps; respects reduced-motion; pauses when off-screen.
 */
function Particles() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0, h = 0, raf = 0, t = 0, visible = true
    const N = 420
    const pts = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), a: Math.random() }))
    const resize = () => {
      const r = cv.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = r.width; h = r.height
      cv.width = Math.floor(w * dpr); cv.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = '#f5efe4'; ctx.fillRect(0, 0, w, h)
    }
    resize()
    const ro = new ResizeObserver(resize); ro.observe(cv)
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting }); io.observe(cv)
    const field = (x: number, y: number, t: number) =>
      Math.sin(x * 3.1 + t * 0.00022) * Math.cos(y * 2.3 - t * 0.00017) + 0.35 * Math.sin((x + y) * 5.2 + t * 0.0003)
    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      if (!visible) return
      t = now
      ctx.fillStyle = 'rgba(245,239,228,0.085)'; ctx.fillRect(0, 0, w, h)
      for (const p of pts) {
        const ang = field(p.x, p.y, t) * Math.PI
        const sp = 0.00055 + 0.0003 * p.a
        const nx = p.x + Math.cos(ang) * sp * 1.4, ny = p.y + Math.sin(ang) * sp
        const warm = p.a > 0.82
        ctx.strokeStyle = warm ? 'rgba(196,129,47,0.55)' : 'rgba(31,61,43,0.28)'
        ctx.lineWidth = warm ? 1.2 : 0.8
        ctx.beginPath(); ctx.moveTo(p.x * w, p.y * h); ctx.lineTo(nx * w, ny * h); ctx.stroke()
        p.x = nx; p.y = ny
        if (p.x < -0.02 || p.x > 1.02 || p.y < -0.02 || p.y > 1.02 || Math.random() < 0.002) { p.x = Math.random(); p.y = Math.random() }
      }
    }
    if (reduce) {
      for (let i = 0; i < 90; i++) step(i * 16)
    } else raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
  }, [])
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" aria-hidden />
}

export default function Hero({ onExplore }: { onExplore: () => void }) {
  const meta = useData((s) => s.meta)
  const metrics = useData((s) => s.metrics)
  const gt = meta?.ground_truth as { stations?: number } | undefined
  return (
    <section className="relative overflow-hidden border-b border-line">
      <Particles />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_30%_40%,rgba(245,239,228,0.1),rgba(245,239,228,0.92)_70%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-12 lg:pb-24">
        <div className="lg:col-span-8">
          <p className="eyebrow rise">Track 1 · Air · India</p>
          <h1 className="rise rise-1 mt-3 text-[2.6rem] leading-[1.02] sm:text-6xl lg:text-7xl">
            PM2.5 for the districts <em className="italic text-forest">India doesn't measure.</em>
          </h1>
          <p className="rise rise-2 mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
            Around {gt?.stations ? fmt(Math.round(gt.stations / 10) * 10) : 'six hundred'} government and community monitors report PM2.5 for a country of 1.4 billion people.
            Most districts have none. AirGap learns from the monitors that exist, reads today's satellite aerosol and weather for every district, and tells you what the air is probably like where nobody is checking,
            with an honest error bar and a ranked list of where the next monitors should go.
          </p>
          <div className="rise rise-3 mt-8 flex flex-wrap items-center gap-3">
            <button className="btn btn-solid" onClick={onExplore}><ArrowDown size={15} />Explore the map</button>
            <a className="btn" href="/accuracy">See how accurate it is</a>
          </div>
        </div>
        <div className="rise rise-4 grid grid-cols-2 gap-4 self-end lg:col-span-4">
          <Stat label="Districts predicted" value={meta ? fmt(meta.n_districts) : '…'} />
          <Stat label="Monitors learned from" value={meta ? fmt(meta.n_stations) : '…'} />
          <Stat label="Held-out-city MAE" value={metrics ? `${fmt(metrics.overall.mae, 1)}` : '…'} unit="µg/m³" />
          <Stat label="vs satellite baseline" value={metrics ? `${fmt(metrics.overall.cams_mae, 1)}` : '…'} unit="µg/m³ MAE" />
        </div>
      </div>
    </section>
  )
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="card p-4">
      <div className="eyebrow">{label}</div>
      <div className="num mt-1 text-3xl leading-none">{value}</div>
      {unit && <div className="mt-1 text-[11px] text-ink-3">{unit}</div>}
    </div>
  )
}
