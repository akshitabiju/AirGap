"""Step 1: pull Indian PM2.5 ground truth from OpenAQ v3.

Outputs
  data/ground_truth.parquet        one row per (location, day): daily mean PM2.5
  data/stations.json               station metadata incl. city group for CV
  data/ground_truth_summary.json   counts for the README / method page

Honesty rules: a day is kept only if OpenAQ reports >= MIN_HOURS hourly
observations behind the daily mean and the value is physically plausible.
Nothing is interpolated or filled.
"""
from __future__ import annotations

import datetime as dt
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import pandas as pd

from common import (
    DATA, HISTORY_DAYS, assign_city_group, cached_json, get_logger,
    http_get_json, load_cities, read_openaq_key, write_json,
)

log = get_logger("openaq")
API = "https://api.openaq.org/v3"
COUNTRY_INDIA = 9
PARAM_PM25 = 2
MIN_HOURS = 16          # at least 16 of 24 hourly values behind a daily mean
MIN_VALUE, MAX_VALUE = 1.0, 1500.0
REQ_INTERVAL = 1.05     # seconds of sleep after each call, per worker
WORKERS = 3             # each call takes ~3s, so 3 workers ~= 45 req/min (< 60 limit)


def fetch_locations(headers: dict) -> list[dict]:
    """All Indian locations that have a PM2.5 sensor (paginated, cached)."""
    def _fetch():
        out, page = [], 1
        while True:
            d = http_get_json(f"{API}/locations", {
                "countries_id": COUNTRY_INDIA, "parameters_id": PARAM_PM25,
                "limit": 1000, "page": page}, headers=headers, min_interval=REQ_INTERVAL)
            out.extend(d["results"])
            if len(d["results"]) < 1000:
                return out
            page += 1
    return cached_json("openaq_locations_in", _fetch)


def fetch_days(sensor_id: int, headers: dict, date_from: dt.date) -> list[dict]:
    """Daily aggregates for one sensor since date_from (cached).
    Note: the v3 /days endpoint honours `date_from`, not `datetime_from`."""
    def _fetch():
        out, page = [], 1
        while True:
            d = http_get_json(f"{API}/sensors/{sensor_id}/days", {
                "date_from": date_from.isoformat(), "limit": 1000, "page": page},
                headers=headers, min_interval=REQ_INTERVAL)
            out.extend(d.get("results", []))
            if len(d.get("results", [])) < 1000:
                return out
            page += 1
    return cached_json(f"openaq_days_{sensor_id}", _fetch)


def clean_days(days: list[dict], date_from: dt.date) -> list[tuple[str, float, int]]:
    """Apply the coverage + plausibility rules; return (date, value, hours)."""
    out = []
    for r in days:
        local = r["period"]["datetimeFrom"]["local"][:10]
        if local < date_from.isoformat():
            continue
        obs = (r.get("coverage") or {}).get("observedCount") or 0
        v = r.get("value")
        if v is None or obs < MIN_HOURS or not (MIN_VALUE <= v <= MAX_VALUE):
            continue
        out.append((local, float(v), int(obs)))
    return out


def main() -> None:
    headers = {"X-API-Key": read_openaq_key()}
    today = dt.date.today()
    date_from = today - dt.timedelta(days=HISTORY_DAYS)
    cities = load_cities()

    locs = fetch_locations(headers)
    log.info("locations with a PM2.5 sensor in India: %d", len(locs))
    active = [l for l in locs
              if ((l.get("datetimeLast") or {}).get("utc") or "")[:10] >= date_from.isoformat()]
    log.info("active since %s: %d", date_from, len(active))

    def fetch_one(l: dict):
        sensors = [s for s in l["sensors"] if s["parameter"]["id"] == PARAM_PM25]
        got = []
        for s in sensors:
            try:
                got.append((s["id"], fetch_days(s["id"], headers, date_from)))
            except Exception as e:  # noqa: BLE001
                got.append((s["id"], e))
        return l, got

    rows, stations, failures = [], [], 0
    t0 = time.time()
    with ThreadPoolExecutor(max_workers=WORKERS) as ex:
        for i, (l, got) in enumerate(ex.map(fetch_one, active), 1):
            lat, lon = l["coordinates"]["latitude"], l["coordinates"]["longitude"]
            kept = 0
            for sid, days in got:
                if isinstance(days, Exception):
                    failures += 1
                    log.error("sensor %s failed: %s", sid, days)
                    continue
                for date, v, hours in clean_days(days, date_from):
                    rows.append({"location_id": l["id"], "sensor_id": sid, "date": date,
                                 "pm25": v, "observed_hours": hours})
                    kept += 1
            if kept:
                stations.append({
                    "id": l["id"], "name": l["name"], "lat": lat, "lon": lon,
                    "provider": (l.get("provider") or {}).get("name"),
                    "locality": l.get("locality"),
                    "city_group": assign_city_group(lat, lon, cities),
                    "n_days": kept,
                    "last_utc": (l.get("datetimeLast") or {}).get("utc"),
                })
            if i % 25 == 0:
                log.info("%d/%d stations, %d rows kept, %d failures, %.0fs",
                         i, len(active), len(rows), failures, time.time() - t0)

    if not rows:
        raise SystemExit("No ground-truth rows fetched; aborting.")

    df = pd.DataFrame(rows)
    # One row per location-day (a few locations have 2 PM2.5 sensors): average them.
    df = df.groupby(["location_id", "date"], as_index=False).agg(
        pm25=("pm25", "mean"), observed_hours=("observed_hours", "max"))
    df.to_parquet(DATA / "ground_truth.parquet", index=False)
    write_json(DATA / "stations.json", stations)

    groups = {s["city_group"] for s in stations}
    log.info("DONE: %d stations, %d location-days, %d city groups, %d sensor failures",
             len(stations), len(df), len(groups), failures)
    log.info("date range %s .. %s; median pm25 %.1f", df["date"].min(), df["date"].max(), df["pm25"].median())
    write_json(DATA / "ground_truth_summary.json", {
        "stations": len(stations), "location_days": int(len(df)), "city_groups": len(groups),
        "sensor_failures": failures, "date_min": df["date"].min(), "date_max": df["date"].max(),
        "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "min_hours_per_day": MIN_HOURS, "history_days": HISTORY_DAYS,
    })


if __name__ == "__main__":
    sys.exit(main())
