"""
FloodGuard scenario simulation — flash flood + shallow landslide, on real terrain.

FLASH FLOOD
  • Runoff:   SCS Curve Number (USDA NRCS TR-55) per cell from ESA WorldCover 2021 land cover.
              Hydrologic soil group from ISRIC SoilGrids texture when reachable, otherwise ASSUMED "C".
              Antecedent moisture (AMC I/II/III) adjusts CN (Chow, Maidment & Mays 1988).
  • Routing:  2D local-inertial shallow-water scheme (Bates, Horritt & Fewtrell 2010 — the
              LISFLOOD-FP formulation) on Copernicus GLO-30 resampled to the simulation grid,
              Manning's n from land cover, Froude-limited, mass-conserving flux limiter,
              free outflow at the domain edge.
  • Hazard:   flood hazard rating HR = d·(v + 0.5) + DF (UK EA/Defra FD2320).

SHALLOW LANDSLIDE
  • Infinite-slope factor of safety with steady-state wetness (Montgomery & Dietrich 1994,
    SHALSTAB; Pack et al. SINMAP): FS = [c + (γs − m·γw)·z·cos²θ·tanφ] / (γs·z·sinθ·cosθ),
    m = min(1, q·a / (T·sinθ)).  Soil strength/depth/conductivity are USER/ASSUMED parameters.
  • Runout:   D8 steepest-descent path from each failed cluster until the travel-angle
    criterion H/L < tan(reach angle) (Corominas 1996).

These are uncalibrated physically-based scenario models. They are not validated against
observed Wayanad events and must be labelled SIMULATION.
"""

from __future__ import annotations

import base64
import logging
import math
import time
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from rasterio.features import geometry_mask, shapes
from rasterio.transform import from_origin
from shapely.geometry import LineString, Point, mapping, shape
from shapely.ops import unary_union

from app.services.geo import rasters
from app.services.geo.common import utcnow_iso
from app.services.geo.hydrology import d8_accumulation, priority_flood, D8

logger = logging.getLogger(__name__)

G = 9.81
MAX_CELLS = 110          # flood grid cells along the longer side of the domain
MAX_LS_CELLS = 260       # landslide grid (native 30 m where possible)
N_FRAMES = 24
WET_M = 0.10             # cell counted as flooded
PEOPLE_M = 0.15          # depth at which people in a cell are counted as exposed
VEHICLE_M = 0.30         # road treated as impassable for vehicles (common flood-safety guidance)

# TR-55 curve numbers by WorldCover class for hydrologic soil groups A–D
CN_TABLE: Dict[int, Tuple[int, int, int, int]] = {
    10: (30, 55, 70, 77),   # tree cover → woods, good
    20: (35, 56, 70, 77),   # shrubland → brush, fair
    30: (49, 69, 79, 84),   # grassland → pasture, fair
    40: (67, 78, 85, 89),   # cropland → row crops, straight row, good
    50: (77, 85, 90, 92),   # built-up → residential ~65 % impervious
    60: (77, 86, 91, 94),   # bare → fallow, bare soil
    80: (98, 98, 98, 98),   # water
    90: (85, 85, 87, 88),   # herbaceous wetland (assumed near-saturated)
    95: (85, 85, 87, 88),
    100: (49, 69, 79, 84),
}
MANNING_N = {10: 0.12, 20: 0.08, 30: 0.035, 40: 0.04, 50: 0.05, 60: 0.03, 80: 0.03, 90: 0.07, 95: 0.08, 100: 0.035}

HAZARD_CLASSES = [(0.75, "LOW"), (1.25, "MODERATE"), (2.0, "SIGNIFICANT"), (float("inf"), "EXTREME")]


