"""Step 3: train the PM2.5 model with leave-cities-out validation.

Model: LightGBM on log1p(PM2.5). Validation: GroupKFold(5) grouped by
city_group, so every test row belongs to a city the model never saw.
A CAMS baseline (the raw satellite-assimilated model value) is scored on
exactly the same rows so the comparison is like-for-like.

Uncertainty: two quantile models (q16, q84) give a central 68 % interval;
its coverage is measured out-of-fold so the number on the website is real.

Outputs
  data/model.txt, data/model_q16.txt, data/model_q84.txt
  data/metrics.json         (also copied to public/data/metrics.json)
"""
from __future__ import annotations

import datetime as dt
import json
import shutil

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GroupKFold

from common import DATA, PUBLIC_DATA, get_logger, write_json

log = get_logger("train")
SEED = 42
FEATURES = [
    "cams_pm25_mean", "cams_pm25_max", "cams_pm10_mean", "aod_mean", "aod_max", "dust_mean", "cams_pm25_lag1",
    "tmax", "tmin", "wind_max", "wind_dir", "precip", "rh", "pressure", "wind_max_lag1",
    "lat", "lon", "elevation", "doy_sin", "doy_cos", "month",
]
PARAMS = dict(
    objective="regression", learning_rate=0.03, num_leaves=31, min_child_samples=40,
    subsample=0.8, subsample_freq=1, colsample_bytree=0.8, reg_lambda=1.0,
    n_estimators=700, random_state=SEED, verbose=-1,
)
N_FOLDS = 5


def metrics(y, p, prefix=""):
    return {
        f"{prefix}mae": float(mean_absolute_error(y, p)),
        f"{prefix}rmse": float(np.sqrt(mean_squared_error(y, p))),
        f"{prefix}r2": float(r2_score(y, p)),
    }


def load() -> pd.DataFrame:
    gt = pd.read_parquet(DATA / "ground_truth.parquet")
    fx = pd.read_parquet(DATA / "features_stations.parquet")
    st = pd.DataFrame(json.loads((DATA / "stations.json").read_text(encoding="utf-8")))
    df = gt.merge(fx, on=["location_id", "date"], how="inner")
    df = df.merge(st[["id", "city_group", "name"]].rename(columns={"id": "location_id"}), on="location_id")
    df = df.dropna(subset=FEATURES + ["pm25"])
    log.info("training rows: %d (ground truth %d, with features %d)", len(df), len(gt), len(df))
    return df


