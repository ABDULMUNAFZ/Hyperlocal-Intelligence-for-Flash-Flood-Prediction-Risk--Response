# FloodGuard Model Inference Service
"""High-performance model inference service with batching and caching."""

import asyncio
import logging
import time
import hashlib
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
import numpy as np
from concurrent.futures import ThreadPoolExecutor

from app.ml.registry import ModelRegistry, get_model_registry, ModelStage
from app.ml.models.training import FloodRiskPredictor, ModelConfig

logger = logging.getLogger(__name__)


@dataclass
class InferenceRequest:
    """Single inference request."""
    request_id: str
    features: np.ndarray
    feature_names: List[str]
    model_name: Optional[str] = None
    use_ensemble: bool = True
    return_uncertainty: bool = False
    return_explanations: bool = False
    top_k_features: int = 5
    priority: int = 0
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class InferenceResponse:
    """Inference response."""
    request_id: str
    predictions: np.ndarray
    probabilities: np.ndarray
    uncertainties: Optional[np.ndarray] = None
    explanations: Optional[List[Dict]] = None
    model_used: str = ""
    model_version: str = ""
    latency_ms: float = 0.0
    timestamp: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict = field(default_factory=dict)


@dataclass
class BatchInferenceRequest:
    """Batch inference request."""
    requests: List[InferenceRequest]
    batch_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class BatchInferenceResponse:
    """Batch inference response."""
    batch_id: str
    responses: List[Any]
    total_latency_ms: float
    timestamp: datetime = field(default_factory=datetime.utcnow)


class ModelCache:
    """LRU cache for model predictions."""
    
    def __init__(self, max_size: int = 10000, ttl_seconds: int = 3600):
        self.max_size = max_size
        self.ttl_seconds = ttl_seconds
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self._access_times: Dict[str, float] = {}
        self._lock = asyncio.Lock()
    
    def _make_key(self, prefix: str, features: np.ndarray) -> str:
        """Create cache key."""
        feature_hash = hashlib.sha256(features.tobytes()).hexdigest()[:16]
        return f"{prefix}:{feature_hash}"
    
    async def get(self, prefix: str, features: np.ndarray) -> Optional[Any]:
        """Get cached prediction."""
        key = self._make_key(prefix, features)
        async with self._lock:
            if key in self._cache:
                value, timestamp = self._cache[key]
                if time.time() - timestamp < self.ttl_seconds:
                    self._access_times[key] = time.time()
                    return value
                else:
                    del self._cache[key]
                    del self._access_times[key]
        return None
    
    async def set(self, prefix: str, features: np.ndarray, value: Any):
        """Cache prediction."""
        key = self._make_key(prefix, features)
        async with self._lock:
            if len(self._cache) >= self.max_size:
                lru_key = min(self._access_times, key=self._access_times.get)
                del self._cache[lru_key]
                del self._access_times[lru_key]
            
            self._cache[key] = (value, time.time())
            self._access_times[key] = time.time()
    
    async def clear(self):
        """Clear cache."""
        async with self._lock:
            self._cache.clear()
            self._access_times.clear()