def hydrologic_soil_group(sand: Optional[float], clay: Optional[float]) -> Tuple[str, str]:
    if sand is None or clay is None:
        return "C", "ASSUMED (soil texture unavailable)"
    if clay > 40:
        return "D", f"SoilGrids texture (clay {clay:.0f} %)"
    if clay > 20:
        return "C", f"SoilGrids texture (clay {clay:.0f} %)"
    if sand > 70 and clay < 10:
        return "A", f"SoilGrids texture (sand {sand:.0f} %)"
    return "B", f"SoilGrids texture (sand {sand:.0f} %, clay {clay:.0f} %)"


def adjust_cn(cn: np.ndarray, amc: str) -> np.ndarray:
    if amc == "I":
        return 4.2 * cn / (10 - 0.058 * cn)
    if amc == "III":
        return np.minimum(99.0, 23 * cn / (10 + 0.13 * cn))
    return cn


def scs_runoff(p_mm: float, s_mm: np.ndarray) -> np.ndarray:
    ia = 0.2 * s_mm
    return np.where(p_mm > ia, (p_mm - ia) ** 2 / np.maximum(p_mm - ia + s_mm, 1e-6), 0.0)


def _b64(arr: np.ndarray) -> str:
    return base64.b64encode(np.ascontiguousarray(arr).tobytes()).decode()


def hazard_class(hr: float) -> str:
    for thr, name in HAZARD_CLASSES:
        if hr < thr:
            return name
    return "EXTREME"


# ======================================================================================= flood

def condition_dem(z: np.ndarray, dx: float, dy: float) -> Tuple[np.ndarray, Dict[str, float], np.ndarray]:
    """Hydrologic conditioning by D8 breaching.

    Copernicus GLO-30 is a surface model: tree canopy and bridges form false barriers across
    valleys that would trap water in spurious ponds. Following the Priority-Flood routing,
    each cell's downstream neighbour is lowered (if needed) to just below it, carving the
    lowest spill path through barriers instead of filling the pits behind them.
    """
    filled = priority_flood(z, eps=1e-3)
    direction, acc = d8_accumulation(filled, dx, dy)
    diag = math.hypot(dx, dy)
    step = [dy, diag, dx, diag, dy, diag, dx, diag]
    zb = z.copy()
    rows, cols = z.shape
    order = np.argsort(-filled, axis=None)
    flat_dir = direction.ravel()
    flat_z = zb.ravel()
    for idx in order:
        k = flat_dir[idx]
        if k < 0:
            continue
        r, c = divmod(int(idx), cols)
        rr, cc = r + D8[k][0], c + D8[k][1]
        if 0 <= rr < rows and 0 <= cc < cols:
            j = rr * cols + cc
            src = flat_z[idx]
            if k % 2 == 1:
                # Diagonal step: the 2D solver exchanges water only across N/S/E/W faces, so also
                # carve the lower of the two orthogonal neighbours to keep the breach 4-connected.
                m1, m2 = rr * cols + c, r * cols + cc
                m = m1 if flat_z[m1] <= flat_z[m2] else m2
                mid_limit = src - 0.005 * min(dx, dy)
                if flat_z[m] > mid_limit:
                    flat_z[m] = mid_limit
                src = min(src, flat_z[m])
                limit = src - 0.005 * min(dx, dy)
            else:
                limit = src - 0.005 * step[k]  # carve at ≥ 0.5 % gradient so breaches drain
            if flat_z[j] > limit:
                flat_z[j] = limit
    carve = z - zb
    stats = {"carved_cells_pct": round(100 * float((carve > 0.05).mean()), 2),
                "max_carve_m": round(float(carve.max()), 1), "mean_carve_m": round(float(carve[carve > 0.05].mean()) if (carve > 0.05).any() else 0.0, 2),
                "min_breach_gradient_pct": 0.5}
    return zb, stats, acc


