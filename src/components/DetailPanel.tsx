import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Cigarette, Info, MapPin, Radio, X } from 'lucide-react'
import { useData } from '../lib/store'
import { band, colorFor, fmt, INDIA_NAAQS_24H, WHO_GUIDELINE_24H } from '../lib/scale'
import { SERIES } from './Charts'
import type { DistrictProps } from '../lib/types'

const PREDICT_URL = import.meta.env.VITE_PREDICT_URL as string | undefined
/** Berkeley Earth's rule of thumb: 22 µg/m³ of PM2.5 over a day ≈ one cigarette (Muller & Muller, 2015). */
const CIGARETTE_UGM3 = 22

interface Live { pred: number; lo: number; hi: number; cams: number | null; date: string; source: string }

function Sparkline({ id, dayIdx }: { id: number; dayIdx: number | null }) {
  const history = useData((s) => s.history)
  const setDay = useData((s) => s.setDay)
  const series = history?.series[String(id)]
  const [hover, setHover] = useState<number | null>(null)
  if (!series || series.length < 3) return null
  const W = 320, H = 72, m = { l: 4, r: 4, t: 6, b: 14 }
  const max = Math.max(...series.map((d) => Math.max(d[1], d[2])), 30)
  const x = (i: number) => m.l + (i / (series.length - 1)) * (W - m.l - m.r)
  const y = (v: number) => m.t + (1 - Math.min(v, max) / max) * (H - m.t - m.b)
  const fcFrom = history?.forecastFrom ?? series.length
  const seg = (k: 1 | 2, from: number, to: number) => series.slice(from, to).map((d, i) => `${i ? 'L' : 'M'}${x(from + i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ')
  const cur = hover ?? dayIdx ?? fcFrom - 1
  const d = series[cur]
  return (
    <figure className="mt-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-ink-3">
        <span>Last {fcFrom} days{fcFrom < series.length ? ` + ${series.length - fcFrom}-day forecast` : ''}</span>
        <span className="flex gap-3 normal-case tracking-normal">
          <span className="flex items-center gap-1"><span className="h-0.5 w-3" style={{ background: SERIES.airgap }} />AirGap</span>
          <span className="flex items-center gap-1"><span className="h-0.5 w-3 border-t border-dashed" style={{ borderColor: SERIES.cams }} />CAMS</span>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 h-auto w-full cursor-crosshair" role="img" aria-label="PM2.5 over the last three months"
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left) / r.width) * (series.length - 1))) }}
        onMouseLeave={() => setHover(null)}
        onClick={() => { if (hover != null) setDay(hover === fcFrom - 1 ? null : hover) }}>
        <line x1={m.l} x2={W - m.r} y1={y(WHO_GUIDELINE_24H)} y2={y(WHO_GUIDELINE_24H)} stroke="#1b1a17" strokeOpacity={0.15} strokeDasharray="2 3" />
        {max > INDIA_NAAQS_24H && <line x1={m.l} x2={W - m.r} y1={y(INDIA_NAAQS_24H)} y2={y(INDIA_NAAQS_24H)} stroke="#b5462d" strokeOpacity={0.35} strokeDasharray="2 3" />}
        <path d={seg(2, 0, series.length)} fill="none" stroke={SERIES.cams} strokeWidth={1.2} strokeDasharray="3 3" strokeOpacity={0.8} />
        <path d={seg(1, 0, fcFrom)} fill="none" stroke={SERIES.airgap} strokeWidth={2} strokeLinejoin="round" />
        {fcFrom < series.length && <path d={seg(1, fcFrom - 1, series.length)} fill="none" stroke={SERIES.airgap} strokeWidth={2} strokeDasharray="4 3" strokeOpacity={0.7} />}
        {fcFrom < series.length && <line x1={x(fcFrom - 1)} x2={x(fcFrom - 1)} y1={m.t} y2={H - m.b} stroke="#16697a" strokeOpacity={0.4} />}
        <line x1={x(cur)} x2={x(cur)} y1={m.t} y2={H - m.b} stroke="#1b1a17" strokeOpacity={0.35} />
        <circle cx={x(cur)} cy={y(d[1])} r={3.5} fill={SERIES.airgap} stroke="#f5efe4" strokeWidth={1.5} />
        <text x={m.l} y={H - 3} fontSize={9} fill="#7d776d" className="num">{series[0][0]}</text>
        <text x={W - m.r} y={H - 3} fontSize={9} fill="#7d776d" textAnchor="end" className="num">{series[series.length - 1][0]}</text>
      </svg>
      <figcaption className="num flex justify-between text-[11px] text-ink-2">
        <span>{d[0]}{cur >= fcFrom ? ' (forecast)' : ''}: <strong className="text-ink">{fmt(d[1])}</strong> µg/m³ <span className="text-ink-3">(CAMS {fmt(d[2])})</span></span>
        <span className="text-ink-3">click to scrub the map</span>
      </figcaption>
    </figure>
  )
}

export default function DetailPanel() {
  const districts = useData((s) => s.districts)
  const history = useData((s) => s.history)
  const day = useData((s) => s.day)
  const selected = useData((s) => s.selected)
  const hovered = useData((s) => s.hovered)
  const setSelected = useData((s) => s.setSelected)
  const id = selected ?? hovered
  const p = useMemo<DistrictProps | null>(() => {
    if (id == null || !districts) return null
    const f = districts.features.find((x) => x.properties.id === id)
    return f ? f.properties : null
  }, [id, districts])

  // When the timeline is scrubbed, show that day's value instead of today's.
  const shown = useMemo(() => {
    if (!p) return null
    const s = history?.series[String(p.id)]
    if (day != null && s && s[day]) return { pred: s[day][1], cams: s[day][2], prev: day > 0 ? s[day - 1][1] : null, date: `${history!.start.slice(0, 4)}-${s[day][0]}${day >= (history!.forecastFrom ?? Infinity) ? ' (forecast)' : ''}`, scrubbed: true }
    return { pred: p.pred, cams: p.cams, prev: p.pred_prev, date: p.date, scrubbed: false }
  }, [p, history, day])

  const [live, setLive] = useState<Live | null>(null)
  const [liveState, setLiveState] = useState<'idle' | 'loading' | 'error'>('idle')
  useEffect(() => {
    if (!PREDICT_URL || selected == null || !p) { setLive(null); return }
    const ctl = new AbortController()
    setLiveState('loading')
    fetch(`${PREDICT_URL.replace(/\/$/, '')}/?lat=${p.lat}&lon=${p.lon}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Live) => { setLive(d); setLiveState('idle') })
      .catch((e) => { if (e.name !== 'AbortError') setLiveState('error') })
    return () => ctl.abort()
  }, [selected, p])

  if (!p || !shown) {
    return (
      <div className="p-5 text-sm text-ink-2">
        <div className="eyebrow mb-2">District detail</div>
        <p>Hover a district for its prediction. Click to pin it{PREDICT_URL ? ' and query the live AWS model for that point' : ''}. Scrub the timeline below the map to travel back 90 days.</p>
      </div>
    )
  }

  const b = band(shown.pred)
  const delta = shown.pred != null && shown.prev != null ? shown.pred - shown.prev : null
  const vsCams = shown.pred != null && shown.cams != null ? shown.pred - shown.cams : null
  const cigs = shown.pred != null ? shown.pred / CIGARETTE_UGM3 : null

  return (
    <div className="relative overflow-hidden p-5 text-sm" key={p.id}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: colorFor(shown.pred) }} />
      {selected != null && (
        <button onClick={() => setSelected(null)} aria-label="Unpin" className="absolute right-3 top-3 rounded-full p-1 text-ink-3 hover:bg-cream-2"><X size={14} /></button>
      )}
      <div className="eyebrow">{selected != null ? 'Pinned district' : 'District'}{shown.scrubbed ? ` · ${shown.date}` : ''}</div>
      <h3 className="mt-0.5 text-2xl leading-tight">{p.name}</h3>
      {p.city && <p className="text-xs text-ink-3">largest town: {p.city}{p.urban_pop ? ` · ${fmt(p.urban_pop)} urban residents` : ''}</p>}

      <div className="mt-4 flex items-end gap-3">
        <div className="num text-5xl leading-none" style={{ color: colorFor(shown.pred) }}>{fmt(shown.pred)}</div>
        <div className="pb-1">
          <div className="num text-xs text-ink-3">± {fmt(p.unc)} µg/m³</div>
          <div className="text-xs font-medium" style={{ color: b.color }}>{b.label}</div>
        </div>
        {delta != null && (
          <div className={`num ml-auto flex items-center gap-0.5 pb-1 text-xs ${delta > 0 ? 'text-rust' : 'text-forest-3'}`}>
            {delta > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{fmt(Math.abs(delta))} vs day before
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-3">Predicted 24-h mean for {shown.date}. The ± is the model's calibrated 68 % interval for an unseen place.</p>

      {cigs != null && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-cream-2/70 px-3 py-2 text-xs">
          <Cigarette size={14} className="shrink-0 text-rust" />
          <span>Breathing this all day ≈ <strong className="num text-ink">{cigs < 0.1 ? '<0.1' : cigs.toFixed(1)}</strong> cigarettes <span className="text-ink-3">(22 µg/m³ ≈ 1, Berkeley Earth)</span></span>
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-ink-3">Nearest monitor</dt>
        <dd className="num flex items-center gap-1"><MapPin size={12} className="text-ink-3" />{fmt(p.nearest_km)} km</dd>
        <dt className="text-ink-3">Satellite baseline (CAMS)</dt>
        <dd className="num">{fmt(shown.cams)}{vsCams != null && <span className="text-ink-3"> ({vsCams > 0 ? '+' : ''}{fmt(vsCams)})</span>}</dd>
        <dt className="text-ink-3">vs WHO guideline ({WHO_GUIDELINE_24H})</dt>
        <dd className="num">{shown.pred != null ? `${(shown.pred / WHO_GUIDELINE_24H).toFixed(1)}×` : '—'}</dd>
        <dt className="text-ink-3">vs India standard ({INDIA_NAAQS_24H})</dt>
        <dd className="num">{shown.pred != null ? `${(shown.pred / INDIA_NAAQS_24H).toFixed(1)}×` : '—'}</dd>
      </dl>
      <p className="mt-1.5 truncate text-[11px] text-ink-3" title={p.nearest_name ?? ''}>nearest: {p.nearest_name}</p>

      <Sparkline id={p.id} dayIdx={day} />

      {PREDICT_URL && selected != null && (
        <div className="mt-4 rounded-xl border border-line bg-cream-2/60 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium"><Radio size={12} className={liveState === 'loading' ? 'animate-pulse text-ochre' : 'text-forest-3'} />Live from AWS Lambda</div>
          {liveState === 'loading' && <p className="mt-1 text-xs text-ink-3">Fetching today's satellite + weather features and running the model…</p>}
          {liveState === 'error' && <p className="mt-1 text-xs text-rust">Live endpoint unavailable; showing the precomputed value above.</p>}
          {live && <p className="num mt-1 text-xs">{fmt(live.pred)} µg/m³ (68 %: {fmt(live.lo)}–{fmt(live.hi)}) for {live.date}</p>}
        </div>
      )}

      <p className="mt-4 flex gap-1.5 text-[11px] leading-snug text-ink-3"><Info size={12} className="mt-0.5 shrink-0" />How we know: a model trained on monitors elsewhere in India, fed this day's satellite aerosol and weather for this district. See Accuracy for what the error looks like.</p>
    </div>
  )
}
