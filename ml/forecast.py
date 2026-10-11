"""Step 6: 3-day PM2.5 forecast for every district.

Same trained model, fed *forecast* features: CAMS air-quality forecast and
the Open-Meteo weather forecast (instead of the ERA5 archive used in
training). That is a mild distribution shift, so the UI labels these days
as "forecast" and shows the same calibrated interval.

Output: public/data/forecast.json
  {"generated_at", "base_date", "days": [...], "weather_source",
   "series": {district_id: [[MM-DD, pred, lo, hi, cams], ...]}}
"""
from __future__ import annotations

import datetime as dt
import json
import time

import lightgbm as lgb
import numpy as np
import pandas as pd

from common import DATA, PUBLIC_DATA, TZ, cache_key, cached_json, get_logger, http_get_json, write_json
from fetch_features import DAILY, HOURLY, aq_daily, wx_daily
from train import FEATURES

log = get_logger("forecast")
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WX_URL = "https://api.open-meteo.com/v1/forecast"
BATCH = 25
HORIZON = 3


def fetch_batch(points, today):
    lat = ",".join(f"{p['lat']:.4f}" for p in points)
    lon = ",".join(f"{p['lon']:.4f}" for p in points)
    aq = cached_json("fc_aq_" + cache_key(lat, lon, today), lambda: http_get_json(AQ_URL, {
        "latitude": lat, "longitude": lon, "hourly": HOURLY, "past_days": 1, "forecast_days": HORIZON + 1, "timezone": TZ},
        timeout=120, min_interval=0.6))
    wx = cached_json("fc_wx_" + cache_key(lat, lon, today), lambda: http_get_json(WX_URL, {
        "latitude": lat, "longitude": lon, "daily": DAILY, "past_days": 1, "forecast_days": HORIZON + 1, "timezone": TZ},
        timeout=120, min_interval=0.6))
    aq = aq if isinstance(aq, list) else [aq]
    wx = wx if isinstance(wx, list) else [wx]
    return aq, wx


def main() -> None:
    meta = json.loads((DATA / "districts_meta.json").read_text(encoding="utf-8"))
    today = dt.date.today().isoformat()
    model = lgb.Booster(model_file=str(DATA / "model.txt"))
    q16 = lgb.Booster(model_file=str(DATA / "model_q16.txt"))
    q84 = lgb.Booster(model_file=str(DATA / "model_q84.txt"))
    scale = json.loads((DATA / "calibration.json").read_text(encoding="utf-8"))["interval_scale"]

    frames = []
    t0 = time.time()
    for b in range(0, len(meta), BATCH):
        chunk = meta[b:b + BATCH]
        aqs, wxs = fetch_batch(chunk, today)
        if len(aqs) != len(chunk) or len(wxs) != len(chunk):
            raise RuntimeError(f"batch size mismatch at {b}")
        for p, aq, wx in zip(chunk, aqs, wxs):
            a = aq_daily(aq)
            w = wx_daily(wx)
            m = a.merge(w, on="date", how="inner").dropna(subset=["cams_pm25_mean", "aod_mean", "tmax", "wind_max"])
            m = m[m["date"] > today]
            m["district_id"] = p["district_id"]
            m["lat"], m["lon"], m["elevation"] = p["lat"], p["lon"], aq.get("elevation", 0.0)
            frames.append(m)
        log.info("%d/%d districts (%.0fs)", min(b + BATCH, len(meta)), len(meta), time.time() - t0)
    df = pd.concat(frames, ignore_index=True)
    doy = pd.to_datetime(df["date"]).dt.dayofyear
    df["doy_sin"], df["doy_cos"] = np.sin(2 * np.pi * doy / 365.25), np.cos(2 * np.pi * doy / 365.25)
    df["month"] = pd.to_datetime(df["date"]).dt.month
    df = df.dropna(subset=FEATURES)

    df["pred"] = np.expm1(model.predict(df[FEATURES]))
    lo = np.expm1(q16.predict(df[FEATURES])); hi = np.expm1(q84.predict(df[FEATURES]))
    df["lo"] = df["pred"] - scale * np.clip(df["pred"] - lo, 0, None)
    df["hi"] = df["pred"] + scale * np.clip(hi - df["pred"], 0, None)

    days = sorted(df["date"].unique())[:HORIZON]
    df = df[df["date"].isin(days)]
    series = {}
    for did, g in df.sort_values("date").groupby("district_id"):
        series[int(did)] = [[d[5:], round(float(p), 1), round(float(l), 1), round(float(h), 1), round(float(c), 1)]
                            for d, p, l, h, c in zip(g["date"], g["pred"], g["lo"], g["hi"], g["cams_pm25_mean"])]
    write_json(PUBLIC_DATA / "forecast.json", {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "base_date": today, "days": [str(d) for d in days],
        "weather_source": "Open-Meteo forecast (best-match model); training used ERA5 archive",
        "series": series,
    }, compact=True)
    nat = df.groupby("date")["pred"].median()
    log.info("DONE: %d districts x %d days; national median by day: %s", len(series), len(days),
             ", ".join(f"{d}: {v:.1f}" for d, v in nat.items()))


if __name__ == "__main__":
    main()