def simulate_flood(
    zone_geom: Dict[str, Any],
    rainfall_mm: float,
    duration_h: float,
    amc: str,
    soil: Optional[Dict[str, float]],
    buildings: List[Dict[str, Any]],
    roads: List[Dict[str, Any]],
) -> Dict[str, Any]:
    t0 = time.time()
    zone = shape(zone_geom)
    w, s, e, n = zone.bounds
    pad = 0.3 * max(e - w, n - s)
    bounds = (w - pad, s - pad, e + pad, n + pad)
    span = max(bounds[2] - bounds[0], bounds[3] - bounds[1])
    res = max(2 / 3600, span / MAX_CELLS)
    z, transform = rasters.read_dem(bounds, res_deg=res)
    z = np.where(np.isnan(z), np.nanmin(z), z).astype("float64")
    ny, nx = z.shape
    lat_c = (s + n) / 2
    dx, dy = rasters.cell_size_m(lat_c, res)
    z, carved, acc_cells = condition_dem(z, dx, dy)
    cell_area = dx * dy

    lc = rasters.worldcover_window(bounds, (ny, nx)).astype(int)
    hsg, hsg_source = hydrologic_soil_group((soil or {}).get("sand"), (soil or {}).get("clay"))
    gi = "ABCD".index(hsg)
    cn = np.full(z.shape, CN_TABLE[30][gi], dtype="float64")
    nman = np.full(z.shape, 0.05)
    for code, vals in CN_TABLE.items():
        cn[lc == code] = vals[gi]
        nman[lc == code] = MANNING_N.get(code, 0.05)
    # Channels: mountain-stream roughness where the contributing area exceeds 0.5 km² (Chow 1959, n≈0.045)
    channel = acc_cells * dx * dy > 0.5e6
    nman[channel] = 0.045
    cn = adjust_cn(cn, amc)
    s_mm = 25400.0 / cn - 254.0

    inside = geometry_mask([mapping(zone)], out_shape=z.shape, transform=transform, invert=True)

    # Population per sim cell from HRSL (people per cell)
    pop = np.zeros(z.shape)
    try:
        pop_grid = rasters.hrsl_grid(bounds, res)
        for c in pop_grid["cells"]:
            cx = (c["bbox"][0] + c["bbox"][2]) / 2
            cy = (c["bbox"][1] + c["bbox"][3]) / 2
            col, row = ~transform * (cx, cy)
            r, cc = int(row), int(col)
            if 0 <= r < ny and 0 <= cc < nx:
                pop[r, cc] += c["population"]
    except Exception as exc:  # noqa: BLE001
        logger.info("HRSL unavailable for simulation: %s", exc)

    inv = ~transform

    def cell_of(lon: float, lat: float) -> Optional[Tuple[int, int]]:
        col, row = inv * (lon, lat)
        r, c = int(row), int(col)
        return (r, c) if 0 <= r < ny and 0 <= c < nx else None

    b_cells = []
    for b in buildings:
        rc = cell_of(*b["centroid"])
        if rc and inside[rc]:
            b_cells.append((b["osm_id"], rc))
    r_cells: List[Tuple[Dict[str, Any], List[Tuple[int, int]]]] = []
    for rd in roads:
        pts = rd["coords"]
        cells = set()
        for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
            steps = max(1, int(math.hypot((x2 - x1) / res, (y2 - y1) / res) * 2))
            for k in range(steps + 1):
                rc = cell_of(x1 + (x2 - x1) * k / steps, y1 + (y2 - y1) * k / steps)
                if rc and inside[rc]:
                    cells.add(rc)
        if cells:
            r_cells.append((rd, sorted(cells)))

    # ---- state
    h = np.zeros(z.shape)
    qx = np.zeros((ny, nx - 1))
    qy = np.zeros((ny - 1, nx))
    nx2 = (0.5 * (nman[:, :-1] + nman[:, 1:])) ** 2
    ny2 = (0.5 * (nman[:-1, :] + nman[1:, :])) ** 2
    zx = np.maximum(z[:, :-1], z[:, 1:])
    zy = np.maximum(z[:-1, :], z[1:, :])

    total_h = duration_h + max(2.0, min(duration_h, 4.0))
    total_s = total_h * 3600.0
    frame_dt = total_s / N_FRAMES
    intensity = rainfall_mm / duration_h  # mm/h
    excess_prev = np.zeros(z.shape)
    max_h = np.zeros(z.shape)
    max_hr = np.zeros(z.shape)
    first_wet = np.full(z.shape, np.nan)
    frames: List[Dict[str, Any]] = []
    b_depth = {bid: [] for bid, _ in b_cells}
    r_depth: List[List[float]] = [[] for _ in r_cells]

    t = 0.0
    next_frame = 0.0
    steps = 0
    mass_in = 0.0
    mass_out = 0.0

    def snapshot():
        vx = np.zeros(z.shape)
        vy = np.zeros(z.shape)
        vx[:, 1:-1] = 0.5 * (qx[:, :-1] + qx[:, 1:])
        vy[1:-1, :] = 0.5 * (qy[:-1, :] + qy[1:, :])
        v = np.hypot(vx, vy) / np.maximum(h, 0.05)
        v = np.where(h > 0.02, np.minimum(v, 15.0), 0.0)
        hr = h * (v + 0.5) + np.where(h > 0.25, 0.5, 0.0)
        return v, hr

    while True:
        if t >= next_frame - 1e-6:
            v, hr = snapshot()
            np.maximum(max_hr, np.where(inside, hr, 0), out=max_hr)
            hz = np.where(inside, h, 0.0)
            wet = hz > WET_M
            rain_now = intensity if t < duration_h * 3600 else 0.0
            p_cum = min(t / 3600.0, duration_h) * intensity
            frames.append({
                "t_h": round(t / 3600.0, 3),
                "rain_mm_h": round(rain_now, 2),
                "rain_cum_mm": round(p_cum, 1),
                "excess_cum_mm": round(float(np.mean(excess_prev[inside])) if inside.any() else 0.0, 1),
                "flooded_km2": round(float(wet.sum()) * cell_area / 1e6, 3),
                "max_depth_m": round(float(hz.max()), 2),
                "volume_m3": round(float(hz.sum() * cell_area), 0),
                "people_exposed": round(float(pop[(hz > PEOPLE_M)].sum()), 0),
                "max_velocity_ms": round(float(np.where(inside, v, 0).max()), 2),
                "depth_b64": _b64(np.clip(hz * 100, 0, 65535).astype("<u2")),
            })
            for bid, rc in b_cells:
                b_depth[bid].append(float(hz[rc]))
            for k, (_, cells) in enumerate(r_cells):
                r_depth[k].append(float(max(hz[c] for c in cells)))
            next_frame += frame_dt
            if len(frames) > N_FRAMES:
                break

        hmax_now = float(h.max())
        dt = 0.7 * min(dx, dy) / math.sqrt(G * max(hmax_now, 0.05))
        dt = min(dt, 10.0, max(0.05, next_frame - t))

        # rainfall excess (SCS-CN, cumulative) over this step
        p_next = min((t + dt) / 3600.0, duration_h) * intensity
        excess = scs_runoff(p_next, s_mm)
        add = (excess - excess_prev) / 1000.0
        excess_prev = excess
        h += add
        mass_in += float(add.sum() * cell_area)

        eta = z + h
        # x-faces
        hfx = np.maximum(eta[:, :-1], eta[:, 1:]) - zx
        sx = (eta[:, 1:] - eta[:, :-1]) / dx
        wetx = hfx > 1e-3
        hfx_s = np.where(wetx, hfx, 1.0)
        qx = np.where(wetx, (qx - G * hfx_s * dt * sx) / (1 + G * dt * nx2 * np.abs(qx) / hfx_s ** (7 / 3)), 0.0)
        lim = hfx_s * np.sqrt(G * hfx_s)
        qx = np.clip(qx, -lim, lim)
        # y-faces (row index increases southwards)
        hfy = np.maximum(eta[:-1, :], eta[1:, :]) - zy
        sy = (eta[1:, :] - eta[:-1, :]) / dy
        wety = hfy > 1e-3
        hfy_s = np.where(wety, hfy, 1.0)
        qy = np.where(wety, (qy - G * hfy_s * dt * sy) / (1 + G * dt * ny2 * np.abs(qy) / hfy_s ** (7 / 3)), 0.0)
        lim = hfy_s * np.sqrt(G * hfy_s)
        qy = np.clip(qy, -lim, lim)

        # mass-conserving limiter: a cell cannot export more water than it holds
        out = np.zeros(z.shape)
        out[:, :-1] += np.maximum(qx, 0) / dx
        out[:, 1:] += np.maximum(-qx, 0) / dx
        out[:-1, :] += np.maximum(qy, 0) / dy
        out[1:, :] += np.maximum(-qy, 0) / dy
        out *= dt
        f = np.where(out > h, h / np.maximum(out, 1e-12), 1.0)
        qx = np.where(qx > 0, qx * f[:, :-1], qx * f[:, 1:])
        qy = np.where(qy > 0, qy * f[:-1, :], qy * f[1:, :])

        dh = np.zeros(z.shape)
        dh[:, :-1] -= qx / dx
        dh[:, 1:] += qx / dx
        dh[:-1, :] -= qy / dy
        dh[1:, :] += qy / dy
        h = np.maximum(h + dt * dh, 0.0)

        # free outflow: the domain edge is a sink
        edge_vol = float((h[0, :].sum() + h[-1, :].sum() + h[1:-1, 0].sum() + h[1:-1, -1].sum()) * cell_area)
        mass_out += edge_vol
        h[0, :] = h[-1, :] = 0.0
        h[:, 0] = h[:, -1] = 0.0

        np.maximum(max_h, np.where(inside, h, 0), out=max_h)
        newly = np.isnan(first_wet) & (h > WET_M) & inside
        first_wet[newly] = (t + dt) / 3600.0
        t += dt
        steps += 1
        if t > total_s + 1:
            break

    # ---- impacts
    times = [f["t_h"] for f in frames]
    b_out = {}
    for bid, depths in b_depth.items():
        md = max(depths) if depths else 0.0
        if md > WET_M:
            first = next((times[i] for i, d in enumerate(depths) if d > WET_M), None)
            b_out[str(bid)] = {"max_depth_m": round(md, 2), "first_wet_h": first, "depths": [round(d, 2) for d in depths]}
    r_out = []
    for (rd, _), depths in zip(r_cells, r_depth):
        md = max(depths) if depths else 0.0
        if md > VEHICLE_M:
            first = next((times[i] for i, d in enumerate(depths) if d > VEHICLE_M), None)
            r_out.append({"osm_id": rd["osm_id"], "name": rd.get("name"), "class": rd.get("class"),
                          "max_depth_m": round(md, 2), "t_impassable_h": first,
                          "depths": [round(d, 2) for d in depths]})
    for f_ in frames:
        i = times.index(f_["t_h"])
        f_["buildings_wet"] = sum(1 for v in b_out.values() if v["depths"][i] > WET_M)
        f_["roads_impassable"] = sum(1 for r in r_out if r["depths"][i] > VEHICLE_M)

    hz_max = np.where(inside, max_h, 0.0)
    hr_class = np.zeros(z.shape, dtype="u1")
    for k, (thr, _) in enumerate(HAZARD_CLASSES):
        lower = 0 if k == 0 else HAZARD_CLASSES[k - 1][0]
        hr_class[(max_hr >= lower) & (max_hr < thr) & (hz_max > WET_M)] = k + 1

    w_, n_ = transform.c, transform.f
    e_, s_ = w_ + transform.a * nx, n_ + transform.e * ny
    peak = max(frames, key=lambda f_: f_["flooded_km2"])
    return {
        "grid": {"bounds": [w_, s_, e_, n_], "nx": nx, "ny": ny, "dx_m": round(dx, 1), "dy_m": round(dy, 1),
                 "coordinates": [[w_, n_], [e_, n_], [e_, s_], [w_, s_]], "res_deg": res},
        "zone_mask_b64": _b64(inside.astype("u1")),
        "frames": frames,
        "max_depth_b64": _b64(np.clip(hz_max * 100, 0, 65535).astype("<u2")),
        "hazard_b64": _b64(hr_class),
        "hazard_classes": ["NONE"] + [c for _, c in HAZARD_CLASSES],
        "buildings": b_out,
        "roads": r_out,
        "summary": {
            "max_depth_m": round(float(hz_max.max()), 2),
            "peak_flooded_km2": peak["flooded_km2"],
            "peak_time_h": peak["t_h"],
            "people_exposed_peak": max(f_["people_exposed"] for f_ in frames),
            "buildings_wet": len(b_out),
            "roads_impassable": len(r_out),
            "hazard_cells": {c: int((hr_class == k + 1).sum()) for k, (_, c) in enumerate(HAZARD_CLASSES)},
            "mass_balance_error_pct": round(100 * abs(mass_in - mass_out - float(h.sum() * cell_area)) / max(mass_in, 1.0), 2),
            "steps": steps,
            "compute_s": round(time.time() - t0, 1),
        },
        "setup": {
            "grid_resolution_m": round((dx + dy) / 2, 1),
            "domain_padding": "30 % around the zone to include upstream contributing area",
            "dem_conditioning": {"method": "D8 breaching after Priority-Flood routing", **carved},
            "channel_roughness": "Manning n = 0.045 where contributing area > 0.5 km² (Chow 1959); land-cover n elsewhere",
            "hydrologic_soil_group": hsg, "hsg_source": hsg_source, "amc": amc,
            "rain_intensity_mm_h": round(intensity, 2),
            "simulated_hours": round(total_h, 2),
        },
    }


