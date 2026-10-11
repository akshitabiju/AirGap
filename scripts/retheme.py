"""One-off re-theme: deep teal + mint, cool off-white surfaces. Run once; safe to re-run (asserts guard)."""
import pathlib, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def patch(path, pairs, must=True):
    p = pathlib.Path(path); s = p.read_text(encoding="utf-8")
    for a, b in pairs:
        if a not in s:
            if must: raise SystemExit(f"{path}: missing {a[:70]!r}")
            continue
        s = s.replace(a, b)
    p.write_text(s, encoding="utf-8")

# ---------------- tokens ----------------
patch("src/index.css", [
    ("""  --color-cream: #f5efe4;
  --color-cream-2: #ede4d3;
  --color-cream-3: #e3d8c3;
  --color-ink: #1b1a17;
  --color-ink-2: #4a463f;
  --color-ink-3: #7d776d;
  --color-forest: #1f3d2b;
  --color-forest-2: #2e5a3f;
  --color-forest-3: #4f8463;
  --color-moss: #9db99a;
  --color-ochre: #e0a458;
  --color-ochre-2: #c4812f;
  --color-rust: #b5462d;
  --color-rust-2: #8a2f1c;
  --color-line: rgba(27, 26, 23, 0.12);
  --color-line-2: rgba(27, 26, 23, 0.22);""",
     """  /* Surfaces: cool off-white. Ink: deep teal-black. Primary: deep teal. Accent: mint / gold. */
  --color-cream: #f4f7f6;
  --color-cream-2: #e9efee;
  --color-cream-3: #d8e2e0;
  --color-ink: #0c1a1e;
  --color-ink-2: #3b4f55;
  --color-ink-3: #6f8188;
  --color-forest: #0f4c5c;
  --color-forest-2: #16697a;
  --color-forest-3: #2a8c9c;
  --color-moss: #9fd3c7;
  --color-ochre: #d4a64a;
  --color-ochre-2: #b8862a;
  --color-rust: #d1495b;
  --color-rust-2: #9c2f41;
  --color-line: rgba(12, 26, 30, 0.12);
  --color-line-2: rgba(12, 26, 30, 0.22);"""),
    ("::selection { background: var(--color-ochre); color: var(--color-ink); }", "::selection { background: #5eead4; color: var(--color-ink); }"),
    ("""  --color-night: #0b1020;
  --color-night-2: #121a30;
  --color-haze: #f0b36a;
  --color-haze-2: #d9643a;""",
     """  --color-night: #04141a;
  --color-night-2: #0b2a33;
  --color-haze: #5eead4;
  --color-haze-2: #38bdf8;"""),
    (""".hero-sky {
  background:
    radial-gradient(120% 70% at 50% 110%, rgba(240,179,106,0.55) 0%, rgba(217,100,58,0.28) 28%, rgba(11,16,32,0) 62%),
    radial-gradient(60% 40% at 20% 20%, rgba(80,110,200,0.25), transparent 70%),
    linear-gradient(180deg, #070b17 0%, #0b1020 45%, #1a1a2e 75%, #2b2135 100%);
}""",
     """.hero-sky {
  background:
    radial-gradient(110% 60% at 50% 115%, rgba(94,234,212,0.28) 0%, rgba(56,189,248,0.16) 30%, rgba(4,20,26,0) 62%),
    radial-gradient(55% 40% at 15% 15%, rgba(129,140,248,0.18), transparent 70%),
    linear-gradient(180deg, #03111a 0%, #04141a 40%, #0b2a33 78%, #0f3a44 100%);
}"""),
    (".shimmer-text { background: linear-gradient(90deg, #f5efe4 0%, #f0b36a 40%, #f5efe4 60%);", ".shimmer-text { background: linear-gradient(90deg, #f4f7f6 0%, #5eead4 40%, #f4f7f6 60%);"),
    (".glass-light {\n  background: rgba(245,239,228,0.78);\n  border: 1px solid rgba(27,26,23,0.12);", ".glass-light {\n  background: rgba(244,247,246,0.8);\n  border: 1px solid rgba(12,26,30,0.12);"),
    ("  box-shadow: 0 24px 60px -24px rgba(27,26,23,0.35), inset 0 1px 0 rgba(255,255,255,0.7);", "  box-shadow: 0 24px 60px -24px rgba(12,26,30,0.35), inset 0 1px 0 rgba(255,255,255,0.7);"),
    (".nav-solid { background: rgba(245,239,228,0.82);", ".nav-solid { background: rgba(244,247,246,0.84);"),
    (".maplibregl-ctrl-attrib { background: rgba(245,239,228,0.85) !important;", ".maplibregl-ctrl-attrib { background: rgba(244,247,246,0.85) !important;"),
    ("  content: \"\";\n  position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.045;", "  content: \"\";\n  position: fixed; inset: 0; z-index: 0; pointer-events: none; opacity: 0.035;"),
])

