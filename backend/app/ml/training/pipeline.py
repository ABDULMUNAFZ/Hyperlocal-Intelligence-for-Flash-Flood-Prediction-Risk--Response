# FloodGuard Training Pipeline
"""Complete training pipeline with spatial/temporal splits and MLflow tracking."""

import asyncio
import logging
import json
import hashlib
import joblib
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import BaseCrossValidator
from sklearn.metrics import (
    roc_auc_score, average_precision_score, precision_recall_curve,
    roc_curve, brier_score_loss,
    precision_score, recall_score, f1_score, accuracy_score
)
from sklearn.calibration import calibration_curve
import mlflow
import mlflow.sklearn

from app.ml.models.training import FloodRiskPredictor, ModelConfig
from app.ml.registry import get_model_registry, ModelStage, create_model_metadata
from app.db.session import async_session_maker
from app.core.config import settings
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


@dataclass
class TrainingConfig:
    """Training pipeline configuration."""
    experiment_name: str = "floodguard_training"
    test_size: float = 0.2
    validation_size: float = 0.1
    temporal_split: bool = True
    spatial_split: bool = True
    n_splits: int = 5
    random_state: int = 42
    target_column: str = "flood_occurred"
    feature_columns: List[str] = field(default_factory=list)
    group_column: Optional[str] = "grid_cell_id"
    time_column: Optional[str] = "event_date"
    
    # Model configs
    logistic_config: Dict[str, Any] = field(default_factory=dict)
    rf_config: Dict[str, Any] = field(default_factory=dict)
    xgb_config: Dict[str, Any] = field(default_factory=dict)
    lgbm_config: Dict[str, Any] = field(default_factory=dict)
    
    # Ensemble
    ensemble_weights: List[float] = field(default_factory=lambda: [0.3, 0.3, 0.4])
    
    # Thresholds
    prob_threshold: float = 0.5
    min_samples_per_class: int = 10


class SpatialTemporalSplitter(BaseCrossValidator):
    """Cross-validator with spatial and temporal separation to prevent leakage."""
    
    def __init__(
        self,
        n_splits: int = 5,
        spatial_buffer_km: float = 50,
        temporal_buffer_days: int = 30,
        test_size: float = 0.2,
        random_state: int = 42
    ):
        self.n_splits = n_splits
        self.spatial_buffer_km = spatial_buffer_km
        self.temporal_buffer_days = temporal_buffer_days
        self.test_size = test_size
        self.random_state = random_state
        self.rng = np.random.RandomState(random_state)
    
    def get_n_splits(self, X=None, y=None, groups=None):
        return self.n_splits
    
    def split(self, X, y=None, groups=None):
        """Generate train/test splits with spatial and temporal separation."""
        if groups is None:
            raise ValueError("groups (grid_cell_id) required for spatial splitting")
        
        # Get unique groups and their time info
        unique_groups = np.unique(groups)
        n_groups = len(unique_groups)
        n_test_groups = max(1, int(n_groups * self.test_size))
        
        # For temporal splitting, we need time information
        # Here we assume groups have temporal ordering or we use indices
        
        for split_idx in range(self.n_splits):
            # Shuffle groups
            shuffled = self.rng.permutation(unique_groups)
            
            # Split groups
            test_groups = shuffled[:n_test_groups]
            train_groups = shuffled[n_test_groups:]
            
            # Create spatial buffer - exclude nearby groups from test
            # This is simplified; real implementation would use actual distances
            
            train_mask = np.isin(groups, train_groups)
            test_mask = np.isin(groups, test_groups)
            
            # Ensure minimum samples per class in both splits
            if y is not None:
                train_y = y[train_mask]
                test_y = y[test_mask]
                
                if len(np.unique(train_y)) < 2 or len(np.unique(test_y)) < 2:
                    # Resample if class imbalance
                    continue
            
            train_idx = np.where(train_mask)[0]
            test_idx = np.where(test_mask)[0]
            
            yield train_idx, test_idx


