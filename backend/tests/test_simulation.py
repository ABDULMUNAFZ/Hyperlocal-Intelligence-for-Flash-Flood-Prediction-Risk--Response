"""Offline tests for the scenario simulation engine (network rasters are stubbed)."""

import math

import numpy as np
import pytest
from rasterio.transform import from_origin

from app.services.geo import simulation as sim
from app.services.geo.hydrology import priority_flood


def test_scs_runoff_matches_hand_calculation():
    s = np.array([25400 / 80 - 254])  # CN 80 → S = 63.5 mm
    assert sim.scs_runoff(10.0, s)[0] == 0.0  # below initial abstraction (0.2 S = 12.7 mm)
    q = sim.scs_runoff(100.0, s)[0]
    assert q == pytest.approx((100 - 12.7) ** 2 / (100 - 12.7 + 63.5), rel=1e-6)  # ≈ 50.5 mm


def test_amc_adjustment_direction():
    cn = np.array([70.0])
    assert sim.adjust_cn(cn, "I")[0] < 70 < sim.adjust_cn(cn, "III")[0]


def test_condition_dem_removes_pits_and_barriers():
    z = np.tile(np.linspace(100, 50, 30), (20, 1))  # valley draining east
    z[10, 12] = 30.0            # spurious pit
    z[:, 18] += 25.0            # canopy-like barrier across the valley
    zb, stats, _ = sim.condition_dem(z, 30.0, 30.0)
    filled = priority_flood(zb, eps=0.0)
    assert float((filled - zb).max()) < 1e-6  # no closed depressions remain
    assert stats["carved_cells_pct"] > 0


def _stub_rasters(monkeypatch, z):
    ny, nx = z.shape
    res = 0.0006

    def read_dem(bounds, res_deg=None):
        return z.astype("float32"), from_origin(bounds[0], bounds[3], (bounds[2] - bounds[0]) / nx, (bounds[3] - bounds[1]) / ny)

    monkeypatch.setattr(sim.rasters, "read_dem", read_dem)
    monkeypatch.setattr(sim.rasters, "worldcover_window", lambda bounds, shape: np.full(shape, 30))
    monkeypatch.setattr(sim.rasters, "hrsl_grid", lambda bounds, cell: {"cells": [], "cell_deg": cell})
    return res


def test_flood_solver_conserves_mass_and_drains(monkeypatch):
    # V-shaped valley sloping east: water must collect in the thalweg and leave at the east edge
    ny, nx = 40, 40
    yy, xx = np.mgrid[0:ny, 0:nx]
    z = 500.0 - xx * 1.0 + np.abs(yy - ny / 2) * 3.0
    _stub_rasters(monkeypatch, z)
    zone = {"type": "Polygon", "coordinates": [[[76.10, 11.50], [76.114, 11.50], [76.114, 11.514], [76.10, 11.514], [76.10, 11.50]]]}
    out = sim.simulate_flood(zone, rainfall_mm=120, duration_h=2, amc="III", soil=None, buildings=[], roads=[])
    frames = out["frames"]
    assert out["summary"]["mass_balance_error_pct"] < 1.0
    depths = [np.frombuffer(__import__("base64").b64decode(f["depth_b64"]), dtype="<u2") for f in frames]
    assert all(d.min() >= 0 for d in depths)
    peak = max(f["volume_m3"] for f in frames)
    assert peak > 0
    assert frames[-1]["volume_m3"] < peak  # recession after rain stops
    last = depths[-1].reshape(out["grid"]["ny"], out["grid"]["nx"])
    # deepest water lies along the thalweg (centre rows), not on the valley sides
    r = np.unravel_index(np.argmax(last), last.shape)[0]
    assert abs(r - out["grid"]["ny"] / 2) <= out["grid"]["ny"] * 0.25


def test_hazard_classes():
    assert sim.hazard_class(0.2) == "LOW"
    assert sim.hazard_class(1.0) == "MODERATE"
    assert sim.hazard_class(1.5) == "SIGNIFICANT"
    assert sim.hazard_class(3.0) == "EXTREME"


def test_infinite_slope_dry_cohesionless_limit():
    # FS = tanφ / tanθ for c = 0 and m = 0 (textbook limit used by simulate_landslide)
    phi, theta = math.radians(30), math.radians(35)
    fs = ((19.0 - 0) * 1.5 * math.cos(theta) ** 2 * math.tan(phi)) / (19.0 * 1.5 * math.sin(theta) * math.cos(theta))
    assert fs == pytest.approx(math.tan(phi) / math.tan(theta), rel=1e-9)
    assert fs < 1  # slope steeper than friction angle is unstable
