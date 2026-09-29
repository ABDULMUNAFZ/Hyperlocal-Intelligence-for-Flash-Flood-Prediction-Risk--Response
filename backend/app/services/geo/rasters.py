"""
Windowed reads from public cloud-optimized rasters.

  • Copernicus DEM GLO-30 (ESA / Airbus, 30 m)          — elevation, slope, aspect
  • ESA WorldCover 2021 v200 (10 m)                      — land cover
  • Meta & CIESIN High Resolution Settlement Layer v1.5  — population (30 m)

All functions are blocking (rasterio/GDAL); call them through asyncio.to_thread.
"""

from __future__ import annotations

import logging
import math
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.features import geometry_mask
from rasterio.io import MemoryFile
from rasterio.merge import merge
from rasterio.transform import from_bounds as transform_from_bounds
from rasterio.windows import from_bounds as window_from_bounds
from shapely.geometry import mapping
from shapely.geometry.base import BaseGeometry

logger = logging.getLogger(__name__)

GDAL_ENV = dict(
    GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR",
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.vrt",
    GDAL_HTTP_MAX_RETRY=2,
    GDAL_HTTP_RETRY_DELAY=1,
    GDAL_HTTP_TIMEOUT=25,
    GDAL_HTTP_CONNECTTIMEOUT=10,
    VSI_CACHE=True,
    VSI_CACHE_SIZE=67108864,
    GDAL_CACHEMAX=256,
)

Bounds = Tuple[float, float, float, float]  # min_lon, min_lat, max_lon, max_lat

DEM_SOURCE = "Copernicus DEM GLO-30 (© DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the EU and ESA)"
DEM_URL = "https://registry.opendata.aws/copernicus-dem/"
WORLDCOVER_SOURCE = "ESA WorldCover 10 m 2021 v200 (© ESA WorldCover project 2021, CC BY 4.0)"
WORLDCOVER_URL = "https://esa-worldcover.org/"
HRSL_SOURCE = "High Resolution Settlement Layer v1.5 — Meta Data for Good & CIESIN, Columbia University (CC BY 4.0)"
HRSL_URL = "https://dataforgood.facebook.com/dfg/tools/high-resolution-population-density-maps"

WORLDCOVER_CLASSES: Dict[int, Tuple[str, Tuple[int, int, int]]] = {
    10: ("Tree cover", (0, 100, 0)),
    20: ("Shrubland", (255, 187, 34)),
    30: ("Grassland", (255, 255, 76)),
    40: ("Cropland", (240, 150, 255)),
    50: ("Built-up", (250, 0, 0)),
    60: ("Bare / sparse vegetation", (180, 180, 180)),
    70: ("Snow and ice", (240, 240, 240)),
    80: ("Permanent water bodies", (0, 100, 200)),
    90: ("Herbaceous wetland", (0, 150, 160)),
    95: ("Mangroves", (0, 207, 117)),
    100: ("Moss and lichen", (250, 230, 160)),
}


# --------------------------------------------------------------------------- tiles

def _dem_tile_urls(bounds: Bounds) -> List[str]:
    min_lon, min_lat, max_lon, max_lat = bounds
    urls = []
    for lat in range(math.floor(min_lat), math.floor(max_lat - 1e-9) + 1):
        for lon in range(math.floor(min_lon), math.floor(max_lon - 1e-9) + 1):
            ns = "N" if lat >= 0 else "S"
            ew = "E" if lon >= 0 else "W"
            name = f"Copernicus_DSM_COG_10_{ns}{abs(lat):02d}_00_{ew}{abs(lon):03d}_00_DEM"
            urls.append(f"/vsicurl/https://copernicus-dem-30m.s3.amazonaws.com/{name}/{name}.tif")
    return urls


def _worldcover_tile_url(lon: float, lat: float) -> str:
    tlat = math.floor(lat / 3) * 3
    tlon = math.floor(lon / 3) * 3
    ns = "N" if tlat >= 0 else "S"
    ew = "E" if tlon >= 0 else "W"
    tile = f"{ns}{abs(tlat):02d}{ew}{abs(tlon):03d}"
    return (
        "/vsicurl/https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/"
        f"ESA_WorldCover_10m_2021_v200_{tile}_Map.tif"
    )


HRSL_URL_VSI = "/vsicurl/https://dataforgood-fb-data.s3.amazonaws.com/hrsl-cogs/hrsl_general/hrsl_general-latest.vrt"


# --------------------------------------------------------------------------- DEM

def read_dem(bounds: Bounds, res_deg: float = 1 / 3600) -> Tuple[np.ndarray, Any]:
    """Mosaic Copernicus GLO-30 over bounds at the requested resolution (degrees).

    Returns (elevation float32 array with NaN for no-data, affine transform).
    """
    with rasterio.Env(**GDAL_ENV):
        datasets = [rasterio.open(u) for u in _dem_tile_urls(bounds)]
        try:
            arr, transform = merge(
                datasets, bounds=bounds, res=(res_deg, res_deg),
                resampling=Resampling.bilinear, nodata=-32767.0, dtype="float32",
            )
        finally:
            for ds in datasets:
                ds.close()
    dem = arr[0].astype("float32")
    dem[dem <= -32000] = np.nan
    return dem, transform


