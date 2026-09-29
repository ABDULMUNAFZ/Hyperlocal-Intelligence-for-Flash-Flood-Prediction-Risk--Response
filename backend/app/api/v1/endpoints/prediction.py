# FloodGuard Prediction API Endpoints
"""REST API endpoints for flood risk prediction."""

from fastapi import APIRouter, HTTPException, Depends, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
import numpy as np
import uuid
import logging

from app.ml.inference import get_inference_service, close_inference_service, InferenceEngine
from app.ml.registry import get_model_registry, ModelStage
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/prediction", tags=["prediction"])


# Request/Response Models
class PredictionRequest(BaseModel):
    """Single prediction request."""
    latitude: float = Field(..., ge=-90, le=90, description="Latitude")
    longitude: float = Field(..., ge=-180, le=180, description="Longitude")
    prediction_horizon_hours: int = Field(72, ge=1, le=168, description="Forecast horizon in hours")
    model_name: Optional[str] = Field(None, description="Specific model to use")
    use_ensemble: bool = Field(True, description="Use ensemble prediction")
    return_uncertainty: bool = Field(True, description="Include uncertainty estimates")
    return_explanations: bool = Field(True, description="Include feature explanations")
    top_k_features: int = Field(5, ge=1, le=20, description="Top K features for explanations")


class BatchPredictionRequest(BaseModel):
    """Batch prediction request."""
    locations: List[Dict[str, float]] = Field(..., description="List of {lat, lon} locations")
    prediction_horizon_hours: int = Field(72, ge=1, le=168)
    model_name: Optional[str] = None
    use_ensemble: bool = True
    return_uncertainty: bool = True
    return_explanations: bool = False
    top_k_features: int = 5


class PredictionResponse(BaseModel):
    """Single prediction response."""
    request_id: str
    location: Dict[str, float]
    timestamp: str
    prediction_horizon_hours: int
    risk_probability: float
    risk_level: str
    risk_score: int
    model_version: str
    data_quality: str
    uncertainty: Optional[float] = None
    contributing_factors: List[Dict[str, Any]] = []
    data_sources: List[str] = []
    prediction_timestamp: str
    # Provenance of every model input (value, unit, source, status: MODEL_ANALYSIS / STATIC_DATASET / DERIVED / IMPUTED)
    features: List[Dict[str, Any]] = []
    imputed_features: List[str] = []
    explanation_method: Optional[str] = None
    model_provenance: Dict[str, Any] = {}


class BatchPredictionResponse(BaseModel):
    """Batch prediction response."""
    batch_id: str
    timestamp: str
    predictions: List[PredictionResponse]
    summary: Dict[str, Any]


class ModelInfoResponse(BaseModel):
    """Model information response."""
    model_id: str
    name: str
    version: str
    stage: str
    model_type: str
    training_date: str
    training_samples: int
    positive_samples: int
    negative_samples: int
    feature_count: int
    metrics: Dict[str, float]
    hyperparameters: Dict[str, Any]
    feature_importance: Dict[str, float]
    created_at: str
    updated_at: str


class HealthCheckResponse(BaseModel):
    """Health check response."""
    status: str
    models_loaded: List[str]
    models_fitted: Dict[str, bool]
    cache_size: int
    metrics: Dict[str, Any]
    uptime_seconds: float


# Dependency
async def get_engine() -> InferenceEngine:
    """Get inference engine."""
    service = await get_inference_service()
    return service.engine


