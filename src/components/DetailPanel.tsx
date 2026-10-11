import { useEffect, useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Info, MapPin, Radio, X } from 'lucide-react'
import { useData } from '../lib/store'
import { band, colorFor, fmt, INDIA_NAAQS_24H, WHO_GUIDELINE_24H } from '../lib/scale'
import type { DistrictProps } from '../lib/types'

const PREDICT_URL = import.meta.env.VITE_PREDICT_URL as string | undefined

interface Live { pred: number; lo: number; hi: number; cams: number | null; date: string; source: string }

export default function DetailPanel() {
  const districts = useData((s) => s.districts)
  const selected = useData((s) => s.selected)
  const hovered = useData((s) => s.hovered)
  const setSelected = useData((s) => s.setSelected)
  const id = selected ?? hovered
  const p = useMemo<DistrictProps | null>(() => {
    if (id == null || !districts) return null
    const f = districts.features.find((x) => x.properties.id === id)
    return f ? f.properties : null
  }, [id, districts])

  const [live, setLive] = useState<Live | null>(null)
  const [liveState, setLiveState] = useState<'idle' | 'loading' | 'error'>('idle')
  useEffect(() => {
    setLive(null)
    if (!PREDICT_URL || selected == null || !p) return
    const ctl = new AbortController()
    setLiveState('loading')
    fetch(`${PREDICT_URL.replace(/\/$/, '')}/?lat=${p.lat}&lon=${p.lon}`, { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: Live) => { setLive(d); setLiveState('idle') })
      .catch((e) => { if (e.name !== 'AbortError') setLiveState('error') })
    return () => ctl.abort()
  }, [selected, p])

  if (!p) {
    return (
      <div className="card p-5 text-sm text-ink-2">
        <div className="eyebrow mb-2">District detail</div>
        <p>Hover a district for its prediction. Click to pin it{PREDICT_URL ? ' and query the live AWS model for that point' : ''}.</p>
      </div>
    )
  }

  const b = band(p.pred)
  const delta = p.pred != null && p.pred_prev != null ? p.pred - p.pred_prev : null
  const vsCams = p.pred != null && p.cams != null ? p.pred - p.cams : null

  return (
    <div className="card relative overflow-hidden p-5 text-sm" key={p.id}>
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: colorFor(p.pred) }} />
      {selected != null && (
        <button onClick={() => setSelected(null)} aria-label="Unpin" className="absolute right-3 top-3 rounded-full p-1 text-ink-3 hover:bg-cream-2"><X size={14} /></button>
      )}
      <div className="eyebrow">{selected != null ? 'Pinned district' : 'District'}</div>
      <h3 className="mt-0.5 text-2xl leading-tight">{p.name}</h3>
      {p.city && <p className="text-xs text-ink-3">largest town: {p.city}{p.pop ? ` · ${fmt(p.pop)} people` : ''}</p>}

      <div className="mt-4 flex items-end gap-3">
        <div className="num text-5xl leading-none" style={{ color: colorFor(p.pred) }}>{fmt(p.pred)}</div>
        <div className="pb-1">
          <div className="num text-xs text-ink-3">± {fmt(p.unc)} µg/m³</div>
          <div className="text-xs font-medium" style={{ color: b.color }}>{b.label}</div>
        </div>
        {delta != null && (
          <div className={`num ml-auto flex items-center gap-0.5 pb-1 text-xs ${delta > 0 ? 'text-rust' : 'text-forest-3'}`}>
            {delta > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{fmt(Math.abs(delta))} vs yesterday
          </div>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-3">Predicted 24-h mean for {p.date}. The ± is the model's 68 % interval for an unseen place.</p>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <dt className="text-ink-3">Nearest monitor</dt>
        <dd className="num flex items-center gap-1"><MapPin size={12} className="text-ink-3" />{fmt(p.nearest_km)} km</dd>
        <dt className="text-ink-3">Satellite baseline (CAMS)</dt>
        <dd className="num">{fmt(p.cams)}{vsCams != null && <span className="text-ink-3"> ({vsCams > 0 ? '+' : ''}{fmt(vsCams)})</span>}</dd>
        <dt className="text-ink-3">vs WHO guideline ({WHO_GUIDELINE_24H})</dt>
        <dd className="num">{p.pred != null ? `${(p.pred / WHO_GUIDELINE_24H).toFixed(1)}×` : '—'}</dd>
        <dt className="text-ink-3">vs India standard ({INDIA_NAAQS_24H})</dt>
        <dd className="num">{p.pred != null ? `${(p.pred / INDIA_NAAQS_24H).toFixed(1)}×` : '—'}</dd>
      </dl>
      <p className="mt-2 truncate text-[11px] text-ink-3" title={p.nearest_name ?? ''}>nearest: {p.nearest_name}</p>

      {PREDICT_URL && selected != null && (
        <div className="mt-4 rounded-xl border border-line bg-cream-2/60 p-3">
          <div className="flex items-center gap-1.5 text-xs font-medium"><Radio size={12} className={liveState === 'loading' ? 'animate-pulse text-ochre' : 'text-forest-3'} />Live from AWS Lambda</div>
          {liveState === 'loading' && <p className="mt-1 text-xs text-ink-3">Fetching today's satellite + weather features and running the model…</p>}
          {liveState === 'error' && <p className="mt-1 text-xs text-rust">Live endpoint unavailable; showing the precomputed value above.</p>}
          {live && (
            <p className="num mt-1 text-xs">{fmt(live.pred)} µg/m³ (68 %: {fmt(live.lo)}–{fmt(live.hi)}) for {live.date}</p>
          )}
        </div>
      )}

      <p className="mt-4 flex gap-1.5 text-[11px] leading-snug text-ink-3"><Info size={12} className="mt-0.5 shrink-0" />How we know: a model trained on {''}
        monitors elsewhere in India, fed today's satellite aerosol and weather for this district. See Accuracy for what the error looks like.</p>
    </div>
  )
}
