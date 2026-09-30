# FloodGuard Backend Dockerfile
# Multi-stage build for development and production

# Base stage with common dependencies
FROM python:3.12-slim AS base

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    gdal-bin \
    libgdal-dev \
    proj-bin \
    libproj-dev \
    libgeos-dev \
    libspatialindex-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set GDAL config
ENV GDAL_CONFIG=/usr/bin/gdal-config
ENV CPLUS_INCLUDE_PATH=/usr/include/gdal
ENV C_INCLUDE_PATH=/usr/include/gdal

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Development stage
FROM base AS development
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# Production stage (Amazon ECS/Fargate). Same image runs the API, Celery worker, Celery beat
# and one-off tasks (db bootstrap) — the command is chosen by the ECS task definition.
FROM base AS production

# Non-root runtime user with a fixed UID
RUN groupadd -r -g 10001 floodguard && useradd -r -u 10001 -g floodguard -d /app -s /usr/sbin/nologin floodguard

COPY --chown=floodguard:floodguard . .
# writable dirs: geo cache (ephemeral) and model artifacts fetched from S3 at start
RUN chmod 0755 docker-entrypoint.sh && mkdir -p .cache models/trained && chown -R floodguard:floodguard .cache models

USER floodguard

ENV PYTHONPATH=/app \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production \
    LOG_LEVEL=INFO \
    PORT=8000 \
    WEB_CONCURRENCY=2

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
# uvicorn production server: multiple workers, proxy headers from the load balancer,
# graceful shutdown on SIGTERM (ECS stopTimeout), keep-alive above the ALB idle timeout
CMD ["sh", "-c", "exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY} --proxy-headers --forwarded-allow-ips='*' --timeout-graceful-shutdown 25 --timeout-keep-alive 130 --no-server-header"]