@router.post("/predict", response_model=PredictionResponse)
async def predict_flood_risk(
    request: PredictionRequest,
    background_tasks: BackgroundTasks,
    engine: InferenceEngine = Depends(get_engine)
):
    """
    Predict flood risk for a single location.
    
    This endpoint:
    1. Fetches real-time data (rainfall, weather, soil, terrain)
    2. Runs feature engineering pipeline
    3. Runs ML model inference
    4. Returns structured flood risk assessment
    """
    start_time = datetime.utcnow()

    from app.services.geo.features import FEATURE_META, FEATURE_NAMES, build_point_features
    from app.api.v1.endpoints.geo import model_provenance

    # Real inputs: Open-Meteo, Copernicus GLO-30, ESA WorldCover, HRSL, SoilGrids, curated events.
    built = await build_point_features(request.latitude, request.longitude)
    feature_names = FEATURE_NAMES
    features = built["vector"]

    try:
        # Run inference
        result = await engine.predict(
            features=features,
            feature_names=feature_names,
            model_name=request.model_name,
            use_ensemble=request.use_ensemble,
            return_uncertainty=request.return_uncertainty,
            return_explanations=request.return_explanations,
            top_k_features=request.top_k_features
        )

        probas = result["probabilities"]
        if isinstance(probas[0], list):
            risk_prob = float(probas[0][1] if len(probas[0]) > 1 else probas[0])
        else:
            risk_prob = float(probas[0])

        # Determine risk level
        if risk_prob >= 0.8:
            risk_level = "CRITICAL"
        elif risk_prob >= 0.6:
            risk_level = "HIGH"
        elif risk_prob >= 0.4:
            risk_level = "MODERATE"
        elif risk_prob >= 0.2:
            risk_level = "LOW"
        else:
            risk_level = "VERY_LOW"

        risk_score = int(risk_prob * 100)

        # Map explanation entries (which may be keyed by column index) to named, valued features
        explanation_method = None
        factors: List[Dict[str, Any]] = []
        explanations = result.get("explanations") or []
        if explanations:
            explanation_method = explanations[0].get("method")
            for f in explanations[0].get("features", []):
                key = f.get("feature")
                name = feature_names[key] if isinstance(key, int) and key < len(feature_names) else str(key)
                row = next((x for x in built["features"] if x["name"] == name), None)
                factors.append({
                    **f,
                    "feature": name,
                    "label": FEATURE_META.get(name, (name, ""))[0],
                    "value": row["value"] if row else None,
                    "unit": row["unit"] if row else None,
                    "status": row["status"] if row else None,
                })

        # Ensemble variance is only meaningful when >1 fitted model is loaded
        unc = result.get("uncertainty")
        uncertainty = float(unc[0]) if request.return_uncertainty and unc and float(unc[0]) > 0 else None

        sources = sorted({row["source"].split(" (")[0].split(" —")[0] for row in built["features"] if row["status"] != "IMPUTED" and row["source"]})

        response = PredictionResponse(
            request_id=str(uuid.uuid4()),
            location={"latitude": request.latitude, "longitude": request.longitude},
            timestamp=start_time.isoformat(),
            prediction_horizon_hours=request.prediction_horizon_hours,
            risk_probability=risk_prob,
            risk_level=risk_level,
            risk_score=risk_score,
            model_version=result.get("model_used", "ensemble"),
            data_quality=built["data_quality"],
            uncertainty=uncertainty,
            contributing_factors=factors,
            data_sources=sources,
            prediction_timestamp=datetime.utcnow().isoformat(),
            features=built["features"],
            imputed_features=built["imputed"],
            explanation_method=(f"{explanation_method} (model-wide, not per-location)" if explanation_method == "feature_importance" else explanation_method),
            model_provenance=model_provenance(),
        )

        return response

    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@router.post("/predict/batch", response_model=BatchPredictionResponse)
async def predict_batch(
    request: BatchPredictionRequest,
    background_tasks: BackgroundTasks,
    engine: InferenceEngine = Depends(get_engine)
):
    """
    Predict flood risk for multiple locations.
    """
    batch_id = str(uuid.uuid4())
    start_time = datetime.utcnow()
    
    predictions = []
    
    for loc in request.locations:
        # Generate mock features for demonstration
        # In production, this would come from the feature engineering pipeline
        # Using the 17 features expected by the trained model
        feature_names = [
            "rainfall_1h_mm", "rainfall_6h_mm", "rainfall_24h_mm", "rainfall_72h_mm",
            "temperature_c", "humidity_percent", "wind_speed_kmh", "pressure_hpa",
            "elevation_m", "slope_deg", "twi",
            "soil_clay_percent", "soil_sand_percent", "soil_saturated_conductivity_mm_h",
            "landcover_class", "population_density_per_km2", "historical_flood_count"
        ]
        from app.services.geo.features import build_point_features

        lat = loc.get("lat", loc.get("latitude"))
        lon = loc.get("lon", loc.get("longitude"))
        if lat is None or lon is None:
            logger.error(f"Batch location missing lat/lon: {loc}")
            continue
        built = await build_point_features(lat, lon)
        features = built["vector"]

        try:
            result = await engine.predict(
                features=features,
                feature_names=feature_names,
                model_name=request.model_name,
                use_ensemble=request.use_ensemble,
                return_uncertainty=request.return_uncertainty,
                return_explanations=request.return_explanations,
                top_k_features=request.top_k_features
            )
            
            probas = result["probabilities"]
            if isinstance(probas[0], list):
                risk_prob = float(probas[0][1] if len(probas[0]) > 1 else probas[0])
            else:
                risk_prob = float(probas[0])
            
            if risk_prob >= 0.8:
                risk_level = "CRITICAL"
            elif risk_prob >= 0.6:
                risk_level = "HIGH"
            elif risk_prob >= 0.4:
                risk_level = "MODERATE"
            elif risk_prob >= 0.2:
                risk_level = "LOW"
            else:
                risk_level = "VERY_LOW"
            
            predictions.append(PredictionResponse(
                request_id=str(uuid.uuid4()),
                location=loc,
                timestamp=start_time.isoformat(),
                prediction_horizon_hours=request.prediction_horizon_hours,
                risk_probability=risk_prob,
                risk_level=risk_level,
                risk_score=int(risk_prob * 100),
                model_version=result.get("model_used", "ensemble"),
                data_quality=built["data_quality"],
                uncertainty=float(result.get("uncertainty", [0.1])[0]) if request.return_uncertainty and result.get("uncertainty") else None,
                contributing_factors=result.get("explanations", [{}])[0].get("features", []) if result.get("explanations") else [],
                data_sources=sorted({r["source"].split(" (")[0].split(" —")[0] for r in built["features"] if r["status"] != "IMPUTED" and r["source"]}),
                prediction_timestamp=datetime.utcnow().isoformat(),
                features=built["features"],
                imputed_features=built["imputed"],
            ))
            
        except Exception as e:
            logger.error(f"Batch prediction failed for {loc}: {e}")
            continue
    
    # Summary statistics
    risk_levels = [p.risk_level for p in predictions]
    summary = {
        "total_locations": len(predictions),
        "risk_distribution": {level: risk_levels.count(level) for level in set(risk_levels)},
        "avg_risk_probability": np.mean([p.risk_probability for p in predictions]) if predictions else 0,
        "max_risk_probability": max([p.risk_probability for p in predictions]) if predictions else 0
    }
    
    return BatchPredictionResponse(
        batch_id=batch_id,
        timestamp=start_time.isoformat(),
        predictions=predictions,
        summary=summary
    )


