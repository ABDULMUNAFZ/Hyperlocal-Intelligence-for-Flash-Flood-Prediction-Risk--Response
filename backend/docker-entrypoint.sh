#!/bin/sh
# FloodGuard container entrypoint (production image).
#  - fetches trained model artifacts from S3 when MODEL_ARTIFACTS_S3_URI is set
#  - then execs the given command (API server, Celery worker, Celery beat, or a one-off task)
set -e

if [ -n "$MODEL_ARTIFACTS_S3_URI" ] && [ "${SKIP_MODEL_FETCH:-0}" != "1" ]; then
  python scripts/fetch_models.py || echo "WARNING: model artifacts could not be fetched; prediction API will report models as not loaded"
fi

exec "$@"
