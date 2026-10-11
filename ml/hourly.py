"""Step 7: hourly profile for today + tomorrow per district, for "best hours to step out".

Level comes from AirGap's calibrated daily estimate; the within-day *shape*
comes from the CAMS hourly forecast for that district (we have no hourly
ground truth to train an hourly model, and we say so in the UI).

  hourly[h] = daily_pred(day) * cams[h] / mean(cams over that day)

Output: public/data/hourly.json
  {"generated_at", "days": ["YYYY-MM-DD", ...], "series": {district_id: [[h0..h23 for day0], [h0..h23 for day1]]}}
Values rounded to integers to keep the file small (~735 x 48 numbers).
"""
from __future__ import annotations

import datetime as dt
import json

import pandas as pd

from common import DATA, PUBLIC_DATA, TZ, cache_key, cached_json, get_logger, http_get_json, write_json

log = get_logger("hourly")
AQ_URL = "https://air-quality-api.open-meteo.com/v1/air-quality"
BATCH = 25


def main() -> None:
    meta = json.loads((DATA / "districts_meta.json").read_text(encoding="utf-8"))
    preds = pd.read_csv(DATA / "district_predictions.csv").set_index("id")
    fc = json.loads((PUBLIC_DATA / "forecast.json").read_text(encoding="utf-8"))
    today = dt.date.today().isoformat()
    tomorrow = (dt.date.today() + dt.timedelta(days=1)).isoformat()
    days = [today, tomorrow]

    series = {}
    for b in range(0, len(meta), BATCH):
        chunk = meta[b:b + BATCH]
        lat = ",".join(f"{p['lat']:.4f}" for p in chunk); lon = ",".join(f"{p['lon']:.4f}" for p in chunk)
        aq = cached_json("hr_aq_" + cache_key(lat, lon, today), lambda: http_get_json(AQ_URL, {
            "latitude": lat, "longitude": lon, "hourly": "pm2_5", "forecast_days": 2, "timezone": TZ}, timeout=120, min_interval=0.6))
        aq = aq if isinstance(aq, list) else [aq]
        for p, a in zip(chunk, aq):
            did = p["district_id"]
            times, vals = a["hourly"]["time"], a["hourly"]["pm2_5"]
            out = []
            for di, day in enumerate(days):
                hours = [v for t, v in zip(times, vals) if t.startswith(day)]
                if len(hours) < 24 or any(v is None for v in hours):
                    out.append(None); continue
                if di == 0:
                    level = preds.loc[did, "pred"] if did in preds.index else None
                else:
                    f = fc["series"].get(str(did)); level = f[0][1] if f else None
                if level is None or pd.isna(level):
                    out.append(None); continue
                mean = sum(hours) / 24 or 1e-6
                out.append([int(round(level * v / mean)) for v in hours])
            series[int(did)] = out
        log.info("%d/%d districts", min(b + BATCH, len(meta)), len(meta))

    write_json(PUBLIC_DATA / "hourly.json", {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "days": days,
        "method": "level = AirGap daily estimate; within-day shape = CAMS hourly forecast scaled to that level",
        "series": series,
    }, compact=True)
    ok = sum(1 for v in series.values() if v[0]); log.info("DONE: %d/%d districts with today's hourly profile", ok, len(series))


if __name__ == "__main__":
    main()
