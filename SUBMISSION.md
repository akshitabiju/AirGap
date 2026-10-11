# AirGap · Track 1: Air · Team Axiom

**Live:** https://main.d3cvwqcst393r5.amplifyapp.com
**Code:** https://github.com/akshitabiju/AirGap
**Video:** (YouTube link)

## The problem

PM2.5 is the pollutant that lodges deepest in the lungs and is one of India's largest causes of early death. India has about 570 public PM2.5 monitors, almost all in big cities. **368 of 735 districts have no public monitor within 50 km.** For the people there, at least 85 million in towns alone plus most of rural India, no app can answer the most basic question: *is it safe to go outside today?* A mother with an asthmatic child, a school deciding on outdoor assembly, an outdoor worker, an elderly person with a heart condition: none of them has a number to act on.

## The solution

AirGap gives **every district in India, including the 368 with no monitor, a daily PM2.5 estimate with a checked error bar**, and turns it into decisions:

| For | What they get |
|---|---|
| A person (My Air) | Use location or search any town; pick a profile (healthy adult, asthma/heart/60+, child, outdoor worker). Today's PM2.5 with uncertainty, plain-language advice adapted from CPCB health advisories, cigarettes-per-day equivalent, the cleanest and worst three-hour windows today and tomorrow, a 3-day forecast, one-tap WhatsApp share with a link to the district. English and Hindi. |
| The public (Map) | All 735 districts coloured by today's estimate on a street-level map; 92-day timeline that plays into a 3-day forecast; views for PM2.5, model uncertainty, and distance to the nearest monitor; real monitors with their latest readings; live per-point prediction from AWS when a district is pinned. |
| Regulators (Next 20 monitors) | A ranked list of the 20 towns where a new monitor would help most (population × model uncertainty × distance to nearest monitor, chosen greedily to spread). Number one today: Brahmapur, Odisha, 147 km from the nearest monitor. |
| Everyone (Accuracy) | The error, measured honestly: held-out-city validation, per fold and per city, next to the satellite baseline on identical rows. |

## How it works

1. **Ground truth:** 39,695 daily PM2.5 readings from 571 real monitors (OpenAQ: CPCB, state boards, community sensors), last 92 days.
2. **Features for any point:** Copernicus CAMS satellite-assimilated aerosol (PM2.5, PM10, AOD, dust) and ERA5 weather, via Open-Meteo, keyless.
3. **Model:** LightGBM gradient-boosted trees on log PM2.5, plus quantile models for a 68 % interval, calibrated out-of-fold.
4. **Validation:** leave-cities-out, 5 folds. On cities the model never saw: **MAE 10.2 µg/m³ vs 16.0 for the CAMS satellite baseline (36 % lower), better in every fold; 80 % of days within ±15 µg/m³ vs 64 %; the 68 % interval covers 68 % of real values.**
5. **Outputs:** district predictions, 92-day history, 3-day forecast, hourly profiles, state hotspots, monitor placement. One command regenerates everything: `python ml/run_all.py`.

Everything inferred is labelled as inferred in the interface, with its error bar.

## AWS usage

| Service | Role |
|---|---|
| **AWS Lambda + Function URL** (ap-south-1, Python 3.12) | Live inference endpoint. `GET /?lat=&lon=` fetches today's CAMS and weather features for that exact coordinate from Open-Meteo and evaluates the LightGBM models with a dependency-free evaluator (`ml/lgb_pure.py`, verified equal to lightgbm in tests). ~2 MB package, sub-second warm responses. The site calls it whenever a district is pinned. |
| **AWS Amplify Hosting** | HTTPS hosting and CDN for the static site and its data files (manual zip deploys via `infra/deploy_amplify.sh`). |
| **Amazon S3** | Object store for the built site; the S3 + CloudFront path is scripted in `infra/deploy.sh` for accounts that AWS has verified for CloudFront. |
| **IAM** | Least-privilege execution role for the Lambda. |

Deployment is idempotent and scripted; state lives in `infra/.deploy-state.json`. Usage sits well inside the free tier.

## Data sources and licences

OpenAQ (CC BY 4.0) · Copernicus CAMS and ERA5 via Open-Meteo (CC BY 4.0 / Copernicus licence) · geoBoundaries IND ADM1/ADM2 (CC BY 4.0) · GeoNames (CC BY 4.0) · OpenFreeMap / OpenStreetMap (ODbL).

## Honest limitations

District-scale daily estimates, not street-level measurements. Trained on a monsoon window (low, flat PM2.5), so R² is modest (0.28) even though the error beats the baseline by 36 %; winter will read differently and the pipeline is built to be re-run. Hourly "best hours" use the satellite model's diurnal shape scaled to our daily estimate. Placement optimises one defensible objective; real siting also needs land, power and maintenance.

## Team

Team Axiom. Built solo over the hackathon window.
