# FloodGuard Data Quality System
"""Data validation, quality checks, and status tracking."""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Literal
from enum import Enum
import json


class DataQualityStatus(str, Enum):
    FRESH = "fresh"
    STALE = "stale"
    INVALID = "invalid"
    UNAVAILABLE = "unavailable"
    DEGRADED = "degraded"


class QualityCheckType(str, Enum):
    COMPLETENESS = "completeness"
    VALIDITY = "validity"
    CONSISTENCY = "consistency"
    TIMELINESS = "timeliness"
    SPATIAL_VALIDITY = "spatial_validity"
    CRS_VALIDITY = "crs_validity"
    DUPLICATE = "duplicate"
    RANGE_CHECK = "range_check"


@dataclass
class QualityCheck:
    """Result of a single quality check."""
    check_type: QualityCheckType
    passed: bool
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    severity: Literal["info", "warning", "error"] = "info"


@dataclass
class DataQualityReport:
    """Complete quality report for a dataset/observation."""
    source_name: str
    dataset_id: str
    timestamp: datetime
    overall_status: DataQualityStatus
    checks: List[QualityCheck]
    records_total: int = 0
    records_valid: int = 0
    records_invalid: int = 0
    missing_values: int = 0
    duplicate_records: int = 0
    spatial_invalid: int = 0
    crs_mismatch: int = 0
    freshness_hours: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "source_name": self.source_name,
            "dataset_id": self.dataset_id,
            "timestamp": self.timestamp.isoformat(),
            "overall_status": self.overall_status.value,
            "checks": [
                {
                    "check_type": c.check_type.value,
                    "passed": c.passed,
                    "message": c.message,
                    "details": c.details,
                    "severity": c.severity,
                }
                for c in self.checks
            ],
            "records_total": self.records_total,
            "records_valid": self.records_valid,
            "records_invalid": self.records_invalid,
            "missing_values": self.missing_values,
            "duplicate_records": self.duplicate_records,
            "spatial_invalid": self.spatial_invalid,
            "crs_mismatch": self.crs_mismatch,
            "freshness_hours": self.freshness_hours,
            "metadata": self.metadata,
        }


