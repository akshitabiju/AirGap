"""Wire hourly.json + BestHours + share into My Air; add PWA manifest/SW. One-off."""
import pathlib, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def patch(path, pairs):
    p = pathlib.Path(path); s = p.read_text(encoding="utf-8")
    for a, b in pairs:
        if a not in s: raise SystemExit(f"{path}: missing {a[:70]!r}")
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")

patch("src/lib/types.ts", [
    ("export type ViewMode = 'pred' | 'unc' | 'dist'",
     "export type ViewMode = 'pred' | 'unc' | 'dist'\n\n/** Hourly PM2.5 profile per district for today and tomorrow (24 ints each, or null). */\nexport interface Hourly { generated_at: string; days: string[]; method: string; series: Record<string, (number[] | null)[]> }"),
])
patch("src/lib/store.ts", [
    ("import type { City, Forecast, History, Meta, Metrics, Placement, Station, ViewMode } from './types'",
     "import type { City, Forecast, History, Hourly, Meta, Metrics, Placement, Station, ViewMode } from './types'"),
    ("  forecast: Forecast | null\n", "  forecast: Forecast | null\n  hourly: Hourly | null\n"),
    ("  history: null, forecast: null, day: null, view: 'pred',", "  history: null, forecast: null, hourly: null, day: null, view: 'pred',"),
    ("['forecast', '/data/forecast.json'],", "['forecast', '/data/forecast.json'], ['hourly', '/data/hourly.json'],"),
])
patch("src/components/MyAir.tsx", [
    ("import Search from './Search'", "import Search from './Search'\nimport BestHours from './BestHours'"),
    ("""              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-ink-3">{T.ui.disclaimer}</p>""",
     """              <BestHours district={district} lang={lang} bandLabel={T.band[bandKey]} />
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-ink-3">{T.ui.disclaimer}</p>"""),
])
# Deep link ?d=<district id> from shared messages: select + scroll to the map.
patch("src/pages/Landing.tsx", [
    ("  useReveal([districts, metrics])\n",
     """  useReveal([districts, metrics])
  // Shared links carry ?d=<district id>: pin it and jump to the map once data is in.
  const deepLinked = useRef(false)
  useEffect(() => {
    if (deepLinked.current || !districts) return
    const id = Number(new URLSearchParams(location.search).get('d'))
    const f = Number.isFinite(id) ? districts.features.find((x) => x.properties.id === id) : undefined
    if (!f) return
    deepLinked.current = true
    setSelected(f.properties.id); setFlyTo({ lat: f.properties.lat, lon: f.properties.lon })
    setTimeout(() => mapSection.current?.scrollIntoView({ behavior: 'smooth' }), 600)
  }, [districts, setSelected])
"""),
    ("import { useMemo, useRef, useState } from 'react'", "import { useEffect, useMemo, useRef, useState } from 'react'"),
])
print("patched")
