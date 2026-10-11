import { useData } from '../lib/store'

export default function Footer() {
  const meta = useData((s) => s.meta)
  return (
    <footer className="relative z-[1] border-t border-line">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-6 text-xs text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p>Ground truth: OpenAQ (CPCB &amp; others). Features: Copernicus CAMS and ERA5 via Open-Meteo. Boundaries: geoBoundaries (CC BY). Basemap: OpenFreeMap &amp; OpenStreetMap contributors.</p>
        <p className="num whitespace-nowrap">{meta ? `Predictions for ${meta.prediction_date} · built ${meta.generated_at.slice(0, 16).replace('T', ' ')} UTC` : 'Loading build info…'}</p>
      </div>
    </footer>
  )
}