class DataQualityChecker:
    """Validates data quality for different source types."""

    # Expected ranges for common variables
    VARIABLE_RANGES = {
        "precipitation": (0, 1000),  # mm per hour
        "temperature_2m": (-40, 60),  # Celsius
        "relative_humidity_2m": (0, 100),  # %
        "wind_speed_10m": (0, 100),  # m/s
        "wind_direction_10m": (0, 360),  # degrees
        "pressure_msl": (850, 1100),  # hPa
        "cloudcover": (0, 100),  # %
        "soil_moisture": (0, 1),  # m3/m3
        "elevation": (-500, 9000),  # meters
        "slope": (0, 90),  # degrees
        "aspect": (0, 360),  # degrees
        "population_density": (0, 100000),  # per sqkm
    }

    # Required fields per source type
    REQUIRED_FIELDS = {
        "rainfall": ["station_id", "timestamp", "rainfall_mm", "latitude", "longitude"],
        "weather_forecast": ["timestamp", "valid_time", "latitude", "longitude"],
        "dem": ["elevation", "latitude", "longitude"],
        "soil": ["property_name", "depth_interval", "latitude", "longitude"],
        "landcover": ["class_value", "latitude", "longitude"],
        "hydrology": ["geometry"],
        "infrastructure": ["geometry", "type"],
        "population": ["population", "latitude", "longitude"],
        "historical_flood": ["event_id", "date", "latitude", "longitude"],
    }

    def __init__(self, stale_threshold_hours: float = 6.0):
        self.stale_threshold_hours = stale_threshold_hours

    def check_rainfall_observation(self, data: Dict[str, Any]) -> DataQualityReport:
        """Validate a rainfall observation record."""
        checks = []
        source_name = data.get("source", "unknown")
        dataset_id = f"rainfall_{data.get('station_id', 'unknown')}_{data.get('timestamp', 'unknown')}"

        # Completeness
        required = self.REQUIRED_FIELDS["rainfall"]
        missing = [f for f in required if f not in data or data[f] is None]
        checks.append(QualityCheck(
            check_type=QualityCheckType.COMPLETENESS,
            passed=len(missing) == 0,
            message=f"Missing required fields: {missing}" if missing else "All required fields present",
            details={"missing_fields": missing},
            severity="error" if missing else "info",
        ))

        # Validity - rainfall range
        rainfall = data.get("rainfall_mm")
        if rainfall is not None:
            min_val, max_val = self.VARIABLE_RANGES["precipitation"]
            passed = min_val <= rainfall <= max_val
            checks.append(QualityCheck(
                check_type=QualityCheckType.RANGE_CHECK,
                passed=passed,
                message=f"Rainfall {rainfall}mm outside expected range [{min_val}, {max_val}]" if not passed else "Rainfall within range",
                details={"value": rainfall, "range": [min_val, max_val]},
                severity="warning" if not passed else "info",
            ))

        # Validity - coordinates
        lat, lon = data.get("latitude"), data.get("longitude")
        coord_passed = True
        coord_msgs = []
        if lat is not None and not (-90 <= lat <= 90):
            coord_passed = False
            coord_msgs.append(f"Invalid latitude: {lat}")
        if lon is not None and not (-180 <= lon <= 180):
            coord_passed = False
            coord_msgs.append(f"Invalid longitude: {lon}")
        checks.append(QualityCheck(
            check_type=QualityCheckType.SPATIAL_VALIDITY,
            passed=coord_passed,
            message="; ".join(coord_msgs) if coord_msgs else "Coordinates valid",
            details={"latitude": lat, "longitude": lon},
            severity="error" if not coord_passed else "info",
        ))

        # Timeliness
        timestamp = data.get("timestamp")
        if timestamp:
            if isinstance(timestamp, str):
                timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
            age_hours = (datetime.utcnow() - timestamp.replace(tzinfo=None)).total_seconds() / 3600
            checks.append(QualityCheck(
                check_type=QualityCheckType.TIMELINESS,
                passed=age_hours <= self.stale_threshold_hours,
                message=f"Data age: {age_hours:.1f}h" + (" (STALE)" if age_hours > self.stale_threshold_hours else " (FRESH)"),
                details={"age_hours": age_hours, "threshold_hours": self.stale_threshold_hours},
                severity="warning" if age_hours > self.stale_threshold_hours else "info",
            ))

        # Overall status
        failed_errors = [c for c in checks if not c.passed and c.severity == "error"]
        failed_warnings = [c for c in checks if not c.passed and c.severity == "warning"]

        if failed_errors:
            overall = DataQualityStatus.INVALID
        elif failed_warnings:
            overall = DataQualityStatus.DEGRADED
        else:
            overall = DataQualityStatus.FRESH

        return DataQualityReport(
            source_name=source_name,
            dataset_id=dataset_id,
            timestamp=datetime.utcnow(),
            overall_status=overall,
            checks=checks,
            records_total=1,
            records_valid=1 if overall != DataQualityStatus.INVALID else 0,
            records_invalid=1 if overall == DataQualityStatus.INVALID else 0,
            metadata={"variable": "rainfall", "unit": "mm"},
        )

    def check_weather_forecast(self, data: Dict[str, Any]) -> DataQualityReport:
        """Validate a weather forecast record."""
        checks = []
        source_name = data.get("source", "unknown")
        dataset_id = f"forecast_{data.get('model', 'unknown')}_{data.get('init_time', 'unknown')}"

        # Completeness
        required = self.REQUIRED_FIELDS["weather_forecast"]
        missing = [f for f in required if f not in data or data[f] is None]
        checks.append(QualityCheck(
            check_type=QualityCheckType.COMPLETENESS,
            passed=len(missing) == 0,
            message=f"Missing required fields: {missing}" if missing else "All required fields present",
            details={"missing_fields": missing},
            severity="error" if missing else "info",
        ))

        # Validity - variable ranges
        for var, (min_val, max_val) in self.VARIABLE_RANGES.items():
            if var in data and data[var] is not None:
                val = data[var]
                passed = min_val <= val <= max_val
                checks.append(QualityCheck(
                    check_type=QualityCheckType.RANGE_CHECK,
                    passed=passed,
                    message=f"{var}={val} outside range [{min_val}, {max_val}]" if not passed else f"{var} within range",
                    details={"variable": var, "value": val, "range": [min_val, max_val]},
                    severity="warning" if not passed else "info",
                ))

        # Coordinates
        lat, lon = data.get("latitude"), data.get("longitude")
        coord_passed = True
        if lat is not None and not (-90 <= lat <= 90):
            coord_passed = False
        if lon is not None and not (-180 <= lon <= 180):
            coord_passed = False
        checks.append(QualityCheck(
            check_type=QualityCheckType.SPATIAL_VALIDITY,
            passed=coord_passed,
            message="Coordinates valid" if coord_passed else "Invalid coordinates",
            details={"latitude": lat, "longitude": lon},
            severity="error" if not coord_passed else "info",
        ))

        # Forecast validity (init_time <= valid_time)
        init_time = data.get("init_time")
        valid_time = data.get("valid_time")
        if init_time and valid_time:
            if isinstance(init_time, str):
                init_time = datetime.fromisoformat(init_time.replace("Z", "+00:00"))
            if isinstance(valid_time, str):
                valid_time = datetime.fromisoformat(valid_time.replace("Z", "+00:00"))
            passed = init_time <= valid_time
            checks.append(QualityCheck(
                check_type=QualityCheckType.CONSISTENCY,
                passed=passed,
                message="Forecast times consistent" if passed else "init_time > valid_time (invalid forecast)",
                details={"init_time": init_time.isoformat(), "valid_time": valid_time.isoformat()},
                severity="error" if not passed else "info",
            ))

        # Overall
        failed_errors = [c for c in checks if not c.passed and c.severity == "error"]
        failed_warnings = [c for c in checks if not c.passed and c.severity == "warning"]
        overall = DataQualityStatus.INVALID if failed_errors else (DataQualityStatus.DEGRADED if failed_warnings else DataQualityStatus.FRESH)

        return DataQualityReport(
            source_name=source_name,
            dataset_id=dataset_id,
            timestamp=datetime.utcnow(),
            overall_status=overall,
            checks=checks,
            records_total=1,
            records_valid=1 if overall != DataQualityStatus.INVALID else 0,
            records_invalid=1 if overall == DataQualityStatus.INVALID else 0,
            metadata={"type": "forecast"},
        )

    def check_dem_tile(self, data: Dict[str, Any]) -> DataQualityReport:
        """Validate a DEM tile."""
        checks = []
        source_name = data.get("source", "unknown")
        dataset_id = f"dem_{data.get('tile_id', 'unknown')}"

        # Elevation range
        elev = data.get("mean_elevation")
        if elev is not None:
            min_val, max_val = self.VARIABLE_RANGES["elevation"]
            passed = min_val <= elev <= max_val
            checks.append(QualityCheck(
                check_type=QualityCheckType.RANGE_CHECK,
                passed=passed,
                message=f"Elevation {elev}m outside range [{min_val}, {max_val}]" if not passed else "Elevation within range",
                details={"elevation": elev, "range": [min_val, max_val]},
                severity="warning" if not passed else "info",
            ))

        # Resolution
        res = data.get("resolution_m")
        if res is not None:
            passed = 5 <= res <= 1000
            checks.append(QualityCheck(
                check_type=QualityCheckType.VALIDITY,
                passed=passed,
                message=f"Resolution {res}m reasonable" if passed else f"Unusual resolution: {res}m",
                details={"resolution_m": res},
                severity="info",
            ))

        # Geometry validity
        geom = data.get("geometry")
        if geom:
            # Would check actual geometry validity with shapely
            checks.append(QualityCheck(
                check_type=QualityCheckType.SPATIAL_VALIDITY,
                passed=True,
                message="Geometry structure present",
                details={"has_geometry": True},
            ))

        overall = DataQualityStatus.FRESH
        return DataQualityReport(
            source_name=source_name,
            dataset_id=dataset_id,
            timestamp=datetime.utcnow(),
            overall_status=overall,
            checks=checks,
            records_total=1,
            records_valid=1,
            metadata={"type": "dem_tile"},
        )

    def check_batch(self, source_type: str, records: List[Dict[str, Any]]) -> DataQualityReport:
        """Validate a batch of records."""
        all_checks = []
        total = len(records)
        valid = 0
        invalid = 0
        missing_total = 0
        duplicate_count = 0

        # Check for duplicates
        seen = set()
        for r in records:
            key = self._get_record_key(source_type, r)
            if key in seen:
                duplicate_count += 1
            seen.add(key)

        if duplicate_count > 0:
            all_checks.append(QualityCheck(
                check_type=QualityCheckType.DUPLICATE,
                passed=False,
                message=f"Found {duplicate_count} duplicate records",
                details={"duplicate_count": duplicate_count},
                severity="warning",
            ))

        # Check each record
        for record in records:
            if source_type == "rainfall":
                report = self.check_rainfall_observation(record)
            elif source_type == "weather_forecast":
                report = self.check_weather_forecast(record)
            elif source_type == "dem":
                report = self.check_dem_tile(record)
            else:
                report = DataQualityReport(
                    source_name=record.get("source", "unknown"),
                    dataset_id="batch",
                    timestamp=datetime.utcnow(),
                    overall_status=DataQualityStatus.FRESH,
                    checks=[],
                )
            all_checks.extend(report.checks)
            if report.overall_status == DataQualityStatus.INVALID:
                invalid += 1
            else:
                valid += 1
            missing_total += report.missing_values

        # Overall batch status
        if invalid > 0:
            overall = DataQualityStatus.INVALID
        elif duplicate_count > 0 or any(c.severity == "warning" for c in all_checks):
            overall = DataQualityStatus.DEGRADED
        else:
            overall = DataQualityStatus.FRESH

        return DataQualityReport(
            source_name=records[0].get("source", "unknown") if records else "unknown",
            dataset_id=f"batch_{source_type}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}",
            timestamp=datetime.utcnow(),
            overall_status=overall,
            checks=all_checks,
            records_total=total,
            records_valid=valid,
            records_invalid=invalid,
            missing_values=missing_total,
            duplicate_records=duplicate_count,
            metadata={"batch_size": total, "source_type": source_type},
        )

    def _get_record_key(self, source_type: str, record: Dict[str, Any]) -> tuple:
        """Generate a key for duplicate detection."""
        if source_type == "rainfall":
            return (record.get("station_id"), record.get("timestamp"))
        elif source_type == "weather_forecast":
            return (record.get("source"), record.get("model"), record.get("init_time"), record.get("valid_time"), record.get("latitude"), record.get("longitude"))
        elif source_type == "dem":
            return (record.get("tile_id"),)
        return (str(record),)


