# FloodGuard ML Models
"""Machine learning models for flood risk prediction."""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from datetime import datetime
import joblib
import logging
from pathlib import Path
from abc import ABC, abstractmethod

import xgboost as xgb
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.metrics import (
    roc_auc_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_curve,
    precision_recall_curve, average_precision_score,
    brier_score_loss
)
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
import joblib

logger = logging.getLogger(__name__)


@dataclass
class ModelConfig:
    """Configuration for ML models."""
    # Model selection
    models_to_train: List[str] = field(default_factory=lambda: ['logistic', 'random_forest', 'xgboost'])
    
    # XGBoost parameters
    xgb_params: Dict = field(default_factory=lambda: {
        'objective': 'binary:logistic',
        'eval_metric': 'auc',
        'max_depth': 6,
        'learning_rate': 0.1,
        'n_estimators': 200,
        'subsample': 0.8,
        'colsample_bytree': 0.8,
        'min_child_weight': 1,
        'gamma': 0,
        'reg_alpha': 0.1,
        'reg_lambda': 1.0,
        'scale_pos_weight': 1,  # Will be adjusted for class imbalance
        'random_state': 42,
        'n_jobs': -1,
        'verbosity': 1
    })
    
    # Random Forest parameters
    rf_params: Dict = field(default_factory=lambda: {
        'n_estimators': 200,
        'max_depth': 15,
        'min_samples_split': 5,
        'min_samples_leaf': 2,
        'max_features': 'sqrt',
        'class_weight': 'balanced',
        'random_state': 42,
        'n_jobs': -1
    })
    
    # Logistic Regression parameters
    lr_params: Dict = field(default_factory=lambda: {
        'C': 1.0,
        'penalty': 'l2',
        'solver': 'lbfgs',
        'max_iter': 1000,
        'class_weight': 'balanced',
        'random_state': 42,
        'n_jobs': -1
    })
    
    # Training
    test_size: float = 0.2
    val_size: float = 0.1
    random_state: int = 42
    cv_folds: int = 5
    
    # Calibration
    calibrate_probabilities: bool = True
    calibration_method: str = 'isotonic'  # 'isotonic' or 'sigmoid'
    
    # Class imbalance handling
    handle_class_imbalance: bool = True
    oversample_method: str = 'smote'  # 'smote', 'adasyn', 'random', 'none'
    
    # Feature selection
    feature_selection: bool = False
    n_features_to_select: Optional[int] = None
    
    # Model output
    save_dir: str = "models/"
    model_name: str = "flood_risk"