# ======================================================================================= landslide

def simulate_landslide(
    zone_geom: Dict[str, Any],
    rainfall_mm: float,
    duration_h: float,
    soil_depth_m: float,
    cohesion_kpa: float,
    friction_deg: float,
    ksat_mm_h: float,
    reach_angle_deg: float,
    infiltration_fraction: float,
    buildings: List[Dict[str, Any]],
    roads: List[Dict[str, Any]],
) -> Dict[str, Any]:
    from scipy import ndimage

    zone = shape(zone_geom)
    w, s, e, n = zone.bounds
    pad = 0.3 * max(e - w, n - s)
    bounds = (w - pad, s - pad, e + pad, n + pad)
    span = max(bounds[2] - bounds[0], bounds[3] - bounds[1])
    res = max(1 / 3600, span / MAX_LS_CELLS)
    dem, transform = rasters.read_dem(bounds, res_deg=res)
    dem = np.where(np.isnan(dem), np.nanmin(dem), dem)
    dx, dy = rasters.cell_size_m((s + n) / 2, res)
    cw = (dx + dy) / 2
    slope_deg, _ = rasters.slope_aspect(dem, dx, dy)
    filled = priority_flood(dem)
    direction, acc = d8_accumulation(filled, dx, dy)
    a = acc * dx * dy / cw  # specific catchment area (m)
    lc = rasters.worldcover_window(bounds, dem.shape).astype(int)
    inside = geometry_mask([mapping(zone)], out_shape=dem.shape, transform=transform, invert=True)

    th = np.radians(np.maximum(slope_deg, 0.1))
    gamma_s, gamma_w = 19.0, 9.81  # kN/m3 (γs ASSUMED)
    T = ksat_mm_h / 1000.0 * 24.0 * soil_depth_m  # m2/day
    intensity = rainfall_mm / duration_h
    q = intensity * infiltration_fraction * 24.0 / 1000.0  # m/day recharge
    m = np.minimum(1.0, q * a / (T * np.sin(th)))
    fs = (cohesion_kpa + (gamma_s - m * gamma_w) * soil_depth_m * np.cos(th) ** 2 * math.tan(math.radians(friction_deg))) / (
        gamma_s * soil_depth_m * np.sin(th) * np.cos(th))
    valid = (slope_deg >= 10) & (lc != 80) & (lc != 50)
    fs = np.where(valid, fs, np.inf)
    unstable = (fs < 1.0) & valid

    # time to wet the soil column to the (drainable porosity 0.10, ASSUMED) storage
    t_sat = min(duration_h, soil_depth_m * 0.10 * 1000.0 / max(intensity * infiltration_fraction, 0.1))

    labels, nlab = ndimage.label(unstable, structure=np.ones((3, 3)))
    sources, paths = [], []
    tan_reach = math.tan(math.radians(reach_angle_deg))
    for lab in range(1, nlab + 1):
        rr, cc = np.nonzero(labels == lab)
        if len(rr) < 2:
            continue
        if not inside[rr, cc].any():
            continue
        top = int(np.argmax(dem[rr, cc]))
        low = int(np.argmin(dem[rr, cc]))
        z_top = float(dem[rr[top], cc[top]])
        r, c = int(rr[low]), int(cc[low])
        coords = []
        dist = 0.0
        prev = None
        x0, y0 = transform * (cc[top] + 0.5, rr[top] + 0.5)
        coords.append([round(x0, 6), round(y0, 6)])
        for _ in range(600):
            x, y = transform * (c + 0.5, r + 0.5)
            if prev is not None:
                dist += math.hypot((x - prev[0]) * dx / res, (y - prev[1]) * dy / res)
            prev = (x, y)
            coords.append([round(x, 6), round(y, 6)])
            drop = z_top - float(dem[r, c])
            if dist > 200 and drop / max(dist, 1.0) < tan_reach:
                break
            k = direction[r, c]
            if k < 0:
                break
            r2, c2 = r + D8[k][0], c + D8[k][1]
            if not (0 <= r2 < dem.shape[0] and 0 <= c2 < dem.shape[1]):
                break
            r, c = r2, c2
        area = len(rr) * dx * dy
        sources.append({"type": "Feature", "properties": {"id": lab, "failed_area_m2": round(area), "top_elevation_m": round(z_top, 1),
                                                            "min_fs": round(float(fs[rr, cc].min()), 2)},
                        "geometry": {"type": "Point", "coordinates": [round(x0, 6), round(y0, 6)]}})
        if len(coords) >= 3:
            paths.append({"type": "Feature", "properties": {"id": lab, "runout_m": round(dist), "drop_m": round(z_top - float(dem[r, c]), 1),
                                                          "t_fail_h": round(t_sat, 2), "failed_area_m2": round(area)},
                          "geometry": {"type": "LineString", "coordinates": coords}})

    # failure polygons (vectorised unstable cells)
    polys = [{"type": "Feature", "properties": {"class": "UNSTABLE (FS<1)"}, "geometry": g}
             for g, v in shapes(unstable.astype("u1"), mask=unstable, transform=transform) if v == 1]
    marginal = (fs >= 1.0) & (fs < 1.25) & valid & inside
    fs_img = np.full(dem.shape, np.nan)
    fs_img[valid & inside] = np.clip(fs[valid & inside], 0, 3)
    # Only unstable (FS < 1) and marginal (1–1.25) cells are coloured; stable ground stays clear.
    fs_img[fs_img >= 1.25] = np.nan
    png = rasters.to_png(rasters.colorize(fs_img, [
        (0.0, (130, 0, 30, 200)), (0.99, (215, 35, 45, 170)), (1.0, (245, 140, 40, 110)), (1.249, (250, 200, 70, 70))]))

    # impacts along debris corridors (25 m either side, ASSUMED corridor width)
    corridor = unary_union([LineString(p_["geometry"]["coordinates"]).buffer(25 / 111320.0) for p_ in paths]) if paths else None
    hit_b, hit_r = [], []
    if corridor is not None:
        for b in buildings:
            if corridor.contains(Point(b["centroid"])):
                hit_b.append(b["osm_id"])
        for rd in roads:
            if corridor.intersects(LineString(rd["coords"])):
                hit_r.append({"osm_id": rd["osm_id"], "name": rd.get("name"), "class": rd.get("class"), "t_blocked_h": round(t_sat, 2)})
    pop_hit = None
    if corridor is not None:
        try:
            pop_hit = round(rasters.hrsl_population(corridor.intersection(zone.buffer(0.01)))["population"])
        except Exception:  # noqa: BLE001
            pop_hit = None

    w_, n_ = transform.c, transform.f
    e_, s_ = w_ + transform.a * dem.shape[1], n_ + transform.e * dem.shape[0]
    return {
        "fs_png": "data:image/png;base64," + base64.b64encode(png).decode(),
        "coordinates": [[w_, n_], [e_, n_], [e_, s_], [w_, s_]],
        "unstable": {"type": "FeatureCollection", "features": polys},
        "sources": {"type": "FeatureCollection", "features": sources},
        "debris": {"type": "FeatureCollection", "features": paths},
        "t_fail_h": round(t_sat, 2),
        "impacts": {"buildings": hit_b, "roads": hit_r, "people_in_corridors_hrsl": pop_hit},
        "summary": {
            "unstable_area_km2": round(float((unstable & inside).sum()) * dx * dy / 1e6, 3),
            "marginal_area_km2": round(float(marginal.sum()) * dx * dy / 1e6, 3),
            "failure_clusters": len(sources),
            "debris_paths": len(paths),
            "max_runout_m": max((p_["properties"]["runout_m"] for p_ in paths), default=0),
            "buildings_in_corridors": len(hit_b),
            "roads_blocked": len(hit_r),
            "grid_resolution_m": round(cw, 1),
        },
        "setup": {"soil_depth_m": soil_depth_m, "cohesion_kpa": cohesion_kpa, "friction_deg": friction_deg,
                  "ksat_mm_h": ksat_mm_h, "reach_angle_deg": reach_angle_deg, "infiltration_fraction": infiltration_fraction,
                  "unit_weight_kn_m3": gamma_s, "drainable_porosity": 0.10, "debris_corridor_half_width_m": 25},
    }


