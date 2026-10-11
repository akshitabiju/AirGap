import { ExternalLink } from 'lucide-react'
import { useData } from '../lib/store'
import { fmt } from '../lib/scale'

export default function Method() {
  const meta = useData((s) => s.meta)
  const metrics = useData((s) => s.metrics)
  const gt = (meta?.ground_truth ?? {}) as Record<string, string | number>

  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
      <div className="hero-sky relative -mx-5 -mt-12 overflow-hidden px-5 pb-14 pt-16 text-cream sm:-mx-8 sm:rounded-b-[2.5rem] sm:px-10">
        <div className="haze haze-b" style={{ width: '50vw', height: '40vh', right: '-10vw', top: '-10%', background: 'rgba(129,140,248,0.22)' }} />
        <div className="relative">
          <p className="rise text-xs uppercase tracking-[0.18em] text-cream/60">Method &amp; data</p>
          <h1 className="rise rise-1 mt-2 max-w-3xl !text-cream text-4xl sm:text-6xl">Everything here is open data and <em className="italic text-haze">one model you can rerun tonight.</em></h1>
        </div>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-12">
        <div className="space-y-10 lg:col-span-7">
          <Block title="1 · Ground truth">
            <p>Daily mean PM2.5 from every Indian monitor on OpenAQ v3 (CPCB, state boards, and community sensors). A day is kept only if at least {gt.min_hours_per_day ?? 16} hourly readings sit behind the mean and the value is between 1 and 1,500 µg/m³. We do not interpolate gaps.</p>
            <p className="num text-xs text-ink-3">{gt.stations ? `${fmt(gt.stations as number)} monitors · ${fmt(gt.location_days as number)} station-days · ${gt.date_min} to ${gt.date_max} · ${fmt(gt.city_groups as number)} city groups` : 'Loading…'}</p>
          </Block>
          <Block title="2 · Features for any point in India, no key needed">
            <p>For each monitor and each of the 735 district centroids we pull, from Open-Meteo, the Copernicus CAMS global atmospheric composition model (hourly PM2.5, PM10, aerosol optical depth, dust: satellite-assimilated, ~40 km grid) and ERA5 daily weather (temperature, wind, rain, humidity, pressure). Hourly values become daily means and maxima, plus yesterday's values. Static features: latitude, longitude, elevation, season.</p>
          </Block>
          <Block title="3 · The model">
            <p>{metrics?.model ?? 'LightGBM regression on log1p(PM2.5)'}. Gradient-boosted trees on a log target handle the long right tail of pollution days; the quantile models give an interval instead of a single number.</p>
            {metrics && <p className="num text-xs text-ink-3">{Object.entries(metrics.params).map(([k, v]) => `${k}=${String(v)}`).join(' · ')} · seed {metrics.seed}</p>}
          </Block>
          <Block title="4 · Leave-cities-out validation">
            <p>Random train/test splits would let the model see Delhi on Monday and be tested on Delhi on Tuesday, which is not the question. We group every monitor by city (nearest city of 100k+ within 30 km, else a 0.25° cell) and use GroupKFold so each test fold contains cities absent from training. The CAMS baseline is scored on the same rows. Reported on the <a className="underline" href="/accuracy">Accuracy</a> page with per-fold and per-city breakdowns.</p>
          </Block>
          <Block title="5 · Monitor placement">
            <p>Candidates are towns of 50,000+ with no monitor within 25 km. Score = log₁₀(population) × (district uncertainty ÷ national median) × min(km to nearest monitor ÷ 50, 3), chosen greedily so each pick counts as a monitor for later picks.</p>
          </Block>
          <Block title="6 · What it cannot do">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>It is a district-scale daily estimate, not a street-level or hourly reading. A 40 km CAMS grid cannot see a single factory or a traffic corridor.</li>
              <li>It is only as good as the monitors it learns from. Rural and Northeast India have few, so predictions there are extrapolations; the error bars are wider for that reason, but they are still model estimates.</li>
              <li>Training covers {metrics ? `${metrics.date_min} to ${metrics.date_max}` : 'about 90 days'} because the free Open-Meteo air-quality archive serves 92 days. Winter in the Indo-Gangetic plain is harder than the monsoon; accuracy will look different in January.</li>
              <li>Monitor placement optimises one defensible objective; a real siting study also needs land, power, and who will maintain the instrument.</li>
              <li>Nothing on this site is a regulatory measurement. It is a tool for deciding where to look and where to measure next.</li>
            </ul>
          </Block>
          <Block title="7 · Reproduce it">
            <pre className="num overflow-x-auto rounded-xl bg-ink p-4 text-xs leading-relaxed text-cream"><code>{`git clone https://github.com/akshitabiju/AirGap && cd AirGap
pip install -r ml/requirements.txt
echo <OPENAQ_API_KEY> > ../openaq.key      # free key from openaq.org
python ml/run_all.py                       # fetch, train, predict, place (~15 min)
npm install && npm run dev`}</code></pre>
          </Block>
        </div>

        <aside className="lg:col-span-5">
          <div className="card sticky top-20 p-5">
            <div className="eyebrow mb-3">Data sources &amp; licences</div>
            <ul className="divide-y divide-line text-sm">
              {(meta?.sources ?? []).map((s) => (
                <li key={s.name} className="py-3">
                  <a href={s.url} target="_blank" rel="noreferrer" className="flex items-start justify-between gap-2 font-medium hover:underline">{s.name}<ExternalLink size={13} className="mt-1 shrink-0 text-ink-3" /></a>
                  <p className="mt-0.5 text-xs text-ink-2">{s.role}</p>
                  <p className="mt-0.5 text-[11px] text-ink-3">{s.licence}</p>
                </li>
              ))}
              {!meta && <li className="py-3 text-ink-3">Loading…</li>}
            </ul>
            <div className="eyebrow mb-2 mt-5">Architecture</div>
            <ol className="num space-y-1 text-xs text-ink-2">
              <li>Python pipeline (fetch → LightGBM → GeoJSON) runs locally or on a schedule.</li>
              <li>Static site: Vite/React, served from Amazon S3 behind CloudFront.</li>
              <li>Live point prediction: AWS Lambda (Python) loads the model, fetches today's features from Open-Meteo for any lat/lon, returns value + 68 % interval via a Function URL.</li>
            </ol>
            {meta && <p className="num mt-5 text-[11px] text-ink-3">Build {meta.generated_at.slice(0, 16).replace('T', ' ')} UTC · predictions for {meta.prediction_date} · {fmt(meta.n_districts)} districts · {fmt(meta.n_stations)} monitors</p>}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  )
}
