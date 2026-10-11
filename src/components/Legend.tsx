import { BANDS, INDIA_NAAQS_24H, VIEW_LEGEND, WHO_GUIDELINE_24H } from '../lib/scale'
import { useData } from '../lib/store'

export default function Legend({ compact = false }: { compact?: boolean }) {
  const view = useData((s) => s.view)
  if (view !== 'pred') {
    const L = VIEW_LEGEND[view]
    return (
      <div className={`px-3.5 py-3 ${compact ? 'text-[11px]' : 'text-xs'}`}>
        <div className="eyebrow mb-2">{L.title}</div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full">{L.stops.map((c) => <span key={c} style={{ background: c, flex: 1 }} />)}</div>
        <div className="num mt-1 flex justify-between text-[10px] text-ink-3">{L.labels.map((l) => <span key={l}>{l}</span>)}</div>
        <p className="mt-2 text-[11px] leading-snug text-ink-3">{view === 'unc' ? 'Wider intervals mean the model is extrapolating: fewer nearby monitors, unusual conditions. These districts top the placement list.' : 'Half of India is more than 50 km from any public PM2.5 monitor.'}</p>
      </div>
    )
  }
  return (
    <div className={`px-3.5 py-3 ${compact ? 'text-[11px]' : 'text-xs'}`}>
      <div className="eyebrow mb-2">Predicted daily PM2.5, µg/m³</div>
      <div className="flex h-2.5 w-full overflow-hidden rounded-full">
        {BANDS.map((b, i) => (
          <span key={b.label} style={{ background: b.color, flex: i === BANDS.length - 1 ? 1.2 : 1 }} />
        ))}
      </div>
      <div className="num mt-1 flex justify-between text-[10px] text-ink-3">
        <span>0</span><span>30</span><span>60</span><span>90</span><span>120</span><span>250+</span>
      </div>
      <ul className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-ink-2">
        {BANDS.map((b) => (
          <li key={b.label} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-sm" style={{ background: b.color }} />{b.label}
          </li>
        ))}
      </ul>
      {!compact && (
        <p className="mt-2 text-[11px] leading-snug text-ink-3">
          Bands follow CPCB's national AQI breakpoints. WHO's guideline is {WHO_GUIDELINE_24H}; India's standard is {INDIA_NAAQS_24H}. Small dark dots are the monitors we learn from.
        </p>
      )}
    </div>
  )
}
