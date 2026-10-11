"""Step 4: predict PM2.5 (+ 68 % interval) for all 735 districts.

Outputs (served by the web app)
  public/data/districts.geojson   geometry + prediction per district (simplified)
  public/data/stations.json       monitors with their latest daily value
  public/data/cities.json         search index (name, lat, lon, pop)
  public/data/meta.json           build info + data sources/licences
  data/district_predictions.csv   used by placement.py
"""
from __future__ import annotations

import datetime as dt
import json

import lightgbm as lgb
import numpy as np
import pandas as pd
from shapely.geometry import Point, mapping, shape
from shapely.strtree import STRtree

from common import DATA, PUBLIC_DATA, RAW, get_logger, haversine_km, load_cities, write_json
from train import FEATURES

log = get_logger("predict")
SIMPLIFY_DEG = 0.012      # ~1.3 km; keeps the 735-district file under ~1.5 MB
COORD_DECIMALS = 3

SOURCES = [
    {"name": "OpenAQ v3 (CPCB, DPCC and other providers)", "url": "https://openaq.org", "licence": "CC BY 4.0", "role": "Ground-truth daily PM2.5 at monitors"},
    {"name": "Copernicus CAMS global atmospheric composition, via Open-Meteo Air Quality API", "url": "https://open-meteo.com/en/docs/air-quality-api", "licence": "CC BY 4.0 (Open-Meteo); Copernicus licence", "role": "Satellite-assimilated PM2.5, PM10, aerosol optical depth, dust (features + baseline)"},
    {"name": "ERA5 reanalysis, via Open-Meteo Historical Weather API", "url": "https://open-meteo.com/en/docs/historical-weather-api", "licence": "CC BY 4.0 (Open-Meteo); Copernicus licence", "role": "Daily weather features"},
    {"name": "geoBoundaries IND ADM2", "url": "https://www.geoboundaries.org", "licence": "CC BY 4.0", "role": "District polygons (735)"},
    {"name": "GeoNames cities (pop >= 1,000)", "url": "https://www.geonames.org", "licence": "CC BY 4.0", "role": "City locations and population for search and monitor placement"},
    {"name": "OpenFreeMap / OpenStreetMap", "url": "https://openfreemap.org", "licence": "ODbL (OSM data)", "role": "Basemap tiles"},
]


