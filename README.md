# AirGap

**PM2.5 for the districts India doesn't measure.**

Live: **https://main.d3cvwqcst393r5.amplifyapp.com** · Live model endpoint: `https://2gd4u767a54mvulo4cqwsnhshq0iwbjh.lambda-url.ap-south-1.on.aws/?lat=26.9&lon=75.8`

India has roughly 600 PM2.5 monitors reporting publicly for 1.4 billion people. Most of its 735 districts have none. AirGap learns from the monitors that exist, reads today's satellite-assimilated aerosol and weather for every district, and publishes:

1. a daily PM2.5 estimate with an honest error bar for all 735 districts,
2. proof: the error on **cities the model never saw**, next to the raw satellite model's error on the same rows,
3. a ranked list of **where the next 20 monitors should go**.

It is a decision tool for pollution control boards and civic groups, not another dashboard of the same 600 stations.

Built solo for MakeDevs (Track 1: Air), 11 October 2026. Everything is open data; nothing is fabricated; every number on the site is produced by `python ml/run_all.py`.

## What it shows

| Page | What you get |
|---|---|
| `/` | **My Air**, in English or Hindi: use the browser's location or search a town, pick who you are (healthy adult, asthma/heart/60+, child, outdoor worker) and get today's estimate for your district with plain-language guidance adapted from CPCB health advisories, a cigarettes-per-day equivalent, and the next three days. Stored on your device only. India map coloured by predicted 24-h PM2.5 for every district on a street-level basemap (zoom to roads and towns); monitors are coloured by their latest measured value, with hover popups. **Timeline scrubber** replays the last 92 days across the whole country and runs **three days into the future** (same model on CAMS + weather forecasts, labelled as forecast); My Air shows today plus the next three days with intervals and a worse/better trend; **view modes** switch to model uncertainty or distance-to-nearest-monitor. Hover for value ± 68 % interval, satellite baseline, WHO/India multiples and a cigarettes-per-day equivalent; a 92-day sparkline per district. Search any town. Click to pin and (when deployed) query the live AWS model for that point. |
| `/accuracy` | Leave-cities-out validation: MAE, RMSE, R², share within ±15 µg/m³, interval coverage. Predicted-vs-observed scatter, per-fold and per-city tables, each against the CAMS baseline. Plain-language "what the error means". |
| `/placement` | The next 20 monitor sites with the score breakdown per site (people × uncertainty × distance), on a map. |
| `/method` | Sources, licences, model, validation design, limitations, how to reproduce. |

## Results (held-out cities, this build)

Numbers below are copied from `public/data/metrics.json`, which the pipeline regenerates. Validation is GroupKFold(5) by city: each test fold contains only cities absent from training. The Copernicus CAMS PM2.5 value (the satellite-assimilated model we build on) is scored on the identical rows.

| Metric | AirGap | CAMS baseline |
|---|---|---|
| Mean absolute error (µg/m³) | **10.2** | 16.0 |
| RMSE (µg/m³) | **16.0** | 25.5 |
| R² | **0.28** | −0.83 |
| Share of station-days within ±15 µg/m³ | **80 %** | 64 % |
| 68 % interval coverage (raw quantile models → after CV calibration) | 48 % → **68 %** | n/a |

Per fold (MAE, AirGap vs CAMS): 9.8 vs 18.1 · 10.5 vs 14.6 · 8.7 vs 14.8 · 11.7 vs 17.7 · 10.4 vs 14.9. AirGap wins every fold.

Training set: 39,695 station-days from 571 monitors in 306 city groups, 2026-07-12 to 2026-10-10. That is monsoon and early post-monsoon, when PM2.5 is low (median observed 24 µg/m³) and comparatively flat, which is why R² is modest even though the error is 36 % below the satellite baseline. Winter in the Indo-Gangetic plain will read differently, and the pipeline is built to be re-run then.

What this means: on a district with no monitor, the map's number is typically within about 10 µg/m³ of what a monitor would have read. That is enough to tell a clean day from a bad one; it is not a regulatory measurement.

## Data (all open, all fetched live by the pipeline)

