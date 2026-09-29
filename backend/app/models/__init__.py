# FloodGuard Database Models Package
from app.models.core import (
    User,
    Region,
    DataSource,
    ProcessingJob,
    TimestampMixin,
)
from app.models.terrain import (
    TerrainTile,
    SlopeAspect,
    Watershed,
    RiverNetwork,
)
from app.models.rainfall import (
    RainfallObservation,
    RainfallGrid,
    WeatherForecast,
    WeatherObservation,
)
from app.models.soil import (
    SoilGrid,
    SoilProfile,
    SoilHydraulicProperties,
)
from app.models.landcover import (
    LandCoverGrid,
    LandCoverClass,
    BuildingFootprint,
    RoadNetwork,
    CriticalInfrastructure,
)
from app.models.population import (
    PopulationGrid,
    PopulationStats,
    HistoricalFloodEvent,
    HistoricalFloodExtent,
)
from app.models.iot_sensor import (
    IoTSensor,
    IoTSensorReading,
    FloodRisk,
    FloodRiskHistory,
)
from app.models.simulation import (
    FloodSimulation,
    FloodSimulationTimeSeries,
    WhatIfScenario,
)
from app.models.evacuation import (
    EvacuationZone,
    EvacuationRoute,
    Shelter,
    EvacuationPlan,
)
from app.models.alerts import (
    Alert,
    AlertSubscription,
    AlertTemplate,
    AIConversation,
    AIMessage,
)
from app.models.training import (
    TrainingSample,
    TrainingDataset,
)

__all__ = [
    "User",
    "Region",
    "DataSource",
    "ProcessingJob",
    "TimestampMixin",
    "TerrainTile",
    "SlopeAspect",
    "Watershed",
    "RiverNetwork",
    "RainfallObservation",
    "RainfallGrid",
    "WeatherForecast",
    "WeatherObservation",
    "SoilGrid",
    "SoilProfile",
    "SoilHydraulicProperties",
    "LandCoverGrid",
    "LandCoverClass",
    "BuildingFootprint",
    "RoadNetwork",
    "CriticalInfrastructure",
    "PopulationGrid",
    "PopulationStats",
    "HistoricalFloodEvent",
    "HistoricalFloodExtent",
    "IoTSensor",
    "IoTSensorReading",
    "FloodRisk",
    "FloodRiskHistory",
    "FloodSimulation",
    "FloodSimulationTimeSeries",
    "WhatIfScenario",
    "EvacuationZone",
    "EvacuationRoute",
    "Shelter",
    "EvacuationPlan",
    "Alert",
    "AlertSubscription",
    "AlertTemplate",
    "AIConversation",
    "AIMessage",
    "TrainingSample",
    "TrainingDataset",
]