"""Step 8: states for the hero map: label positions, district -> state, and per-state pollution today.

Output: public/data/states.json
  {"generated_at", "states": [{"name", "lat", "lon", "n_districts", "mean_pred", "max_pred",
                               "worst_district", "worst_pred", "worst_lat", "worst_lon"}],
   "hotspots": [{"district", "state", "lat", "lon", "pred"}]  # districts in Poor band or worse, then top Moderate
  }
Names are ASCII-folded (geoBoundaries uses diacritics: "Mahārāshtra").
"""
from __future__ import annotations

import datetime as dt
import json
import unicodedata

import pandas as pd
from shapely.geometry import Point, shape
from shapely.strtree import STRtree

from common import DATA, PUBLIC_DATA, RAW, get_logger, write_json

log = get_logger("states")
RENAME = {"NCT of Delhi": "Delhi", "Andaman & Nicobar": "Andaman & Nicobar", "Jammu and Kashmir": "Jammu & Kashmir"}


def fold(s: str) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    return RENAME.get(s, s)


def main() -> None:
    gj = json.loads((RAW / "states_adm1.geojson").read_text(encoding="utf-8"))
    polys = [shape(f["geometry"]) for f in gj["features"]]
    names = [fold(f["properties"]["shapeName"]) for f in gj["features"]]
    tree = STRtree(polys)
    preds = pd.read_csv(DATA / "district_predictions.csv")

    state_of = {}
    for r in preds.itertuples():
        hit = tree.query(Point(r.lon, r.lat), predicate="within")
        if len(hit) == 0:  # coastal rounding: nearest polygon
            hit = [min(range(len(polys)), key=lambda i: polys[i].distance(Point(r.lon, r.lat)))]
        state_of[r.id] = names[int(hit[0])]
    preds["state"] = preds["id"].map(state_of)

    states = []
    for i, (poly, name) in enumerate(zip(polys, names)):
        g = preds[preds["state"] == name].dropna(subset=["pred"])
        rp = poly.representative_point()
        if g.empty:
            states.append({"name": name, "lat": round(rp.y, 3), "lon": round(rp.x, 3), "n_districts": 0}); continue
        w = g.loc[g["pred"].idxmax()]
        states.append({
            "name": name, "lat": round(rp.y, 3), "lon": round(rp.x, 3), "n_districts": int(len(g)),
            "mean_pred": round(float(g["pred"].mean()), 1), "max_pred": round(float(g["pred"].max()), 1),
            "worst_district": str(w["name"]), "worst_pred": round(float(w["pred"]), 1), "worst_lat": float(w["lat"]), "worst_lon": float(w["lon"]),
            "area_deg2": round(poly.area, 2),
        })
    ranked = sorted([s for s in states if s["n_districts"]], key=lambda s: -s["mean_pred"])
    hot = preds.dropna(subset=["pred"]).sort_values("pred", ascending=False)
    hotspots = [{"district": str(r.name), "state": r.state, "lat": float(r.lat), "lon": float(r.lon), "pred": round(float(r.pred), 1)}
                for r in hot.head(40).itertuples()]
    write_json(PUBLIC_DATA / "states.json", {
        "generated_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "states": states, "hotspots": hotspots,
    }, compact=True)
    # keep the district -> state mapping for other scripts
    preds[["id", "state"]].to_csv(DATA / "district_state.csv", index=False)
    log.info("DONE: %d states; most polluted today by mean: %s", len(states),
             ", ".join(f"{s['name']} {s['mean_pred']}" for s in ranked[:5]))


if __name__ == "__main__":
    main()
