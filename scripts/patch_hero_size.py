"""Hero map wrapper: explicit JS sizing (no calc-in-class), padded Mercator fit. One-off."""
import pathlib, os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
p = pathlib.Path("src/components/Hero.tsx"); s = p.read_text(encoding="utf-8")

def rep(a, b):
    global s
    assert a in s, a[:70]
    s = s.replace(a, b, 1)

# padded fit so coast/Kashmir never touch the edge
rep("""function projector(w: number, h: number) {
  const sc = Math.min(w / ((LON1 - LON0) * (Math.PI / 180)), h / (MY1 - MY0))""",
    """function projector(w: number, h: number) {
  const pad = 0.04
  w *= 1 - 2 * pad; h *= 1 - 2 * pad
  const sc = Math.min(w / ((LON1 - LON0) * (Math.PI / 180)), h / (MY1 - MY0))""")
rep("""  const ox = (w - pw) / 2, oy = (h - ph) / 2
  return { X:""", """  const ox = (w - pw) / 2 + w * pad / (1 - 2 * pad), oy = (h - ph) / 2 + h * pad / (1 - 2 * pad)
  return { X:""")

# viewport hook
rep("/* Live IST clock. */", """/* Window size, for laying the map out without CSS calc. */
function useViewport() {
  const [v, setV] = useState({ w: typeof window === 'undefined' ? 1280 : window.innerWidth, h: typeof window === 'undefined' ? 800 : window.innerHeight })
  useEffect(() => {
    const on = () => setV({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on); return () => window.removeEventListener('resize', on)
  }, [])
  return v
}

/* Live IST clock. */""")

# wrapper: explicit size from the viewport on desktop
rep("""      <div className="float-2 pointer-events-none absolute right-[-6%] top-[14%] z-10 h-[60%] w-[60%] opacity-95 lg:right-[1%] lg:top-[112px] lg:h-[calc(100svh-120px)] lg:max-h-[960px] lg:w-[calc((100svh-120px)*0.98)] lg:max-w-[52vw]">""",
    """      <div className="float-2 pointer-events-none absolute z-10 opacity-95" style={mapBox}>""")
rep("""  const worstState = states ? [...states.states]""", """  const vp = useViewport()
  const desktop = vp.w >= 1024
  const mapH = desktop ? Math.min(vp.h - 130, 940) : Math.round(vp.h * 0.5)
  const mapW = desktop ? Math.min(Math.round(mapH * 0.98), Math.round(vp.w * 0.5)) : Math.round(vp.w * 0.7)
  const mapBox: React.CSSProperties = desktop
    ? { right: '1%', top: 104, width: mapW, height: mapH }
    : { right: '-8%', top: '12%', width: mapW, height: mapH }
  const worstState = states ? [...states.states]""")
p.write_text(s, encoding="utf-8")
print("hero sizing patched")
