# Build "AirGap" — PM2.5 for the 90% of India with no air-quality monitor

Act as a senior ML engineer, geospatial developer, product designer and AWS architect. Build a complete, working, honest hackathon project in the folder `C:\Users\bijud\code\airgap` (already scaffolded: Vite + React + TypeScript, Tailwind v4, lucide-react, maplibre-gl, zustand installed; git initialised with remote https://github.com/akshitabiju/Terra-Scope-.git; `data/india_cities.json` has 3,780 Indian cities with lat/lon/population from GeoNames). Python 3.13 has scikit-learn, lightgbm, pandas, numpy, requests installed.

Hackathon: MakeDevs (Kunal Kushwaha), Track 1 — Air. Solo participant. Deadline: tonight. Prizes judged on: real environmental problem, working product with real data, genuine AWS integration, polish, 3-minute demo.

## 1. The problem and the claim
India has roughly 500 government PM2.5 monitors for 1.4 billion people; most districts have none. AirGap (a) predicts daily PM2.5 for every Indian district from satellite-assimilated aerosol + weather, (b) proves it with a held-out-city validation and a published error, and (c) recommends where the next 20 monitors should go (highest population × highest model uncertainty × farthest from an existing monitor). It is a decision tool for pollution control boards, not a dashboard.

Every number shown must be real or clearly labelled an estimate. Never fabricate readings, stations, accuracy figures or datasets.

## 2. Data (all verified working on 2026-10-11)
- **Ground truth:** OpenAQ v3 API (`https://api.openaq.org/v3/`, header `X-API-Key`). India `countries_id=9`. Use locations + sensors + measurements/days endpoints to get daily PM2.5 means for Indian stations for the last ~90 days. The key is in `C:\Users\bijud\code\openaq.key` (read it from the file; never print it, never commit it; add to .gitignore). Respect rate limits with backoff; paginate.
- **Features, any lat/lon, no key:**
  - Open-Meteo Air Quality (CAMS, satellite-assimilated): `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=..&longitude=..&hourly=pm2_5,pm10,aerosol_optical_depth,dust&past_days=92&forecast_days=1&timezone=Asia%2FKolkata` (returns 2,232 hourly rows). Use AOD, dust, and CAMS pm2_5 as features; label CAMS as "model baseline" and show that our model beats it on held-out cities (if it does — report truthfully either way).
  - Open-Meteo Archive weather: `https://archive-api.open-meteo.com/v1/archive?latitude=..&longitude=..&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&daily=temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_sum,relative_humidity_2m_mean&timezone=Asia%2FKolkata`.
  - Static: lat, lon, elevation (Open-Meteo returns it), day-of-year, month, city population from GeoNames.
- **Boundaries:** geoBoundaries India ADM2 simplified GeoJSON (735 districts): `https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IND/ADM2/geoBoundaries-IND-ADM2_simplified.geojson` (CC BY). Property `shapeName`. Read it with UTF-8. Simplify further for the web (target < 1.5 MB).
- **Basemap:** OpenFreeMap `https://tiles.openfreemap.org/styles/positron` (free, no key). Do NOT use CARTO tiles (they now require a key and watermark).
- Known gotcha: MapLibre's web worker fails under some bundlers — if the map is blank with "Worker failed to load", copy `node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs` to `public/` and call `setWorkerUrl('/maplibre-gl-worker.mjs')`. With Vite this is usually unnecessary; test first.

## 3. ML pipeline (`ml/` folder, Python)
1. `fetch_openaq.py` — pull Indian PM2.5 stations and daily means (last 90 days), save `data/ground_truth.parquet` and `data/stations.json` (id, name, lat, lon, city).
2. `fetch_features.py` — for each station and each of the 735 district centroids, pull Open-Meteo AQ + archive weather; cache responses on disk; build daily feature rows.
3. `train.py` — LightGBM regressor on log(PM2.5). Validation = **leave-cities-out** (GroupKFold by city, 5 folds) so the metric is "cities the model never saw". Report MAE, RMSE, R², and compare against the CAMS pm2_5 baseline. Save `data/metrics.json` (with fold details), `data/model.txt`, feature importances.
4. `predict_districts.py` — predict yesterday's and today's PM2.5 for all 735 districts with an uncertainty estimate (e.g. std of fold models or quantile models). Save `public/data/districts.geojson` (geometry + name + pred + uncertainty + nearest_monitor_km + population if available) and `public/data/stations.json`.
5. `placement.py` — greedy selection of the next 20 monitor sites: score = population-weighted uncertainty × distance-to-nearest-monitor penalty, from `data/india_cities.json` restricted to cities with no monitor within 25 km. Save `public/data/placement.json` with the reasoning per site.
6. Everything must be re-runnable with `python ml/run_all.py`. Log counts and failures; do not silently drop data.

## 4. Web app (Vite + React + TS)
Pages (client-side routing):
- **/** Landing: one-screen explanation of the gap, the live India map (districts coloured by predicted PM2.5, stations as small marks), a hover/click panel with predicted value ± uncertainty, nearest monitor distance, and "how we know". Legend, search (filter from `india_cities.json`), loading/error/empty states.
- **/accuracy** The evidence page: held-out-city metrics, a scatter of predicted vs observed for held-out cities, per-city table, honest comparison with the CAMS baseline, and a plain-language "what this error means".
- **/placement** The next-20-monitors recommendation: ranked list + map, with the score breakdown per site.
- **/method** Data sources with licence, update time, resolution, limitations; the leave-cities-out explanation; what the model cannot do.

Design: warm cream background (#f5efe4-ish), deep forest green accents, restrained earthy palette, editorial typography (e.g. Fraunces for headlines + a clean sans body), generous spacing, thin borders, Lucide icons only — **no emojis anywhere**, no neon, no gradients-everywhere, nothing that looks AI-generated. Smooth restrained animations. Responsive. Make every control work.

## 5. AWS (mandatory, genuine)
- Static hosting: S3 bucket + CloudFront distribution for the built site.
- A Python **Lambda** behind a Function URL that loads `model.txt` and returns a prediction + uncertainty for any `?lat=&lon=` by fetching Open-Meteo features live (this is the real integration: anyone can query a point with no monitor). The web app's detail panel calls it when `VITE_PREDICT_URL` is set, and falls back to the precomputed district value when not.
- Write `infra/deploy.sh` (AWS CLI, idempotent) and `infra/README.md`. Credentials are not available yet: build everything to run locally first, and never claim deployment succeeded until it is verified with `aws sts get-caller-identity` and a live URL.

## 6. Delivery
- README: problem, who benefits, data sources + licences, method, validation results (real numbers from `metrics.json`), limitations, AWS architecture, setup, deploy.
- `.env.example`, `.gitignore` (include `openaq.key`, `data/*.parquet`, caches, node_modules).
- `npm run build` and `tsc` must pass. Basic tests for the scoring/placement logic.
- Commit in small steps; push to the GitHub remote when the first end-to-end version works.
- `DEMO.md`: a 2.5-minute demo script with timed narration lines the presenter will record in their own voice.

## 7. Execution order
1. Read the OpenAQ key, fetch stations + ground truth. Report how many stations/days you got before continuing.
2. Fetch features, train, print the held-out metrics. If R² is poor, say so and improve features — do not hide it.
3. Predictions + placement JSON.
4. Web app: map first, then accuracy, placement, method.
5. AWS scripts + Lambda, README, DEMO.md, build check, push.

Make decisions without asking about minor details. If something cannot be done honestly in time, cut it and say so in the README.