def main() -> None:
    df = load()
    X, y = df[FEATURES], np.log1p(df["pm25"].values)
    groups = df["city_group"].values
    gkf = GroupKFold(n_splits=N_FOLDS)

    oof = np.full(len(df), np.nan)
    oof_lo = np.full(len(df), np.nan)
    oof_hi = np.full(len(df), np.nan)
    folds = []
    for k, (tr, te) in enumerate(gkf.split(X, y, groups), 1):
        m = lgb.LGBMRegressor(**PARAMS).fit(X.iloc[tr], y[tr])
        lo = lgb.LGBMRegressor(**{**PARAMS, "objective": "quantile", "alpha": 0.16}).fit(X.iloc[tr], y[tr])
        hi = lgb.LGBMRegressor(**{**PARAMS, "objective": "quantile", "alpha": 0.84}).fit(X.iloc[tr], y[tr])
        oof[te] = np.expm1(m.predict(X.iloc[te]))
        oof_lo[te] = np.expm1(lo.predict(X.iloc[te]))
        oof_hi[te] = np.expm1(hi.predict(X.iloc[te]))
        yt = df["pm25"].values[te]
        f = {"fold": k, "n_test": int(len(te)), "n_cities": int(len(set(groups[te])))}
        f.update(metrics(yt, oof[te]))
        f.update(metrics(yt, df["cams_pm25_mean"].values[te], "cams_"))
        folds.append(f)
        log.info("fold %d: %d rows / %d cities | MAE %.1f (CAMS %.1f) | R2 %.2f (CAMS %.2f)",
                 k, f["n_test"], f["n_cities"], f["mae"], f["cams_mae"], f["r2"], f["cams_r2"])

    yt = df["pm25"].values
    cams = df["cams_pm25_mean"].values
    overall = metrics(yt, oof)
    overall.update(metrics(yt, cams, "cams_"))
    overall["within_15"] = float(np.mean(np.abs(yt - oof) <= 15))
    overall["cams_within_15"] = float(np.mean(np.abs(yt - cams) <= 15))
    overall["interval68_coverage_raw"] = float(np.mean((yt >= oof_lo) & (yt <= oof_hi)))
    # Conformal-style calibration: one multiplier on the quantile half-widths so that the
    # out-of-fold central interval really covers 68 % of held-out-city observations.
    lo_w, hi_w = np.maximum(oof - oof_lo, 1e-6), np.maximum(oof_hi - oof, 1e-6)
    ratio = np.where(yt < oof, (oof - yt) / lo_w, (yt - oof) / hi_w)
    interval_scale = float(np.quantile(ratio, 0.68))
    overall["interval_scale"] = interval_scale
    overall["interval68_coverage"] = float(np.mean((yt >= oof - interval_scale * lo_w) & (yt <= oof + interval_scale * hi_w)))
    overall["median_obs"] = float(np.median(yt))
    overall["mean_obs"] = float(np.mean(yt))
    log.info("OVERALL held-out-city: MAE %.1f vs CAMS %.1f | RMSE %.1f vs %.1f | R2 %.2f vs %.2f | 68%% coverage raw %.2f -> calibrated %.2f (scale %.2f)",
             overall["mae"], overall["cams_mae"], overall["rmse"], overall["cams_rmse"], overall["r2"], overall["cams_r2"],
             overall["interval68_coverage_raw"], overall["interval68_coverage"], interval_scale)

    df["oof"] = oof
    per_city = (df.groupby("city_group")
                .apply(lambda g: pd.Series({
                    "n": len(g), "mean_obs": g["pm25"].mean(), "mean_pred": g["oof"].mean(),
                    "mae": np.mean(np.abs(g["pm25"] - g["oof"])),
                    "cams_mae": np.mean(np.abs(g["pm25"] - g["cams_pm25_mean"])),
                    "lat": g["lat"].mean(), "lon": g["lon"].mean(),
                }), include_groups=False)
                .reset_index().rename(columns={"city_group": "city"}))
    per_city = per_city[per_city["n"] >= 20].sort_values("n", ascending=False)

    # Final models on everything.
    final = lgb.LGBMRegressor(**PARAMS).fit(X, y)
    final.booster_.save_model(str(DATA / "model.txt"))
    lgb.LGBMRegressor(**{**PARAMS, "objective": "quantile", "alpha": 0.16}).fit(X, y).booster_.save_model(str(DATA / "model_q16.txt"))
    lgb.LGBMRegressor(**{**PARAMS, "objective": "quantile", "alpha": 0.84}).fit(X, y).booster_.save_model(str(DATA / "model_q84.txt"))
    imp = final.booster_.feature_importance(importance_type="gain")
    fi = sorted([{"feature": f, "gain": float(g)} for f, g in zip(FEATURES, imp)], key=lambda d: -d["gain"])
    tot = sum(d["gain"] for d in fi) or 1
    for d in fi:
        d["share"] = d["gain"] / tot

    rng = np.random.default_rng(SEED)
    idx = rng.choice(len(df), size=min(1500, len(df)), replace=False)
    scatter = [{"obs": round(float(yt[i]), 1), "pred": round(float(oof[i]), 1), "cams": round(float(cams[i]), 1),
                "city": str(groups[i])} for i in idx]

    out = {
        "trained_at": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "n_train_rows": int(len(df)), "n_stations": int(df["location_id"].nunique()),
        "n_city_groups": int(len(set(groups))), "date_min": str(df["date"].min()), "date_max": str(df["date"].max()),
        "folds": folds, "overall": overall,
        "per_city": per_city.round(2).to_dict(orient="records"),
        "scatter": scatter, "feature_importance": fi, "features": FEATURES,
        "model": "LightGBM regression on log1p(PM2.5); quantile models (0.16/0.84) for the 68% interval",
        "validation": f"GroupKFold({N_FOLDS}) by city_group (leave-cities-out); CAMS baseline scored on identical rows",
        "params": {k: v for k, v in PARAMS.items() if k != "verbose"}, "seed": SEED,
    }
    write_json(DATA / "metrics.json", out)
    write_json(DATA / "calibration.json", {"interval_scale": interval_scale, "note": "multiply (pred-lo) and (hi-pred) by this; fitted out-of-fold"})
    shutil.copy(DATA / "metrics.json", PUBLIC_DATA / "metrics.json")
    log.info("DONE: wrote data/metrics.json and models")


if __name__ == "__main__":
    main()
