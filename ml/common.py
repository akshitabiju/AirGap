"""Shared helpers for the AirGap ML pipeline.

Paths, logging, HTTP with retry/backoff, simple on-disk JSON cache,
and the city-grouping used for leave-cities-out validation.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import os
import time
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
RAW = DATA / "raw"
CACHE = DATA / "cache"
PUBLIC_DATA = ROOT / "public" / "data"
for p in (DATA, RAW, CACHE, PUBLIC_DATA):
    p.mkdir(parents=True, exist_ok=True)

KEY_FILE = ROOT.parent / "openaq.key"  # C:\Users\bijud\code\openaq.key (never committed)

TZ = "Asia/Kolkata"
HISTORY_DAYS = 92  # Open-Meteo AQ past_days hard limit

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)


def read_openaq_key() -> str:
    """Read the OpenAQ key from the local key file or OPENAQ_API_KEY env var."""
    env = os.environ.get("OPENAQ_API_KEY")
    if env:
        return env.strip()
    if KEY_FILE.exists():
        return KEY_FILE.read_text(encoding="utf-8").strip()
    raise SystemExit(f"OpenAQ key not found. Put it in {KEY_FILE} or set OPENAQ_API_KEY.")


_session = requests.Session()
_session.headers["User-Agent"] = "AirGap/0.1 (hackathon; open data)"


def http_get_json(
    url: str,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 60,
    max_tries: int = 12,
    min_interval: float = 0.0,
) -> Any:
    """GET with exponential backoff on 429/5xx/network errors."""
    log = get_logger("http")
    delay = 2.0
    for attempt in range(1, max_tries + 1):
        try:
            r = _session.get(url, params=params, headers=headers, timeout=timeout)
            if r.status_code == 429 or r.status_code >= 500:
                retry_after = r.headers.get("Retry-After")
                wait = float(retry_after) if retry_after and retry_after.isdigit() else delay
                log.warning("HTTP %s on %s (attempt %d/%d); sleeping %.1fs", r.status_code, url.split("?")[0], attempt, max_tries, wait)
                time.sleep(wait)
                delay = min(delay * 2, 120)
                continue
            r.raise_for_status()
            if min_interval:
                time.sleep(min_interval)
            return r.json()
        except (requests.ConnectionError, requests.Timeout) as e:
            log.warning("network error %s (attempt %d/%d); sleeping %.1fs", e.__class__.__name__, attempt, max_tries, delay)
            time.sleep(delay)
            delay = min(delay * 2, 120)
    raise RuntimeError(f"GET failed after {max_tries} tries: {url}")


def cache_key(*parts: Any) -> str:
    return hashlib.sha1("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


def cached_json(name: str, fetch, *, stale_ok: bool = True) -> Any:
    """Return cached JSON for `name` or call fetch() and store the result."""
    path = CACHE / f"{name}.json"
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            path.unlink()
    result = fetch()
    path.write_text(json.dumps(result), encoding="utf-8")
    return result


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def load_cities(min_pop: int = 0) -> list[dict[str, Any]]:
    cities = json.loads((DATA / "india_cities.json").read_text(encoding="utf-8"))
    return [c for c in cities if c.get("pop", 0) >= min_pop]


def assign_city_group(lat: float, lon: float, cities: list[dict[str, Any]], radius_km: float = 30.0) -> str:
    """Group label for leave-cities-out CV: nearest city with pop >= 100k within
    `radius_km`, otherwise a 0.25-degree grid cell. Stations in the same
    metro therefore share a group and can never be split across train/test."""
    best, best_d = None, radius_km
    for c in cities:
        if c.get("pop", 0) < 100_000:
            continue
        d = haversine_km(lat, lon, c["lat"], c["lon"])
        if d < best_d:
            best, best_d = c["name"], d
    if best:
        return best
    return f"cell_{round(lat * 4) / 4:.2f}_{round(lon * 4) / 4:.2f}"


def write_json(path: Path, obj: Any, compact: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if compact:
        path.write_text(json.dumps(obj, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    else:
        path.write_text(json.dumps(obj, indent=2, ensure_ascii=False), encoding="utf-8")