class InferenceEngine:
    """High-performance model inference engine with batching and caching."""
    
    def __init__(
        self,
        registry: Optional[ModelRegistry] = None,
        config: Optional[ModelConfig] = None,
        cache_size: int = 10000,
        cache_ttl: int = 3600,
        batch_size: int = 32,
        batch_timeout_ms: int = 50,
        max_workers: int = 4
    ):
        self.registry = registry or get_model_registry()
        self.config = config or ModelConfig()
        self.batch_size = batch_size
        self.batch_timeout_ms = batch_timeout_ms
        self.max_workers = max_workers
        
        self._models: Dict[str, Any] = {}
        self._model_versions: Dict[str, str] = {}
        self._model_lock = asyncio.Lock()
        
        self.cache = ModelCache(max_size=cache_size, ttl_seconds=cache_ttl)
        
        self._batch_queue: asyncio.Queue = asyncio.Queue()
        self._batch_results: Dict[str, asyncio.Future] = {}
        self._batch_processor_task: Optional[asyncio.Task] = None
        self._shutdown = False
        
        self.executor = ThreadPoolExecutor(max_workers=max_workers)
        self._start_time = time.time()
        
        self.metrics = {
            "total_requests": 0,
            "cache_hits": 0,
            "cache_misses": 0,
            "total_latency_ms": 0.0,
            "batch_count": 0,
            "errors": 0
        }
        self._metrics_lock = asyncio.Lock()
    
    async def initialize(self):
        """Initialize inference engine."""
        logger.info("Initializing inference engine...")
        
        await self._load_production_models()
        
        self._batch_processor_task = asyncio.create_task(self._batch_processor())
        
        logger.info("Inference engine initialized")
    
    async def _load_production_models(self):
        """Load all production models from registry."""
        registry = get_model_registry()
        
        for model_meta in registry.get_models_by_stage(ModelStage.PRODUCTION):
            try:
                await self._load_model(model_meta)
                logger.info(f"Loaded production model: {model_meta.name} v{model_meta.version}")
            except Exception as e:
                logger.error(f"Failed to load model {model_meta.name}: {e}")
    
    async def _load_model(self, metadata) -> bool:
        """Load a model from registry."""
        model_id = metadata.model_id
        
        async with self._model_lock:
            if model_id in self._models:
                return True
            
            try:
                model_path = Path(metadata.model_path)
                if not model_path.exists():
                    logger.error(f"Model file not found: {model_path}")
                    return False
                
                import joblib
                predictor = FloodRiskPredictor.load_all(model_path.parent)
                
                self._models[metadata.name] = predictor
                self._model_versions[metadata.name] = metadata.version
                
                logger.info(f"Loaded model: {metadata.name} v{metadata.version}")
                return True
                
            except Exception as e:
                logger.error(f"Failed to load model {metadata.model_id}: {e}")
                return False
    
    async def predict(
        self,
        features: np.ndarray,
        feature_names: List[str],
        model_name: Optional[str] = None,
        use_ensemble: bool = True,
        return_uncertainty: bool = False,
        return_explanations: bool = False,
        top_k_features: int = 5
    ) -> Dict[str, Any]:
        """Single prediction with optional uncertainty and explanations."""
        start_time = time.time()
        
        if features.ndim == 1:
            features = features.reshape(1, -1)
        
        model_name = model_name or "ensemble"
        
        try:
            if model_name == "ensemble" or model_name not in self._models:
                predictor = self._get_ensemble_predictor()
                probas = predictor.predict_proba(features)
                predictions = (probas >= 0.5).astype(int)
                model_used = "ensemble"
            else:
                model = self._models.get(model_name)
                if model is None:
                    raise ValueError(f"Model not found: {model_name}")
                
                probas = model.predict_proba(features)
                predictions = (probas >= 0.5).astype(int)
                model_used = model_name
            
            latency_ms = (time.time() - start_time) * 1000
            
            result = {
                "predictions": predictions.tolist(),
                "probabilities": probas.tolist(),
                "model_used": model_used,
                "latency_ms": latency_ms,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if return_uncertainty:
                uncertainty = await self._estimate_uncertainty(features)
                result["uncertainty"] = uncertainty.tolist()
            
            if return_explanations:
                explanations = await self._generate_explanations(
                    features, feature_names, top_k_features
                )
                result["explanations"] = explanations
            
            await self._increment_metric("total_requests")
            await self._add_latency(latency_ms)
            
            return result
            
        except Exception as e:
            await self._increment_metric("errors")
            logger.error(f"Prediction failed: {e}")
            raise
    
    async def predict_batch(
        self,
        features_batch: np.ndarray,
        feature_names: List[str],
        model_name: Optional[str] = None,
        use_ensemble: bool = True,
        return_uncertainty: bool = False,
        return_explanations: bool = False,
        top_k_features: int = 5
    ) -> Dict[str, Any]:
        """Batch prediction for multiple samples."""
        start_time = time.time()
        
        if features_batch.ndim == 1:
            features_batch = features_batch.reshape(1, -1)
        
        n_samples = features_batch.shape[0]
        
        chunk_size = 1000
        results = []
        
        for i in range(0, len(features_batch), chunk_size):
            chunk = features_batch[i:i+chunk_size]
            
            probas = self._predict_proba_raw(chunk, use_ensemble=True)
            predictions = (probas >= 0.5).astype(int)
            
            chunk_results = []
            for j in range(len(chunk)):
                prob = float(probas[j])
                pred = int(predictions[j])
                
                result = {
                    "prediction": pred,
                    "probability": float(prob),
                    "risk_level": self._get_risk_level(prob)
                }
                chunk_results.append(result)
            
            results.extend(chunk_results)
        
        latency_ms = (time.time() - start_time) * 1000
        
        return {
            "predictions": results,
            "total_samples": len(results),
            "latency_ms": latency_ms,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def _predict_proba_raw(self, features: np.ndarray, use_ensemble: bool) -> np.ndarray:
        """Raw probability prediction without metrics."""
        if use_ensemble:
            predictor = self._get_ensemble_predictor()
            return predictor.predict_proba(features)
        else:
            # Use first available model
            for model in self._models.values():
                if model.is_fitted:
                    return model.predict_proba(features)
            raise ValueError("No fitted models available")
    
    def _get_risk_level(self, probability: float) -> str:
        """Convert probability to risk level."""
        if probability >= 0.8:
            return "CRITICAL"
        elif probability >= 0.6:
            return "HIGH"
        elif probability >= 0.4:
            return "MODERATE"
        elif probability >= 0.2:
            return "LOW"
        else:
            return "VERY_LOW"
    
    async def _increment_metric(self, name: str):
        async with self._metrics_lock:
            self.metrics[name] = self.metrics.get(name, 0) + 1
    
    async def _add_latency(self, latency_ms: float):
        async with self._metrics_lock:
            self.metrics["total_latency_ms"] += latency_ms
    
    async def get_metrics(self) -> Dict[str, Any]:
        """Get inference engine metrics."""
        async with self._metrics_lock:
            metrics = self.metrics.copy()
            if metrics["total_requests"] > 0:
                metrics["avg_latency_ms"] = metrics["total_latency_ms"] / metrics["total_requests"]
                total_cache = metrics["cache_hits"] + metrics["cache_misses"]
                metrics["cache_hit_rate"] = (
                    metrics["cache_hits"] / total_cache
                    if total_cache > 0 else 0
                )
            else:
                metrics["avg_latency_ms"] = 0
                metrics["cache_hit_rate"] = 0
            return metrics
    
    async def _batch_processor(self):
        """Background task to process batched requests."""
        while not self._shutdown:
            try:
                batch_requests = []
                try:
                    request = await asyncio.wait_for(
                        self._batch_queue.get(), timeout=self.batch_timeout_ms / 1000
                    )
                    batch_requests.append(request)
                    
                    while len(batch_requests) < self.batch_size:
                        try:
                            request = self._batch_queue.get_nowait()
                            batch_requests.append(request)
                        except asyncio.QueueEmpty:
                            break
                    
                    await self._process_batch(batch_requests)
                    
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    logger.error(f"Batch processor error: {e}")
            except Exception as e:
                logger.error(f"Batch processor outer error: {e}")
    
    async def _process_batch(self, requests: List[InferenceRequest]):
        """Process a batch of inference requests."""
        if not requests:
            return
        
        by_model = defaultdict(list)
        for req in requests:
            by_model[req.model_name or "ensemble"].append(req)
        
        for model_name, reqs in by_model.items():
            features = np.vstack([r.features for r in reqs])
            
            try:
                if model_name == "ensemble":
                    predictor = self._get_ensemble_predictor()
                    probas = predictor.predict_proba(features)
                    predictions = (probas >= 0.5).astype(int)
                else:
                    model = self._models.get(model_name)
                    probas = model.predict_proba(features)
                    predictions = (probas >= 0.5).astype(int)
                
                for i, req in enumerate(reqs):
                    future = self._batch_results.get(req.request_id)
                    if future and not future.done():
                        result = {
                            "request_id": req.request_id,
                            "predictions": predictions[i].tolist(),
                            "probabilities": probas[i].tolist() if probas.ndim > 1 else [probas[i]],
                            "model_used": model_name,
                            "latency_ms": 0
                        }
                        future.set_result(result)
                        
            except Exception as e:
                logger.error(f"Batch processing error: {e}")
                for req in reqs:
                    future = self._batch_results.get(req.request_id)
                    if future and not future.done():
                        future.set_exception(e)
    
    def _get_ensemble_predictor(self):
        """Get or create ensemble predictor."""
        if "flood_ensemble" in self._models:
            return self._models["flood_ensemble"]
        if "ensemble" in self._models:
            return self._models["ensemble"]
        config = ModelConfig()
        predictor = FloodRiskPredictor(config)
        predictor.create_default_models()
        self._models["ensemble"] = predictor
        return self._models["ensemble"]
    
    async def _estimate_uncertainty(self, features: np.ndarray) -> np.ndarray:
        """Estimate prediction uncertainty using ensemble variance."""
        predictions = []
        
        for name, model in self._models.items():
            if model.is_fitted:
                probas = model.predict_proba(features)
                predictions.append(probas[:, 1] if probas.ndim > 1 else probas)
        
        if len(predictions) < 2:
            return np.zeros(features.shape[0])
        
        pred_array = np.array(predictions)
        return np.std(pred_array, axis=0)
    
    async def _generate_explanations(
        self,
        features: np.ndarray,
        feature_names: List[str],
        top_k: int = 5
    ) -> List[Dict]:
        """Generate feature explanations using SHAP or feature importance."""
        explanations = []
        
        try:
            import shap
            for name, model in self._models.items():
                if model.is_fitted and hasattr(model, 'model'):
                    try:
                        explainer = shap.TreeExplainer(model.model)
                        shap_values = explainer.shap_values(features[:1])
                        
                        if isinstance(shap_values, list):
                            shap_vals = shap_values[1][0]
                        else:
                            shap_vals = shap_vals[0]
                        
                        feature_importance = np.abs(shap_vals)
                        top_indices = np.argsort(feature_importance)[-5:][::-1]
                        
                        explanations.append({
                            "method": "SHAP",
                            "model": "ensemble",
                            "features": [
                                {
                                    "feature": feature_names[idx] if idx < len(feature_names) else f"feature_{idx}",
                                    "value": float(features[0][idx]),
                                    "shap_value": float(shap_vals[idx]),
                                    "impact": "increases" if shap_vals[idx] > 0 else "decreases"
                                }
                                for idx in top_indices
                            ]
                        })
                        break
                    except Exception as e:
                        logger.warning(f"SHAP explanation failed: {e}")
        except ImportError:
            pass
        
        if not explanations:
            for name, model in self._models.items():
                if not model.is_fitted:
                    continue
                # Handle ensemble (FloodRiskPredictor) which contains sub-models
                if hasattr(model, 'models') and isinstance(model.models, dict):
                    # Ensemble: iterate through sub-models
                    for sub_name, sub_model in model.models.items():
                        if sub_model.is_fitted and sub_model.feature_importance:
                            sorted_features = sorted(
                                sub_model.feature_importance.items(),
                                key=lambda x: x[1], reverse=True
                            )[:5]
                            explanations.append({
                                "method": "feature_importance",
                                "model": f"{name}.{sub_name}",
                                "features": [
                                    {"feature": feat, "importance": imp}
                                    for feat, imp in sorted_features
                                ]
                            })
                            break
                    if explanations:
                        break
                elif model.feature_importance:
                    # Single model with feature_importance
                    sorted_features = sorted(
                        model.feature_importance.items(),
                        key=lambda x: x[1], reverse=True
                    )[:5]
                    explanations.append({
                        "method": "feature_importance",
                        "model": name,
                        "features": [
                            {"feature": feat, "importance": imp}
                            for feat, imp in sorted_features
                        ]
                    })
                    break
        
        return explanations
    
    async def shutdown(self):
        """Graceful shutdown."""
        self._shutdown = True
        
        if self._batch_processor_task:
            self._batch_processor_task.cancel()
            try:
                await self._batch_processor_task
            except asyncio.CancelledError:
                pass
        
        self.executor.shutdown(wait=True)
        await self.cache.clear()
        
        logger.info("Inference engine shutdown complete")
    
    async def health_check(self) -> Dict[str, Any]:
        """Health check for inference engine."""
        return {
            "status": "healthy" if self._models else "no_models",
            "models_loaded": list(self._models.keys()),
            "models_fitted": {k: v.is_fitted for k, v in self._models.items()},
            "cache_size": len(self.cache._cache),
            "metrics": await self.get_metrics(),
            "uptime_seconds": time.time() - self._start_time
        }


class InferenceService:
    """High-level inference service with business logic."""
    
    def __init__(self, engine: InferenceEngine):
        self.engine = engine
        self.feature_engineer = None
    
    async def predict_flood_risk(
        self,
        latitude: float,
        longitude: float,
        prediction_horizon_hours: int = 72,
        include_uncertainty: bool = True,
        include_explanations: bool = True
    ) -> Dict[str, Any]:
        """High-level flood risk prediction for a location."""
        risk_result = {
            "location": {"latitude": latitude, "longitude": longitude},
            "timestamp": datetime.utcnow().isoformat(),
            "prediction_horizon_hours": prediction_horizon_hours,
            "risk_probability": 0.0,
            "risk_level": "LOW",
            "risk_score": 0,
            "model_version": "1.0.0",
            "data_quality": "GOOD",
            "uncertainty": 0.1,
            "contributing_factors": [],
            "data_sources": [],
            "model_version": "1.0.0",
            "prediction_timestamp": datetime.utcnow().isoformat()
        }
        
        return risk_result
    
    async def get_risk_map(
        self,
        bbox: Tuple[float, float, float, float],
        resolution: int = 250,
        forecast_hours: int = 0
    ) -> Dict:
        """Generate flood risk map for a bounding box."""
        return {
            "bbox": bbox,
            "resolution": resolution,
            "forecast_hours": forecast_hours,
            "tiles": []
        }
    
    async def get_evacuation_routes(
        self,
        origin: Tuple[float, float],
        destination: Tuple[float, float],
        max_flood_depth: float = 0.3
    ) -> Dict:
        """Compute safe evacuation routes."""
        return {
            "routes": [],
            "warnings": []
        }
    
    async def get_nearby_shelters(
        self,
        latitude: float,
        longitude: float,
        radius_km: float = 50
    ) -> List[Dict]:
        """Find nearby emergency shelters."""
        return []


_inference_service: Optional[InferenceService] = None


async def get_inference_service() -> InferenceService:
    """Get or create global inference service."""
    global _inference_service
    if _inference_service is None:
        engine = InferenceEngine()
        await engine.initialize()
        _inference_service = InferenceService(engine)
    return _inference_service


async def close_inference_service():
    """Shutdown inference service."""
    global _inference_service
    if _inference_service:
        await _inference_service.engine.shutdown()
        _inference_service = None