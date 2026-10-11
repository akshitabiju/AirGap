"""AirGap predict Lambda: PM2.5 + 68 % interval for any lat/lon in India.

GET /?lat=26.9&lon=75.8  ->  {"pred": 41.2, "lo": 27.0, "hi": 63.1, "cams": 35.4,
                              "date": "2026-10-11", "source": "...", "ms": 812}

Fetches today's CAMS air-quality and weather features live from Open-Meteo
(no key), evaluates the LightGBM models with the pure-Python evaluator in
lgb_pure.py, and returns JSON. No numpy, no lightgbm: ~100 KB package,
sub-second cold start. CORS is open because the site is static.
"""
from __future__ import annotations

import datetime as dt
import json
import math
import os
import time
import urllib.parse
import urllib.request

from lgb_pure import Model

HERE = os.path.dirname(__file__)
MODEL = Model.from_file(os.path.join(HERE, "model.txt"))
Q16 = Model.from_file(os.path.join(HERE, "model_q16.txt"))
Q84 = Model.from_file(os.path.join(HERE, "model_q84.txt"))
with open(os.path.join(HERE, "calibration.json"), encoding="utf-8") as _f:
    INTERVAL_SCALE = float(json.load(_f)["interval_scale"])
TZ = "Asia/Kolkata"
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
WX_ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
WX_FORECAST = "https://api.open-meteo.com/v1/forecast"
DAILY = ("temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,"
         "precipitation_sum,relative_humidity_2m_mean,surface_pressure_mean")
INDIA = (6.0, 37.5, 67.0, 98.0)  # lat min/max, lon min/max


def _get(url: str, params: dict) -> dict:
    req = urllib.request.Request(url + "?" + urllib.parse.urlencode(params), headers={"User-Agent": "AirGap-lambda/0.1"})
    with urllib.request.urlopen(req, timeout=12) as r:
        return json.loads(r.read().decode())


def _mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def build_features(lat: float, lon: float) -> tuple[dict, dict]:
    today = dt.datetime.now(dt.timezone(dt.timedelta(hours=5, minutes=30))).date()
    aq = _get(AQ_URL, {"latitude": lat, "longitude": lon, "hourly": "pm2_5,pm10,aerosol_optical_depth,dust",
                       "past_days": 2, "forecast_days": 1, "timezone": TZ})
    h = aq["hourly"]
    by_day: dict[str, dict[str, list]] = {}
    for i, t in enumerate(h["time"]):
        d = by_day.setdefault(t[:10], {"pm25": [], "pm10": [], "aod": [], "dust": []})
        d["pm25"].append(h["pm2_5"][i]); d["pm10"].append(h["pm10"][i])
        d["aod"].append(h["aerosol_optical_depth"][i]); d["dust"].append(h["dust"][i])
    # Use the latest day with >= 18 hourly CAMS values (today, or yesterday early in the day).
    days = sorted(d for d, v in by_day.items() if sum(x is not None for x in v["pm25"]) >= 18 and d <= today.isoformat())
    if not days:
        raise ValueError("no complete CAMS day available")
    day = days[-1]
    prev = (dt.date.fromisoformat(day) - dt.timedelta(days=1)).isoformat()
    cur, pv = by_day[day], by_day.get(prev)

    try:
        wx = _get(WX_ARCHIVE, {"latitude": lat, "longitude": lon, "daily": DAILY, "start_date": prev, "end_date": day, "timezone": TZ})
        if day not in wx["daily"]["time"] or wx["daily"]["temperature_2m_max"][wx["daily"]["time"].index(day)] is None:
            raise ValueError("archive lags")
        wx_src = "ERA5 archive"
    except Exception:  # noqa: BLE001 - archive can lag a few days; forecast model fills in
        wx = _get(WX_FORECAST, {"latitude": lat, "longitude": lon, "daily": DAILY, "past_days": 2, "forecast_days": 1, "timezone": TZ})
        wx_src = "Open-Meteo forecast (archive not yet available)"
    wd = wx["daily"]
    i = wd["time"].index(day)
    ip = wd["time"].index(prev) if prev in wd["time"] else None
    doy = dt.date.fromisoformat(day).timetuple().tm_yday
    feats = {
        "cams_pm25_mean": _mean(cur["pm25"]), "cams_pm25_max": max(x for x in cur["pm25"] if x is not None),
        "cams_pm10_mean": _mean(cur["pm10"]), "aod_mean": _mean(cur["aod"]), "aod_max": max(x for x in cur["aod"] if x is not None),
        "dust_mean": _mean(cur["dust"]), "cams_pm25_lag1": _mean(pv["pm25"]) if pv else float("nan"),
        "tmax": wd["temperature_2m_max"][i], "tmin": wd["temperature_2m_min"][i], "wind_max": wd["wind_speed_10m_max"][i],
        "wind_dir": wd["wind_direction_10m_dominant"][i], "precip": wd["precipitation_sum"][i],
        "rh": wd["relative_humidity_2m_mean"][i], "pressure": wd["surface_pressure_mean"][i],
        "wind_max_lag1": wd["wind_speed_10m_max"][ip] if ip is not None else float("nan"),
        "lat": lat, "lon": lon, "elevation": aq.get("elevation", 0.0),
        "doy_sin": math.sin(2 * math.pi * doy / 365.25), "doy_cos": math.cos(2 * math.pi * doy / 365.25),
        "month": dt.date.fromisoformat(day).month,
    }
    feats = {k: (float("nan") if v is None else v) for k, v in feats.items()}
    return feats, {"date": day, "source": f"CAMS via Open-Meteo + {wx_src}", "elevation": aq.get("elevation")}


