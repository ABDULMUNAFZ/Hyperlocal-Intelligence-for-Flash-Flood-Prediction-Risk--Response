# FloodGuard Data Source Registry
"""Central registry of all external data sources with metadata."""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Literal
from datetime import datetime
from enum import Enum


class DataSourceType(str, Enum):
    RAINFALL = "rainfall"
    WEATHER_FORECAST = "weather_forecast"
    DEM = "dem"
    SOIL = "soil"
    LANDCOVER = "landcover"
    HYDROLOGY = "hydrology"
    INFRASTRUCTURE = "infrastructure"
    POPULATION = "population"
    HISTORICAL_FLOOD = "historical_flood"
    IOT = "iot"


class DataFormat(str, Enum):
    NETCDF = "netcdf"
    GEOTIFF = "geotiff"
    JSON = "json"
    CSV = "csv"
    GEOJSON = "geojson"
    PROTOBUF = "protobuf"
    SHAPEFILE = "shapefile"
    GPKG = "gpkg"
    HDF5 = "hdf5"
    GRIB2 = "grib2"


class AuthType(str, Enum):
    NONE = "none"
    API_KEY = "api_key"
    OAUTH = "oauth"
    REGISTRATION = "registration"
    SERVICE_ACCOUNT = "service_account"


class IngestionMethod(str, Enum):
    HTTP_DOWNLOAD = "http_download"
    API_REQUEST = "api_request"
    S3_DOWNLOAD = "s3_download"
    FTP_DOWNLOAD = "ftp_download"
    WMS_WCS = "wms_wcs"
    GOOGLE_EARTH_ENGINE = "google_earth_engine"


@dataclass
class DataSource:
    """Metadata for an external data source."""
    name: str
    provider: str
    source_type: DataSourceType
    description: str

    # Access
    url: str
    api_endpoint: Optional[str] = None
    auth_type: AuthType = AuthType.NONE
    api_key_env: Optional[str] = None

    # Geographic
    coverage: str = "global"
    bbox: Optional[List[float]] = None  # [minx, miny, maxx, maxy]

    # Temporal
    temporal_resolution: str = "hourly"
    update_frequency: str = "realtime"
    historical_range: Optional[str] = None

    # Spatial
    spatial_resolution: str = "1km"
    native_crs: str = "EPSG:4326"

    # Data format
    data_format: DataFormat = DataFormat.NETCDF
    ingestion_method: IngestionMethod = IngestionMethod.API_REQUEST

    # Licensing
    license: str = "CC-BY-4.0"
    attribution: str = ""
    citation: str = ""

    # Status tracking
    is_active: bool = True
    last_successful_retrieval: Optional[datetime] = None
    last_retrieval_error: Optional[str] = None
    consecutive_failures: int = 0
    reliability_score: float = 1.0

    # Processing
    required_bands: List[str] = field(default_factory=list)
    processing_notes: str = ""

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "provider": self.provider,
            "source_type": self.source_type.value,
            "description": self.description,
            "url": self.url,
            "api_endpoint": self.api_endpoint,
            "auth_type": self.auth_type.value,
            "api_key_env": self.api_key_env,
            "coverage": self.coverage,
            "bbox": self.bbox,
            "temporal_resolution": self.temporal_resolution,
            "update_frequency": self.update_frequency,
            "historical_range": self.historical_range,
            "spatial_resolution": self.spatial_resolution,
            "native_crs": self.native_crs,
            "data_format": self.data_format.value,
            "ingestion_method": self.ingestion_method.value,
            "license": self.license,
            "attribution": self.attribution,
            "citation": self.citation,
            "is_active": self.is_active,
            "last_successful_retrieval": self.last_successful_retrieval.isoformat() if self.last_successful_retrieval else None,
            "last_retrieval_error": self.last_retrieval_error,
            "consecutive_failures": self.consecutive_failures,
            "reliability_score": self.reliability_score,
            "required_bands": self.required_bands,
            "processing_notes": self.processing_notes,
        }


# =============================================================================
# DATA SOURCE REGISTRY - South India Flood Prediction
# =============================================================================