# ---------------- data colours (CPCB bands, re-tuned: green -> yellow -> orange -> red -> plum) ----------------
patch("src/lib/scale.ts", [
    ("""  { max: 30, label: 'Good', color: '#4f8463' },
  { max: 60, label: 'Satisfactory', color: '#9db99a' },
  { max: 90, label: 'Moderate', color: '#e0c45c' },
  { max: 120, label: 'Poor', color: '#e0a458' },
  { max: 250, label: 'Very poor', color: '#b5462d' },
  { max: Infinity, label: 'Severe', color: '#5a1f16' },""",
     """  { max: 30, label: 'Good', color: '#2fb58b' },
  { max: 60, label: 'Satisfactory', color: '#9ccf5f' },
  { max: 90, label: 'Moderate', color: '#f2cf4a' },
  { max: 120, label: 'Poor', color: '#f0913a' },
  { max: 250, label: 'Very poor', color: '#d9455f' },
  { max: Infinity, label: 'Severe', color: '#6e2a7a' },"""),
    ("if (v == null || Number.isNaN(v)) return { max: 0, label: 'No data', color: '#d9d2c3' }", "if (v == null || Number.isNaN(v)) return { max: 0, label: 'No data', color: '#cfd8d6' }"),
    ("  if (v == null || Number.isNaN(v)) return '#d9d2c3'\n  const stops: [number, string][] = [\n    [0, '#5f9470'], [30, '#8fb58a'], [60, '#d9c565'], [90, '#dfa352'], [120, '#c9623a'], [250, '#8a2f1c'], [400, '#4a160f'],\n  ]",
     "  if (v == null || Number.isNaN(v)) return '#cfd8d6'\n  const stops: [number, string][] = [\n    [0, '#24a883'], [30, '#7cc46a'], [60, '#f2cf4a'], [90, '#f0913a'], [120, '#e2603f'], [250, '#b8325a'], [400, '#5a1f6e'],\n  ]"),
    ("""  'case', ['==', V, null], '#d9d2c3',
  ['interpolate', ['linear'], V,
    0, '#5f9470', 30, '#8fb58a', 60, '#d9c565', 90, '#dfa352', 120, '#c9623a', 250, '#8a2f1c', 400, '#4a160f'],""",
     """  'case', ['==', V, null], '#cfd8d6',
  ['interpolate', ['linear'], V,
    0, '#24a883', 30, '#7cc46a', 60, '#f2cf4a', 90, '#f0913a', 120, '#e2603f', 250, '#b8325a', 400, '#5a1f6e'],"""),
    ("""  'case', ['==', ['get', 'unc'], null], '#d9d2c3',
  ['interpolate', ['linear'], ['get', 'unc'], 5, '#e9e3d6', 12, '#b9c9c0', 20, '#6f9a86', 30, '#2e5a3f', 45, '#14301f'],""",
     """  'case', ['==', ['get', 'unc'], null], '#cfd8d6',
  ['interpolate', ['linear'], ['get', 'unc'], 5, '#e3efec', 12, '#b2dcd4', 20, '#5fb8b0', 30, '#16697a', 45, '#0a3540'],"""),
    ("  'interpolate', ['linear'], ['get', 'nearest_km'], 0, '#efe6d4', 25, '#e7c89a', 60, '#d99a5a', 120, '#b5462d', 250, '#5a1f16',",
     "  'interpolate', ['linear'], ['get', 'nearest_km'], 0, '#eef3f1', 25, '#f3dca3', 60, '#e9a85a', 120, '#d1495b', 250, '#5a1f6e',"),
    ("  unc: { title: '68 % interval half-width, µg/m³', stops: ['#e9e3d6', '#b9c9c0', '#6f9a86', '#2e5a3f', '#14301f'], labels: ['5', '12', '20', '30', '45+'] },\n  dist: { title: 'Distance to nearest monitor, km', stops: ['#efe6d4', '#e7c89a', '#d99a5a', '#b5462d', '#5a1f16'], labels: ['0', '25', '60', '120', '250+'] },",
     "  unc: { title: '68 % interval half-width, µg/m³', stops: ['#e3efec', '#b2dcd4', '#5fb8b0', '#16697a', '#0a3540'], labels: ['5', '12', '20', '30', '45+'] },\n  dist: { title: 'Distance to nearest monitor, km', stops: ['#eef3f1', '#f3dca3', '#e9a85a', '#d1495b', '#5a1f6e'], labels: ['0', '25', '60', '120', '250+'] },"),
])

