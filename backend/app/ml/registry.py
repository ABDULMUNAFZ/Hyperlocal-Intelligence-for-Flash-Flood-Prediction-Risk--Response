# FloodGuard Model Registry
"""Model registry and versioning for flood prediction models."""

import os
import json
import hashlib
import joblib
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class ModelStage(str, Enum):
    """Model lifecycle stages."""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    ARCHIVED = "archived"


class ModelType(str, Enum):
    """Types of models in the registry."""
    LOGISTIC = "logistic_regression"
    RANDOM_FOREST = "random_forest"
    XGBOOST = "xgboost"
    LIGHTGBM = "lightgbm"
    ENSEMBLE = "ensemble"
    CUSTOM = "custom"


@dataclass
class ModelMetadata:
    """Metadata for a registered model."""
    model_id: str
    name: str
    model_type: ModelType
    version: str
    stage: ModelStage
    
    # Training info
    training_date: str
    training_dataset_hash: str
    training_samples: int
    positive_samples: int
    negative_samples: int
    
    # Feature info
    feature_names: List[str]
    feature_count: int
    feature_hash: str
    
    # Performance
    metrics: Dict[str, float]
    validation_strategy: str
    
    # Model info
    model_type: str
    hyperparameters: Dict[str, Any]
    feature_names: List[str]
    feature_importance: Dict[str, float]
    
    # File info
    model_path: str
    model_hash: str
    model_size_bytes: int
    
    # Lineage
    parent_model_id: Optional[str] = None
    training_data_hash: Optional[str] = None
    
    # Metadata
    description: str = ""
    tags: List[str] = field(default_factory=list)
    created_by: str = "system"
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    # Stage transitions
    stage_history: List[Dict[str, str]] = field(default_factory=list)