def cell_size_m(lat: float, res_deg: float) -> Tuple[float, float]:
    """(dx, dy) in metres for a geographic cell at latitude."""
    dy = res_deg * 111_320.0
    dx = res_deg * 111_320.0 * math.cos(math.radians(lat))
    return dx, dy


def slope_aspect(dem: np.ndarray, dx: float, dy: float) -> Tuple[np.ndarray, np.ndarray]:
    """Horn (1981) slope (degrees) and aspect (degrees clockwise from north, downslope direction)."""
    z = np.pad(dem, 1, mode="edge")
    a, b, c = z[:-2, :-2], z[:-2, 1:-1], z[:-2, 2:]
    d, f = z[1:-1, :-2], z[1:-1, 2:]
    g, h, i = z[2:, :-2], z[2:, 1:-1], z[2:, 2:]
    dzdx = ((c + 2 * f + i) - (a + 2 * d + g)) / (8 * dx)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + c)) / (8 * dy)  # +y is south (row increases)
    slope = np.degrees(np.arctan(np.hypot(dzdx, dzdy)))
    # Downslope direction: gradient points uphill; negate. north = -row direction.
    aspect = (np.degrees(np.arctan2(-dzdx, dzdy)) + 360.0) % 360.0
    return slope.astype("float32"), aspect.astype("float32")


