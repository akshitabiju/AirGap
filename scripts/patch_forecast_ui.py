"""Wire forecast.json into the store, timeline, sparkline and My Air. One-off."""
import pathlib, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def patch(path, pairs):
    p = pathlib.Path(path); s = p.read_text(encoding="utf-8")
    for a, b in pairs:
        if a not in s: raise SystemExit(f"{path}: missing {a[:70]!r}")
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")

patch("src/lib/types.ts", [
    ("export interface History { start: string; series: Record<string, [string, number, number][]> }",
     "export interface History { start: string; series: Record<string, [string, number, number][]>; forecastFrom?: number }\n\n/** 3-day forecast per district: [MM-DD, pred, lo, hi, cams] */\nexport interface Forecast { generated_at: string; base_date: string; days: string[]; weather_source: string; series: Record<string, [string, number, number, number, number][]> }"),
])

patch("src/lib/store.ts", [
    ("import type { City, History, Meta, Metrics, Placement, Station, ViewMode } from './types'",
     "import type { City, Forecast, History, Meta, Metrics, Placement, Station, ViewMode } from './types'"),
    ("  history: History | null\n", "  history: History | null\n  forecast: Forecast | null\n"),
    ("  history: null, day: null, view: 'pred',", "  history: null, forecast: null, day: null, view: 'pred',"),
    ("['history', '/data/history.json'],", "['history', '/data/history.json'], ['forecast', '/data/forecast.json'],"),
    ("    set({ ...patch, errors, loading: false })",
     """    // Append the forecast days to each district's history so the timeline runs past today.
    const h = patch.history as History | undefined, f = patch.forecast as Forecast | undefined
    if (h && f && h.forecastFrom == null) {
      let n = 0
      for (const [id, s] of Object.entries(h.series)) {
        n = s.length
        const fs = f.series[id]
        if (fs) s.push(...fs.map(([d, p, , , c]) => [d, p, c] as [string, number, number]))
      }
      h.forecastFrom = n
    }
    set({ ...patch, errors, loading: false })"""),
])

patch("src/components/MapControls.tsx", [
    ("  const label = history && n ? `${history.start.slice(0, 4)}-${Object.values(history.series)[0][idx][0]}` : ''",
     "  const fcFrom = history?.forecastFrom ?? n\n  const isFc = idx >= fcFrom\n  const label = history && n ? `${history.start.slice(0, 4)}-${Object.values(history.series)[0][idx][0]}${isFc ? ' · forecast' : day == null ? ' · today' : ''}` : ''"),
    ("if (next >= n) { setDay(null); setPlaying(false) } else setDay(next)",
     "if (next >= n) { setDay(null); setPlaying(false) } else setDay(next === fcFrom - 1 ? null : next)"),
    ("          <input type=\"range\" min={0} max={n - 1} value={idx}",
     "          <div className=\"relative flex-1\">\n          <input type=\"range\" min={0} max={n - 1} value={idx}"),
    ("            className=\"h-1.5 flex-1 cursor-pointer accent-forest\" aria-label=\"Day\" />",
     "            className=\"h-1.5 w-full cursor-pointer accent-forest\" aria-label=\"Day\" />\n          {fcFrom < n && <span className=\"pointer-events-none absolute -bottom-3 text-[9px] uppercase tracking-wider text-ink-3\" style={{ left: `${((fcFrom - 1) / (n - 1)) * 100}%` }}>today ›</span>}\n          </div>"),
    ("<button onClick={() => { setPlaying(false); setDay(null) }} className=\"num flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-2 hover:bg-cream-2\" title=\"Jump to today\">",
     "<button onClick={() => { setPlaying(false); setDay(null) }} className={`num flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] hover:bg-cream-2 ${isFc ? 'border-forest-3 bg-forest/10 text-forest' : 'border-line text-ink-2'}`} title=\"Jump to today\">"),
])
# the scrub value index: day null means "today" which is index fcFrom-1 now, not n-1
patch("src/components/MapControls.tsx", [
    ("  const idx = day ?? n - 1\n", "  const idx = day ?? Math.max((history?.forecastFrom ?? n) - 1, 0)\n"),
    ("const v = Number(e.target.value); setDay(v === n - 1 ? null : v)", "const v = Number(e.target.value); setDay(v === fcFrom - 1 ? null : v)"),
])

