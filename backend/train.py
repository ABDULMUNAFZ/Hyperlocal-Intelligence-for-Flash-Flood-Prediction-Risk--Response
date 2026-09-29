#!/usr/bin/env python3
"""
FloodGuard Model Training Script

Run complete training pipeline with spatial-temporal cross-validation.
"""

import asyncio
import argparse
import logging
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.ml.training.pipeline import run_full_training_pipeline

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def parse_args():
    parser = argparse.ArgumentParser(description="FloodGuard Model Training")
    
    parser.add_argument(
        "--start-date",
        type=str,
        help="Start date for training data (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--end-date",
        type=str,
        help="End date for training data (YYYY-MM-DD)"
    )
    parser.add_argument(
        "--bbox",
        type=str,
        help="Bounding box as min_lon,min_lat,max_lon,max_lat"
    )
    parser.add_argument(
        "--register",
        action="store_true",
        default=True,
        help="Register models in registry"
    )
    parser.add_argument(
        "--no-register",
        action="store_false",
        dest="register",
        help="Don't register models"
    )
    parser.add_argument(
        "--promote",
        action="store_true",
        help="Promote best model to staging"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="training_report.json",
        help="Output path for training report"
    )
    
    return parser.parse_args()


async def main():
    args = parse_args()
    
    # Parse bbox if provided
    bbox = None
    if args.bbox:
        try:
            coords = [float(x.strip()) for x in args.bbox.split(",")]
            if len(coords) != 4:
                raise ValueError
            bbox = tuple(coords)
        except ValueError:
            logger.error("Bbox must be: min_lon,min_lat,max_lon,max_lat")
            return 1
    
    logger.info("Starting FloodGuard training pipeline...")
    logger.info(f"Args: start_date={args.start_date}, end_date={args.end_date}, bbox={bbox}")
    logger.info(f"Register: {args.register}, Promote: {args.promote}")
    
    try:
        results = await run_full_training_pipeline(
            start_date=args.start_date,
            end_date=args.end_date,
            bbox=bbox,
            register=args.register,
            promote=args.promote
        )
        
        # Save report
        output_path = Path(args.output)
        import json
        with open(output_path, 'w') as f:
            json.dump(results, f, indent=2, default=str)
        
        logger.info(f"Training completed successfully!")
        logger.info(f"Results saved to {output_path}")
        logger.info(f"CV ROC-AUC: {results['cv_results']['summary']['roc_auc']['mean']:.4f}")
        logger.info(f"CV PR-AUC: {results['cv_results']['summary']['pr_auc']['mean']:.4f}")
        logger.info(f"Full ROC-AUC: {results['full_metrics'].get('roc_auc', 'N/A')}")
        logger.info(f"Full PR-AUC: {results['full_metrics'].get('pr_auc', 'N/A')}")
        
        return 0
        
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))