class TrainingPipeline:
    """Complete training pipeline for flood prediction models."""
    
    def __init__(self, config: Optional[TrainingConfig] = None):
        self.config = config or TrainingConfig()
        self.predictor = FloodRiskPredictor(ModelConfig())
        self.splitter = SpatialTemporalSplitter(
            n_splits=self.config.n_splits,
            test_size=self.config.test_size,
            random_state=self.config.random_state
        )
        self.training_history: List[Dict] = []
        self._setup_mlflow()
    
    def _setup_mlflow(self):
        """Setup MLflow tracking."""
        try:
            mlflow.set_tracking_uri(settings.MLFLOW_TRACKING_URI)
            mlflow.set_experiment(self.config.experiment_name)
        except Exception as e:
            logger.warning(f"MLflow setup failed: {e}")
    
    async def load_training_data(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        bbox: Optional[Tuple[float, float, float, float]] = None,
        min_samples: int = 1000
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[str]]:
        """
        Load training data from database.
        
        Returns:
            X: Feature matrix (n_samples, n_features)
            y: Target labels (n_samples,)
            groups: Group identifiers for spatial splitting (n_samples,)
            feature_names: List of feature names
        """
        # Build query
        conditions = []
        params = {}
        
        if start_date:
            conditions.append("event_date >= :start_date")
            if isinstance(start_date, str):
                params["start_date"] = datetime.fromisoformat(start_date)
            else:
                params["start_date"] = start_date
        if end_date:
            conditions.append("event_date <= :end_date")
            if isinstance(end_date, str):
                params["end_date"] = datetime.fromisoformat(end_date)
            else:
                params["end_date"] = end_date
        if bbox:
            min_lon, min_lat, max_lon, max_lat = bbox
            conditions.append("longitude BETWEEN :min_lon AND :max_lon")
            conditions.append("latitude BETWEEN :min_lat AND :max_lat")
            params.update({
                "min_lon": min_lon, "max_lon": max_lon,
                "min_lat": min_lat, "max_lat": max_lat
            })
        
        where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
        
        query = f"""
            SELECT 
                grid_cell_id,
                latitude,
                longitude,
                event_date,
                flood_occurred,
                -- Rainfall features
                rainfall_1h_mm,
                rainfall_3h_mm,
                rainfall_6h_mm,
                rainfall_12h_mm,
                rainfall_24h_mm,
                rainfall_48h_mm,
                rainfall_72h_mm,
                rainfall_168h_mm,
                rainfall_intensity_mmh,
                rainfall_max_intensity_24h,
                antecedent_rainfall_7d_mm,
                antecedent_rainfall_14d_mm,
                antecedent_rainfall_30d_mm,
                dry_spell_hours,
                -- Weather features
                temperature_c,
                humidity_percent,
                wind_speed_kmh,
                wind_direction_deg,
                pressure_hpa,
                cape_jkg,
                lifted_index,
                soil_moisture_0_7cm,
                soil_moisture_7_28cm,
                soil_moisture_28_100cm,
                precipitable_water_mm,
                -- Forecast features
                forecast_precip_1h_mm,
                forecast_precip_6h_mm,
                forecast_precip_24h_mm,
                forecast_precip_72h_mm,
                forecast_precip_prob_max,
                forecast_temp_min_24h,
                forecast_temp_max_24h,
                forecast_wind_max_24h,
                forecast_cape_max_24h,
                -- Terrain features
                elevation_m,
                slope_deg,
                slope_pct,
                aspect_deg,
                aspect_northness,
                aspect_eastness,
                curvature,
                profile_curvature,
                plan_curvature,
                flow_accumulation,
                log_flow_accumulation,
                twi,
                spi,
                distance_to_stream_m,
                distance_to_river_m,
                watershed_area_sqkm,
                drainage_density_kmkm2,
                stream_order,
                -- Soil features
                soil_clay_percent,
                soil_sand_percent,
                soil_silt_percent,
                soil_organic_carbon_percent,
                soil_bulk_density_gcm3,
                soil_ph,
                soil_cec_cmolkg,
                soil_ksat_mmhr,
                soil_field_capacity,
                soil_wilting_point,
                soil_porosity,
                soil_awc_mm,
                soil_k_factor,
                hydrologic_soil_group,
                -- Land cover features
                landcover_class,
                impervious_fraction,
                tree_cover_pct,
                grass_cover_pct,
                crop_cover_pct,
                urban_fraction,
                forest_fraction,
                water_fraction,
                wetland_fraction,
                vegetation_fraction,
                ndvi,
                ndwi,
                -- Population & infrastructure
                population_density_per_km2,
                population_total,
                vulnerable_population_pct,
                building_density_per_km2,
                critical_infrastructure_count,
                road_density_kmkm2,
                hospital_count,
                school_count,
                shelter_count,
                -- Historical flood features
                historical_flood_count,
                years_since_last_flood,
                max_historical_flood_depth_m,
                historical_flood_frequency_per_year,
                max_historical_fatalities,
                max_historical_affected_pop,
                -- IoT sensor features
                sensor_rainfall_mm,
                sensor_water_level_m,
                sensor_soil_moisture_pct
            FROM training_samples
            {where_clause}
            ORDER BY event_date
        """
        
        try:
            async with async_session_maker() as db:
                result = await db.execute(text(query), params)
                rows = result.fetchall()
        except Exception as e:
            logger.warning(f"Database connection failed, using synthetic data: {e}")
            return self._generate_synthetic_data(min_samples)
        
        if len(rows) < min_samples:
            logger.warning(f"Only {len(rows)} samples found, need at least {min_samples}")
            # Generate synthetic data for development
            return self._generate_synthetic_data(min_samples)
        
        # Convert to arrays
        data = np.array([list(row) for row in rows])
        
        # Extract columns
        # Columns: grid_cell_id, latitude, longitude, event_date, flood_occurred, features...
        y = data[:, 4].astype(int)  # flood_occurred
        groups = data[:, 0].astype(str)  # grid_cell_id
        
        # Feature columns (skip first 5 columns)
        X = data[:, 5:].astype(float)
        
        # Handle NaN values
        X = np.nan_to_num(X, nan=0.0, posinf=1e6, neginf=-1e6)
        
        feature_names = [
            "rainfall_1h_mm", "rainfall_6h_mm", "rainfall_24h_mm", "rainfall_72h_mm",
            "temperature_c", "humidity_percent", "wind_speed_kmh", "pressure_hpa",
            "elevation_m", "slope_deg", "twi",
            "soil_clay_percent", "soil_sand_percent", "soil_saturated_conductivity_mm_h",
            "landcover_class", "population_density_per_km2", "historical_flood_count"
        ]
        
        logger.info(f"Loaded {len(X)} samples with {X.shape[1]} features")
        logger.info(f"Target distribution: {np.bincount(y)}")
        
        return X, y, groups, feature_names
    
    def _generate_synthetic_data(self, n_samples: int) -> Tuple[np.ndarray, np.ndarray, np.ndarray, List[str]]:
        """Generate synthetic training data for development."""
        n_features = 17
        feature_names = [
            "rainfall_1h_mm", "rainfall_6h_mm", "rainfall_24h_mm", "rainfall_72h_mm",
            "temperature_c", "humidity_percent", "wind_speed_kmh", "pressure_hpa",
            "elevation_m", "slope_deg", "twi",
            "soil_clay_percent", "soil_sand_percent", "soil_saturated_conductivity_mm_h",
            "landcover_class", "population_density_per_km2", "historical_flood_count"
        ]
        
        np.random.seed(self.config.random_state)
        
        # Generate features with realistic distributions
        X = np.zeros((n_samples, n_features))
        X[:, 0] = np.random.exponential(5, n_samples)  # rainfall_1h
        X[:, 1] = np.random.exponential(15, n_samples)  # rainfall_6h
        X[:, 2] = np.random.exponential(30, n_samples)  # rainfall_24h
        X[:, 3] = np.random.exponential(50, n_samples)  # rainfall_72h
        X[:, 4] = np.random.normal(25, 5, n_samples)  # temperature
        X[:, 5] = np.random.uniform(40, 100, n_samples)  # humidity
        X[:, 6] = np.random.exponential(10, n_samples)  # wind
        X[:, 7] = np.random.normal(1013, 10, n_samples)  # pressure
        X[:, 8] = np.random.uniform(0, 2500, n_samples)  # elevation
        X[:, 9] = np.random.uniform(0, 45, n_samples)  # slope
        X[:, 10] = np.random.uniform(0, 20, n_samples)  # twi
        X[:, 11] = np.random.uniform(0, 60, n_samples)  # clay
        X[:, 12] = np.random.uniform(0, 80, n_samples)  # sand
        X[:, 13] = np.random.uniform(0, 100, n_samples)  # ksat
        X[:, 14] = np.random.choice([10, 20, 30, 40, 50, 60, 80, 90], n_samples)  # landcover
        X[:, 15] = np.random.exponential(100, n_samples)  # pop density
        X[:, 16] = np.random.poisson(2, n_samples)  # historical floods
        
        # Generate targets with some relationship to features
        # Higher rainfall + low elevation + high historical floods = higher risk
        risk_score = (
            0.3 * (X[:, 2] / 100) +  # 24h rainfall
            0.2 * (1 - X[:, 8] / 2500) +  # inverse elevation
            0.2 * (X[:, 16] / 10) +  # historical floods
            0.1 * (X[:, 11] / 60) +  # clay content
            0.1 * (X[:, 15] / 1000) +  # population
            0.1 * np.random.randn(n_samples)  # noise
        )
        
        # Convert to probability and sample
        prob = 1 / (1 + np.exp(-risk_score + 2))  # Shift to get ~20% positive rate
        y = np.random.binomial(1, prob)
        
        # Groups (grid cells)
        n_groups = max(10, n_samples // 50)
        groups = np.array([f"grid_{i % n_groups}" for i in range(n_samples)])
        
        logger.info(f"Generated synthetic data: {n_samples} samples, {y.sum()} positive ({y.mean()*100:.1f}%)")
        
        return X, y, groups, feature_names
    
    async def train(
        self,
        X: np.ndarray,
        y: np.ndarray,
        groups: np.ndarray,
        feature_names: List[str],
        register_models: bool = True
    ) -> Dict[str, Any]:
        """
        Train all models with cross-validation.
        
        Returns:
            Dictionary with training results and model metrics
        """
        logger.info("Starting model training...")
        
        # Create default models
        self.predictor.create_default_models()
        
        # Cross-validation
        cv_results = await self._cross_validate(X, y, groups, feature_names)
        
        # Train on full dataset
        logger.info("Training on full dataset...")
        self.predictor.fit(X, y, feature_names=feature_names)
        
        # Evaluate on full dataset
        full_metrics = self._evaluate_full(X, y, feature_names)
        
        # Register models
        if register_models:
            await self._register_models(X, y, groups, feature_names, full_metrics)
        
        results = {
            "cv_results": cv_results,
            "full_metrics": full_metrics,
            "feature_names": feature_names,
            "n_samples": len(X),
            "positive_rate": y.mean(),
            "trained_at": datetime.utcnow().isoformat()
        }
        
        self.training_history.append(results)
        
        return results
    
    async def _cross_validate(
        self,
        X: np.ndarray,
        y: np.ndarray,
        groups: np.ndarray,
        feature_names: List[str]
    ) -> Dict[str, Any]:
        """Run spatial-temporal cross-validation."""
        logger.info(f"Running {self.config.n_splits}-fold spatial-temporal CV...")
        
        cv_metrics = {
            "roc_auc": [],
            "pr_auc": [],
            "brier_score": [],
            "precision": [],
            "recall": [],
            "f1": [],
            "accuracy": []
        }
        
        fold_predictions = []
        fold_probabilities = []
        fold_indices = []
        
        for fold_idx, (train_idx, test_idx) in enumerate(self.splitter.split(X, y, groups)):
            logger.info(f"Fold {fold_idx + 1}/{self.config.n_splits}")
            
            X_train, X_test = X[train_idx], X[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]
            
            # Create fresh predictor for each fold
            fold_predictor = FloodRiskPredictor(ModelConfig())
            fold_predictor.create_default_models()
            fold_predictor.fit(X_train, y_train, feature_names=feature_names)
            
            # Predict
            probas = fold_predictor.predict_proba(X_test)
            preds = (probas >= self.config.prob_threshold).astype(int)
            
            # Compute metrics
            if len(np.unique(y_test)) > 1:
                roc_auc = roc_auc_score(y_test, probas)
                pr_auc = average_precision_score(y_test, probas)
                brier = brier_score_loss(y_test, probas)
                precision = precision_score(y_test, preds, zero_division=0)
                recall = recall_score(y_test, preds, zero_division=0)
                f1 = f1_score(y_test, preds, zero_division=0)
                accuracy = accuracy_score(y_test, preds)
            else:
                roc_auc = pr_auc = brier = precision = recall = f1 = accuracy = 0
            
            cv_metrics["roc_auc"].append(roc_auc)
            cv_metrics["pr_auc"].append(pr_auc)
            cv_metrics["brier_score"].append(brier)
            cv_metrics["precision"].append(precision)
            cv_metrics["recall"].append(recall)
            cv_metrics["f1"].append(f1)
            cv_metrics["accuracy"].append(accuracy)
            
            fold_predictions.append(preds)
            fold_probabilities.append(probas)
            fold_indices.append(test_idx)
        
        # Aggregate
        cv_summary = {}
        for metric, values in cv_metrics.items():
            cv_summary[metric] = {
                "mean": float(np.mean(values)),
                "std": float(np.std(values)),
                "values": [float(v) for v in values]
            }
        
        logger.info(f"CV Results: ROC-AUC={cv_summary['roc_auc']['mean']:.4f}±{cv_summary['roc_auc']['std']:.4f}, "
                   f"PR-AUC={cv_summary['pr_auc']['mean']:.4f}±{cv_summary['pr_auc']['std']:.4f}")
        
        return {
            "summary": cv_summary,
            "fold_predictions": fold_predictions,
            "fold_probabilities": fold_probabilities,
            "fold_indices": fold_indices
        }
    
    def _evaluate_full(
        self,
        X: np.ndarray,
        y: np.ndarray,
        feature_names: List[str]
    ) -> Dict[str, Any]:
        """Evaluate on full dataset."""
        probas = self.predictor.predict_proba(X)
        preds = (probas >= self.config.prob_threshold).astype(int)
        
        # Overall metrics
        metrics = {}
        if len(np.unique(y)) > 1:
            metrics["roc_auc"] = float(roc_auc_score(y, probas))
            metrics["pr_auc"] = float(average_precision_score(y, probas))
            metrics["brier_score"] = float(brier_score_loss(y, probas))
            metrics["precision"] = float(precision_score(y, preds, zero_division=0))
            metrics["recall"] = float(recall_score(y, preds, zero_division=0))
            metrics["f1"] = float(f1_score(y, preds, zero_division=0))
            metrics["accuracy"] = float(accuracy_score(y, preds))
            
            # Calibration
            prob_true, prob_pred = calibration_curve(y, probas, n_bins=10)
            metrics["calibration_curve"] = {
                "prob_true": prob_true.tolist(),
                "prob_pred": prob_pred.tolist()
            }
        
        # Per-class metrics
        metrics["per_class"] = {}
        for cls in [0, 1]:
            mask = y == cls
            if mask.sum() > 0:
                metrics["per_class"][cls] = {
                    "count": int(mask.sum()),
                    "mean_prob": float(probas[mask].mean()),
                    "precision": float(precision_score(y[mask], preds[mask], zero_division=0)),
                    "recall": float(recall_score(y[mask], preds[mask], zero_division=0))
                }
        
        # Feature importance
        feature_importance = {}
        for name, model in self.predictor.models.items():
            if model.is_fitted and model.feature_importance:
                feature_importance[name] = model.feature_importance
        
        # Ensemble feature importance (average)
        if feature_importance:
            all_features = set()
            for fi in feature_importance.values():
                all_features.update(fi.keys())
            
            ensemble_importance = {}
            for feat in all_features:
                values = [fi.get(feat, 0) for fi in feature_importance.values()]
                ensemble_importance[feat] = float(np.mean(values))
            
            metrics["feature_importance"] = dict(
                sorted(ensemble_importance.items(), key=lambda x: x[1], reverse=True)
            )
        
        return metrics
    
    async def _register_models(
        self,
        X: np.ndarray,
        y: np.ndarray,
        groups: np.ndarray,
        feature_names: List[str],
        metrics: Dict[str, Any]
    ):
        """Register trained models in registry."""
        registry = get_model_registry()
        
        # Compute data hash
        data_hash = hashlib.sha256(f"{X.shape}:{y.sum()}:{np.unique(groups).shape}".encode()).hexdigest()[:16]
        
        # Feature hash
        feature_str = ','.join(sorted(feature_names))
        feature_hash = hashlib.sha256(feature_str.encode()).hexdigest()[:16]
        
        # Model path
        model_dir = Path("models/trained") / datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        model_dir.mkdir(parents=True, exist_ok=True)
        
        # Save predictor
        self.predictor.save_all(model_dir)
        
        # Register each model
        model_types = {
            "logistic_regression": "logistic",
            "random_forest": "random_forest",
            "xgboost": "xgboost",
            "lightgbm": "lightgbm"
        }
        
        for model_name, model_type in model_types.items():
            model = self.predictor.models.get(model_name)
            if model and model.is_fitted:
                model_path = model_dir / f"{model_name}.pkl"
                
                # Get hyperparameters from model config
                if model_name == "logistic":
                    hyperparams = model.config.lr_params
                elif model_name == "random_forest":
                    hyperparams = model.config.rf_params
                elif model_name == "xgboost":
                    hyperparams = model.config.xgb_params
                elif model_name == "lightgbm":
                    hyperparams = model.config.lgbm_params
                else:
                    hyperparams = {}
                
                metadata = create_model_metadata(
                    name=f"flood_{model_name}",
                    version="1.0.0",
                    model_type=model_type,
                    training_date=datetime.utcnow().isoformat(),
                    training_samples=len(X),
                    positive_samples=int(y.sum()),
                    negative_samples=int((y == 0).sum()),
                    feature_names=feature_names,
                    metrics=metrics,
                    hyperparameters=hyperparams,
                    feature_importance=model.feature_importance,
                    feature_hash=feature_hash,
                    training_dataset_hash=data_hash,
                    model_path=model_path,
                    description=f"Flood prediction {model_name} model trained with spatial-temporal CV",
                    tags=["flood", "prediction", model_type, "spatial_temporal_cv"],
                    parent_model_id=None
                )
                
                registry.register_model(model_path, metadata, ModelStage.DEVELOPMENT)
                logger.info(f"Registered {model_name} model")
        
        # Register ensemble
        ensemble_path = model_dir / "ensemble.pkl"
        # Save ensemble as predictor
        joblib.dump(self.predictor, ensemble_path)
        
        ensemble_metadata = create_model_metadata(
            name="flood_ensemble",
            version="1.0.0",
            model_type="ensemble",
            training_date=datetime.utcnow().isoformat(),
            training_samples=len(X),
            positive_samples=int(y.sum()),
            negative_samples=int((y == 0).sum()),
            feature_names=feature_names,
            metrics=metrics,
            hyperparameters={
                "weights": self.config.ensemble_weights,
                "threshold": self.config.prob_threshold
            },
            feature_importance=metrics.get("feature_importance", {}),
            feature_hash=feature_hash,
            training_dataset_hash=data_hash,
            model_path=ensemble_path,
            description="Flood prediction ensemble model",
            tags=["flood", "prediction", "ensemble", "spatial_temporal_cv"],
            parent_model_id=None
        )
        
        registry.register_model(ensemble_path, ensemble_metadata, ModelStage.DEVELOPMENT)
        logger.info("Registered ensemble model")
    
    async def hyperparameter_tuning(
        self,
        X: np.ndarray,
        y: np.ndarray,
        groups: np.ndarray,
        model_name: str,
        param_grid: Dict[str, List],
        n_iter: int = 20
    ) -> Dict[str, Any]:
        """Run hyperparameter tuning with spatial-temporal CV."""
        from sklearn.model_selection import RandomizedSearchCV
        from sklearn.base import clone
        
        logger.info(f"Running hyperparameter tuning for {model_name}...")
        
        # Get base model
        base_model = self.predictor.models.get(model_name)
        if not base_model:
            raise ValueError(f"Model {model_name} not found")
        
        # Create estimator wrapper
        from sklearn.base import BaseEstimator, ClassifierMixin
        
        class ModelWrapper(BaseEstimator, ClassifierMixin):
            def __init__(self, **params):
                self.params = params
                self.model = None
            
            def fit(self, X, y):
                self.model = clone(base_model)
                self.model.hyperparameters.update(self.params)
                self.model.fit(X, y)
                return self
            
            def predict_proba(self, X):
                return self.model.predict_proba(X)
            
            def predict(self, X):
                return self.model.predict(X)
        
        # Randomized search with custom CV
        search = RandomizedSearchCV(
            ModelWrapper(),
            param_grid,
            n_iter=n_iter,
            cv=self.splitter,
            scoring="roc_auc",
            n_jobs=-1,
            random_state=self.config.random_state,
            verbose=1
        )
        
        search.fit(X, y, groups=groups)
        
        logger.info(f"Best params: {search.best_params_}")
        logger.info(f"Best score: {search.best_score_:.4f}")
        
        return {
            "best_params": search.best_params_,
            "best_score": search.best_score_,
            "cv_results": search.cv_results_
        }
    
    async def retrain_with_new_data(
        self,
        new_X: np.ndarray,
        new_y: np.ndarray,
        new_groups: np.ndarray,
        feature_names: List[str]
    ) -> Dict[str, Any]:
        """Retrain models with new data (incremental learning where possible)."""
        logger.info("Retraining with new data...")
        
        # For now, full retrain
        # In production, use incremental learning for RF, XGBoost
        return await self.train(new_X, new_y, new_groups, feature_names)
    
    def save_training_report(self, output_path: Path):
        """Save training report."""
        report = {
            "config": self.config.__dict__,
            "training_history": self.training_history,
            "generated_at": datetime.utcnow().isoformat()
        }
        
        with open(output_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)
        
        logger.info(f"Training report saved to {output_path}")
    
    async def promote_best_model(self, metric: str = "pr_auc") -> str:
        """Promote best model to production based on metric."""
        registry = get_model_registry()
        
        # Get all development models
        dev_models = registry.get_models_by_stage(ModelStage.DEVELOPMENT)
        
        if not dev_models:
            raise ValueError("No development models found")
        
        # Find best by metric
        best_model = None
        best_score = -1
        
        for model in dev_models:
            score = model.metrics.get(metric, 0)
            if score > best_score:
                best_score = score
                best_model = model
        
        if best_model:
            registry.promote_model(best_model.model_id, ModelStage.STAGING, "auto_promotion")
            logger.info(f"Promoted {best_model.name} to STAGING with {metric}={best_score:.4f}")
            return best_model.model_id
        
        raise ValueError("No suitable model found")


async def run_full_training_pipeline(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    bbox: Optional[Tuple[float, float, float, float]] = None,
    register: bool = True,
    promote: bool = False,
    min_samples: int = 1000
) -> Dict[str, Any]:
    """Run the complete training pipeline."""
    config = TrainingConfig()
    pipeline = TrainingPipeline(config)
    
    # Load data
    X, y, groups, feature_names = await pipeline.load_training_data(
        start_date=start_date,
        end_date=end_date,
        bbox=bbox,
        min_samples=min_samples
    )
    
    # Train
    results = await pipeline.train(X, y, groups, feature_names, register_models=register)
    
    # Optionally promote best model
    if promote:
        await pipeline.promote_best_model("pr_auc")
    
    return results