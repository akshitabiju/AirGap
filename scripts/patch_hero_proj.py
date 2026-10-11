"""Hero: Mercator projection, bigger/lower map, clickable layer above the text. One-off."""
import pathlib, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
p = pathlib.Path("src/components/Hero.tsx"); s = p.read_text(encoding="utf-8")

def rep(a, b, count=1):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, count)

# shared Mercator projection helper
rep("const LON0 = 68, LON1 = 97.5, LAT0 = 6.5, LAT1 = 36\n",
    """const LON0 = 68, LON1 = 97.5, LAT0 = 6.5, LAT1 = 36
const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))
const MY0 = merc(LAT0), MY1 = merc(LAT1)
/** Web-Mercator fit of India's bounding box into a w x h box (same look as the MapLibre map below). */
function projector(w: number, h: number) {
  const sc = Math.min(w / ((LON1 - LON0) * (Math.PI / 180)), h / (MY1 - MY0))
  const pw = (LON1 - LON0) * (Math.PI / 180) * sc, ph = (MY1 - MY0) * sc
  const ox = (w - pw) / 2, oy = (h - ph) / 2
  return { X: (lon: number) => ox + (lon - LON0) * (Math.PI / 180) * sc, Y: (lat: number) => oy + (MY1 - merc(lat)) * sc, sc }
}
""")
# IndiaGlow: use projector
rep("""      const s = Math.min(W / (LON1 - LON0), H / ((LAT1 - LAT0) * 1.05))
      const ox = (W - (LON1 - LON0) * s) / 2, oy = (H - (LAT1 - LAT0) * s * 1.05) / 2
      X = (lon) => ox + (lon - LON0) * s
      Y = (lat) => oy + (LAT1 - lat) * s * 1.05
""", """      const pr = projector(W, H)
      X = pr.X; Y = pr.Y
""")
# Hotspots: use projector
rep("""  const sc = Math.min(w / (LON1 - LON0), h / ((LAT1 - LAT0) * 1.05))
  const ox = (w - (LON1 - LON0) * sc) / 2, oy = (h - (LAT1 - LAT0) * sc * 1.05) / 2
  const X = (lon: number) => ox + (lon - LON0) * sc, Y = (lat: number) => oy + (LAT1 - lat) * sc * 1.05
""", """  const { X, Y } = projector(w, h)
""")
# wrapper: lower, bigger, above the text so dots are clickable
rep('''      <div className="float-2 pointer-events-none absolute right-[-6%] top-[14%] h-[60%] w-[60%] opacity-90 lg:right-[2%] lg:top-[76px] lg:h-[calc(100svh-140px)] lg:max-h-[880px] lg:w-[calc((100svh-140px)*0.92)] lg:max-w-[46vw]">''',
    '''      <div className="float-2 pointer-events-none absolute right-[-6%] top-[14%] z-10 h-[60%] w-[60%] opacity-95 lg:right-[1%] lg:top-[112px] lg:h-[calc(100svh-120px)] lg:max-h-[960px] lg:w-[calc((100svh-120px)*0.98)] lg:max-w-[52vw]">''')
# readout above everything; text column below the map layer but still interactive
rep('<div className="pointer-events-none absolute right-4 top-[72px] hidden flex-col items-end gap-2 lg:flex">',
    '<div className="pointer-events-none absolute right-4 top-[72px] z-20 hidden flex-col items-end gap-2 lg:flex">')
rep('<div className="relative mx-auto flex max-w-7xl flex-col justify-center px-5 pb-24 pt-28 sm:px-8 sm:pt-32" style={{ minHeight: \'max(100svh, 720px)\' }}>',
    '<div className="relative z-[5] mx-auto flex max-w-7xl flex-col justify-center px-5 pb-24 pt-28 sm:px-8 sm:pt-32 pointer-events-none [&_a]:pointer-events-auto [&_button]:pointer-events-auto" style={{ minHeight: \'max(100svh, 720px)\' }}>')
p.write_text(s, encoding="utf-8")
print("hero projection/layout patched")
