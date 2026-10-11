"""Sanity check: does the real diurnal PM2.5 cycle at monitors look like the CAMS shape we use?

Pulls hourly readings for a handful of active OpenAQ stations (last 7 days), averages by
hour of day, and prints the peak / trough hours next to the CAMS-based hourly.json profile
for the district containing each station.
"""
from __future__ import annotations

import datetime as dt
import json
import sys

sys.path.insert(0, __file__.rsplit("\\", 1)[0] if "\\" in __file__ else ".")
from common import DATA, PUBLIC_DATA, http_get_json, read_openaq_key, haversine_km  # noqa: E402

API = "https://api.openaq.org/v3"
headers = {"X-API-Key": read_openaq_key()}
stations = json.loads((DATA / "stations.json").read_text(encoding="utf-8"))
locs = json.loads((DATA / "cache" / "openaq_locations_in.json").read_text(encoding="utf-8"))
sid_by_loc = {l["id"]: [s["id"] for s in l["sensors"] if s["parameter"]["id"] == 2] for l in locs}
hourly = json.loads((PUBLIC_DATA / "hourly.json").read_text(encoding="utf-8"))
meta = json.loads((DATA / "districts_meta.json").read_text(encoding="utf-8"))

# spread across the country: pick stations by name keyword
picks = []
for key in ["Delhi", "Lucknow", "Patna", "Kolkata", "Mumbai", "Hyderabad", "Bengaluru", "Chennai", "Jaipur", "Bhubaneswar"]:
    s = next((x for x in stations if key.lower() in x["name"].lower() and x["n_days"] > 60), None)
    if s: picks.append(s)

date_from = (dt.date.today() - dt.timedelta(days=7)).isoformat()
print(f"{'station':42s} {'real peak':>9s} {'real low':>9s} | {'cams peak':>9s} {'cams low':>9s}  (hour of day, IST)")
for s in picks:
    sid = sid_by_loc.get(s["id"], [None])[0]
    if not sid: continue
    d = http_get_json(f"{API}/sensors/{sid}/hours", {"date_from": date_from, "limit": 1000}, headers=headers, min_interval=1.1)
    by_h = {}
    for r in d.get("results", []):
        if r.get("value") is None: continue
        h = int(r["period"]["datetimeFrom"]["local"][11:13])
        by_h.setdefault(h, []).append(r["value"])
    if len(by_h) < 20: print(f"{s['name'][:42]:42s} (insufficient hourly data)"); continue
    prof = {h: sum(v) / len(v) for h, v in by_h.items()}
    rp, rl = max(prof, key=prof.get), min(prof, key=prof.get)
    # nearest district profile
    did = min(meta, key=lambda m: haversine_km(s["lat"], s["lon"], m["lat"], m["lon"]))["district_id"]
    cp = hourly["series"].get(str(did), [None])[0]
    if cp: cpk, cpl = max(range(24), key=lambda i: cp[i]), min(range(24), key=lambda i: cp[i])
    else: cpk = cpl = "-"
    print(f"{s['name'][:42]:42s} {rp:>9} {rl:>9} | {cpk:>9} {cpl:>9}")