def main() -> None:
    fx = pd.read_parquet(DATA / "features_districts.parquet")
    meta = json.loads((DATA / "districts_meta.json").read_text(encoding="utf-8"))
    stations = json.loads((DATA / "stations.json").read_text(encoding="utf-8"))
    gt = pd.read_parquet(DATA / "ground_truth.parquet")
    gj = json.loads((RAW / "districts_adm2.geojson").read_text(encoding="utf-8"))

    model = lgb.Booster(model_file=str(DATA / "model.txt"))
    q16 = lgb.Booster(model_file=str(DATA / "model_q16.txt"))
    q84 = lgb.Booster(model_file=str(DATA / "model_q84.txt"))

    fx = fx.dropna(subset=FEATURES).copy()
    fx["pred"] = np.expm1(model.predict(fx[FEATURES]))
    fx["lo"] = np.expm1(q16.predict(fx[FEATURES]))
    fx["hi"] = np.expm1(q84.predict(fx[FEATURES]))
    scale = json.loads((DATA / "calibration.json").read_text(encoding="utf-8"))["interval_scale"]
    fx["lo"] = fx["pred"] - scale * (fx["pred"] - fx["lo"]).clip(lower=0)
    fx["hi"] = fx["pred"] + scale * (fx["hi"] - fx["pred"]).clip(lower=0)
    fx["unc"] = (fx["hi"] - fx["lo"]) / 2
    log.info("interval scale (from CV calibration): %.2f", scale)

    # Prediction date = the most recent date for which most districts have complete features.
    counts = fx.groupby("date").size()
    pred_date = counts[counts >= 0.9 * len(meta)].index.max()
    prev_date = (pd.Timestamp(pred_date) - pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    log.info("prediction date %s (%d districts), previous %s", pred_date, counts[pred_date], prev_date)
    today = fx[fx["date"] == pred_date].set_index("district_id")
    prev = fx[fx["date"] == prev_date].set_index("district_id")

    # Latest observed value per station (for the map + nearest-monitor context).
    last = gt.sort_values("date").groupby("location_id").tail(1).set_index("location_id")
    st_pts = np.array([[s["lat"], s["lon"]] for s in stations])
    for s in stations:
        row = last.loc[s["id"]] if s["id"] in last.index else None
        s["last_value"] = round(float(row["pm25"]), 1) if row is not None else None
        s["last_date"] = str(row["date"]) if row is not None else None

    # Largest GeoNames city inside each district (for population context).
    cities = load_cities()
    polys = [shape(f["geometry"]) for f in gj["features"]]
    tree = STRtree(polys)
    biggest: dict[int, dict] = {}
    for c in cities:
        hits = tree.query(Point(c["lon"], c["lat"]), predicate="within")
        for i in hits:
            if i not in biggest or c["pop"] > biggest[i]["pop"]:
                biggest[int(i)] = c

    feats, rows = [], []
    for m in meta:
        i = m["district_id"]
        t = today.loc[i] if i in today.index else None
        p = prev.loc[i] if i in prev.index else None
        d = np.sqrt(((st_pts - np.array([m["lat"], m["lon"]])) ** 2).sum(axis=1))
        j = int(d.argmin())
        near_km = haversine_km(m["lat"], m["lon"], stations[j]["lat"], stations[j]["lon"])
        props = {
            "id": i, "name": m["name"], "lat": m["lat"], "lon": m["lon"], "date": str(pred_date),
            "pred": round(float(t["pred"]), 1) if t is not None else None,
            "unc": round(float(t["unc"]), 1) if t is not None else None,
            "cams": round(float(t["cams_pm25_mean"]), 1) if t is not None else None,
            "pred_prev": round(float(p["pred"]), 1) if p is not None else None,
            "nearest_km": round(near_km, 1), "nearest_name": stations[j]["name"],
            "pop": int(biggest[i]["pop"]) if i in biggest else None,
            "city": biggest[i]["name"] if i in biggest else None,
        }
        geom = polys[i].simplify(SIMPLIFY_DEG, preserve_topology=True)
        g = mapping(geom)
        g = {"type": g["type"], "coordinates": _round(g["coordinates"])}
        feats.append({"type": "Feature", "id": i, "geometry": g, "properties": props})
        rows.append({**props, "unc_rel": (props["unc"] / props["pred"]) if props["pred"] else None})

    fc = {"type": "FeatureCollection", "features": feats}
    write_json(PUBLIC_DATA / "districts.geojson", fc, compact=True)
    size_mb = (PUBLIC_DATA / "districts.geojson").stat().st_size / 1e6
    log.info("districts.geojson: %d features, %.2f MB", len(feats), size_mb)

    write_json(PUBLIC_DATA / "stations.json", stations, compact=True)
    search = sorted(cities, key=lambda c: -c["pop"])[:2500]
    write_json(PUBLIC_DATA / "cities.json", [{"name": c["name"], "lat": c["lat"], "lon": c["lon"], "pop": c["pop"]} for c in search], compact=True)
    pd.DataFrame(rows).to_csv(DATA / "district_predictions.csv", index=False)

    summary = json.loads((DATA / "ground_truth_summary.json").read_text(encoding="utf-8"))
    preds = [r["pred"] for r in rows if r["pred"] is not None]
    write_json(PUBLIC_DATA / "meta.json", {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "prediction_date": str(pred_date), "n_districts": len(feats), "n_districts_predicted": len(preds),
        "n_stations": len(stations), "ground_truth": summary, "sources": SOURCES,
        "district_pred_median": float(np.median(preds)), "district_pred_max": float(np.max(preds)),
        "districts_over_60": int(sum(1 for v in preds if v > 60)), "districts_over_15": int(sum(1 for v in preds if v > 15)),
        "districts_no_monitor_50km": int(sum(1 for r in rows if r["nearest_km"] > 50)),
    })
    log.info("DONE: %d districts predicted; median %.1f; %d districts > 60 µg/m³; %d districts > 50 km from a monitor",
             len(preds), float(np.median(preds)), sum(1 for v in preds if v > 60), sum(1 for r in rows if r["nearest_km"] > 50))


def _round(coords):
    if isinstance(coords, (int, float)):
        return round(coords, COORD_DECIMALS)
    return [_round(c) for c in coords]


if __name__ == "__main__":
    main()
