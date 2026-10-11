"""Step 2: build daily feature rows from Open-Meteo for stations and districts.

Usage
  python ml/fetch_features.py stations    -> data/features_stations.parquet
  python ml/fetch_features.py districts   -> data/features_districts.parquet
                                             data/districts_meta.json

Features per (point, day)
  CAMS air-quality model (satellite-assimilated, Copernicus via Open-Meteo):
    cams_pm25_mean/max, cams_pm10_mean, aod_mean/max, dust_mean,
    cams_pm25_lag1 (previous day's mean)
  ERA5 weather archive (Open-Meteo):
    tmax, tmin, wind_max, wind_dir, precip, rh, pressure, wind_max_lag1
  Static: lat, lon, elevation, doy_sin, doy_cos, month

All calls are batched (BATCH points per request) and cached on disk, so
re-runs are free. Nothing is fabricated: a point-day with a missing CAMS
value is dropped and counted.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import sys
import time

import numpy as np
import pandas as pd
from shapely.geometry import shape

from common import DATA, RAW, HISTORY_DAYS, TZ, cache_key, cached_json, get_logger, http_get_json, write_json

log = get_logger("features")
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WX_URL = "https://archive-api.open-meteo.com/v1/archive"
BATCH = 25
HOURLY = "pm2_5,pm10,aerosol_optical_depth,dust"
DAILY = ("temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,"
         "precipitation_sum,relative_humidity_2m_mean,surface_pressure_mean")


PARTIAL = "--partial" in sys.argv   # skip batches not yet cached (rate-limit recovery)


def _cached_exists(key: str) -> bool:
    from common import CACHE
    return (CACHE / f"{key}.json").exists()


def fetch_aq(points: list[tuple[float, float]]) -> list[dict]:
    lat = ",".join(f"{p[0]:.4f}" for p in points)
    lon = ",".join(f"{p[1]:.4f}" for p in points)
    key = "aq_" + cache_key(lat, lon, HOURLY, HISTORY_DAYS, dt.date.today())
    if PARTIAL and not _cached_exists(key):
        return []
    def _f():
        d = http_get_json(AQ_URL, {"latitude": lat, "longitude": lon, "hourly": HOURLY,
                                   "past_days": HISTORY_DAYS, "forecast_days": 1, "timezone": TZ},
                          timeout=120, min_interval=0.6)
        return d if isinstance(d, list) else [d]
    return cached_json(key, _f)


def fetch_wx(points: list[tuple[float, float]], start: dt.date, end: dt.date) -> list[dict]:
    lat = ",".join(f"{p[0]:.4f}" for p in points)
    lon = ",".join(f"{p[1]:.4f}" for p in points)
    key = "wx_" + cache_key(lat, lon, DAILY, start, end)
    if PARTIAL and not _cached_exists(key):
        return []
    def _f():
        d = http_get_json(WX_URL, {"latitude": lat, "longitude": lon, "daily": DAILY,
                                   "start_date": start.isoformat(), "end_date": end.isoformat(), "timezone": TZ},
                          timeout=120, min_interval=0.6)
        return d if isinstance(d, list) else [d]
    return cached_json(key, _f)


def aq_daily(aq: dict) -> pd.DataFrame:
    h = aq["hourly"]
    df = pd.DataFrame({"time": pd.to_datetime(h["time"]), "pm25": h["pm2_5"], "pm10": h["pm10"],
                       "aod": h["aerosol_optical_depth"], "dust": h["dust"]})
    df["date"] = df["time"].dt.strftime("%Y-%m-%d")
    g = df.groupby("date")
    out = pd.DataFrame({
        "cams_pm25_mean": g["pm25"].mean(), "cams_pm25_max": g["pm25"].max(),
        "cams_pm10_mean": g["pm10"].mean(), "aod_mean": g["aod"].mean(), "aod_max": g["aod"].max(),
        "dust_mean": g["dust"].mean(), "n_hours": g["pm25"].count(),
    }).reset_index()
    out = out[out["n_hours"] >= 18].copy()
    out["cams_pm25_lag1"] = out["cams_pm25_mean"].shift(1)
    return out


def wx_daily(wx: dict) -> pd.DataFrame:
    d = wx["daily"]
    out = pd.DataFrame({
        "date": d["time"], "tmax": d["temperature_2m_max"], "tmin": d["temperature_2m_min"],
        "wind_max": d["wind_speed_10m_max"], "wind_dir": d["wind_direction_10m_dominant"],
        "precip": d["precipitation_sum"], "rh": d["relative_humidity_2m_mean"],
        "pressure": d["surface_pressure_mean"],
    })
    out["wind_max_lag1"] = out["wind_max"].shift(1)
    return out


def build(points: list[dict], id_key: str) -> pd.DataFrame:
    """points: dicts with id_key, lat, lon."""
    today = dt.date.today()
    start = today - dt.timedelta(days=HISTORY_DAYS)
    frames, dropped, skipped = [], 0, 0
    t0 = time.time()
    for b in range(0, len(points), BATCH):
        chunk = points[b:b + BATCH]
        coords = [(p["lat"], p["lon"]) for p in chunk]
        aqs = fetch_aq(coords)
        wxs = fetch_wx(coords, start, today)
        if PARTIAL and (not aqs or not wxs):
            skipped += len(chunk)
            log.warning("partial mode: skipping uncached batch at %d (%d points)", b, len(chunk))
            continue
        if len(aqs) != len(chunk) or len(wxs) != len(chunk):
            raise RuntimeError(f"batch size mismatch at {b}: {len(aqs)} aq / {len(wxs)} wx for {len(chunk)} points")
        for p, aq, wx in zip(chunk, aqs, wxs):
            a = aq_daily(aq)
            w = wx_daily(wx)
            m = a.merge(w, on="date", how="inner")
            before = len(m)
            m = m.dropna(subset=["cams_pm25_mean", "aod_mean", "tmax", "wind_max"])
            dropped += before - len(m)
            m[id_key] = p[id_key]
            m["lat"], m["lon"] = p["lat"], p["lon"]
            m["elevation"] = aq.get("elevation", 0.0)
            frames.append(m)
        log.info("%d/%d points (%.0fs)", min(b + BATCH, len(points)), len(points), time.time() - t0)
    df = pd.concat(frames, ignore_index=True)
    doy = pd.to_datetime(df["date"]).dt.dayofyear
    df["doy_sin"], df["doy_cos"] = np.sin(2 * np.pi * doy / 365.25), np.cos(2 * np.pi * doy / 365.25)
    df["month"] = pd.to_datetime(df["date"]).dt.month
    log.info("built %d point-days; dropped %d incomplete; skipped %d points (partial mode)", len(df), dropped, skipped)
    if skipped:
        log.warning("PARTIAL DATA: %d points missing. Re-run without --partial once the API limit resets.", skipped)
    return df


def district_points() -> list[dict]:
    """Representative point (interior) for each ADM2 district + area."""
    gj = json.loads((RAW / "districts_adm2.geojson").read_text(encoding="utf-8"))
    pts = []
    for i, f in enumerate(gj["features"]):
        geom = shape(f["geometry"])
        rp = geom.representative_point()
        pts.append({"district_id": i, "name": f["properties"]["shapeName"], "shape_id": f["properties"]["shapeID"],
                    "lat": round(rp.y, 4), "lon": round(rp.x, 4),
                    "area_km2": round(geom.area * 111.32 * 111.32 * math.cos(math.radians(rp.y)), 1)})
    return pts


def main(target: str) -> None:
    if target == "stations":
        st = json.loads((DATA / "stations.json").read_text(encoding="utf-8"))
        pts = [{"location_id": s["id"], "lat": s["lat"], "lon": s["lon"]} for s in st]
        df = build(pts, "location_id")
        df.to_parquet(DATA / "features_stations.parquet", index=False)
    elif target == "districts":
        pts = district_points()
        write_json(DATA / "districts_meta.json", pts)
        df = build(pts, "district_id")
        df.to_parquet(DATA / "features_districts.parquet", index=False)
    else:
        raise SystemExit("usage: fetch_features.py stations|districts")
    log.info("DONE %s: %d rows -> data/features_%s.parquet", target, len(df), target)


if __name__ == "__main__":
    main(next((a for a in sys.argv[1:] if not a.startswith("--")), "districts"))