def get_data_freshness_status(last_update: Optional[datetime], threshold_hours: float = 6.0) -> DataQualityStatus:
    """Determine freshness status based on last update time."""
    if last_update is None:
        return DataQualityStatus.UNAVAILABLE

    age_hours = (datetime.utcnow() - last_update.replace(tzinfo=None)).total_seconds() / 3600

    if age_hours <= threshold_hours:
        return DataQualityStatus.FRESH
    elif age_hours <= threshold_hours * 4:
        return DataQualityStatus.STALE
    else:
        return DataQualityStatus.UNAVAILABLE


def create_data_status_response(source_name: str, last_update: Optional[datetime],
                                 record_count: int = 0, error: Optional[str] = None) -> Dict[str, Any]:
    """Create a standardized data status response for the API."""
    if error:
        return {
            "source": source_name,
            "status": "unavailable",
            "error": error,
            "last_update": last_update.isoformat() if last_update else None,
            "record_count": 0,
        }

    freshness = get_data_freshness_status(last_update)
    return {
        "source": source_name,
        "status": freshness.value,
        "last_update": last_update.isoformat() if last_update else None,
        "record_count": record_count,
        "age_hours": (datetime.utcnow() - last_update.replace(tzinfo=None)).total_seconds() / 3600 if last_update else None,
    }