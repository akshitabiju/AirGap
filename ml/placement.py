"""Step 5: recommend where the next 20 PM2.5 monitors should go.

Candidates: GeoNames cities with population >= MIN_POP that have no monitor
within COVER_KM. For each candidate:

  score = pop_weight x unc_weight x dist_weight
    pop_weight  = log10(population)                 (people affected)
    unc_weight  = district 68% half-width / median   (how unsure the model is there)
    dist_weight = min(nearest_monitor_km / 50, 3)    (how far from any truth)

Selection is greedy: after each pick, the picked site counts as a monitor,
so nearby candidates lose distance weight (diversity without a magic rule).
The per-site breakdown and the "coverage_penalty" (how much a site's score
fell because of earlier picks) are saved so the UI can show its reasoning.

Output: public/data/placement.json
"""
from __future__ import annotations

import datetime as dt
import json

import numpy as np
import pandas as pd
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

from common import DATA, PUBLIC_DATA, RAW, get_logger, haversine_km, load_cities, write_json

log = get_logger("placement")
MIN_POP = 50_000
COVER_KM = 25.0
N_SITES = 20


def main() -> None:
    preds = pd.read_csv(DATA / "district_predictions.csv").set_index("id")
    stations = json.loads((DATA / "stations.json").read_text(encoding="utf-8"))
    gj = json.loads((RAW / "districts_adm2.geojson").read_text(encoding="utf-8"))
    polys = [shape(f["geometry"]) for f in gj["features"]]
    tree = STRtree(polys)
    med_unc = float(preds["unc"].median())

    monitors = [(s["lat"], s["lon"]) for s in stations]
    cands = []
    for c in load_cities(MIN_POP):
        dmin = min(haversine_km(c["lat"], c["lon"], a, b) for a, b in monitors)
        if dmin < COVER_KM:
            continue
        hit = tree.query(Point(c["lon"], c["lat"]), predicate="within")
        did = int(hit[0]) if len(hit) else None
        row = preds.loc[did] if did is not None and did in preds.index else None
        unc = float(row["unc"]) if row is not None and not np.isnan(row["unc"]) else med_unc
        cands.append({
            "name": c["name"], "lat": c["lat"], "lon": c["lon"], "pop": int(c["pop"]),
            "district": str(row["name"]) if row is not None else None,
            "pred": float(row["pred"]) if row is not None and not np.isnan(row["pred"]) else None,
            "unc": round(unc, 1), "nearest_km0": dmin, "nearest_km": dmin,
        })
    log.info("candidates: %d cities with pop >= %d and no monitor within %.0f km", len(cands), MIN_POP, COVER_KM)

    def score(c):
        pw = np.log10(c["pop"])
        uw = c["unc"] / med_unc
        dw = min(c["nearest_km"] / 50.0, 3.0)
        return pw * uw * dw, {"pop_weight": round(pw, 2), "unc_weight": round(uw, 2), "dist_weight": round(dw, 2)}

    chosen = []
    for rank in range(1, N_SITES + 1):
        best, best_s, best_b = None, -1.0, None
        for c in cands:
            if c.get("taken"):
                continue
            s, b = score(c)
            if s > best_s:
                best, best_s, best_b = c, s, b
        if best is None:
            break
        best["taken"] = True
        s0, _ = score({**best, "nearest_km": best["nearest_km0"]})
        chosen.append({
            "rank": rank, "name": best["name"], "lat": best["lat"], "lon": best["lon"], "pop": best["pop"],
            "district": best["district"], "pred": best["pred"], "unc": best["unc"],
            "nearest_km": round(best["nearest_km"], 1), "score": round(best_s, 2),
            "score_breakdown": {**best_b, "coverage_penalty": round(s0 - best_s, 2)},
            "reason": (f"{best['pop']:,} people, nearest monitor {best['nearest_km']:.0f} km away, "
                       f"model 68% half-width ±{best['unc']:.0f} µg/m³ ({best['unc'] / med_unc:.1f}× median)."),
        })
        # The new site now counts as a monitor for everyone else.
        for c in cands:
            if not c.get("taken"):
                c["nearest_km"] = min(c["nearest_km"], haversine_km(c["lat"], c["lon"], best["lat"], best["lon"]))
        log.info("#%2d %-22s pop %9d  unc ±%4.0f  dist %4.0f km  score %.2f", rank, best["name"], best["pop"], best["unc"], best["nearest_km"], best_s)

    write_json(PUBLIC_DATA / "placement.json", {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "method": "Greedy: score = log10(pop) × (uncertainty / median) × min(km-to-nearest-monitor / 50, 3); each pick becomes a monitor for later picks.",
        "params": {"min_pop": MIN_POP, "cover_km": COVER_KM, "n_candidates": len(cands), "median_unc": round(med_unc, 1)},
        "sites": chosen,
    })
    log.info("DONE: %d sites -> public/data/placement.json", len(chosen))


if __name__ == "__main__":
    main()
