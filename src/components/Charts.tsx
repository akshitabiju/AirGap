import { useMemo, useState } from 'react'
import { fmt } from '../lib/scale'

/* Two-series palette, validated with the dataviz palette checker (light surface #f5efe4).
   CAMS markers are hollow as a secondary encoding so identity is never colour-alone. */
export const SERIES = { airgap: '#3f8a5d', cams: '#a8640f' }

interface Pt { obs: number; pred: number; cams: number; city: string }

/** Predicted vs observed scatter for held-out cities, AirGap and CAMS side by side. */
export function Scatter({ points, max = 250 }: { points: Pt[]; max?: number }) {
  const W = 560, H = 420, m = { l: 48, r: 16, t: 16, b: 44 }
  const iw = W - m.l - m.r, ih = H - m.t - m.b
  const sx = (v: number) => m.l + (Math.min(v, max) / max) * iw
  const sy = (v: number) => m.t + ih - (Math.min(v, max) / max) * ih
  const [show, setShow] = useState<{ airgap: boolean; cams: boolean }>({ airgap: true, cams: true })
  const [hover, setHover] = useState<{ x: number; y: number; p: Pt; s: 'airgap' | 'cams' } | null>(null)
  const ticks = useMemo(() => [0, 50, 100, 150, 200, 250].filter((t) => t <= max), [max])
  const clipped = points.filter((p) => p.obs > max || p.pred > max || p.cams > max).length

  return (
    <figure className="relative">
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs">
        {(['airgap', 'cams'] as const).map((s) => (
          <button key={s} onClick={() => setShow((v) => ({ ...v, [s]: !v[s] }))} className={`flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 ${show[s] ? '' : 'opacity-40'}`}>
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={s === 'cams' ? { border: `1.5px solid ${SERIES.cams}` } : { background: SERIES.airgap }} />{s === 'airgap' ? 'AirGap (held-out cities)' : 'CAMS satellite baseline'}
          </button>
        ))}
        <span className="text-ink-3">click to toggle · hover a point</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Predicted versus observed PM2.5 scatter plot">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={sx(t)} x2={sx(t)} y1={m.t} y2={m.t + ih} stroke="#1b1a17" strokeOpacity={0.07} />
            <line x1={m.l} x2={m.l + iw} y1={sy(t)} y2={sy(t)} stroke="#1b1a17" strokeOpacity={0.07} />
            <text x={sx(t)} y={m.t + ih + 16} textAnchor="middle" fontSize={10} fill="#7d776d" className="num">{t}</text>
            <text x={m.l - 8} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="#7d776d" className="num">{t}</text>
          </g>
        ))}
        <line x1={sx(0)} y1={sy(0)} x2={sx(max)} y2={sy(max)} stroke="#1b1a17" strokeOpacity={0.35} strokeDasharray="4 4" />
        <text x={sx(max) - 4} y={sy(max) + 12} textAnchor="end" fontSize={10} fill="#4a463f">perfect</text>
        <text x={m.l + iw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="#4a463f">Observed daily PM2.5 at the monitor, µg/m³</text>
        <text transform={`translate(12 ${m.t + ih / 2}) rotate(-90)`} textAnchor="middle" fontSize={11} fill="#4a463f">Predicted, µg/m³</text>
        {show.cams && points.map((p, i) => (
          <circle key={`c${i}`} cx={sx(p.obs)} cy={sy(p.cams)} r={3} fill="none" stroke={SERIES.cams} strokeOpacity={0.6} strokeWidth={1.1}
            onMouseEnter={() => setHover({ x: sx(p.obs), y: sy(p.cams), p, s: 'cams' })} onMouseLeave={() => setHover(null)} />
        ))}
        {show.airgap && points.map((p, i) => (
          <circle key={`a${i}`} cx={sx(p.obs)} cy={sy(p.pred)} r={3} fill={SERIES.airgap} fillOpacity={0.45} stroke="#f5efe4" strokeWidth={0.6}
            onMouseEnter={() => setHover({ x: sx(p.obs), y: sy(p.pred), p, s: 'airgap' })} onMouseLeave={() => setHover(null)} />
        ))}
        {hover && <circle cx={hover.x} cy={hover.y} r={6} fill="none" stroke="#1b1a17" strokeWidth={1.2} />}
      </svg>
      {hover && (
        <div className="card pointer-events-none absolute z-10 px-3 py-2 text-xs" style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%`, transform: 'translate(12px, -110%)' }}>
          <div className="font-medium">{hover.p.city}</div>
          <div className="num text-ink-2">observed {fmt(hover.p.obs, 1)} · AirGap {fmt(hover.p.pred, 1)} · CAMS {fmt(hover.p.cams, 1)}</div>
        </div>
      )}
      <figcaption className="mt-1 text-[11px] text-ink-3">Random sample of {fmt(points.length)} held-out station-days. {clipped > 0 ? `${clipped} points above ${max} are clipped to the edge.` : ''}</figcaption>
    </figure>
  )
}

/** Horizontal bars, single series; value labels on each bar (few bars, so labels earn their place). */
export function HBars({ rows, unit = '', color = SERIES.airgap, maxValue }: { rows: { label: string; value: number; note?: string }[]; unit?: string; color?: string; maxValue?: number }) {
  const max = maxValue ?? Math.max(...rows.map((r) => r.value), 1e-9)
  return (
    <ul className="space-y-1.5 text-xs">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[9rem_1fr_3.5rem] items-center gap-2">
          <span className="truncate text-ink-2" title={r.label}>{r.label}</span>
          <span className="relative h-2.5 overflow-hidden rounded-r-[4px] bg-cream-3">
            <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </span>
          <span className="num text-right text-ink-2">{fmt(r.value, unit === '%' ? 0 : 1)}{unit}</span>
        </li>
      ))}
    </ul>
  )
}

/** Paired bars for AirGap vs CAMS per fold or per city (two series, legend above). */
export function PairedBars({ rows }: { rows: { label: string; a: number; b: number; n?: number }[] }) {
  const max = Math.max(...rows.flatMap((r) => [r.a, r.b]), 1e-9)
  return (
    <div>
      <div className="mb-2 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES.airgap }} />AirGap MAE</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES.cams }} />CAMS MAE</span>
      </div>
      <ul className="space-y-2 text-xs">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[9rem_1fr] items-center gap-2">
            <span className="truncate text-ink-2" title={r.label}>{r.label}{r.n != null && <span className="num text-ink-3"> · {r.n}</span>}</span>
            <span className="space-y-0.5">
              {[['a', SERIES.airgap, r.a], ['b', SERIES.cams, r.b]].map(([k, c, v]) => (
                <span key={k as string} className="flex items-center gap-2">
                  <span className="relative h-2 flex-1 overflow-hidden rounded-r-[4px] bg-cream-3"><span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${((v as number) / max) * 100}%`, background: c as string }} /></span>
                  <span className="num w-10 text-right text-ink-2">{fmt(v as number, 1)}</span>
                </span>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
