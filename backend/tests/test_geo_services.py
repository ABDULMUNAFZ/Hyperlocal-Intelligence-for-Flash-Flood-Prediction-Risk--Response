"""Offline unit tests for the Wayanad geo services (no network access)."""

import numpy as np
from rasterio.transform import from_origin

from app.services.geo.alerts import _covers_wayanad, _parse_cap
from app.services.geo.analysis import risk_level
from app.services.geo.hydrology import d8_accumulation, extract_channels, priority_flood
from app.services.geo.osm import building_height, classify_building, parse_height
from app.services.geo.rasters import aspect_label, slope_aspect
from app.services.geo.weather import imd_category


def test_priority_flood_fills_pit():
    dem = np.array([[5, 5, 5], [5, 1, 5], [5, 5, 5]], dtype=float)
    filled = priority_flood(dem)
    assert filled[1, 1] > 5  # pit raised to spill level (+epsilon)


def test_d8_accumulation_on_tilted_plane():
    # Plane dipping towards +column (east); all flow ends at the east edge
    dem = np.tile(np.arange(10, 0, -1, dtype=float), (5, 1))
    filled = priority_flood(dem)
    direction, acc = d8_accumulation(filled, 30.0, 30.0)
    assert (direction[:, :-1] >= 0).all()
    # Each row accumulates its full length at the outlet column
    assert acc[:, -1].max() >= 10


def test_extract_channels_follow_flow_downstream():
    dem = np.tile(np.arange(20, 0, -1, dtype=float), (3, 1))
    filled = priority_flood(dem)
    direction, acc = d8_accumulation(filled, 30.0, 30.0)
    feats = extract_channels(direction, acc, filled, from_origin(76.0, 11.5, 0.001, 0.001), 900.0, threshold_cells=3)
    assert feats
    line = feats[0]["geometry"]["coordinates"]
    assert line[0][0] < line[-1][0]  # upstream → downstream (west → east)


def test_slope_and_aspect_of_east_facing_plane():
    dem = np.tile(np.arange(10, 0, -1, dtype=float) * 30.0, (6, 1))  # 1 m rise per 1 m run, falling eastwards
    slope, aspect = slope_aspect(dem, 30.0, 30.0)
    assert abs(slope[3, 5] - 45.0) < 0.5
    assert aspect_label(float(aspect[3, 5])) == "E"


def test_building_height_provenance():
    assert building_height({"building": "house", "height": "7.5"})["height_status"] == "SOURCE"
    est = building_height({"building": "apartments", "building:levels": "4"})
    assert est["height_status"] == "ESTIMATED" and est["height_m"] == 12.0
    none = building_height({"building": "yes"})
    assert none["height_status"] == "UNAVAILABLE" and none["height_m"] is None
    assert parse_height("12 m") == 12.0 and parse_height("tall") is None


def test_classify_building():
    assert classify_building({"building": "yes", "amenity": "school"}) == "school"
    assert classify_building({"building": "house"}) == "residential"
    assert classify_building({"building": "yes"}) == "unclassified"


CAP = """<cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
<cap:identifier>IN-1</cap:identifier><cap:sender>KSDMA</cap:sender><cap:sent>2026-09-29T10:00:00+05:30</cap:sent>
<cap:status>Actual</cap:status><cap:msgType>Alert</cap:msgType>
<cap:info><cap:event>Heavy Rain</cap:event><cap:urgency>Expected</cap:urgency><cap:severity>Severe</cap:severity>
<cap:certainty>Likely</cap:certainty><cap:expires>2099-01-01T00:00:00+05:30</cap:expires><cap:headline>Orange alert</cap:headline>
<cap:area><cap:areaDesc>Kerala districts</cap:areaDesc>
<cap:geocode><cap:valueName>LGD District Code</cap:valueName><cap:value>{code}</cap:value></cap:geocode>
</cap:area></cap:info></cap:alert>"""


def test_cap_matching_by_lgd_code():
    msg = _parse_cap(CAP.format(code="567"))
    assert msg["event"] == "Heavy Rain" and msg["lgd_district_codes"] == ["567"]
    assert _covers_wayanad(msg) == "LGD district code 567"
    other = _parse_cap(CAP.format(code="532"))
    assert _covers_wayanad(other) is None


def test_risk_levels_and_imd_categories():
    assert risk_level(0.85) == "CRITICAL" and risk_level(0.65) == "HIGH" and risk_level(0.05) == "VERY_LOW"
    assert imd_category(0.0) == "No rain"
    assert imd_category(70.0) == "Heavy rain"
    assert imd_category(250.0) == "Extremely heavy rain"
