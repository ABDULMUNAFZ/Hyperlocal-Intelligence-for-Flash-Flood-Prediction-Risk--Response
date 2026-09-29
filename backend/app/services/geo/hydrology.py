"""
Terrain hydrology derived from the Copernicus GLO-30 DEM.

Algorithms (all standard, deterministic):
  • Depression filling: Priority-Flood with epsilon (Barnes, Lehman & Mulla 2014)
  • Flow direction:     D8 steepest descent (O'Callaghan & Mark 1984)
  • Flow accumulation:  upstream contributing cell count, processed high→low
  • Wetness index:      TWI = ln(a / tan β)  (Beven & Kirkby 1979)

These describe where surface runoff *would concentrate* on the terrain. They are
not a flood-inundation model and do not produce water depth or extent.
"""

from __future__ import annotations

import heapq
import math
from typing import Any, Dict, List, Tuple

import numpy as np

# D8 neighbour offsets (row, col) — index 0..7
D8 = [(-1, 0), (-1, 1), (0, 1), (1, 1), (1, 0), (1, -1), (0, -1), (-1, -1)]


def priority_flood(dem: np.ndarray, eps: float = 1e-3) -> np.ndarray:
    rows, cols = dem.shape
    filled = dem.astype("float64").copy()
    nan = np.isnan(filled)
    if nan.any():
        filled[nan] = np.nanmin(filled) if (~nan).any() else 0.0
    closed = np.zeros(dem.shape, dtype=bool)
    heap: List[Tuple[float, int, int]] = []
    for r in range(rows):
        for c in (0, cols - 1):
            if not closed[r, c]:
                closed[r, c] = True
                heapq.heappush(heap, (filled[r, c], r, c))
    for c in range(cols):
        for r in (0, rows - 1):
            if not closed[r, c]:
                closed[r, c] = True
                heapq.heappush(heap, (filled[r, c], r, c))
    while heap:
        z, r, c = heapq.heappop(heap)
        for dr, dc in D8:
            nr, nc = r + dr, c + dc
            if 0 <= nr < rows and 0 <= nc < cols and not closed[nr, nc]:
                closed[nr, nc] = True
                if filled[nr, nc] <= z:
                    filled[nr, nc] = z + eps
                heapq.heappush(heap, (filled[nr, nc], nr, nc))
    return filled


def d8_accumulation(filled: np.ndarray, dx: float, dy: float) -> Tuple[np.ndarray, np.ndarray]:
    """Return (flow direction index -1..7, accumulation in cells incl. itself)."""
    rows, cols = filled.shape
    diag = math.hypot(dx, dy)
    dist = [dy, diag, dx, diag, dy, diag, dx, diag]
    direction = np.full(filled.shape, -1, dtype=np.int8)
    pad = np.pad(filled, 1, mode="constant", constant_values=np.inf)
    best = np.zeros(filled.shape)
    for k, (dr, dc) in enumerate(D8):
        nb = pad[1 + dr : 1 + dr + rows, 1 + dc : 1 + dc + cols]
        drop = (filled - nb) / dist[k]
        better = drop > best
        best[better] = drop[better]
        direction[better] = k

    acc = np.ones(filled.shape, dtype="float64")
    order = np.argsort(-filled, axis=None)
    flat_dir = direction.ravel()
    flat_acc = acc.ravel()
    for idx in order:
        k = flat_dir[idx]
        if k < 0:
            continue
        r, c = divmod(int(idx), cols)
        dr, dc = D8[k]
        nr, nc = r + dr, c + dc
        if 0 <= nr < rows and 0 <= nc < cols:
            flat_acc[nr * cols + nc] += flat_acc[idx]
    return direction, acc


def twi(acc: np.ndarray, slope_deg: np.ndarray, cell_width_m: float) -> np.ndarray:
    a = acc * cell_width_m  # specific catchment area (m² per m contour width)
    tanb = np.tan(np.radians(np.maximum(slope_deg, 0.1)))
    return np.log(a / tanb).astype("float32")


def extract_channels(
    direction: np.ndarray,
    acc: np.ndarray,
    filled: np.ndarray,
    transform: Any,
    cell_area_m2: float,
    threshold_cells: int,
) -> List[Dict[str, Any]]:
    """Trace drainage lines from channel heads downstream.

    Each returned feature is a LineString following D8 flow with per-vertex
    contributing area, ordered upstream → downstream so it can be animated.
    """
    rows, cols = acc.shape
    channel = acc >= threshold_cells
    # A channel head is a channel cell with no upstream channel neighbour draining into it.
    has_upstream = np.zeros(acc.shape, dtype=bool)
    rr, cc = np.nonzero(channel)
    for r, c in zip(rr.tolist(), cc.tolist()):
        k = direction[r, c]
        if k < 0:
            continue
        nr, nc = r + D8[k][0], c + D8[k][1]
        if 0 <= nr < rows and 0 <= nc < cols and channel[nr, nc]:
            has_upstream[nr, nc] = True
    heads = [(r, c) for r, c in zip(rr.tolist(), cc.tolist()) if not has_upstream[r, c]]
    heads.sort(key=lambda rc: -filled[rc])

    def center(r: int, c: int) -> List[float]:
        x, y = transform * (c + 0.5, r + 0.5)
        return [round(x, 6), round(y, 6)]

    visited = np.zeros(acc.shape, dtype=bool)
    features: List[Dict[str, Any]] = []
    for r0, c0 in heads:
        coords: List[List[float]] = []
        areas: List[float] = []
        r, c = r0, c0
        while True:
            coords.append(center(r, c))
            areas.append(float(acc[r, c]) * cell_area_m2)
            if visited[r, c]:
                break  # joined an already traced (larger) channel — stop at the confluence
            visited[r, c] = True
            k = direction[r, c]
            if k < 0:
                break
            nr, nc = r + D8[k][0], c + D8[k][1]
            if not (0 <= nr < rows and 0 <= nc < cols):
                break
            r, c = nr, nc
        if len(coords) >= 2:
            features.append(
                {
                    "type": "Feature",
                    "properties": {
                        "max_contributing_area_km2": round(max(areas) / 1e6, 4),
                        "min_contributing_area_km2": round(min(areas) / 1e6, 4),
                        "length_cells": len(coords),
                        "head_elevation_m": round(float(filled[r0, c0]), 1),
                    },
                    "geometry": {"type": "LineString", "coordinates": coords},
                }
            )
    return features