class BaseFloodModel(ABC):
    """Abstract base class for flood prediction models."""
    
    def __init__(self, config: ModelConfig):
        self.config = config
        self.model = None
        self.scaler = StandardScaler()
        self.label_encoder = LabelEncoder()
        self.is_fitted = False
        self.feature_names: List[str] = []
        self.feature_importance: Optional[Dict[str, float]] = None
        self.training_history: Dict = {}
        self.metadata: Dict = {}
        
    @abstractmethod
    def _create_model(self):
        """Create the underlying model instance."""
        pass
    
    def _prepare_data(self, X: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare data for training."""
        # Handle class imbalance
        if self.config.handle_class_imbalance:
            X, y = self._handle_imbalance(X, y)
        return X, y
    
    def _handle_imbalance(self, X: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Handle class imbalance using specified method."""
        from collections import Counter
        
        class_counts = Counter(y)
        logger.info(f"Class distribution: {class_counts}")
        
        if self.config.oversample_method == 'smote':
            try:
                from imblearn.over_sampling import SMOTE
                smote = SMOTE(random_state=self.config.random_state)
                X_res, y_res = smote.fit_resample(X, y)
                logger.info(f"After SMOTE: {Counter(y_res)}")
                return X_res, y_res
            except ImportError:
                logger.warning("imblearn not installed, skipping SMOTE")
        elif self.config.oversample_method == 'adasyn':
            try:
                from imblearn.over_sampling import ADASYN
                ada = ADASYN(random_state=self.config.random_state)
                X_res, y_res = ada.fit_resample(X, y)
                logger.info(f"After ADASYN: {Counter(y_res)}")
                return X_res, y_res
            except ImportError:
                logger.warning("imblearn not installed, skipping ADASYN")
        elif self.config.oversample_method == 'random':
            from sklearn.utils import resample
            X_minority = X[y == 1]
            y_minority = y[y == 1]
            X_majority = X[y == 0]
            y_majority = y[y == 0]
            
            X_minority_upsampled, y_minority_upsampled = resample(
                X_minority, y_minority,
                replace=True,
                n_samples=len(X_majority),
                random_state=self.config.random_state
            )
            X_res = np.vstack([X_majority, X_minority_upsampled])
            y_res = np.hstack([y_majority, y_minority_upsampled])
            return X_res, y_res
        
        return X, y
    
    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: List[str],
            X_val: Optional[np.ndarray] = None, y_val: Optional[np.ndarray] = None) -> Dict:
        """Train the model."""
        self.feature_names = feature_names
        
        # Prepare data
        X, y = self._prepare_data(X, y)
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        
        # Prepare validation data
        if X_val is not None and y_val is not None:
            X_val_scaled = self.scaler.transform(X_val)
            eval_set = [(X_val_scaled, y_val)]
        else:
            eval_set = None
        
        # Create model
        self.model = self._create_model()
        
        # Train
        logger.info(f"Training {self.__class__.__name__}...")
        start_time = datetime.utcnow()
        
        if hasattr(self.model, 'fit') and eval_set is not None:
            self.model.fit(X_scaled, y, eval_set=eval_set, verbose=False)
        else:
            self.model.fit(X_scaled, y)
        
        training_time = (datetime.utcnow() - start_time).total_seconds()
        
        # Calibrate probabilities if requested
        if self.config.calibrate_probabilities:
            logger.info("Calibrating probabilities...")
            self.model = CalibratedClassifierCV(
                self.model, method=self.config.calibration_method, cv=3
            )
            self.model.fit(X_scaled, y)
        
        # Feature importance
        self._extract_feature_importance()
        
        # Mark as fitted BEFORE evaluation
        self.is_fitted = True
        
        # Evaluate on training set
        train_metrics = self.evaluate(X_scaled, y)
        
        # Evaluate on validation set
        val_metrics = {}
        if X_val is not None and y_val is not None:
            val_metrics = self.evaluate(self.scaler.transform(X_val), y_val)
        
        # Record training history
        self.training_history = {
            'training_time_seconds': training_time,
            'train_metrics': train_metrics,
            'val_metrics': val_metrics,
            'feature_names': self.feature_names,
            'n_samples': len(y),
            'class_distribution': dict(pd.Series(y).value_counts()),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        self.metadata = {
            'model_type': self.__class__.__name__,
            'feature_count': len(feature_names),
            'training_samples': len(y),
            'positive_class_ratio': float(np.mean(y)),
            'training_time_seconds': training_time
        }
        
        return {**train_metrics, **val_metrics}
    
    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Predict class probabilities."""
        if not self.is_fitted:
            raise ValueError("Model not fitted")
        X_scaled = self.scaler.transform(X)
        return self.model.predict_proba(X_scaled)[:, 1]
    
    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        """Predict class labels."""
        probas = self.predict_proba(X)
        return (probas >= threshold).astype(int)
    
    def predict_with_uncertainty(self, X: np.ndarray, n_bootstrap: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        """
        Predict with uncertainty estimation using bootstrap sampling.
        
        Returns:
            Tuple of (mean_predictions, std_predictions)
        """
        if not self.is_fitted:
            raise ValueError("Model not fitted")
        
        X_scaled = self.scaler.transform(X)
        n_samples = X.shape[0]
        predictions = np.zeros((n_bootstrap, n_samples))
        
        for i in range(n_bootstrap):
            # Bootstrap sample
            indices = np.random.choice(len(self.model.classes_), n_samples, replace=True)
            preds = self.model.predict_proba(self.scaler.transform(X))[:, 1]
            predictions[i] = preds
        
        mean_preds = np.mean(predictions, axis=0)
        std_preds = np.std(predictions, axis=0)
        
        return mean_preds, std_preds
    
    def evaluate(self, X: np.ndarray, y: np.ndarray, threshold: float = 0.5) -> Dict[str, float]:
        """Evaluate model performance."""
        y_pred_proba = self.predict_proba(X)
        y_pred = (y_pred_proba >= threshold).astype(int)
        
        metrics = {
            'roc_auc': roc_auc_score(y, y_pred_proba),
            'pr_auc': average_precision_score(y, y_pred_proba),
            'precision': precision_score(y, y_pred, zero_division=0),
            'recall': recall_score(y, y_pred, zero_division=0),
            'f1': f1_score(y, y_pred, zero_division=0),
            'brier_score': brier_score_loss(y, y_pred),
            'threshold': threshold
        }
        
        # Confusion matrix
        cm = confusion_matrix(y, y_pred)
        metrics['tn'] = int(cm[0, 0])
        metrics['fp'] = int(cm[0, 1])
        metrics['fn'] = int(cm[1, 0])
        metrics['tp'] = int(cm[1, 1])
        
        # Specificity and NPV
        if metrics['tn'] + metrics['fp'] > 0:
            metrics['specificity'] = metrics['tn'] / (metrics['tn'] + metrics['fp'])
        if metrics['tn'] + metrics['fn'] > 0:
            metrics['npv'] = metrics['tn'] / (metrics['tn'] + metrics['fn'])
        
        return metrics
    
    def _extract_feature_importance(self):
        """Extract feature importance from trained model."""
        if self.model is None or not self.feature_names:
            return
        
        try:
            if hasattr(self.model, 'feature_importances_'):
                importances = self.model.feature_importances_
            elif hasattr(self.model, 'coef_'):
                importances = np.abs(self.model.coef_[0])
            elif hasattr(self.model, 'calibrated_classifiers_'):
                # For calibrated classifiers - get the base estimator from the first calibrated classifier
                calibrated_clf = self.model.calibrated_classifiers_[0]
                # Try different attribute names for the base estimator
                base_estimator = None
                if hasattr(calibrated_clf, 'estimator'):
                    base_estimator = calibrated_clf.estimator
                elif hasattr(calibrated_clf, 'base_estimator'):
                    base_estimator = calibrated_clf.base_estimator
                
                if base_estimator is not None:
                    if hasattr(base_estimator, 'feature_importances_'):
                        importances = base_estimator.feature_importances_
                    elif hasattr(base_estimator, 'coef_'):
                        importances = np.abs(base_estimator.coef_[0])
                    else:
                        return
                else:
                    return
            else:
                return
            
            # Normalize
            importances = importances / importances.sum()
            
            self.feature_importance = dict(
                sorted(zip(self.feature_names, importances), key=lambda x: x[1], reverse=True)
            )
        except Exception as e:
            logger.warning(f"Could not extract feature importance: {e}")
    
    def get_feature_importance(self, top_k: Optional[int] = None) -> Dict[str, float]:
        """Get feature importance rankings."""
        if self.feature_importance is None:
            return {}
        
        if top_k:
            return dict(list(self.feature_importance.items())[:top_k])
        return self.feature_importance
    
    def get_shap_values(self, X: np.ndarray) -> Optional[np.ndarray]:
        """Compute SHAP values for explanations (if shap is available)."""
        try:
            import shap
            X_scaled = self.scaler.transform(X)
            explainer = shap.TreeExplainer(self.model)
            shap_values = explainer.shap_values(self.scaler.transform(X))
            return shap_values
        except ImportError:
            logger.warning("SHAP not installed")
            return None
        except Exception as e:
            logger.warning(f"Could not compute SHAP values: {e}")
            return None
    
    def save(self, path: Optional[str] = None) -> str:
        """Save model to disk."""
        if not self.is_fitted:
            raise ValueError("Model not fitted")
        
        if path is None:
            path = Path(self.config.save_dir) / f"{self.config.model_name}_{self.__class__.__name__}.pkl"
        else:
            path = Path(path)
        
        path.parent.mkdir(parents=True, exist_ok=True)
        
        save_dict = {
            'model': self.model,
            'scaler': self.scaler,
            'label_encoder': self.label_encoder,
            'feature_names': self.feature_names,
            'feature_importance': self.feature_importance,
            'training_history': self.training_history,
            'metadata': self.metadata,
            'config': self.config
        }
        
        joblib.dump(save_dict, path)
        logger.info(f"Model saved to {path}")
        return str(path)
    
    @classmethod
    def load(cls, path: str, config: Optional[ModelConfig] = None) -> 'BaseFloodModel':
        """Load model from disk."""
        loaded = joblib.load(path)
        
        instance = cls(config or ModelConfig())
        instance.model = loaded['model']
        instance.scaler = loaded['scaler']
        instance.label_encoder = loaded['label_encoder']
        instance.feature_names = loaded['feature_names']
        instance.feature_importance = loaded.get('feature_importance')
        instance.training_history = loaded.get('training_history', {})
        instance.metadata = loaded.get('metadata', {})
        instance.is_fitted = True
        
        logger.info(f"Model loaded from {path}")
        return instance


class LogisticRegressionModel(BaseFloodModel):
    """Logistic Regression baseline model."""
    
    def _create_model(self):
        return LogisticRegression(**self.config.lr_params)


class RandomForestModel(BaseFloodModel):
    """Random Forest model."""
    
    def _create_model(self):
        return RandomForestClassifier(**self.config.rf_params)


class XGBoostModel(BaseFloodModel):
    """XGBoost model for flood prediction."""
    
    def _create_model(self):
        # Calculate scale_pos_weight for class imbalance
        if hasattr(self, '_class_ratio'):
            self.config.xgb_params['scale_pos_weight'] = self._class_ratio
        
        return xgb.XGBClassifier(**self.config.xgb_params)
    
    def _prepare_data(self, X: np.ndarray, y: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        # Calculate class ratio for scale_pos_weight
        pos_count = np.sum(y == 1)
        neg_count = np.sum(y == 0)
        if pos_count > 0:
            self._class_ratio = neg_count / pos_count
        return super()._prepare_data(X, y)


class FloodRiskPredictor:
    """High-level flood risk prediction interface."""
    
    def __init__(self, config: Optional[ModelConfig] = None):
        self.config = config or ModelConfig()
        self.models: Dict[str, BaseFloodModel] = {}
        self.ensemble_weights: Optional[Dict[str, float]] = None
        self.is_fitted = False
        self.feature_engineer = None
        
    def add_model(self, name: str, model: BaseFloodModel):
        """Add a model to the ensemble."""
        self.models[name] = model
    
    def create_default_models(self):
        """Create default ensemble of models."""
        self.models = {
            'logistic': LogisticRegressionModel(self.config),
            'random_forest': RandomForestModel(self.config),
            'xgboost': XGBoostModel(self.config)
        }
    
    def fit(self, X: np.ndarray, y: np.ndarray, feature_names: List[str],
            X_val: Optional[np.ndarray] = None, y_val: Optional[np.ndarray] = None,
            sample_weight: Optional[np.ndarray] = None) -> Dict[str, Dict]:
        """Train all models."""
        results = {}
        
        for name, model in self.models.items():
            logger.info(f"Training {name}...")
            try:
                metrics = model.fit(X, y, feature_names=list(range(X.shape[1])))
                results[name] = metrics
                logger.info(f"{name} training completed: AUC={model.training_history.get('train_metrics', {}).get('roc_auc', 'N/A')}")
            except Exception as e:
                logger.error(f"Failed to train {name}: {e}")
                results[name] = {'error': str(e)}
        
        self.is_fitted = True
        self._compute_ensemble_weights()
        
        return results
    
    def _compute_ensemble_weights(self):
        """Compute ensemble weights based on validation performance."""
        if not self.models:
            return
        
        # Use validation AUC as weights
        weights = {}
        total_auc = 0
        for name, model in self.models.items():
            if model.is_fitted and 'val_metrics' in model.training_history:
                auc = model.training_history['val_metrics'].get('roc_auc', 0)
                weights[name] = max(auc, 0.01)  # Minimum weight
                total_auc += weights[name]
            else:
                weights[name] = 0.01
                total_auc += 0.01
        
        # Normalize
        if total_auc > 0:
            self.ensemble_weights = {k: v / total_auc for k, v in weights.items()}
        else:
            self.ensemble_weights = {k: 1.0 / len(self.models) for k in self.models}
        
        logger.info(f"Ensemble weights: {self.ensemble_weights}")
    
    def predict_proba(self, X: np.ndarray, use_ensemble: bool = True) -> np.ndarray:
        """Predict flood risk probabilities."""
        if not self.is_fitted:
            raise ValueError("Models not fitted")
        
        if use_ensemble and self.ensemble_weights:
            # Weighted ensemble
            predictions = np.zeros(X.shape[0])
            total_weight = 0
            
            for name, model in self.models.items():
                if model.is_fitted:
                    weight = self.ensemble_weights.get(name, 0)
                    preds = model.predict_proba(X)
                    predictions += weight * preds
                    total_weight += weight
            
            if total_weight > 0:
                return predictions / total_weight
            else:
                # Fallback to first model
                return list(self.models.values())[0].predict_proba(X)
        else:
            # Use best single model (XGBoost)
            best_model = self.models.get('xgboost') or list(self.models.values())[0]
            return best_model.predict_proba(X)
    
    def predict(self, X: np.ndarray, threshold: float = 0.5,
                use_ensemble: bool = True) -> np.ndarray:
        """Predict class labels."""
        probas = self.predict_proba(X, use_ensemble)
        return (probas >= threshold).astype(int)
    
    def predict_with_uncertainty(self, X: np.ndarray,
                                  n_bootstrap: int = 100) -> Tuple[np.ndarray, np.ndarray]:
        """Predict with uncertainty quantification."""
        # Use ensemble variance as uncertainty
        all_preds = []
        
        for name, model in self.models.items():
            if model.is_fitted:
                preds = model.predict_proba(X)
                all_preds.append(preds)
        
        if not all_preds:
            return np.zeros(X.shape[0]), np.ones(X.shape[0])
        
        pred_array = np.array(all_preds)
        mean_preds = np.mean(pred_array, axis=0)
        std_preds = np.std(pred_array, axis=0)
        
        return mean_preds, std_preds
    
    def evaluate_all(self, X: np.ndarray, y: np.ndarray,
                     thresholds: List[float] = None) -> Dict[str, Dict]:
        """Evaluate all models."""
        if thresholds is None:
            thresholds = [0.3, 0.4, 0.5, 0.6, 0.7]
        
        results = {}
        
        for name, model in self.models.items():
            if not model.is_fitted:
                continue
            
            model_results = {}
            for threshold in thresholds:
                metrics = model.evaluate(X, y, threshold)
                model_results[f'threshold_{threshold}'] = metrics
            
            # Default threshold
            model_results['default'] = model.evaluate(X, y, 0.5)
            results[name] = model_results
        
        # Ensemble
        if self.ensemble_weights:
            ensemble_results = {}
            for threshold in thresholds:
                ensemble_probs = self.predict_proba(X, use_ensemble=True)
                ensemble_preds = (ensemble_probs >= threshold).astype(int)
                
                ensemble_metrics = {
                    'precision': precision_score(y, ensemble_preds, zero_division=0),
                    'recall': recall_score(y, ensemble_preds, zero_division=0),
                    'f1': f1_score(y, ensemble_preds, zero_division=0),
                    'roc_auc': roc_auc_score(y, self.predict_proba(X, use_ensemble=True)),
                    'threshold': threshold
                }
                ensemble_results[f'threshold_{threshold}'] = ensemble_metrics
            
            results['ensemble'] = ensemble_results
        
        return results
    
    def predict_with_explanation(self, X: np.ndarray,
                                  feature_names: List[str],
                                  top_k: int = 5) -> List[Dict]:
        """
        Predict with feature-level explanations.
        
        Returns:
            List of dicts with prediction and top contributing features
        """
        probas = self.predict_proba(X)
        preds = (probas >= 0.5).astype(int)
        
        explanations = []
        
        for i in range(X.shape[0]):
            # Get feature importance for this sample (using SHAP if available)
            try:
                import shap
                # Use first model with SHAP support
                for model in self.models.values():
                    if model.is_fitted:
                        try:
                            explainer = shap.TreeExplainer(model.model)
                            shap_values = explainer.shap_values(X[i:i+1])
                            if isinstance(shap_values, list):
                                shap_vals = shap_values[1][0]  # Positive class
                            else:
                                shap_vals = shap_values[0]
                            
                            # Get top features
                            feature_importance = np.abs(shap_vals[0])
                            top_indices = np.argsort(feature_importance)[-5:][::-1]
                            
                            contributing_features = [
                                {'feature': model.feature_names[idx] if idx < len(model.feature_names) else f'feature_{idx}',
                                 'value': float(X[i, idx]),
                                 'shap_value': float(shap_vals[0][idx]),
                                 'impact': 'increases' if shap_vals[0][idx] > 0 else 'decreases'}
                                for idx in top_indices
                            ]
                            break
                        except Exception:
                            continue
            except Exception:
                pass
            
            # Fallback: use feature importance
            if 'contributing_features' not in locals():
                best_model = self.models.get('xgboost') or list(self.models.values())[0]
                if best_model.feature_importance:
                    sorted_features = sorted(
                        best_model.feature_importance.items(),
                        key=lambda x: x[1], reverse=True
                    )[:5]
                    
                    contributing_features = [
                        {'feature': feat, 'importance': imp, 'impact': 'increases'}
                        for feat, imp in sorted_features
                    ]
                else:
                    contributing_features = []
            
            explanations.append({
                'probability': float(probas[i]),
                'prediction': 'HIGH' if preds[i] >= 0.5 else 'LOW',
                'risk_level': self._get_risk_level(probas[i]),
                'contributing_features': contributing_features,
                'uncertainty': 'moderate'  # Placeholder
            })
        
        return explanations
    
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
    
    def save_all(self, save_dir: str) -> Dict[str, str]:
        """Save all models."""
        save_dir = Path(save_dir)
        save_dir.mkdir(parents=True, exist_ok=True)
        
        saved_paths = {}
        for name, model in self.models.items():
            if model.is_fitted:
                path = save_dir / f"{name}.pkl"
                saved_path = model.save(save_dir / f"{name}.pkl")
                saved_paths[name] = saved_path
        
        # Save ensemble config
        ensemble_config = {
            'ensemble_weights': self.ensemble_weights,
            'model_names': list(self.models.keys()),
            'config': self.config.__dict__
        }
        with open(save_dir / 'ensemble_config.pkl', 'wb') as f:
            joblib.dump(ensemble_config, f)
        
        return saved_paths
    
    @classmethod
    def load_all(cls, save_dir: str, config: Optional[ModelConfig] = None) -> 'FloodRiskPredictor':
        """Load all models from directory."""
        save_dir = Path(save_dir)
        
        # Load ensemble config
        with open(save_dir / 'ensemble_config.pkl', 'rb') as f:
            ensemble_config = joblib.load(f)
        
        predictor = cls(config or ModelConfig())
        predictor.ensemble_weights = ensemble_config['ensemble_weights']
        
        for name in ensemble_config['model_names']:
            model_path = save_dir / f"{name}.pkl"
            if model_path.exists():
                if name == 'logistic':
                    model = LogisticRegressionModel.load(model_path)
                elif name == 'random_forest':
                    model = RandomForestModel.load(model_path)
                elif name == 'xgboost':
                    model = XGBoostModel.load(model_path)
                else:
                    continue
                predictor.models[name] = model
        
        predictor.is_fitted = True
        predictor._compute_ensemble_weights()
        
        logger.info(f"Loaded ensemble from {save_dir}")
        return predictor


# Training pipeline
class FloodModelTrainer:
    """Orchestrate the complete training pipeline."""
    
    def __init__(self, config: Optional[ModelConfig] = None):
        self.config = config or ModelConfig()
        self.predictor = FloodRiskPredictor(self.config)
        self.feature_engineer = None
        self.training_data: Optional[Tuple[np.ndarray, np.ndarray]] = None
        self.validation_data: Optional[Tuple[np.ndarray, np.ndarray]] = None
        self.test_data: Optional[Tuple[np.ndarray, np.ndarray]] = None
        self.feature_names: List[str] = []
    
    def prepare_data(self, 
                     rainfall_data: pd.DataFrame,
                     weather_data: pd.DataFrame,
                     terrain_data: Dict,
                     flood_events: pd.DataFrame,
                     soil_data: Optional[Dict] = None,
                     landcover_data: Optional[Dict] = None,
                     historical_floods: Optional[pd.DataFrame] = None,
                     negative_sampling_ratio: float = 5.0) -> Tuple[np.ndarray, np.ndarray]:
        """
        Prepare training data from raw sources.
        
        Creates positive samples from historical flood events and 
        negative samples from non-flood locations/times.
        """
        from app.ml.features.engineering import create_feature_vector
        
        logger.info("Preparing training data...")
        
        # Get positive samples from historical flood events
        positive_samples = []
        labels = []
        
        for _, event in flood_events.iterrows():
            if pd.isna(event.get('latitude')) or pd.isna(event.get('longitude')):
                continue
            
            location = (event['latitude'], event['longitude'])
            timestamp = event['start_date'] if 'start_date' in event else datetime.utcnow()
            
            # Create feature vector for this flood event
            # This would use the actual feature engineering pipeline
            # For now, create placeholder
            pass
        
        # Generate negative samples (non-flood locations/times)
        # This is a simplified version - real implementation would be more sophisticated
        n_positive = len(flood_events)
        n_negative = int(n_positive * self.config.negative_sampling_ratio if hasattr(self.config, 'negative_sampling_ratio') else n_positive * 5)
        
        logger.info(f"Preparing {len(positive_samples)} positive and {n_negative} negative samples")
        
        # In real implementation, this would:
        # 1. Query all data sources for each positive/negative sample
        # 2. Run feature engineering pipeline
        # 3. Return feature matrix and labels
        
        # Placeholder for now
        n_samples = 1000
        n_features = 50
        X = np.random.randn(n_samples, 50)
        y = np.random.binomial(1, 0.1, n_samples)
        
        self.feature_names = [f'feature_{i}' for i in range(50)]
        
        return X, y
    
    def split_data(self, X: np.ndarray, y: np.ndarray,
                   test_size: float = 0.2, val_size: float = 0.1) -> Tuple:
        """Split data into train/val/test with temporal/spatial awareness."""
        # For now, use simple random split
        # In production, would use spatial/temporal splits
        X_temp, X_test, y_temp, y_test = train_test_split(
            X, y, test_size=test_size, random_state=42, stratify=y
        )
        
        val_size_adjusted = val_size / (1 - test_size)
        X_train, X_val, y_train, y_val = train_test_split(
            X_temp, y_temp, test_size=val_size_adjusted, 
            random_state=42, stratify=y_temp
        )
        
        logger.info(f"Train: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
        
        return X_train, X_val, X_test, y_train, y_val, y_test
    
    def train(self, 
              X_train: np.ndarray, y_train: np.ndarray,
              X_val: np.ndarray, y_val: np.ndarray,
              feature_names: List[str]) -> Dict:
        """Train all models."""
        self.feature_names = feature_names
        self.predictor.create_default_models()
        
        results = self.predictor.fit(
            X_train, y_train, 
            feature_names=list(range(X_train.shape[1])),
            X_val=X_val, y_val=y_val
        )
        
        self.training_results = self.predictor.training_results
        return self.training_results
    
    def evaluate(self, X_test: np.ndarray, y_test: np.ndarray) -> Dict:
        """Evaluate on test set."""
        return self.predictor.evaluate_all(X_test, y_test)
    
    def save_all(self, save_dir: str) -> Dict[str, str]:
        """Save all models and artifacts."""
        save_dir = Path(save_dir)
        save_dir.mkdir(parents=True, exist_ok=True)
        
        # Save predictor
        saved = self.predictor.save_all(save_dir)
        
        # Save feature names
        with open(save_dir / 'feature_names.pkl', 'wb') as f:
            joblib.dump(self.feature_names, f)
        
        # Save training config
        config_dict = {
            'config': self.config.__dict__,
            'feature_names': self.feature_names,
            'training_results': self.training_results
        }
        joblib.dump(config_dict, Path(save_dir) / 'training_config.pkl')
        
        logger.info(f"All models saved to {save_dir}")
        return {'model_dir': str(save_dir)}
    
    @classmethod
    def load(cls, save_dir: str) -> 'FloodModelTrainer':
        """Load trained pipeline."""
        save_dir = Path(save_dir)
        
        # Load config
        with open(save_dir / 'training_config.pkl', 'rb') as f:
            config_dict = joblib.load(f)
        
        config = ModelConfig(**config_dict.get('config', {}))
        trainer = cls(config)
        trainer.feature_names = config_dict.get('feature_names', [])
        trainer.training_results = config_dict.get('training_results', {})
        
        # Load models
        trainer.predictor = FloodRiskPredictor.load_all(save_dir)
        
        return trainer


def train_flood_model(
    data_dir: str,
    save_dir: str,
    config: Optional[ModelConfig] = None
) -> Dict:
    """
    Main training entry point.
    
    Args:
        data_dir: Directory with training data
        save_dir: Directory to save models
        config: Model configuration
        
    Returns:
        Dictionary with training results and model paths
    """
    trainer = FloodModelTrainer(config)
    
    # Load data from data_dir
    # This would load actual data files
    logger.info(f"Loading data from {data_dir}")
    
    # For now, create synthetic data for demonstration
    X = np.random.randn(1000, 50)
    y = np.random.binomial(1, 0.15, 1000)
    feature_names = [f'feature_{i}' for i in range(50)]
    
    # Split
    X_train, X_val, X_test, y_train, y_val, y_test = FloodModelTrainer(config).split_data(
        np.random.randn(1000, 50), np.random.binomial(1, 0.15, 1000)
    )
    
    # Train
    trainer = FloodModelTrainer(ModelConfig())
    trainer.train(X_train, y_train, X_val, y_val, [f'f{i}' for i in range(50)])
    
    # Evaluate
    results = trainer.evaluate(X_test, y_test)
    
    # Save
    trainer.save_all(save_dir)
    
    return {
        'results': trainer.training_results,
        'test_metrics': results,
        'model_dir': save_dir
    }


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(level=logging.INFO)
    
    config = ModelConfig(
        models_to_train=['logistic', 'random_forest', 'xgboost'],
        xgb_params={
            'max_depth': 6,
            'learning_rate': 0.1,
            'n_estimators': 200,
        }
    )
    
    # Quick test
    config = ModelConfig()
    model = XGBoostModel(config)
    
    # Dummy data
    X = np.random.randn(100, 20)
    y = np.random.binomial(1, 0.3, 100)
    
    model.fit(X, y, feature_names=[f'f{i}' for i in range(20)])
    
    preds = model.predict_proba(X[:5])
    print(f"Predictions: {preds}")
    print(f"Feature importance: {model.get_feature_importance(top_k=5)}")