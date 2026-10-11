import { useEffect, useRef, useState } from 'react'
import { Activity, Compass, Pause, Play, SkipForward, Wind } from 'lucide-react'
import { useData } from '../lib/store'
import type { ViewMode } from '../lib/types'

const VIEWS: { id: ViewMode; label: string; icon: React.ReactNode; hint: string }[] = [
  { id: 'pred', label: 'PM2.5', icon: <Wind size={13} />, hint: 'Predicted 24-h mean' },
  { id: 'unc', label: 'Uncertainty', icon: <Activity size={13} />, hint: 'Half-width of the 68 % interval: where the model is least sure' },
  { id: 'dist', label: 'Monitor gap', icon: <Compass size={13} />, hint: 'Kilometres to the nearest ground monitor' },
]

/** View-mode switch + 92-day timeline scrubber. Lives as a glass bar over the map. */
export default function MapControls() {
  const view = useData((s) => s.view)
  const setView = useData((s) => s.setView)
  const history = useData((s) => s.history)
  const day = useData((s) => s.day)
  const setDay = useData((s) => s.setDay)
  const [playing, setPlaying] = useState(false)
  const timer = useRef<number | null>(null)

  const n = history ? Object.values(history.series)[0]?.length ?? 0 : 0
  const idx = day ?? n - 1
  const label = history && n ? `${history.start.slice(0, 4)}-${Object.values(history.series)[0][idx][0]}` : ''

  useEffect(() => {
    if (!playing || !n) return
    timer.current = window.setInterval(() => {
      const cur = useData.getState().day ?? n - 1
      const next = cur + 1
      if (next >= n) { setDay(null); setPlaying(false) } else setDay(next)
    }, 220)
    return () => { if (timer.current) window.clearInterval(timer.current) }
  }, [playing, n, setDay])

  return (
    <div className="glass-light flex flex-col gap-2 rounded-2xl p-2 sm:flex-row sm:items-center sm:gap-3">
      <div className="flex rounded-full bg-cream-2/80 p-0.5">
        {VIEWS.map((v) => (
          <button key={v.id} title={v.hint} onClick={() => setView(v.id)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${view === v.id ? 'bg-ink text-cream' : 'text-ink-2 hover:bg-cream-3'}`}>
            {v.icon}{v.label}
          </button>
        ))}
      </div>
      {n > 0 && (
        <div className="flex flex-1 items-center gap-2 px-1">
          <button onClick={() => { if (!playing && day == null) setDay(0); setPlaying((p) => !p) }} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink text-cream transition hover:bg-forest" aria-label={playing ? 'Pause' : 'Play 92 days'}>
            {playing ? <Pause size={13} /> : <Play size={13} />}
          </button>
          <input type="range" min={0} max={n - 1} value={idx} onChange={(e) => { setPlaying(false); const v = Number(e.target.value); setDay(v === n - 1 ? null : v) }}
            className="h-1.5 flex-1 cursor-pointer accent-forest" aria-label="Day" />
          <button onClick={() => { setPlaying(false); setDay(null) }} className="num flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-2 hover:bg-cream-2" title="Jump to today">
            {label}{day != null ? <SkipForward size={11} /> : ''}
          </button>
        </div>
      )}
    </div>
  )
}
