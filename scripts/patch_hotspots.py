"""Hero: remove state labels; replace canvas dots with clickable HTML hotspots. One-off."""
import pathlib, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
p = pathlib.Path("src/components/Hero.tsx"); s = p.read_text(encoding="utf-8")

def cut(s, start_marker, end_marker):
    i = s.index(start_marker); j = s.index(end_marker, i) + len(end_marker)
    return s[:i] + s[j:]

# 1) remove the state-label block
s = cut(s, "      // state names: small glowing serif caps; tiny states only when there is room\n", "        b.shadowBlur = 0\n      }\n")
# 2) remove animated hotspot drawing; base layer only
old_frame_start = "    const hot = (states?.hotspots ?? []).filter((h) => h.pred >= 60).slice(0, 25)\n"
old_frame_end = "    return () => { cancelAnimationFrame(raf); ro.disconnect() }\n  }, [districts, states])\n"
i = s.index(old_frame_start); j = s.index(old_frame_end) + len(old_frame_end)
s = s[:i] + """    const blit = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(base, 0, 0)
    }
    drawBase(); blit()
    const ro = new ResizeObserver(() => { drawBase(); blit() }); ro.observe(parent)
    return () => { ro.disconnect() }
  }, [districts])
""" + s[j:]
s = s.replace("  const states = useData((s) => s.states)\n  useEffect(() => {\n    const cv = ref.current\n    if (!cv || !districts) return",
              "  useEffect(() => {\n    const cv = ref.current\n    if (!cv || !districts) return", 1)
s = s.replace("    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('static')\n    let raf = 0\n    const base",
              "    const base")

# 3) clickable hotspots component (same projection as the canvas)
hotspots = '''
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
  const sc = Math.min(w / (LON1 - LON0), h / ((LAT1 - LAT0) * 1.05))
  const ox = (w - (LON1 - LON0) * sc) / 2, oy = (h - (LAT1 - LAT0) * sc * 1.05) / 2
  const X = (lon: number) => ox + (lon - LON0) * sc, Y = (lat: number) => oy + (LAT1 - lat) * sc * 1.05
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
'''
s = s.replace("/* Drifting aerosol particles over the sky. */", hotspots + "\n/* Drifting aerosol particles over the sky. */")
s = s.replace("import { colorFor, fmt } from '../lib/scale'", "import { band, colorFor, fmt } from '../lib/scale'")

# 4) mount the hotspots in the glow wrapper (make the wrapper accept pointer events only on dots)
s = s.replace('''      <div className="float-2 pointer-events-none absolute right-[-6%] top-[14%] h-[60%] w-[60%] opacity-90 lg:right-[2%] lg:top-[76px] lg:h-[calc(100svh-140px)] lg:max-h-[880px] lg:w-[calc((100svh-140px)*0.92)] lg:max-w-[46vw]">
        <IndiaGlow />
      </div>''', '''      <div className="float-2 pointer-events-none absolute right-[-6%] top-[14%] h-[60%] w-[60%] opacity-90 lg:right-[2%] lg:top-[76px] lg:h-[calc(100svh-140px)] lg:max-h-[880px] lg:w-[calc((100svh-140px)*0.92)] lg:max-w-[46vw]">
        <IndiaGlow />
        <Hotspots onOpen={onOpenDistrict} />
      </div>''')
s = s.replace("export default function Hero({ onExplore, onCheck }: { onExplore: () => void; onCheck: () => void }) {\n  const meta = useData((s) => s.meta)",
              "export default function Hero({ onExplore, onCheck }: { onExplore: () => void; onCheck: () => void }) {\n  const meta = useData((s) => s.meta)\n  const districts = useData((s) => s.districts)\n  const setSelected = useData((s) => s.setSelected)\n  const onOpenDistrict = (name: string) => {\n    const f = districts?.features.find((x) => x.properties.name === name)\n    if (f) setSelected(f.properties.id)\n    onExplore()\n  }")
# readout card: drop the state-mean line wording tweak (keep), legend stays
p.write_text(s, encoding="utf-8")
print("hotspots patched")