DATA_SOURCES: Dict[str, DataSource] = {
    # -------------------------------------------------------------------------
    # RAINFALL
    # -------------------------------------------------------------------------
    "open_meteo_rainfall": DataSource(
        name="Open-Meteo Rainfall",
        provider="Open-Meteo",
        source_type=DataSourceType.RAINFALL,
        description="Global weather forecast and historical rainfall from 30+ models including ERA5, ECMWF, GFS",
        url="https://api.open-meteo.com/v1",
        api_endpoint="https://api.open-meteo.com/v1/forecast",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],  # South India bounds
        temporal_resolution="hourly",
        update_frequency="realtime",
        historical_range="1940-present (ERA5), 2021-present (forecast archive)",
        spatial_resolution="1-11km (model dependent)",
        native_crs="EPSG:4326",
        data_format=DataFormat.JSON,
        ingestion_method=IngestionMethod.API_REQUEST,
        license="CC-BY-4.0",
        attribution="Data by Open-Meteo (https://open-meteo.com)",
        citation="Open-Meteo.com",
        required_bands=["precipitation", "precipitation_probability"],
        processing_notes="Use ERA5 for historical, best_match model for forecast. No API key required for non-commercial use up to 10k calls/day.",
    ),

    "chirps_rainfall": DataSource(
        name="CHIRPS Rainfall",
        provider="UCSB Climate Hazards Center",
        source_type=DataSourceType.RAINFALL,
        description="Quasi-global rainfall dataset (50°S-50°N) combining satellite and gauge data",
        url="https://data.chc.ucsb.edu/products/CHIRPS-2.0/",
        auth_type=AuthType.NONE,
        coverage="global_50S_50N",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="daily",
        update_frequency="monthly",
        historical_range="1981-present",
        spatial_resolution="0.05° (~5km)",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="CC-BY-4.0",
        attribution="CHIRPS data by UCSB Climate Hazards Center",
        citation="Funk et al., 2015, Scientific Data",
        required_bands=["precipitation"],
        processing_notes="Available as daily, pentad, dekad, monthly. GeoTIFF format. Good for historical climatology.",
    ),

    "nasa_gpm_imerg": DataSource(
        name="NASA GPM IMERG",
        provider="NASA",
        source_type=DataSourceType.RAINFALL,
        description="Global Precipitation Measurement Integrated Multi-satellitE Retrievals",
        url="https://gpm.nasa.gov/data/imerg",
        auth_type=AuthType.REGISTRATION,
        api_key_env="NASA_EARTHDATA_TOKEN",
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="30min",
        update_frequency="near_realtime",
        historical_range="2000-present",
        spatial_resolution="0.1° (~10km)",
        native_crs="EPSG:4326",
        data_format=DataFormat.HDF5,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="NASA Open Data",
        attribution="NASA GPM IMERG",
        citation="Huffman et al., 2019",
        required_bands=["precipitationCal", "precipitationUncal", "probabilityLiquidPrecipitation"],
        processing_notes="Requires NASA Earthdata login. Late run available ~14h after observation. Early run ~4h. HDF5 format.",
    ),

    "imd_aws_rainfall": DataSource(
        name="IMD AWS Rainfall",
        provider="India Meteorological Department",
        source_type=DataSourceType.RAINFALL,
        description="Automatic Weather Station network real-time rainfall observations",
        url="https://mausam.imd.gov.in/",
        api_endpoint="https://api.imd.gov.in/rainfall",
        auth_type=AuthType.REGISTRATION,
        api_key_env="IMD_API_KEY",
        coverage="india",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="hourly",
        update_frequency="realtime",
        historical_range="varies by station",
        spatial_resolution="point",
        native_crs="EPSG:4326",
        data_format=DataFormat.JSON,
        ingestion_method=IngestionMethod.API_REQUEST,
        license="Government of India",
        attribution="India Meteorological Department",
        citation="IMD AWS Network",
        required_bands=["rainfall", "intensity"],
        processing_notes="Requires IMD API registration. Point observations from ~1000+ AWS stations across India.",
    ),

    "mosdac_gsmap": DataSource(
        name="MOSDAC GSMaP",
        provider="ISRO MOSDAC",
        source_type=DataSourceType.RAINFALL,
        description="Global Satellite Mapping of Precipitation from JAXA, served via ISRO MOSDAC",
        url="https://mosdac.gov.in/",
        api_endpoint="https://mosdac.gov.in/api/gsmap",
        auth_type=AuthType.REGISTRATION,
        api_key_env="MOSDAC_API_KEY",
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="hourly",
        update_frequency="near_realtime",
        historical_range="2000-present",
        spatial_resolution="0.1° (~10km)",
        native_crs="EPSG:4326",
        data_format=DataFormat.NETCDF,
        ingestion_method=IngestionMethod.API_REQUEST,
        license="ISRO/JAXA",
        attribution="JAXA GSMaP via ISRO MOSDAC",
        citation="Kubota et al., 2020",
        required_bands=["precipitation"],
        processing_notes="Available via MOSDAC API after registration. NetCDF format. Good for Indian region.",
    ),

    # -------------------------------------------------------------------------
    # WEATHER FORECAST
    # -------------------------------------------------------------------------
    "open_meteo_forecast": DataSource(
        name="Open-Meteo Weather Forecast",
        provider="Open-Meteo",
        source_type=DataSourceType.WEATHER_FORECAST,
        description="Global weather forecast from 30+ models (ECMWF, GFS, ICON, etc.)",
        url="https://api.open-meteo.com/v1",
        api_endpoint="https://api.open-meteo.com/v1/forecast",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="hourly",
        update_frequency="6h",
        historical_range="forecast only",
        spatial_resolution="1-11km",
        native_crs="EPSG:4326",
        data_format=DataFormat.JSON,
        ingestion_method=IngestionMethod.API_REQUEST,
        license="CC-BY-4.0",
        attribution="Data by Open-Meteo (https://open-meteo.com)",
        citation="Open-Meteo.com",
        required_bands=["temperature_2m", "relative_humidity_2m", "wind_speed_10m", "wind_direction_10m",
                       "pressure_msl", "precipitation", "cloudcover", "soil_moisture_0_7cm",
                       "soil_moisture_7_28cm", "cape", "lifted_index"],
        processing_notes="Free up to 10k calls/day. 30+ models. Includes soil moisture layers. Ensemble API available.",
    ),

    "noaa_gfs": DataSource(
        name="NOAA GFS Forecast",
        provider="NOAA NCEP",
        source_type=DataSourceType.WEATHER_FORECAST,
        description="Global Forecast System - primary US operational forecast model",
        url="https://www.nco.ncep.noaa.gov/pmb/products/gfs/",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="3h (0-240h), 6h (240-384h)",
        update_frequency="6h",
        historical_range="forecast only",
        spatial_resolution="0.25° (~25km)",
        native_crs="EPSG:4326",
        data_format=DataFormat.GRIB2,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="Public Domain",
        attribution="NOAA NCEP GFS",
        citation="NCEP GFS",
        required_bands=["TMP", "RH", "UGRD", "VGRD", "PRMSL", "APCP", "CAPE"],
        processing_notes="GRIB2 format. Available via NOMADS or AWS. Good backup to Open-Meteo.",
    ),

    "imd_wrf": DataSource(
        name="IMD WRF Forecast",
        provider="India Meteorological Department",
        source_type=DataSourceType.WEATHER_FORECAST,
        description="Weather Research and Forecasting model runs by IMD for Indian region",
        url="https://mausam.imd.gov.in/",
        api_endpoint="https://api.imd.gov.in/wrf",
        auth_type=AuthType.REGISTRATION,
        api_key_env="IMD_API_KEY",
        coverage="india",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="hourly",
        update_frequency="daily",
        historical_range="forecast only",
        spatial_resolution="3km",
        native_crs="EPSG:4326",
        data_format=DataFormat.NETCDF,
        ingestion_method=IngestionMethod.API_REQUEST,
        license="Government of India",
        attribution="India Meteorological Department WRF",
        citation="IMD WRF",
        required_bands=["rainfall", "temperature", "humidity", "wind"],
        processing_notes="High-resolution (3km) Indian regional model. Requires IMD API access.",
    ),

    # -------------------------------------------------------------------------
    # DIGITAL ELEVATION MODEL (DEM)
    # -------------------------------------------------------------------------
    "copernicus_glo30": DataSource(
        name="Copernicus DEM GLO-30",
        provider="Copernicus/ESA",
        source_type=DataSourceType.DEM,
        description="Global Digital Surface Model at 30m resolution (DSM includes vegetation/buildings)",
        url="https://spacedata.copernicus.eu/web/guest/collections/copernicus-digital-elevation-model",
        api_endpoint="https://copernicus-dem-30m.s3.amazonaws.com",
        auth_type=AuthType.NONE,
        coverage="global (partial public)",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="static",
        historical_range="2011-2015 acquisition",
        spatial_resolution="30m",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.S3_DOWNLOAD,
        license="Copernicus Free License",
        attribution="Copernicus DEM GLO-30 (contains modified Copernicus Sentinel data 2011-2015)",
        citation="ESA, 2019",
        required_bands=["elevation"],
        processing_notes="Cloud Optimized GeoTIFFs on AWS S3. GLO-30 Public has some restricted tiles. Use GLO-90 for global coverage.",
    ),

    "copernicus_glo90": DataSource(
        name="Copernicus DEM GLO-90",
        provider="Copernicus/ESA",
        source_type=DataSourceType.DEM,
        description="Global Digital Surface Model at 90m resolution - full global coverage",
        url="https://spacedata.copernicus.eu/web/guest/collections/copernicus-digital-elevation-model",
        api_endpoint="https://copernicus-dem-90m.s3.amazonaws.com",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="static",
        historical_range="2011-2015 acquisition",
        spatial_resolution="90m",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.S3_DOWNLOAD,
        license="Copernicus Free License",
        attribution="Copernicus DEM GLO-90 (contains modified Copernicus Sentinel data 2011-2015)",
        citation="ESA, 2019",
        required_bands=["elevation"],
        processing_notes="Full global coverage at 90m. Use as fallback where GLO-30 tiles are restricted.",
    ),

    "srtm_30m": DataSource(
        name="SRTM 30m (NASA/USGS)",
        provider="NASA/USGS",
        source_type=DataSourceType.DEM,
        description="Shuttle Radar Topography Mission - near-global DEM at 30m",
        url="https://www2.jpl.nasa.gov/srtm/",
        auth_type=AuthType.REGISTRATION,
        api_key_env="EARTHDATA_TOKEN",
        coverage="60°N-56°S",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="static",
        historical_range="2000 acquisition",
        spatial_resolution="30m",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="Public Domain",
        attribution="NASA/USGS SRTM",
        citation="Farr et al., 2007",
        required_bands=["elevation"],
        processing_notes="Requires Earthdata login. Void-filled versions available. Good backup to Copernicus.",
    ),

    "alos_palsar": DataSource(
        name="ALOS PALSAR DEM",
        provider="JAXA",
        source_type=DataSourceType.DEM,
        description="ALOS World 3D - 30m DSM from PALSAR radar",
        url="https://www.eorc.jaxa.jp/ALOS/en/aw3d30/",
        auth_type=AuthType.REGISTRATION,
        api_key_env="JAXA_EARTHDATA_TOKEN",
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="static",
        historical_range="2006-2011 acquisition",
        spatial_resolution="30m",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="JAXA ALOS License",
        attribution="JAXA ALOS PALSAR",
        citation="Tadono et al., 2016",
        required_bands=["elevation"],
        processing_notes="Radar-based, good for vegetated areas. Requires JAXA registration.",
    ),

    # -------------------------------------------------------------------------
    # SOIL
    # -------------------------------------------------------------------------
    "soilgrids": DataSource(
        name="SoilGrids v2.0",
        provider="ISRIC World Soil Information",
        source_type=DataSourceType.SOIL,
        description="Global gridded soil information at 250m resolution using machine learning",
        url="https://soilgrids.org/",
        api_endpoint="https://rest.isric.org/soilgrids/v2.0",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="static",
        historical_range="2020 update",
        spatial_resolution="250m",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.API_REQUEST,
        license="CC-BY-4.0",
        attribution="SoilGrids by ISRIC (https://soilgrids.org)",
        citation="Poggio et al., 2021, Global Ecology and Biogeography",
        required_bands=["phh2o", "soc", "bdod", "clay", "sand", "silt", "cec", "nitrogen", "cfvo", "ocs", "ocd"],
        processing_notes="REST API available but sometimes unstable. Better to download GeoTIFFs via AWS/GEE. 6 depth intervals.",
    ),

    "hw_sd": DataSource(
        name="Harmonized World Soil Database (HWSD)",
        provider="FAO/IIASA/ISRIC/ISS-CAS/JRC",
        source_type=DataSourceType.SOIL,
        description="Global soil database at ~1km resolution with soil units and parameters",
        url="https://www.fao.org/soils-portal/data-hub/soil-maps-and-databases/harmonized-world-soil-database-v12/en/",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="static",
        historical_range="v1.2 2012",
        spatial_resolution="30arcsec (~1km)",
        native_crs="EPSG:4326",
        data_format=DataFormat.SHAPEFILE,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="CC-BY-4.0",
        attribution="FAO/IIASA/ISRIC/ISS-CAS/JRC HWSD",
        citation="FAO et al., 2012",
        required_bands=["soil_unit", "texture", "drainage", "phase"],
        processing_notes="Coarser resolution but includes soil classification. Good for regional overview.",
    ),

    # -------------------------------------------------------------------------
    # LAND COVER
    # -------------------------------------------------------------------------
    "esa_worldcover": DataSource(
        name="ESA WorldCover",
        provider="ESA Copernicus",
        source_type=DataSourceType.LANDCOVER,
        description="Global land cover map at 10m resolution from Sentinel-1/2",
        url="https://viewer.esa-worldcover.org/",
        api_endpoint="https://esa-worldcover.s3.eu-central-1.amazonaws.com",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="annual",
        historical_range="2020, 2021",
        spatial_resolution="10m",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.S3_DOWNLOAD,
        license="CC-BY-4.0",
        attribution="ESA WorldCover (contains modified Copernicus Sentinel data)",
        citation="Zanaga et al., 2021, Remote Sensing",
        required_bands=["map"],
        processing_notes="Cloud Optimized GeoTIFFs on AWS. 11 classes. V100 (2020) and V200 (2021) available.",
    ),

    "modis_mcd12q1": DataSource(
        name="MODIS MCD12Q1 Land Cover",
        provider="NASA LP DAAC",
        source_type=DataSourceType.LANDCOVER,
        description="Annual global land cover at 500m from MODIS Terra/Aqua",
        url="https://lpdaac.usgs.gov/products/mcd12q1v061/",
        auth_type=AuthType.REGISTRATION,
        api_key_env="EARTHDATA_TOKEN",
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="annual",
        update_frequency="annual",
        historical_range="2001-present",
        spatial_resolution="500m",
        native_crs="EPSG:4326",
        data_format=DataFormat.HDF5,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="Public Domain",
        attribution="NASA MODIS Land Cover",
        citation="Friedl & Sulla-Menashe, 2019",
        required_bands=["LC_Type1", "LC_Type2", "LC_Type3", "LC_Type4", "LC_Type5"],
        processing_notes="HDF5 format. Multiple classification schemes (IGBP, UMD, LAI, etc.). Time series available.",
    ),

    "bhuvan_lulc": DataSource(
        name="Bhuvan LULC",
        provider="ISRO NRSC",
        source_type=DataSourceType.LANDCOVER,
        description="Indian land use/land cover at high resolution from Indian satellites",
        url="https://bhuvan.nrsc.gov.in/",
        auth_type=AuthType.REGISTRATION,
        api_key_env="BHUVAN_API_KEY",
        coverage="india",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="annual",
        update_frequency="annual",
        historical_range="2005-present",
        spatial_resolution="10-56m",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.API_REQUEST,
        license="ISRO",
        attribution="ISRO NRSC Bhuvan",
        citation="NRSC LULC",
        required_bands=["lulc_class"],
        processing_notes="Indian-specific classes. Requires Bhuvan registration. High resolution for India.",
    ),

    # -------------------------------------------------------------------------
    # HYDROLOGY
    # -------------------------------------------------------------------------
    "hydrosheds": DataSource(
        name="HydroSHEDS",
        provider="WWF/USGS",
        source_type=DataSourceType.HYDROLOGY,
        description="Hydrological data and maps based on SRTM DEM - rivers, basins, flow direction",
        url="https://www.hydrosheds.org/",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="static",
        historical_range="v1 2013, v2 in prep",
        spatial_resolution="15arcsec (~500m), 3arcsec (~90m)",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="CC-BY-4.0",
        attribution="HydroSHEDS by WWF/USGS (https://hydrosheds.org)",
        citation="Lehner & Grill, 2013, Hydrobiologia",
        required_bands=["flow_dir", "flow_acc", "basins", "rivers"],
        processing_notes="Pre-computed flow direction (D8), accumulation, basin boundaries, river network. Multiple resolutions.",
    ),

    "hydroatlas": DataSource(
        name="HydroATLAS",
        provider="WWF/McGill/ETH",
        source_type=DataSourceType.HYDROLOGY,
        description="Global hydro-environmental attributes for river basins and reaches",
        url="https://www.hydrosheds.org/hydroatlas",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="static",
        historical_range="2019",
        spatial_resolution="sub-basin / reach",
        native_crs="EPSG:4326",
        data_format=DataFormat.GPKG,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="CC-BY-4.0",
        attribution="HydroATLAS by WWF/McGill/ETH",
        citation="Linke et al., 2019, Scientific Data",
        required_bands=["climate", "landcover", "soil", "terrain", "anthropogenic"],
        processing_notes="500+ attributes per sub-basin/reach. GeoPackage format. Excellent for watershed characterization.",
    ),

    # -------------------------------------------------------------------------
    # INFRASTRUCTURE (OSM)
    # -------------------------------------------------------------------------
    "openstreetmap": DataSource(
        name="OpenStreetMap",
        provider="OSM Community",
        source_type=DataSourceType.INFRASTRUCTURE,
        description="Collaborative global map - roads, buildings, waterways, POIs",
        url="https://www.openstreetmap.org/",
        api_endpoint="https://overpass-api.de/api/interpreter",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="continuous",
        update_frequency="continuous",
        historical_range="2004-present",
        spatial_resolution="variable",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOJSON,
        ingestion_method=IngestionMethod.API_REQUEST,
        license="ODbL",
        attribution="© OpenStreetMap contributors",
        citation="OpenStreetMap",
        required_bands=["highway", "building", "waterway", "amenity", "bridge"],
        processing_notes="Use Overpass API for queries. For bulk, use Geofabrik extracts (.osm.pbf) or BBBike. Respect rate limits.",
    ),

    "microsoft_buildings": DataSource(
        name="Microsoft Building Footprints",
        provider="Microsoft",
        source_type=DataSourceType.INFRASTRUCTURE,
        description="AI-generated building footprints for multiple countries including India",
        url="https://github.com/microsoft/GlobalMLBuildingFootprints",
        auth_type=AuthType.NONE,
        coverage="india (and others)",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="static",
        historical_range="2021",
        spatial_resolution="variable (~1-5m)",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOJSON,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="ODbL-compatible",
        attribution="Microsoft Building Footprints",
        citation="Microsoft, 2021",
        required_bands=["geometry", "confidence"],
        processing_notes="Available as GeoJSON per quadkey. High quality for India. Good supplement to OSM buildings.",
    ),

    # -------------------------------------------------------------------------
    # POPULATION
    # -------------------------------------------------------------------------
    "worldpop": DataSource(
        name="WorldPop Population",
        provider="WorldPop/University of Southampton",
        source_type=DataSourceType.POPULATION,
        description="High-resolution gridded population estimates with age/sex breakdown",
        url="https://www.worldpop.org/",
        api_endpoint="https://wopr.worldpop.org/api",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="annual",
        update_frequency="annual",
        historical_range="2000-2020",
        spatial_resolution="100m (constrained), 1km (unconstrained)",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="CC-BY-4.0",
        attribution="WorldPop (www.worldpop.org)",
        citation="Tatem, 2017, Nature Scientific Data",
        required_bands=["population", "population_density", "age_sex_structure"],
        processing_notes="Multiple products: unconstrained (uniform), constrained (dasymetric), age/sex. GeoTIFF format.",
    ),

    "landscan": DataSource(
        name="LandScan Global",
        provider="Oak Ridge National Laboratory",
        source_type=DataSourceType.POPULATION,
        description="Global population distribution at ~1km resolution, ambient (day/night) population",
        url="https://landscan.ornl.gov/",
        auth_type=AuthType.REGISTRATION,
        api_key_env="LANDSCAN_TOKEN",
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="annual",
        update_frequency="annual",
        historical_range="2000-present",
        spatial_resolution="30arcsec (~1km)",
        native_crs="EPSG:4326",
        data_format=DataFormat.GEOTIFF,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="ORNL License",
        attribution="LandScan by UT-Battelle/ORNL",
        citation="Rose et al., 2019",
        required_bands=["population"],
        processing_notes="Requires registration. Good for ambient population (not just residential).",
    ),

    # -------------------------------------------------------------------------
    # HISTORICAL FLOOD
    # -------------------------------------------------------------------------
    "emdat": DataSource(
        name="EM-DAT",
        provider="CRED/UCLouvain",
        source_type=DataSourceType.HISTORICAL_FLOOD,
        description="International disaster database with 27,000+ events since 1900",
        url="https://public.emdat.be/",
        api_endpoint="https://public.emdat.be/api",
        auth_type=AuthType.REGISTRATION,
        api_key_env="EMDAT_API_KEY",
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="event",
        update_frequency="monthly",
        historical_range="1900-present",
        spatial_resolution="country/subnational",
        native_crs="EPSG:4326",
        data_format=DataFormat.CSV,
        ingestion_method=IngestionMethod.API_REQUEST,
        license="Open Access (non-commercial)",
        attribution="EM-DAT, CRED/UCLouvain",
        citation="CRED, 2024",
        required_bands=["event_id", "date", "location", "fatalities", "affected", "damage"],
        processing_notes="Country-level with some subnational. Free registration for API. Good for event catalog.",
    ),

    "dartmouth_flood": DataSource(
        name="Dartmouth Flood Observatory",
        provider="University of Colorado",
        source_type=DataSourceType.HISTORICAL_FLOOD,
        description="Satellite-observed flood extents since 1985",
        url="https://floodobservatory.colorado.edu/",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="event",
        update_frequency="near_realtime",
        historical_range="1985-present",
        spatial_resolution="variable (sensor dependent)",
        native_crs="EPSG:4326",
        data_format=DataFormat.SHAPEFILE,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="Open Access",
        attribution="Dartmouth Flood Observatory, University of Colorado",
        citation="Brakenridge et al.",
        required_bands=["flood_extent", "date", "sensor"],
        processing_notes="Shapefiles per event. Satellite-derived extents (MODIS, Sentinel, Landsat). Good for validation.",
    ),

    "nidm_flood": DataSource(
        name="NIDM Disaster Data",
        provider="National Institute of Disaster Management, India",
        source_type=DataSourceType.HISTORICAL_FLOOD,
        description="Indian disaster management data including flood events",
        url="https://nidm.gov.in/",
        auth_type=AuthType.NONE,
        coverage="india",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="event",
        update_frequency="periodic",
        historical_range="varies",
        spatial_resolution="district/state",
        native_crs="EPSG:4326",
        data_format=DataFormat.CSV,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="Government of India",
        attribution="NIDM, Ministry of Home Affairs",
        citation="NIDM Reports",
        required_bands=["event", "date", "state", "district", "impact"],
        processing_notes="Available in PDF reports and some datasets. Indian-specific. Good for validation.",
    ),

    # -------------------------------------------------------------------------
    # ADMINISTRATIVE BOUNDARIES
    # -------------------------------------------------------------------------
    "gadm": DataSource(
        name="GADM Administrative Boundaries",
        provider="GADM",
        source_type=DataSourceType.INFRASTRUCTURE,
        description="Global administrative areas (countries, states, districts, etc.)",
        url="https://gadm.org/",
        auth_type=AuthType.NONE,
        coverage="global",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="static",
        update_frequency="periodic",
        historical_range="v4.1 2023",
        spatial_resolution="variable",
        native_crs="EPSG:4326",
        data_format=DataFormat.GPKG,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="Free for non-commercial",
        attribution="GADM (https://gadm.org)",
        citation="Hijmans et al.",
        required_bands=["NAME_0", "NAME_1", "NAME_2", "NAME_3"],
        processing_notes="GeoPackage format with all levels. Level 0=country, 1=state, 2=district, 3=sub-district. Best for South India boundaries.",
    ),

    "census_india": DataSource(
        name="Census India Boundaries",
        provider="Office of Registrar General, India",
        source_type=DataSourceType.INFRASTRUCTURE,
        description="Official Indian administrative boundaries down to village level",
        url="https://censusindia.gov.in/",
        auth_type=AuthType.REGISTRATION,
        coverage="india",
        bbox=[74.0, 8.0, 84.0, 19.0],
        temporal_resolution="decadal",
        update_frequency="decadal",
        historical_range="2011, 2021",
        spatial_resolution="variable",
        native_crs="EPSG:4326",
        data_format=DataFormat.SHAPEFILE,
        ingestion_method=IngestionMethod.HTTP_DOWNLOAD,
        license="Government of India",
        attribution="Census of India",
        citation="Census 2011/2021",
        required_bands=["state", "district", "subdistrict", "village"],
        processing_notes="Official boundaries. Requires access. Best for village/ward level in India.",
    ),
}