def predict(lat: float, lon: float) -> dict:
    t0 = time.time()
    feats, info = build_features(lat, lon)
    pred = math.expm1(MODEL.predict_dict(feats))
    lo = pred - INTERVAL_SCALE * max(pred - math.expm1(Q16.predict_dict(feats)), 0.0)
    hi = pred + INTERVAL_SCALE * max(math.expm1(Q84.predict_dict(feats)) - pred, 0.0)
    return {
        "pred": round(pred, 1), "lo": round(min(lo, pred), 1), "hi": round(max(hi, pred), 1),
        "cams": round(feats["cams_pm25_mean"], 1) if not math.isnan(feats["cams_pm25_mean"]) else None,
        "date": info["date"], "source": info["source"], "lat": lat, "lon": lon,
        "elevation": info["elevation"], "ms": int((time.time() - t0) * 1000),
        "units": "µg/m³, 24-h mean; lo/hi = central 68 % interval",
    }


CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Content-Type": "application/json"}


def lambda_handler(event, _context):
    if (event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS"):
        return {"statusCode": 204, "headers": CORS, "body": ""}
    q = event.get("queryStringParameters") or {}
    try:
        lat, lon = float(q.get("lat", "")), float(q.get("lon", ""))
    except ValueError:
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "lat and lon query params required"})}
    if not (INDIA[0] <= lat <= INDIA[1] and INDIA[2] <= lon <= INDIA[3]):
        return {"statusCode": 400, "headers": CORS, "body": json.dumps({"error": "point outside India; the model is only trained there"})}
    try:
        return {"statusCode": 200, "headers": {**CORS, "Cache-Control": "public, max-age=900"}, "body": json.dumps(predict(lat, lon))}
    except Exception as e:  # noqa: BLE001
        print(f"ERROR lat={lat} lon={lon}: {e!r}")
        return {"statusCode": 502, "headers": CORS, "body": json.dumps({"error": f"upstream data unavailable: {e.__class__.__name__}"})}


if __name__ == "__main__":  # local smoke test: python infra/lambda/handler.py 26.9 75.8
    import sys
    print(json.dumps(predict(float(sys.argv[1]), float(sys.argv[2])), indent=2))