@router.get("/models", response_model=List[ModelInfoResponse])
async def list_models(
    stage: Optional[str] = Query(None, description="Filter by stage"),
    model_type: Optional[str] = Query(None, description="Filter by model type"),
    name: Optional[str] = Query(None, description="Filter by name")
):
    """List registered models with optional filters."""
    registry = get_model_registry()
    
    stage_filter = ModelStage(stage) if stage else None
    models = registry.list_models(name=name, stage=stage_filter)
    
    if model_type:
        models = [m for m in models if m.model_type == model_type]
    
    return [
        ModelInfoResponse(
            model_id=m.model_id,
            name=m.name,
            version=m.version,
            stage=m.stage.value,
            model_type=m.model_type,
            training_date=m.training_date,
            training_samples=m.training_samples,
            positive_samples=m.positive_samples,
            negative_samples=m.negative_samples,
            feature_count=m.feature_count,
            metrics=m.metrics,
            hyperparameters=m.hyperparameters,
            feature_importance=m.feature_importance,
            created_at=m.created_at,
            updated_at=m.updated_at
        )
        for m in models
    ]


@router.get("/models/{model_id}", response_model=ModelInfoResponse)
async def get_model(model_id: str):
    """Get model details by ID."""
    registry = get_model_registry()
    model = registry.get_model(model_id)
    
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return ModelInfoResponse(
        model_id=model.model_id,
        name=model.name,
        version=model.version,
        stage=model.stage.value,
        model_type=model.model_type,
        training_date=model.training_date,
        training_samples=model.training_samples,
        positive_samples=model.positive_samples,
        negative_samples=model.negative_samples,
        feature_count=model.feature_count,
        metrics=model.metrics,
        hyperparameters=model.hyperparameters,
        feature_importance=model.feature_importance,
        created_at=model.created_at,
        updated_at=model.updated_at
    )