def get_data_source(name: str) -> Optional[DataSource]:
    """Get a data source by name."""
    return DATA_SOURCES.get(name)


def get_sources_by_type(source_type: DataSourceType) -> List[DataSource]:
    """Get all data sources of a given type."""
    return [s for s in DATA_SOURCES.values() if s.source_type == source_type]


def get_active_sources() -> List[DataSource]:
    """Get all active data sources."""
    return [s for s in DATA_SOURCES.values() if s.is_active]


def get_south_india_sources() -> List[DataSource]:
    """Get all sources covering South India."""
    south_india_bbox = [74.0, 8.0, 84.0, 19.0]
    result = []
    for s in DATA_SOURCES.values():
        if s.bbox:
            # Check if source bbox overlaps South India
            if not (s.bbox[2] < south_india_bbox[0] or s.bbox[0] > south_india_bbox[2] or
                    s.bbox[3] < south_india_bbox[1] or s.bbox[1] > south_india_bbox[3]):
                result.append(s)
        elif s.coverage in ["global", "india", "global_50S_50N"]:
            result.append(s)
    return result


# Default source priorities for each type (first = primary)
SOURCE_PRIORITIES = {
    DataSourceType.RAINFALL: [
        "open_meteo_rainfall",
        "imd_aws_rainfall",
        "mosdac_gsmap",
        "nasa_gpm_imerg",
        "chirps_rainfall",
    ],
    DataSourceType.WEATHER_FORECAST: [
        "open_meteo_forecast",
        "imd_wrf",
        "noaa_gfs",
    ],
    DataSourceType.DEM: [
        "copernicus_glo30",
        "copernicus_glo90",
        "srtm_30m",
        "alos_palsar",
    ],
    DataSourceType.SOIL: [
        "soilgrids",
        "hw_sd",
    ],
    DataSourceType.LANDCOVER: [
        "esa_worldcover",
        "bhuvan_lulc",
        "modis_mcd12q1",
    ],
    DataSourceType.HYDROLOGY: [
        "hydrosheds",
        "hydroatlas",
    ],
    DataSourceType.INFRASTRUCTURE: [
        "openstreetmap",
        "microsoft_buildings",
    ],
    DataSourceType.POPULATION: [
        "worldpop",
        "landscan",
    ],
    DataSourceType.HISTORICAL_FLOOD: [
        "emdat",
        "dartmouth_flood",
        "nidm_flood",
    ],
}


def get_primary_source(source_type: DataSourceType) -> Optional[DataSource]:
    """Get the primary (highest priority) source for a type."""
    for name in SOURCE_PRIORITIES.get(source_type, []):
        src = DATA_SOURCES.get(name)
        if src and src.is_active:
            return src
    # Fallback to any active source of this type
    for src in DATA_SOURCES.values():
        if src.source_type == source_type and src.is_active:
            return src
    return None