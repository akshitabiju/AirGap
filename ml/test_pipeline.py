"""Tests for the pieces that must be exactly right.

    python -m pytest ml/test_pipeline.py -q      (or: python ml/test_pipeline.py)

- lgb_pure reproduces lightgbm's predictions (so the Lambda serves the same model).
- OpenAQ day-cleaning drops incomplete / implausible days and nothing else.
- City grouping never splits one metro across groups.
- haversine sanity.
"""
from __future__ import annotations

import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import DATA, assign_city_group, haversine_km  # noqa: E402
from fetch_openaq import clean_days  # noqa: E402
from lgb_pure import Model  # noqa: E402


def test_haversine():
    assert abs(haversine_km(28.6139, 77.2090, 19.0760, 72.8777) - 1150) < 20   # Delhi-Mumbai ~1,150 km
    assert haversine_km(10, 10, 10, 10) == 0


def test_clean_days():
    import datetime as dt
    d0 = dt.date(2026, 7, 11)
    rows = [
        {"period": {"datetimeFrom": {"local": "2026-07-12T00:00:00+05:30"}}, "value": 50.0, "coverage": {"observedCount": 24}},
        {"period": {"datetimeFrom": {"local": "2026-07-13T00:00:00+05:30"}}, "value": 50.0, "coverage": {"observedCount": 10}},   # too few hours
        {"period": {"datetimeFrom": {"local": "2026-07-14T00:00:00+05:30"}}, "value": 0.0, "coverage": {"observedCount": 24}},    # implausible
        {"period": {"datetimeFrom": {"local": "2026-07-10T00:00:00+05:30"}}, "value": 50.0, "coverage": {"observedCount": 24}},   # before window
        {"period": {"datetimeFrom": {"local": "2026-07-15T00:00:00+05:30"}}, "value": None, "coverage": {"observedCount": 24}},   # null
    ]
    out = clean_days(rows, d0)
    assert out == [("2026-07-12", 50.0, 24)]


def test_city_group_merges_metro():
    cities = [{"name": "Delhi", "lat": 28.65, "lon": 77.23, "pop": 11_000_000}, {"name": "Tiny", "lat": 28.7, "lon": 77.3, "pop": 5_000}]
    assert assign_city_group(28.60, 77.10, cities) == "Delhi"
    assert assign_city_group(28.75, 77.35, cities) == "Delhi"          # small town ignored, still Delhi group
    assert assign_city_group(20.0, 80.0, cities).startswith("cell_")   # far from any city


def test_lgb_pure_matches_lightgbm():
    import lightgbm as lgb
    model_path = DATA / "model.txt"
    if not model_path.exists():
        print("skip: data/model.txt not trained yet")
        return
    import pandas as pd
    from train import FEATURES
    booster = lgb.Booster(model_file=str(model_path))
    pure = Model.from_file(str(model_path))
    assert pure.feature_names == FEATURES
    fx = pd.read_parquet(DATA / "features_districts.parquet").dropna(subset=FEATURES).sample(500, random_state=1)
    ref = booster.predict(fx[FEATURES])
    got = np.array([pure.predict_row(list(r)) for r in fx[FEATURES].itertuples(index=False)])
    assert np.max(np.abs(ref - got)) < 1e-6, np.max(np.abs(ref - got))
    # NaN handling: lag features missing on the first day.
    row = fx[FEATURES].iloc[0].copy(); row["cams_pm25_lag1"] = np.nan; row["wind_max_lag1"] = np.nan
    ref1 = booster.predict(row.to_frame().T)[0]
    got1 = pure.predict_row([float(v) for v in row.values])
    assert abs(ref1 - got1) < 1e-6, (ref1, got1)


def test_placement_score_monotone():
    med = 10.0
    def score(pop, unc, km):
        return math.log10(pop) * (unc / med) * min(km / 50.0, 3.0)
    assert score(1_000_000, 10, 100) > score(100_000, 10, 100)
    assert score(100_000, 20, 100) > score(100_000, 10, 100)
    assert score(100_000, 10, 100) > score(100_000, 10, 30)
    assert score(100_000, 10, 500) == score(100_000, 10, 150)   # capped


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn(); print("ok", name)