def aspect_label(deg: float) -> str:
    dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
    return dirs[int(((deg + 22.5) % 360) // 45)]


def terrain_class(elev: float, slope: float) -> str:
    """Descriptive landform class from slope thresholds (FAO Guidelines for Soil Description, 2006)."""
    if slope < 2:
        form = "Flat / valley floor"
    elif slope < 5:
        form = "Gently sloping"
    elif slope < 10:
        form = "Sloping"
    elif slope < 15:
        form = "Strongly sloping"
    elif slope < 30:
        form = "Moderately steep"
    elif slope < 45:
        form = "Steep"
    else:
        form = "Very steep"
    return form


def sample_terrain(lon: float, lat: float) -> Dict[str, Any]:
    half = 3 / 3600  # 3 cells each side at 30 m
    dem, _ = read_dem((lon - half, lat - half, lon + half, lat + half))
    dx, dy = cell_size_m(lat, 1 / 3600)
    slope, aspect = slope_aspect(dem, dx, dy)
    r, c = dem.shape[0] // 2, dem.shape[1] // 2
    elev = float(dem[r, c])
    if math.isnan(elev):
        return {"available": False}
    s = float(slope[r, c])
    a = float(aspect[r, c])
    return {
        "available": True,
        "elevation_m": round(elev, 1),
        "slope_deg": round(s, 1),
        "aspect_deg": round(a, 0),
        "aspect": aspect_label(a),
        "terrain_class": terrain_class(elev, s),
        "resolution_m": 30,
    }


# --------------------------------------------------------------------------- WorldCover

def worldcover_point(lon: float, lat: float) -> Optional[Dict[str, Any]]:
    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(_worldcover_tile_url(lon, lat)) as ds:
            row, col = ds.index(lon, lat)
            val = ds.read(1, window=((row, row + 1), (col, col + 1)))
    code = int(val[0, 0])
    if code not in WORLDCOVER_CLASSES:
        return None
    return {"code": code, "label": WORLDCOVER_CLASSES[code][0]}


def worldcover_window(bounds: Bounds, out_shape: Tuple[int, int]) -> np.ndarray:
    """Read WorldCover (nearest-neighbour) resampled to out_shape (rows, cols)."""
    cx = (bounds[0] + bounds[2]) / 2
    cy = (bounds[1] + bounds[3]) / 2
    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(_worldcover_tile_url(cx, cy)) as ds:
            w = window_from_bounds(*bounds, transform=ds.transform)
            return ds.read(1, window=w, out_shape=out_shape, resampling=Resampling.mode)


def worldcover_fractions(geom: BaseGeometry, res_deg: float = 0.0001) -> Dict[str, Any]:
    b = geom.bounds
    rows = max(1, int(round((b[3] - b[1]) / res_deg)))
    cols = max(1, int(round((b[2] - b[0]) / res_deg)))
    scale = max(1.0, math.sqrt(rows * cols / 1_000_000))
    rows, cols = int(rows / scale), int(cols / scale)
    arr = worldcover_window(b, (rows, cols))
    transform = transform_from_bounds(*b, cols, rows)
    inside = geometry_mask([mapping(geom)], out_shape=(rows, cols), transform=transform, invert=True)
    vals = arr[inside]
    total = int(vals.size)
    out = []
    if total:
        codes, counts = np.unique(vals, return_counts=True)
        for code, cnt in sorted(zip(codes.tolist(), counts.tolist()), key=lambda x: -x[1]):
            if code in WORLDCOVER_CLASSES:
                out.append({"code": code, "label": WORLDCOVER_CLASSES[code][0], "fraction": round(cnt / total, 4)})
    return {"classes": out, "pixels": total}


# --------------------------------------------------------------------------- HRSL population

def hrsl_population(geom: BaseGeometry) -> Dict[str, Any]:
    """Sum HRSL population (people per 30 m pixel) inside geometry."""
    b = geom.bounds
    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(HRSL_URL_VSI) as ds:
            w = window_from_bounds(*b, transform=ds.transform).round_offsets().round_lengths()
            arr = ds.read(1, window=w, masked=False).astype("float64")
            transform = ds.window_transform(w)
            nodata = ds.nodata
    if arr.size == 0:
        return {"population": 0.0, "pixels": 0}
    if nodata is not None:
        arr[arr == nodata] = np.nan
    inside = geometry_mask([mapping(geom)], out_shape=arr.shape, transform=transform, invert=True)
    vals = arr[inside]
    return {
        "population": float(np.nansum(vals)),
        "populated_pixels": int(np.count_nonzero(~np.isnan(vals) & (vals > 0))),
        "pixels": int(vals.size),
    }


def hrsl_grid(bounds: Bounds, cell_deg: float) -> Dict[str, Any]:
    """Aggregate HRSL population into square cells of cell_deg (sum of people per cell)."""
    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(HRSL_URL_VSI) as ds:
            w = window_from_bounds(*bounds, transform=ds.transform).round_offsets().round_lengths()
            arr = ds.read(1, window=w).astype("float64")
            transform = ds.window_transform(w)
            nodata = ds.nodata
            px = ds.res[0]
    if nodata is not None:
        arr[arr == nodata] = np.nan
    arr = np.nan_to_num(arr, nan=0.0)
    k = max(1, int(round(cell_deg / px)))
    rows, cols = arr.shape[0] // k, arr.shape[1] // k
    if rows == 0 or cols == 0:
        return {"cells": [], "cell_deg": cell_deg}
    blocks = arr[: rows * k, : cols * k].reshape(rows, k, cols, k).sum(axis=(1, 3))
    x0, y0 = transform.c, transform.f
    step = k * px
    cells = []
    for r in range(rows):
        for c in range(cols):
            v = float(blocks[r, c])
            if v < 0.5:
                continue
            lon0 = x0 + c * step
            lat1 = y0 - r * step
            cells.append({"bbox": [lon0, lat1 - step, lon0 + step, lat1], "population": round(v, 1)})
    return {"cells": cells, "cell_deg": step}


# --------------------------------------------------------------------------- PNG rendering

def to_png(rgba: np.ndarray) -> bytes:
    """Encode an (H, W, 4) uint8 array as PNG."""
    h, w, _ = rgba.shape
    with MemoryFile() as mem:
        with mem.open(driver="PNG", width=w, height=h, count=4, dtype="uint8") as dst:
            dst.write(np.moveaxis(rgba, 2, 0))
        return mem.read()


def colorize(values: np.ndarray, stops: List[Tuple[float, Tuple[int, int, int, int]]]) -> np.ndarray:
    """Piecewise-linear colour ramp. NaN → transparent."""
    out = np.zeros(values.shape + (4,), dtype="uint8")
    xs = np.array([s[0] for s in stops], dtype="float64")
    cols = np.array([s[1] for s in stops], dtype="float64")
    v = np.nan_to_num(values.astype("float64"), nan=np.nan)
    valid = ~np.isnan(v)
    for ch in range(4):
        out[..., ch][valid] = np.interp(v[valid], xs, cols[:, ch]).astype("uint8")
    return out


SLOPE_STOPS = [
    (0, (255, 255, 255, 0)),
    (5, (254, 240, 180, 60)),
    (15, (253, 190, 90, 140)),
    (25, (240, 110, 50, 190)),
    (35, (200, 30, 40, 215)),
    (50, (110, 0, 40, 235)),
]

ELEVATION_STOPS = [
    (0, (40, 110, 60, 200)),
    (300, (110, 160, 80, 200)),
    (700, (200, 200, 120, 200)),
    (1000, (190, 150, 90, 200)),
    (1500, (150, 110, 80, 210)),
    (2100, (240, 240, 240, 220)),
]


def worldcover_rgba(arr: np.ndarray, alpha: int = 200) -> np.ndarray:
    out = np.zeros(arr.shape + (4,), dtype="uint8")
    for code, (_, rgb) in WORLDCOVER_CLASSES.items():
        m = arr == code
        out[m, 0], out[m, 1], out[m, 2], out[m, 3] = rgb[0], rgb[1], rgb[2], alpha
    return out
