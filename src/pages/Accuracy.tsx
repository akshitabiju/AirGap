import { useMemo, useState } from 'react'
import { ArrowUpDown, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useData } from '../lib/store'
import { fmt } from '../lib/scale'
import { HBars, PairedBars, Scatter } from '../components/Charts'

export default function Accuracy() {
  const metrics = useData((s) => s.metrics)
  const err = useData((s) => s.errors.metrics)
  const [sort, setSort] = useState<'n' | 'mae' | 'mean_obs'>('n')
  const cities = useMemo(() => (metrics ? [...metrics.per_city].sort((a, b) => b[sort] - a[sort]) : []), [metrics, sort])

  if (err) return <Empty text={`Couldn't load metrics: ${err}`} />
  if (!metrics) return <Empty text="Loading validation results…" spin />

  const o = metrics.overall
  const better = o.mae < o.cams_mae
  const gain = ((o.cams_mae - o.mae) / o.cams_mae) * 100

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <div className="hero-sky relative -mx-5 -mt-12 overflow-hidden px-5 pb-14 pt-16 text-cream sm:-mx-8 sm:rounded-b-[2.5rem] sm:px-10">
        <div className="haze haze-b" style={{ width: '50vw', height: '40vh', right: '-10vw', top: '-10%', background: 'rgba(240,179,106,0.35)' }} />
        <div className="relative">
          <p className="rise text-xs uppercase tracking-[0.18em] text-cream/60">Accuracy</p>
          <h1 className="rise rise-1 mt-2 max-w-3xl !text-cream text-4xl sm:text-6xl">How wrong is it, on cities it has <em className="italic text-haze">never seen?</em></h1>
          <p className="rise rise-2 mt-4 max-w-2xl text-cream/75">
            We split {fmt(metrics.n_stations)} monitors into {metrics.folds.length} groups by city, trained on four groups and predicted the fifth, five times over.
            Every number below is from a city the model was not trained on. The satellite model we build on (CAMS) is scored on exactly the same rows.
          </p>
        </div>
      </div>

      <div className="rise rise-3 mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Mean absolute error" value={fmt(o.mae, 1)} unit="µg/m³" sub={`CAMS baseline ${fmt(o.cams_mae, 1)}`} />
        <Tile label="R² on held-out cities" value={fmt(o.r2, 2)} sub={`CAMS baseline ${fmt(o.cams_r2, 2)}`} />
        <Tile label="Within ±15 µg/m³" value={`${fmt(o.within_15 * 100)}%`} sub={`CAMS baseline ${fmt(o.cams_within_15 * 100)}%`} />
        <Tile label="68 % interval coverage" value={`${fmt(o.interval68_coverage * 100)}%`} sub="ideal: 68 % (honest error bars)" />
      </div>

      <div className={`rise rise-4 mt-6 flex items-start gap-3 rounded-2xl border p-5 text-sm ${better ? 'border-forest-3/40 bg-forest/5' : 'border-rust/40 bg-rust/5'}`}>
        {better ? <CheckCircle2 className="mt-0.5 shrink-0 text-forest-3" size={18} /> : <XCircle className="mt-0.5 shrink-0 text-rust" size={18} />}
        <p>
          {better
            ? <>On cities it never saw, AirGap's error is <strong>{fmt(gain)}% lower</strong> than the raw satellite-assimilated model it builds on. The median observed value in this period was {fmt(o.median_obs)} µg/m³, so a typical error of {fmt(o.mae)} µg/m³ is {o.mae / o.median_obs < 0.5 ? 'enough to tell a bad day from a good one' : 'large relative to typical levels; treat the map as indicative'}.</>
            : <>AirGap did <strong>not</strong> beat the CAMS baseline on held-out cities in this run (MAE {fmt(o.mae, 1)} vs {fmt(o.cams_mae, 1)}). We publish that rather than hide it. The CAMS value is shown in every district panel so you can compare.</>}
        </p>
      </div>

      <div className="mt-12 grid gap-10 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h2 className="text-2xl">Predicted vs observed</h2>
          <p className="mb-4 mt-1 text-sm text-ink-2">Points on the dashed line are perfect. Tighter around the line is better; CAMS tends to sit low on high-pollution days.</p>
          <Scatter points={metrics.scatter} />
        </div>
        <div className="space-y-8 lg:col-span-5">
          <div>
            <h2 className="text-2xl">By fold</h2>
            <p className="mb-3 mt-1 text-sm text-ink-2">Each fold holds out a different set of cities.</p>
            <PairedBars rows={metrics.folds.map((f) => ({ label: `Fold ${f.fold} · ${f.n_cities} cities`, a: f.mae, b: f.cams_mae, n: f.n_test }))} />
          </div>
          <div>
            <h2 className="text-2xl">What the model leans on</h2>
            <p className="mb-3 mt-1 text-sm text-ink-2">Share of LightGBM split gain, final model.</p>
            <HBars unit="%" rows={metrics.feature_importance.slice(0, 10).map((f) => ({ label: niceFeature(f.feature), value: f.share != null ? f.share * 100 : f.gain }))} />
          </div>
        </div>
      </div>

      <div className="mt-14">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl">Per city</h2>
            <p className="mt-1 text-sm text-ink-2">Cities with at least 20 held-out station-days. Sorted by {sort === 'n' ? 'sample size' : sort === 'mae' ? 'AirGap error' : 'observed level'}.</p>
          </div>
          <div className="flex gap-1 text-xs">
            {(['n', 'mae', 'mean_obs'] as const).map((k) => (
              <button key={k} onClick={() => setSort(k)} className={`btn !py-1 ${sort === k ? 'bg-ink text-cream' : ''}`}><ArrowUpDown size={12} />{k === 'n' ? 'days' : k === 'mae' ? 'error' : 'level'}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="data">
            <thead><tr><th>City</th><th className="text-right">Station-days</th><th className="text-right">Observed mean</th><th className="text-right">Predicted mean</th><th className="text-right">AirGap MAE</th><th className="text-right">CAMS MAE</th><th>Better?</th></tr></thead>
            <tbody>
              {cities.map((c) => (
                <tr key={c.city}>
                  <td>{c.city}</td>
                  <td className="num text-right">{fmt(c.n)}</td>
                  <td className="num text-right">{fmt(c.mean_obs, 1)}</td>
                  <td className="num text-right">{fmt(c.mean_pred, 1)}</td>
                  <td className="num text-right">{fmt(c.mae, 1)}</td>
                  <td className="num text-right">{fmt(c.cams_mae, 1)}</td>
                  <td>{c.mae < c.cams_mae ? <CheckCircle2 size={14} className="text-forest-3" /> : <XCircle size={14} className="text-rust" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-14 max-w-3xl">
        <h2 className="text-2xl">What this error means in practice</h2>
        <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-2">
          <p>A mean absolute error of {fmt(o.mae)} µg/m³ means that for a typical district-day, the real 24-hour value is usually within about {fmt(o.mae)} µg/m³ of what the map shows. The CPCB bands are 30 µg/m³ wide at the clean end and 130 wide at the "very poor" end, so the map is reliable about <em>which kind</em> of day a district is having, less so about the exact number.</p>
          <p>The 68 % interval shown on every district is checked, not assumed: on held-out cities, {fmt(o.interval68_coverage * 100)}% of real values fell inside it. {o.interval68_coverage < 0.6 ? 'That is below 68 %, so the error bars are somewhat too narrow; treat them as a lower bound.' : o.interval68_coverage > 0.76 ? 'That is above 68 %, so the error bars are conservative.' : 'That is close to the 68 % it claims.'}</p>
          <p>Errors are larger in the north in winter (high, variable pollution) and in places far from any monitor, where the model is extrapolating. Those are exactly the places the <a className="underline" href="/placement">placement page</a> asks you to instrument first.</p>
          <p className="text-xs text-ink-3">Training rows: {fmt(metrics.n_train_rows)} station-days from {fmt(metrics.n_stations)} monitors in {fmt(metrics.n_city_groups)} city groups, {metrics.date_min} to {metrics.date_max}. {metrics.validation}. Seed {metrics.seed}. Trained {metrics.trained_at.slice(0, 16).replace('T', ' ')} UTC.</p>
        </div>
      </div>
    </div>
  )
}

function Tile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="eyebrow">{label}</div>
      <div className="num mt-2 text-4xl leading-none">{value}{unit && <span className="ml-1 text-sm text-ink-3">{unit}</span>}</div>
      {sub && <div className="mt-2 text-xs text-ink-3">{sub}</div>}
    </div>
  )
}

function Empty({ text, spin }: { text: string; spin?: boolean }) {
  return <div className="mx-auto flex max-w-7xl items-center gap-2 px-5 py-24 text-sm text-ink-2 sm:px-8">{spin && <Loader2 size={16} className="animate-spin" />}{text}</div>
}

function niceFeature(f: string) {
  const m: Record<string, string> = {
    cams_pm25_mean: 'CAMS PM2.5 (day mean)', cams_pm25_max: 'CAMS PM2.5 (day max)', cams_pm10_mean: 'CAMS PM10', aod_mean: 'Aerosol optical depth', aod_max: 'AOD (day max)',
    dust_mean: 'Dust', cams_pm25_lag1: 'CAMS PM2.5 yesterday', tmax: 'Max temperature', tmin: 'Min temperature', wind_max: 'Max wind', wind_dir: 'Wind direction', precip: 'Rain',
    rh: 'Humidity', pressure: 'Pressure', wind_max_lag1: 'Max wind yesterday', lat: 'Latitude', lon: 'Longitude', elevation: 'Elevation', doy_sin: 'Season (sin)', doy_cos: 'Season (cos)', month: 'Month',
  }
  return m[f] ?? f
}