| Source | Used for | Licence |
|---|---|---|
| [OpenAQ v3](https://openaq.org) (CPCB, state boards, AirGradient, others) | Ground-truth daily PM2.5 at 571 Indian monitors, last 92 days | CC BY 4.0 |
| [Copernicus CAMS](https://atmosphere.copernicus.eu) via [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) | Hourly PM2.5, PM10, aerosol optical depth, dust for any lat/lon (features + baseline) | CC BY 4.0 / Copernicus |
| ERA5 via [Open-Meteo Historical API](https://open-meteo.com/en/docs/historical-weather-api) | Daily temperature, wind, rain, humidity, pressure | CC BY 4.0 / Copernicus |
| [geoBoundaries](https://www.geoboundaries.org) IND ADM2 | 735 district polygons | CC BY 4.0 |
| [GeoNames](https://www.geonames.org) | 3,780 Indian cities with population (search + placement) | CC BY 4.0 |
| [OpenFreeMap](https://openfreemap.org) / OpenStreetMap | Basemap tiles | ODbL |

Only OpenAQ needs a key (free). Everything else is keyless.

## Method

- **Target**: log1p(daily mean PM2.5). **Model**: LightGBM, 700 trees, lr 0.03, 31 leaves, seed 42. Two extra quantile models (0.16, 0.84) give a central 68 % interval; a single multiplier fitted out-of-fold scales that interval so its held-out coverage is actually 68 % (`data/calibration.json`).
- **Features** (21): CAMS PM2.5 mean/max, PM10, AOD mean/max, dust, yesterday's CAMS PM2.5; tmax, tmin, max wind, wind direction, rain, humidity, pressure, yesterday's max wind; lat, lon, elevation, season (sin/cos), month.
- **Validation**: GroupKFold(5) by `city_group` (nearest GeoNames city ≥100k within 30 km, else a 0.25° cell), so metros are never split across train and test.
- **Placement**: candidates are towns ≥50k with no monitor within 25 km; score = log₁₀(pop) × (district uncertainty ÷ median) × min(km to nearest monitor ÷ 50, 3); greedy, with each pick counting as a monitor for later picks.

## Limitations (also on the site)

- District-scale, daily. A 40 km CAMS grid can't see one factory or one road.
- Only as good as the monitor network it learns from; the Northeast and rural interiors are extrapolations with wider (but still modelled) error bars.
- 92 days of history, monsoon season. Winter will be harder.
- Placement optimises one defensible objective; real siting also needs land, power and maintenance.

## Architecture

```
ml/            Python pipeline: fetch_openaq → fetch_features → train → predict_districts → placement
public/data/   generated outputs the site reads (districts.geojson, metrics.json, placement.json, ...)
src/           Vite + React + TypeScript + Tailwind v4 + MapLibre (OpenFreeMap tiles)
infra/         AWS: Lambda handler + deploy.sh (S3 + CloudFront + Lambda Function URL)
```

**AWS**: the built site is served over HTTPS by **AWS Amplify Hosting** (manual zip deploy, `infra/deploy_amplify.sh`); the S3 + CloudFront path in `infra/deploy.sh` also works on accounts that AWS has verified for CloudFront (new accounts are blocked from creating distributions until Support verifies them). A **Python 3.12 Lambda behind a public Function URL** (ap-south-1) answers `GET /?lat=&lon=` for any point in India by fetching today's CAMS + weather from Open-Meteo and evaluating the LightGBM models with a dependency-free evaluator (`ml/lgb_pure.py`, verified equal to lightgbm in tests). The site calls it when a district is pinned (`VITE_PREDICT_URL` is baked in at build time) and falls back to the precomputed district value. See [`infra/README.md`](infra/README.md).

## Run it

```bash
# 1. Python pipeline (Python 3.11+)
pip install -r ml/requirements.txt
echo <OPENAQ_API_KEY> > ../openaq.key          # or export OPENAQ_API_KEY=...
python ml/run_all.py                          # ~15 min first time; all fetches are cached
python ml/test_pipeline.py                    # tests

# 2. Site
npm install
npm run dev                                   # http://localhost:5173
npm run build                                 # tsc + vite build → dist/

# 3. AWS (optional)
aws configure
infra/deploy.sh
```

Rate limits: OpenAQ allows 60 requests/min; Open-Meteo's free tier has an hourly cap that a full first run can hit. Both fetchers back off and cache, so re-running `python ml/run_all.py` resumes where it stopped.

## Repo layout

```
ml/common.py            paths, HTTP with backoff, cache, city grouping
ml/fetch_openaq.py      ground truth (OpenAQ v3 /sensors/{id}/days, date_from)
ml/fetch_features.py    Open-Meteo CAMS + ERA5, batched 25 points per call
ml/train.py             LightGBM + GroupKFold + quantile models + calibration → metrics.json
ml/predict_districts.py 735 districts → districts.geojson, stations.json, cities.json, meta.json
ml/placement.py         greedy next-20 monitors → placement.json
ml/lgb_pure.py          pure-Python LightGBM evaluator (used by the Lambda)
ml/test_pipeline.py     tests
infra/lambda/handler.py Lambda: live prediction for any lat/lon
infra/deploy.sh         idempotent AWS deploy (S3, CloudFront, Lambda URL)
src/pages/              Landing (map), Accuracy, Placement, Method
src/components/         IndiaMap, DetailPanel, Search, Legend, Charts, Hero
```

## Licence

Code: MIT (see `LICENSE`). Data outputs inherit their sources' licences listed above.