# Sparkline: dashed forecast segment + today divider; "today" index = forecastFrom-1
patch("src/components/DetailPanel.tsx", [
    ("  const path = (k: 1 | 2) => series.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ')\n  const cur = hover ?? dayIdx ?? series.length - 1",
     "  const fcFrom = history?.forecastFrom ?? series.length\n  const seg = (k: 1 | 2, from: number, to: number) => series.slice(from, to).map((d, i) => `${i ? 'L' : 'M'}${x(from + i).toFixed(1)},${y(d[k]).toFixed(1)}`).join(' ')\n  const cur = hover ?? dayIdx ?? fcFrom - 1"),
    ("        <path d={path(2)} fill=\"none\" stroke={SERIES.cams} strokeWidth={1.2} strokeDasharray=\"3 3\" strokeOpacity={0.8} />\n        <path d={path(1)} fill=\"none\" stroke={SERIES.airgap} strokeWidth={2} strokeLinejoin=\"round\" />",
     "        <path d={seg(2, 0, series.length)} fill=\"none\" stroke={SERIES.cams} strokeWidth={1.2} strokeDasharray=\"3 3\" strokeOpacity={0.8} />\n        <path d={seg(1, 0, fcFrom)} fill=\"none\" stroke={SERIES.airgap} strokeWidth={2} strokeLinejoin=\"round\" />\n        {fcFrom < series.length && <path d={seg(1, fcFrom - 1, series.length)} fill=\"none\" stroke={SERIES.airgap} strokeWidth={2} strokeDasharray=\"4 3\" strokeOpacity={0.7} />}\n        {fcFrom < series.length && <line x1={x(fcFrom - 1)} x2={x(fcFrom - 1)} y1={m.t} y2={H - m.b} stroke=\"#16697a\" strokeOpacity={0.4} />}"),
    ("        <span>Last {series.length} days</span>", "        <span>Last {fcFrom} days{fcFrom < series.length ? ` + ${series.length - fcFrom}-day forecast` : ''}</span>"),
    ("        <span>{d[0]}: <strong className=\"text-ink\">{fmt(d[1])}</strong> µg/m³ <span className=\"text-ink-3\">(CAMS {fmt(d[2])})</span></span>",
     "        <span>{d[0]}{cur >= fcFrom ? ' (forecast)' : ''}: <strong className=\"text-ink\">{fmt(d[1])}</strong> µg/m³ <span className=\"text-ink-3\">(CAMS {fmt(d[2])})</span></span>"),
    ("        onClick={() => { if (hover != null) setDay(hover === series.length - 1 ? null : hover) }}>",
     "        onClick={() => { if (hover != null) setDay(hover === fcFrom - 1 ? null : hover) }}>"),
    ("    if (day != null && s && s[day]) return { pred: s[day][1], cams: s[day][2], prev: day > 0 ? s[day - 1][1] : null, date: `${history!.start.slice(0, 4)}-${s[day][0]}`, scrubbed: true }",
     "    if (day != null && s && s[day]) return { pred: s[day][1], cams: s[day][2], prev: day > 0 ? s[day - 1][1] : null, date: `${history!.start.slice(0, 4)}-${s[day][0]}${day >= (history!.forecastFrom ?? Infinity) ? ' (forecast)' : ''}`, scrubbed: true }"),
])

# My Air: tomorrow / +2 / +3 chips
patch("src/components/MyAir.tsx", [
    ("  const districts = useData((s) => s.districts)\n", "  const districts = useData((s) => s.districts)\n  const forecast = useData((s) => s.forecast)\n"),
    ("  const pm = district?.pred ?? null\n  const adv = pm != null ? advice(pm, profile) : null",
     "  const pm = district?.pred ?? null\n  const adv = pm != null ? advice(pm, profile) : null\n  const fc = district && forecast ? forecast.series[String(district.id)] ?? null : null\n  const trend = fc && pm != null ? fc[0][1] - pm : null"),
    ("              <div className=\"mt-4 flex flex-wrap items-center justify-between gap-2\">",
     """              {fc && (
                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.12em] text-ink-3"><span>Next three days (forecast)</span>{trend != null && <span className={trend > 3 ? 'text-rust' : trend < -3 ? 'text-forest-3' : ''}>{trend > 3 ? 'getting worse' : trend < -3 ? 'improving' : 'about the same'}</span>}</div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="rounded-xl border border-line p-2.5"><div className="text-ink-3">Today</div><div className="num mt-0.5 text-lg" style={{ color: colorFor(pm) }}>{fmt(pm)}</div><div className="text-[10px] text-ink-3">{band(pm).label}</div></div>
                    {fc.map(([d, p, lo, hi]) => (
                      <div key={d} className="rounded-xl border border-dashed border-line p-2.5"><div className="text-ink-3">{d}</div><div className="num mt-0.5 text-lg" style={{ color: colorFor(p) }}>{fmt(p)}</div><div className="num text-[10px] text-ink-3">{fmt(lo)}–{fmt(hi)}</div></div>
                    ))}
                  </div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">"""),
])
print("forecast UI patched")