class ModelRegistry:
    """Registry for managing model versions and lifecycle."""
    
    def __init__(self, registry_dir: str = "models/registry"):
        self.registry_dir = Path(registry_dir)
        self.registry_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.registry_dir / "index.json"
        self._index: Dict[str, ModelMetadata] = {}
        self._load_index()
    
    def _load_index(self):
        """Load registry index from disk."""
        if self.index_file.exists():
            try:
                with open(self.index_file, 'r') as f:
                    data = json.load(f)
                    self._index = {
                        k: ModelMetadata(**v) for k, v in data.items()
                    }
            except Exception as e:
                logger.warning(f"Failed to load registry index: {e}")
                self._index = {}
        else:
            self._index = {}
    
    def _save_index(self):
        """Save registry index to disk."""
        try:
            data = {k: asdict(v) for k, v in self._index.items()}
            with open(self.index_file, 'w') as f:
                json.dump(data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to save registry index: {e}")
    
    def _compute_file_hash(self, file_path: Path) -> str:
        """Compute SHA256 hash of file."""
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()
    
    def _compute_data_hash(self, data: Any) -> str:
        """Compute hash of data for lineage tracking."""
        if hasattr(data, '__dict__'):
            data = data.__dict__
        return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()[:16]
    
    def register_model(
        self,
        model_path: Path,
        metadata: ModelMetadata,
        stage: ModelStage = ModelStage.DEVELOPMENT
    ) -> str:
        """Register a new model version."""
        # Validate model file exists
        if not model_path.exists():
            raise FileNotFoundError(f"Model file not found: {model_path}")
        
        # Compute hashes
        model_hash = self._compute_file_hash(model_path)
        metadata.model_hash = model_hash
        metadata.model_path = str(model_path)
        metadata.model_size_bytes = model_path.stat().st_size
        metadata.stage = stage
        
        # Generate model ID if not provided
        if not metadata.model_id:
            metadata.model_id = f"{metadata.name}_v{metadata.version}_{uuid.uuid4().hex[:8]}"
        
        # Add stage transition to history
        metadata.stage_history.append({
            "stage": stage.value,
            "timestamp": datetime.utcnow().isoformat(),
            "by": "system"
        })
        
        # Register
        self._index[metadata.model_id] = metadata
        self._save_index()
        
        logger.info(f"Registered model: {metadata.model_id} v{metadata.version} ({stage.value})")
        return metadata.model_id
    
    def get_model(self, model_id: str) -> Optional[ModelMetadata]:
        """Get model metadata by ID."""
        return self._index.get(model_id)
    
    def get_latest_version(self, name: str, stage: Optional[ModelStage] = None) -> Optional[ModelMetadata]:
        """Get latest version of a model."""
        candidates = [
            m for m in self._index.values()
            if m.name == name and (stage is None or (m.stage.value if hasattr(m.stage, 'value') else m.stage) == (stage.value if hasattr(stage, 'value') else stage))
        ]
        
        if not candidates:
            return None
        
        # Sort by version (semantic versioning)
        def version_key(m: ModelMetadata):
            parts = m.version.split('.')
            return tuple(int(p) for p in parts)
        
        return max(candidates, key=version_key)
    
    def get_all_versions(self, name: str) -> List[ModelMetadata]:
        """Get all versions of a model."""
        return [
            m for m in self._index.values()
            if m.name == name
        ]
    
    def get_models_by_stage(self, stage: ModelStage) -> List[ModelMetadata]:
        """Get all models in a specific stage."""
        stage_value = stage.value if hasattr(stage, 'value') else stage
        return [
            m for m in self._index.values()
            if (m.stage.value if hasattr(m.stage, 'value') else m.stage) == stage_value
        ]
    
    def get_production_model(self, name: str) -> Optional[ModelMetadata]:
        """Get current production model."""
        return self.get_latest_version(name, ModelStage.PRODUCTION)
    
    def promote_model(self, model_id: str, target_stage: ModelStage, by: str = "system") -> bool:
        """Promote model to a new stage."""
        if model_id not in self._index:
            raise ValueError(f"Model not found: {model_id}")
        
        metadata = self._index[model_id]
        
        # Validate stage transition
        valid_transitions = {
            ModelStage.DEVELOPMENT: [ModelStage.STAGING, ModelStage.ARCHIVED],
            ModelStage.STAGING: [ModelStage.PRODUCTION, ModelStage.DEVELOPMENT, ModelStage.ARCHIVED],
            ModelStage.PRODUCTION: [ModelStage.ARCHIVED],
            ModelStage.ARCHIVED: [ModelStage.DEVELOPMENT]
        }
        
        if target_stage not in valid_transitions.get(metadata.stage, []):
            raise ValueError(
                f"Invalid stage transition: {metadata.stage.value} -> {target_stage.value}"
            )
        
        # Archive current production model if promoting to production
        if target_stage == ModelStage.PRODUCTION:
            current_prod = self.get_production_model(self._index[model_id].name)
            if current_prod and current_prod.model_id != model_id:
                self.promote_model(current_prod.model_id, ModelStage.ARCHIVED, "auto-promotion")
        
        # Update stage
        old_stage = metadata.stage
        if isinstance(old_stage, str):
            old_stage_enum = ModelStage(old_stage)
        else:
            old_stage_enum = old_stage
        metadata.stage = target_stage
        metadata.stage_history.append({
            "from": old_stage_enum.value,
            "to": target_stage.value,
            "timestamp": datetime.utcnow().isoformat(),
            "by": by
        })
        metadata.updated_at = datetime.utcnow().isoformat()
        
        self._save_index()
        logger.info(f"Promoted {model_id} from {old_stage_enum.value} to {target_stage.value}")
        return True
    
    def archive_model(self, model_id: str, by: str = "system") -> bool:
        """Archive a model."""
        return self.promote_model(model_id, ModelStage.ARCHIVED, by)
    
    def delete_model(self, model_id: str, force: bool = False) -> bool:
        """Delete a model from registry."""
        if model_id not in self._index:
            raise ValueError(f"Model not found: {model_id}")
        
        metadata = self._index[model_id]
        
        if isinstance(metadata.stage, str) and metadata.stage == ModelStage.PRODUCTION.value or metadata.stage == ModelStage.PRODUCTION:
            raise ValueError("Cannot delete production model without force=True")
        
        # Remove model file if it exists
        model_path = Path(metadata.model_path)
        if model_path.exists():
            model_path.unlink()
        
        # Remove from index
        del self._index[model_id]
        self._save_index()
        
        logger.info(f"Deleted model: {model_id}")
        return True
    
    def list_models(
        self,
        name: Optional[str] = None,
        stage: Optional[ModelStage] = None,
        model_type: Optional[str] = None,
        tags: Optional[List[str]] = None
    ) -> List[ModelMetadata]:
        """List models with filters."""
        results = list(self._index.values())
        
        if name:
            results = [m for m in results if m.name == name]
        if stage:
            results = [m for m in results if m.stage == stage]
        if model_type:
            results = [m for m in results if m.model_type == model_type]
        if tags:
            results = [m for m in results if all(t in m.tags for t in tags)]
        
        return sorted(results, key=lambda m: m.created_at, reverse=True)
    
    def search_models(self, query: str) -> List[ModelMetadata]:
        """Search models by text query."""
        query = query.lower()
        results = []
        
        for m in self._index.values():
            if (query in m.name.lower() or
                query in m.description.lower() or
                query in m.model_id.lower() or
                any(query in tag.lower() for tag in m.tags) or
                any(query in fn.lower() for fn in m.feature_names)):
                results.append(m)
        
        return sorted(results, key=lambda m: m.created_at, reverse=True)
    
    def get_lineage(self, model_id: str) -> Dict[str, Any]:
        """Get model lineage information."""
        if model_id not in self._index:
            raise ValueError(f"Model not found: {model_id}")
        
        metadata = self._index[model_id]
        
        lineage = {
            "model_id": model_id,
            "name": metadata.name,
            "version": metadata.version,
            "stage": metadata.stage.value,
            "parent_model_id": metadata.parent_model_id,
            "children": [],
            "ancestors": [],
            "descendants": []
        }
        
        # Find ancestors
        current = metadata
        while current.parent_model_id:
            parent = self._index.get(current.parent_model_id)
            if parent:
                lineage["ancestors"].append({
                    "model_id": parent.model_id,
                    "name": parent.name,
                    "version": parent.version
                })
                current = parent
            else:
                break
        
        # Find descendants
        def find_descendants(mid: str, level: int = 0):
            children = [
                m for m in self._index.values()
                if m.parent_model_id == mid
            ]
            for child in children:
                lineage["descendants"].append({
                    "model_id": child.model_id,
                    "name": child.name,
                    "version": child.version,
                    "level": level + 1
                })
                find_descendants(child.model_id, level + 1)
        
        find_descendants(model_id)
        
        return lineage
    
    def compare_models(self, model_id_1: str, model_id_2: str) -> Dict[str, Any]:
        """Compare two model versions."""
        m1 = self.get_model(model_id_1)
        m2 = self.get_model(model_id_2)
        
        if not m1 or not m2:
            raise ValueError("One or both models not found")
        
        comparison = {
            "model_1": {
                "model_id": m1.model_id,
                "name": m1.name,
                "version": m1.version,
                "stage": m1.stage.value,
                "metrics": m1.metrics,
                "feature_count": m1.feature_count,
                "training_date": m1.training_date,
                "hyperparameters": m1.hyperparameters
            },
            "model_2": {
                "model_id": m2.model_id,
                "name": m2.name,
                "version": m2.version,
                "stage": m2.stage.value,
                "metrics": m2.metrics,
                "feature_count": m2.feature_count,
                "training_date": m2.training_date,
                "hyperparameters": m2.hyperparameters
            },
            "differences": {}
        }
        
        # Compare metrics
        all_metrics = set(m1.metrics.keys()) | set(m2.metrics.keys())
        for metric in all_metrics:
            v1 = m1.metrics.get(metric)
            v2 = m2.metrics.get(metric)
            if v1 is not None and v2 is not None:
                diff = v2 - v1
                pct_change = (diff / v1 * 100) if v1 != 0 else float('inf')
                comparison["differences"][metric] = {
                    "model_1": v1,
                    "model_2": v2,
                    "difference": diff,
                    "pct_change": pct_change
                }
        
        return comparison
    
    def export_model_card(self, model_id: str, output_path: Path) -> Path:
        """Export model card as markdown."""
        metadata = self.get_model(model_id)
        if not metadata:
            raise ValueError(f"Model not found: {model_id}")
        
        card = f"""# Model Card: {metadata.name} v{metadata.version}

## Model Details
- **Model ID**: {metadata.model_id}
- **Name**: {metadata.name}
- **Version**: {metadata.version}
- **Type**: {metadata.model_type}
- **Stage**: {metadata.stage.value}
- **Training Date**: {metadata.training_date}
- **Created By**: {metadata.created_by}
- **Created At**: {metadata.created_at}

## Training Data
- **Training Samples**: {metadata.training_samples:,}
- **Positive Samples**: {metadata.positive_samples:,}
- **Negative Samples**: {metadata.negative_samples:,}
- **Dataset Hash**: {metadata.training_dataset_hash}
- **Training Data Hash**: {metadata.training_data_hash}

## Features
- **Feature Count**: {metadata.feature_count}
- **Feature Hash**: {metadata.feature_hash}
- **Features**: {', '.join(metadata.feature_names[:20])}{'...' if len(metadata.feature_names) > 20 else ''}

## Performance Metrics
"""
        for metric, value in metadata.metrics.items():
            card += f"- **{metric}**: {value:.4f}\n"
        
        card += f"""
## Hyperparameters
"""
        for param, value in metadata.hyperparameters.items():
            card += f"- **{param}**: {value}\n"
        
        card += f"""
## Feature Importance (Top 10)
"""
        for feat, imp in list(metadata.feature_importance.items())[:10]:
            card += f"- **{feat}**: {imp:.4f}\n"
        
        card += f"""
## Model File
- **Path**: {metadata.model_path}
- **Hash**: {metadata.model_hash}
- **Size**: {metadata.model_size_bytes:,} bytes

## Lineage
- **Parent Model**: {metadata.parent_model_id or 'None'}
- **Training Data Hash**: {metadata.training_data_hash or 'None'}

## Tags
{', '.join(metadata.tags) or 'None'}

## Notes
{metadata.description or 'No description provided.'}
"""
        
        with open(output_path, 'w') as f:
            f.write(card)
        
        logger.info(f"Model card exported to {output_path}")
        return output_path
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get registry statistics."""
        models = list(self._index.values())
        
        stats = {
            "total_models": len(models),
            "by_stage": {},
            "by_type": {},
            "total_size_bytes": 0,
            "total_training_samples": 0
        }
        
        for m in models:
            stats["by_stage"][m.stage.value] = stats["by_stage"].get(m.stage.value, 0) + 1
            stats["by_type"][m.model_type] = stats["by_type"].get(m.model_type, 0) + 1
            stats["total_size_bytes"] += m.model_size_bytes
            stats["total_training_samples"] += m.training_samples
        
        return stats
    
    def cleanup_old_versions(self, name: str, keep_latest: int = 3, keep_stages: List[ModelStage] = None) -> int:
        """Clean up old model versions."""
        if keep_stages is None:
            keep_stages = [ModelStage.PRODUCTION, ModelStage.STAGING]
        
        versions = self.get_all_versions(name)
        versions.sort(key=lambda m: m.created_at, reverse=True)
        
        to_keep = set()
        for m in versions:
            if m.stage in keep_stages:
                to_keep.add(m.model_id)
            elif len([v for v in versions if v.model_id in to_keep and v.created_at > m.created_at]) < keep_latest:
                to_keep.add(m.model_id)
        
        deleted = 0
        for m in versions:
            if m.model_id not in to_keep:
                self.delete_model(m.model_id, force=True)
                deleted += 1
        
        logger.info(f"Cleaned up {deleted} old versions of {name}")
        return deleted


# Global registry instance
_registry: Optional[ModelRegistry] = None


def get_model_registry(registry_dir: str = "models/registry") -> ModelRegistry:
    """Get or create global model registry."""
    global _registry
    if _registry is None:
        _registry = ModelRegistry(registry_dir)
    return _registry


def create_model_metadata(
    name: str,
    version: str,
    model_type: ModelType,
    training_date: str,
    training_samples: int,
    positive_samples: int,
    negative_samples: int,
    feature_names: List[str],
    metrics: Dict[str, float],
    hyperparameters: Dict[str, Any],
    feature_importance: Dict[str, float],
    feature_hash: str,
    training_dataset_hash: str,
    model_path: Path,
    description: str = "",
    tags: List[str] = None,
    parent_model_id: str = None,
    training_data_hash: str = None,
    created_by: str = "system"
) -> ModelMetadata:
    """Create model metadata with computed hashes."""
    
    # Compute feature hash
    feature_str = ','.join(sorted(feature_names))
    feature_hash = hashlib.sha256(feature_str.encode()).hexdigest()[:16]
    
    # Training dataset hash already provided
    training_dataset_hash = training_dataset_hash
    
    # Model file hash
    model_hash = hashlib.sha256()
    with open(model_path, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            model_hash.update(chunk)
    model_hash = model_hash.hexdigest()
    
    metadata = ModelMetadata(
        model_id=f"{name}_v{version}_{uuid.uuid4().hex[:8]}",
        name=name,
        model_type=model_type,
        version=version,
        stage=ModelStage.DEVELOPMENT,
        training_date=training_date,
        training_dataset_hash=training_dataset_hash,
        training_samples=training_samples,
        positive_samples=positive_samples,
        negative_samples=negative_samples,
        feature_names=feature_names,
        feature_count=len(feature_names),
        feature_hash=feature_hash,
        metrics=metrics,
        validation_strategy="temporal_spatial_holdout",
        hyperparameters=hyperparameters,
        feature_importance=feature_importance,
        model_path=str(model_path),
        model_hash=model_hash,
        model_size_bytes=model_path.stat().st_size,
        parent_model_id=parent_model_id,
        training_data_hash=training_data_hash,
        description=description,
        tags=tags or [],
        created_by=created_by,
        created_at=datetime.utcnow().isoformat(),
        updated_at=datetime.utcnow().isoformat()
    )
    
    return metadata