@router.post("/models/{model_id}/promote")
async def promote_model(
    model_id: str,
    target_stage: str,
    by: str = "api"
):
    """Promote model to a new stage."""
    registry = get_model_registry()
    
    try:
        stage = ModelStage(target_stage)
        registry.promote_model(model_id, stage, by)
        return {"message": f"Model promoted to {target_stage}"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/models/{model_id}/archive")
async def archive_model(model_id: str, by: str = "api"):
    """Archive a model."""
    registry = get_model_registry()
    
    try:
        registry.archive_model(model_id, by)
        return {"message": "Model archived"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/models/{model_id}/lineage")
async def get_model_lineage(model_id: str):
    """Get model lineage information."""
    registry = get_model_registry()
    
    try:
        lineage = registry.get_lineage(model_id)
        return lineage
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/models/compare")
async def compare_models(model_id_1: str, model_id_2: str):
    """Compare two model versions."""
    registry = get_model_registry()
    
    try:
        comparison = registry.compare_models(model_id_1, model_id_2)
        return comparison
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/models/{model_id}/card")
async def get_model_card(model_id: str):
    """Get model card as markdown."""
    registry = get_model_registry()
    
    model = registry.get_model(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    card = f"""# Model Card: {model.name} v{model.version}

## Model Details
- **Model ID**: {model.model_id}
- **Name**: {model.name}
- **Version**: {model.version}
- **Type**: {model.model_type}
- **Stage**: {model.stage.value}
- **Training Date**: {model.training_date}
- **Created By**: {model.created_by}
- **Created At**: {model.created_at}

## Training Data
- **Training Samples**: {model.training_samples:,}
- **Positive Samples**: {model.positive_samples:,}
- **Negative Samples**: {model.negative_samples:,}
- **Dataset Hash**: {model.training_dataset_hash}

## Features
- **Feature Count**: {model.feature_count}
- **Feature Hash**: {model.feature_hash}
- **Features**: {', '.join(model.feature_names[:20])}{'...' if len(model.feature_names) > 20 else ''}

## Performance Metrics
"""
    for metric, value in model.metrics.items():
        card += f"- **{metric}**: {value:.4f}\n"
    
    card += f"""
## Hyperparameters
"""
    for param, value in model.hyperparameters.items():
        card += f"- **{param}**: {value}\n"
    
    card += f"""
## Feature Importance (Top 10)
"""
    for feat, imp in list(model.feature_importance.items())[:10]:
        card += f"- **{feat}**: {imp:.4f}\n"
    
    card += f"""
## Model File
- **Path**: {model.model_path}
- **Hash**: {model.model_hash}
- **Size**: {model.model_size_bytes:,} bytes

## Tags
{', '.join(model.tags) or 'None'}

## Notes
{model.description or 'No description provided.'}
"""
    
    return {"model_card": card}


@router.get("/health", response_model=HealthCheckResponse)
async def health_check(engine: InferenceEngine = Depends(get_engine)):
    """Health check for prediction service."""
    health = await engine.health_check()
    return HealthCheckResponse(**health)


@router.get("/metrics")
async def get_metrics(engine: InferenceEngine = Depends(get_engine)):
    """Get inference engine metrics."""
    metrics = await engine.get_metrics()
    return metrics


@router.get("/models/production")
async def get_production_models():
    """Get all production models."""
    registry = get_model_registry()
    models = registry.get_models_by_stage(ModelStage.PRODUCTION)
    
    return [
        {
            "model_id": m.model_id,
            "name": m.name,
            "version": m.version,
            "model_type": m.model_type,
            "metrics": m.metrics,
            "feature_count": m.feature_count
        }
        for m in models
    ]


@router.post("/models/cleanup")
async def cleanup_old_models(
    name: str,
    keep_latest: int = 3,
    keep_stages: List[str] = ["production", "staging"]
):
    """Clean up old model versions."""
    registry = get_model_registry()
    
    keep_stages_enum = [ModelStage(s) for s in keep_stages]
    deleted = registry.cleanup_old_versions(name, keep_latest, keep_stages_enum)
    
    return {"deleted": deleted, "message": f"Cleaned up {deleted} old versions"}


@router.get("/risk-map")
async def get_risk_map(
    min_lon: float = Query(..., description="Minimum longitude"),
    min_lat: float = Query(..., description="Minimum latitude"),
    max_lon: float = Query(..., description="Maximum longitude"),
    max_lat: float = Query(..., description="Maximum latitude"),
    resolution: int = Query(250, ge=50, le=1000, description="Grid resolution in meters"),
    forecast_hours: int = Query(0, ge=0, le=168, description="Forecast hours ahead")
):
    """Get flood risk map for a bounding box."""
    service = await get_inference_service()
    
    bbox = (min_lon, min_lat, max_lon, max_lat)
    result = await service.get_risk_map(bbox, resolution, forecast_hours)
    
    return result


@router.get("/evacuation-routes")
async def get_evacuation_routes(
    origin_lat: float = Query(..., description="Origin latitude"),
    origin_lon: float = Query(..., description="Origin longitude"),
    dest_lat: float = Query(..., description="Destination latitude"),
    dest_lon: float = Query(..., description="Destination longitude"),
    max_flood_depth: float = Query(0.3, description="Maximum safe flood depth in meters")
):
    """Get safe evacuation routes."""
    service = await get_inference_service()
    
    origin = (origin_lat, origin_lon)
    destination = (dest_lat, dest_lon)
    result = await service.get_evacuation_routes(origin, destination, max_flood_depth)
    
    return result


@router.get("/shelters")
async def get_nearby_shelters(
    latitude: float = Query(..., ge=-90, le=90, description="Latitude"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude"),
    radius_km: float = Query(50, ge=1, le=200, description="Search radius in km")
):
    """Find nearby emergency shelters."""
    service = await get_inference_service()
    
    shelters = await service.get_nearby_shelters(latitude, longitude, radius_km)
    
    return {"shelters": shelters}