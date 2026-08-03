#!/usr/bin/env python3
"""
Offline DEM depression / sink analysis for ICT dengue zones (richdem).

NOT a daily job — terrain is structural/static. Re-run quarterly or after
major construction. Prefer this when you have:
  - Python 3.10+
  - richdem, numpy, rasterio
  - A Copernicus GLO-30 GeoTIFF for ICT (export via Earth Engine script
    ee_export_glo30.js in this folder, or COPERNICUS/DEM/GLO30)

Fallback DEM: USGS/SRTMGL1_003 (30 m).

Usage:
  python scripts/terrain/compute_depressions.py --dem path/to/ict_glo30.tif
  python scripts/terrain/compute_depressions.py --dem path/to/ict_glo30.tif --out data/terrain_depressions.json
"""

from __future__ import annotations

import argparse
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

try:
    import richdem as rd
except ImportError as e:
    raise SystemExit(
        "Install richdem (and numpy/rasterio): pip install richdem numpy rasterio"
    ) from e

try:
    import rasterio
    from rasterio.mask import mask as rio_mask
    from shapely.geometry import Point, mapping
except ImportError as e:
    raise SystemExit("Install rasterio + shapely: pip install rasterio shapely") from e

# Zone centers — keep in sync with lib/zoneMeta.ts
ZONES = [
    {"id": "zone-f6", "name": "F-6 & Super Market", "lat": 33.7295, "lng": 73.0745, "area": "urban"},
    {"id": "zone-f7", "name": "F-7 Markaz & Jinnah Super", "lat": 33.721, "lng": 73.057, "area": "urban"},
    {"id": "zone-bluearea", "name": "Blue Area (Jinnah Avenue)", "lat": 33.715, "lng": 73.065, "area": "urban"},
    {"id": "zone-f8", "name": "F-8 Markaz", "lat": 33.71, "lng": 73.04, "area": "urban"},
    {"id": "zone-g6", "name": "G-6 & Melody", "lat": 33.708, "lng": 73.075, "area": "urban"},
    {"id": "zone-diplomatic", "name": "Diplomatic Enclave", "lat": 33.723, "lng": 73.1, "area": "urban"},
    {"id": "zone-g9", "name": "G-9 & Karachi Company", "lat": 33.69, "lng": 73.03, "area": "urban"},
    {"id": "zone-f10", "name": "F-10 Markaz", "lat": 33.705, "lng": 73.015, "area": "urban"},
    {"id": "zone-g11", "name": "G-11 Markaz", "lat": 33.675, "lng": 72.995, "area": "urban"},
    {"id": "zone-i8", "name": "I-8 Markaz & Industrial", "lat": 33.665, "lng": 73.075, "area": "urban"},
    {"id": "zone-bharakahu", "name": "Bharakahu", "lat": 33.74, "lng": 73.18, "area": "rural"},
    {"id": "zone-banigala", "name": "Banigala", "lat": 33.76, "lng": 73.15, "area": "rural"},
    {"id": "zone-nilore", "name": "Nilore", "lat": 33.65, "lng": 73.15, "area": "rural"},
    {"id": "zone-chirah", "name": "Chirah", "lat": 33.62, "lng": 73.2, "area": "rural"},
    {"id": "zone-tarnol", "name": "Tarnol", "lat": 33.68, "lng": 72.9, "area": "rural"},
    {"id": "zone-golra", "name": "Golra", "lat": 33.67, "lng": 72.95, "area": "rural"},
    {"id": "zone-sihala", "name": "Sihala", "lat": 33.55, "lng": 73.15, "area": "rural"},
    {"id": "zone-rawat", "name": "Rawat", "lat": 33.5, "lng": 73.2, "area": "rural"},
    {"id": "zone-koral", "name": "Koral", "lat": 33.58, "lng": 73.12, "area": "rural"},
]

DEPTH_THRESHOLD_M = 0.25
RADIUS_M = {"urban": 800, "rural": 1000}


def meters_to_deg(lat: float, meters: float) -> tuple[float, float]:
    dlat = meters / 111_320.0
    dlng = meters / (111_320.0 * math.cos(math.radians(lat)))
    return dlat, dlng