def assumptions(kind: str, flood_setup: Optional[dict], ls_setup: Optional[dict]) -> List[str]:
    out = []
    if kind in ("flood", "combined"):
        out += [
            "Terrain is Copernicus GLO-30, a surface model that includes tree canopy and buildings; it was hydrologically conditioned by D8 breaching "
            f"({flood_setup['dem_conditioning']['carved_cells_pct']} % of cells lowered, max {flood_setup['dem_conditioning']['max_carve_m']} m). Depths are indicative, not surveyed.",
            f"Hydrologic soil group {flood_setup['hydrologic_soil_group']} — {flood_setup['hsg_source']}; antecedent moisture class {flood_setup['amc']}.",
            "Rainfall is uniform in space and time over the scenario duration (design-storm scenario, not a forecast).",
            "River channel geometry below ~30 m is not resolved; in-channel conveyance is underestimated and out-of-bank depths may be overestimated.",
            "No calibration against observed Wayanad floods has been performed.",
        ]
    if kind in ("landslide", "combined"):
        out += [
            "Soil depth, cohesion, friction angle, conductivity and unit weight are ASSUMED/user parameters — no site-specific geotechnical data is connected.",
            "Steady-state wetness (SHALSTAB assumption); built-up and water cells excluded; slopes < 10° treated as stable.",
            f"Debris runout follows D8 steepest descent until H/L < tan({ls_setup['reach_angle_deg']}°); animation timing is illustrative, not a velocity estimate.",
        ]
    return out