# ---------------- chart series ----------------
patch("src/components/Charts.tsx", [
    ("export const SERIES = { airgap: '#3f8a5d', cams: '#a8640f' }", "export const SERIES = { airgap: '#16697a', cams: '#b8862a' }"),
])

# ---------------- hero atmosphere ----------------
patch("src/components/Hero.tsx", [
    ("ctx.shadowColor = 'rgba(240,179,106,0.9)'; ctx.shadowBlur = 24", "ctx.shadowColor = 'rgba(94,234,212,0.75)'; ctx.shadowBlur = 22"),
    ("ctx.strokeStyle = 'rgba(245,239,228,0.35)'; ctx.lineWidth = 0.4", "ctx.strokeStyle = 'rgba(244,247,246,0.35)'; ctx.lineWidth = 0.4"),
    ("        ctx.fillStyle = warm ? `rgba(240,179,106,${0.35 + 0.4 * p.a})` : `rgba(245,239,228,${0.15 + 0.25 * p.a})`",
     "        ctx.fillStyle = warm ? `rgba(94,234,212,${0.35 + 0.4 * p.a})` : `rgba(244,247,246,${0.12 + 0.22 * p.a})`"),
    ("""      <div className="haze haze-a" style={{ width: '70vw', height: '50vh', left: '-10vw', top: '35%', background: 'rgba(217,100,58,0.35)' }} />
      <div className="haze haze-b" style={{ width: '60vw', height: '45vh', right: '-15vw', top: '20%', background: 'rgba(240,179,106,0.28)' }} />
      <div className="haze haze-a" style={{ width: '40vw', height: '30vh', left: '30vw', top: '-10%', background: 'rgba(90,120,220,0.22)', animationDuration: '34s' }} />""",
     """      <div className="haze haze-a" style={{ width: '70vw', height: '50vh', left: '-10vw', top: '35%', background: 'rgba(56,189,248,0.22)' }} />
      <div className="haze haze-b" style={{ width: '60vw', height: '45vh', right: '-15vw', top: '20%', background: 'rgba(94,234,212,0.2)' }} />
      <div className="haze haze-a" style={{ width: '40vw', height: '30vh', left: '30vw', top: '-10%', background: 'rgba(129,140,248,0.2)', animationDuration: '34s' }} />"""),
    ("bg-haze shadow-[0_0_24px_6px_rgba(240,179,106,0.6)]", "bg-haze shadow-[0_0_24px_6px_rgba(94,234,212,0.55)]"),
])
patch("src/pages/Accuracy.tsx", [("background: 'rgba(240,179,106,0.35)'", "background: 'rgba(94,234,212,0.22)'")])
patch("src/pages/Placement.tsx", [("background: 'rgba(217,100,58,0.3)'", "background: 'rgba(56,189,248,0.22)'")])
patch("src/pages/Method.tsx", [("background: 'rgba(90,120,220,0.3)'", "background: 'rgba(129,140,248,0.22)'")])
patch("src/components/IndiaMap.tsx", [
    ("'circle-color': '#1b1a17',\n          'circle-opacity': 0.85,\n          'circle-stroke-color': '#f5efe4',", "'circle-color': '#0c1a1e',\n          'circle-opacity': 0.85,\n          'circle-stroke-color': '#f4f7f6',"),
    ("'line-color': '#1b1a17',", "'line-color': '#0c1a1e',"),
    ("paint: { 'circle-radius': 14, 'circle-color': '#e0a458', 'circle-opacity': 0.25 }", "paint: { 'circle-radius': 14, 'circle-color': '#5eead4', 'circle-opacity': 0.3 }"),
    ("paint: { 'circle-radius': 7, 'circle-color': '#e0a458', 'circle-stroke-color': '#1b1a17', 'circle-stroke-width': 1.4 }", "paint: { 'circle-radius': 7, 'circle-color': '#5eead4', 'circle-stroke-color': '#0c1a1e', 'circle-stroke-width': 1.4 }"),
    ("paint: { 'text-color': '#1b1a17' }", "paint: { 'text-color': '#0c1a1e' }"),
])
patch("public/favicon.svg", [('fill="#1f3d2b"', 'fill="#0f4c5c"'), ('fill="#e0a458"', 'fill="#5eead4"'), ('stroke="#f5efe4"', 'stroke="#f4f7f6"')])
patch("index.html", [('<meta name="theme-color" content="#f5efe4" />', '<meta name="theme-color" content="#04141a" />')])
print("retheme applied")