def score_depression(depth_avg: float, area_pct: float) -> int:
    # GLO-30 / richdem often yields deeper fills than the ~90 m Open-Meteo path.
    # depth_full_m=2.0 suits true hydrologic fill; lower if scores cluster near 0.
    depth_norm = min(1.0, max(0.0, depth_avg / 2.0))
    area_norm = min(1.0, max(0.0, area_pct / 35.0))
    return int(round(100 * (0.55 * depth_norm + 0.45 * area_norm)))


def analyze_zone(dem_path: Path, zone: dict, dem_source: str) -> dict:
    lat, lng = zone["lat"], zone["lng"]
    radius = RADIUS_M[zone["area"]]
    dlat, dlng = meters_to_deg(lat, radius)
    # Approximate buffer as circle polygon (16-gon)
    coords = []
    for k in range(16):
        ang = 2 * math.pi * k / 16
        coords.append((lng + dlng * math.cos(ang), lat + dlat * math.sin(ang)))
    coords.append(coords[0])
    geom = {"type": "Polygon", "coordinates": [coords]}

    with rasterio.open(dem_path) as src:
        out_image, _ = rio_mask(src, [geom], crop=True, filled=True, nodata=src.nodata)
        elev = out_image[0].astype(np.float64)
        nodata = src.nodata
        if nodata is not None:
            elev = np.where(elev == nodata, np.nan, elev)

    # richdem needs finite DEM — fill nan with neighborhood mean for processing
    if np.isnan(elev).all():
        raise RuntimeError(f"No DEM pixels for {zone['id']}")

    nan_mask = np.isnan(elev)
    elev_filled_nan = elev.copy()
    elev_filled_nan[nan_mask] = np.nanmean(elev)

    dem = rd.rdarray(elev_filled_nan, no_data=-9999)
    dem.geotransform = [0, 30, 0, 0, 0, -30]
    original = np.array(dem, dtype=np.float64)
    rd.FillDepressions(dem, epsilon=False, in_place=True)
    filled = np.array(dem, dtype=np.float64)
    depth = np.maximum(0.0, filled - original)
    depth[nan_mask] = np.nan

    valid = ~np.isnan(depth)
    depth_avg = float(np.nanmean(depth))
    area_pct = float(100.0 * np.sum(depth[valid] >= DEPTH_THRESHOLD_M) / np.sum(valid))

    return {
        "zoneId": zone["id"],
        "zoneName": zone["name"],
        "depressionDepthAvg": round(depth_avg, 3),
        "depressionAreaPct": round(area_pct, 1),
        "depressionRiskScore": score_depression(depth_avg, area_pct),
        "elevMin": round(float(np.nanmin(elev)), 1),
        "elevMax": round(float(np.nanmax(elev)), 1),
        "elevMean": round(float(np.nanmean(elev)), 1),
        "demSource": dem_source,
        "computedAt": datetime.now(timezone.utc).isoformat(),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description="ICT terrain depression batch (richdem)")
    ap.add_argument("--dem", required=True, type=Path, help="GLO-30 or SRTM GeoTIFF")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "data" / "terrain_depressions.json",
    )
    ap.add_argument(
        "--dem-source",
        default="COPERNICUS/DEM/GLO30 (richdem FillDepressions)",
    )
    args = ap.parse_args()

    zones = []
    for z in ZONES:
        print(f"  {z['name']}…", end=" ", flush=True)
        row = analyze_zone(args.dem, z, args.dem_source)
        zones.append(row)
        print(
            f"depth={row['depressionDepthAvg']}m area={row['depressionAreaPct']}% "
            f"score={row['depressionRiskScore']}"
        )

    payload = {
        "note": (
            "Structural terrain depression metrics. Refresh quarterly or after "
            "major earthworks — not daily. Written by scripts/terrain/compute_depressions.py"
        ),
        "demSource": args.dem_source,
        "computedAt": datetime.now(timezone.utc).isoformat(),
        "depthThresholdM": DEPTH_THRESHOLD_M,
        "zones": zones,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
