# FloodGuard Makefile
# Convenience commands for development and data ingestion

.PHONY: help install test lint typecheck run-backend run-frontend run-all clean db-init db-migrate db-upgrade ingest-all ingest-quick

# Default target
help:
	@echo "FloodGuard SIH 26192 - Flash Flood Prediction System"
	@echo ""
	@echo "Available commands:"
	@echo "  install          Install all dependencies"
	@echo "  test             Run all tests"
	@echo "  lint             Run linting (ruff)"
	@echo "  typecheck        Run type checking (mypy)"
	@echo "  run-backend      Start backend server"
	@echo "  run-frontend     Start frontend dev server"
	@echo "  run-all          Start all services with docker-compose"
	@echo "  clean            Clean build artifacts"
	@echo ""
	@echo "Database:"
	@echo "  db-init          Initialize database (create extensions, tables)"
	@echo "  db-migrate       Create new migration"
	@echo "  db-upgrade       Apply migrations"
	@echo ""
	@echo "Data Ingestion:"
	@echo "  ingest-all       Run all data ingestion pipelines"
	@echo "  ingest-quick     Quick ingestion for testing"
	@echo "  ingest-rainfall  Ingest rainfall data"
	@echo "  ingest-weather   Ingest weather forecast"
	@echo "  ingest-dem       Ingest DEM data"
	@echo "  ingest-soil      Ingest soil data"
	@echo "  ingest-landcover Ingest land cover data"
	@echo "  ingest-osm       Ingest OSM infrastructure"
	@echo "  ingest-population Ingest population data"
	@echo "  ingest-historical-flood Ingest historical flood data"
	@echo "  ingest-admin-boundaries Ingest administrative boundaries"
	@echo ""
	@echo "Docker:"
	@echo "  docker-build     Build all Docker images"
	@echo "  docker-up        Start all services"
	@echo "  docker-down      Stop all services"
	@echo "  docker-logs      View logs"

# Install dependencies
install:
	cd backend && pip install -r requirements.txt
	cd frontend && npm install

# Testing
test:
	cd backend && python -m pytest -v --tb=short

test-cov:
	cd backend && python -m pytest --cov=app --cov-report=html --cov-report=term

# Linting
lint:
	cd backend && ruff check .
	cd frontend && npm run lint

lint-fix:
	cd backend && ruff check . --fix
	cd frontend && npm run lint:fix

# Type checking
typecheck:
	cd backend && mypy app/
	cd frontend && npm run typecheck

# Backend
run-backend:
	cd backend && python -m app.main

run-backend-dev:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Frontend
run-frontend:
	cd frontend && npm run dev

# Run all with Docker
run-all:
	docker-compose up -d
	@echo "Services started. Frontend: http://localhost:5173, Backend: http://localhost:8000"

# Clean
clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf backend/.pytest_cache backend/htmlcov frontend/node_modules frontend/dist logs/*.log 2>/dev/null || true

# Database
db-init:
	cd backend && python -c "import asyncio; from app.db.session import init_db; asyncio.run(init_db())"

db-migrate:
	cd backend && alembic revision --autogenerate -m "$(MSG)"

db-upgrade:
	cd backend && alembic upgrade head

db-downgrade:
	cd backend && alembic downgrade -1

db-reset:
	cd backend && alembic downgrade base && alembic upgrade head

# Data Ingestion
ingest-all:
	cd backend && python -m app.data.ingest_cli

ingest-quick:
	cd backend && python -m app.data.ingest_cli --quick

ingest-rainfall:
	cd backend && python -m app.data.pipelines.rainfall

ingest-weather:
	cd backend && python -m app.data.pipelines.weather

ingest-dem:
	cd backend && python -m app.data.pipelines.dem

ingest-soil:
	cd backend && python -m app.data.pipelines.soil

ingest-landcover:
	cd backend && python -m app.data.pipelines.landcover

ingest-osm:
	cd backend && python -m app.data.pipelines.osm

ingest-population:
	cd backend && python -m app.data.pipelines.population

ingest-historical-flood:
	cd backend && python -m app.data.pipelines.historical_flood

ingest-admin-boundaries:
	cd backend && python -m app.data.pipelines.admin_boundaries

# Docker
docker-build:
	docker-compose build

docker-up:
	docker-compose up -d

docker-down:
	docker-compose down

docker-logs:
	docker-compose logs -f

docker-ps:
	docker-compose ps

# Development setup
dev-setup: install db-init db-upgrade
	@echo "Development environment ready!"
	@echo "Run 'make run-all' to start all services"

# CI/CD
ci: lint typecheck test

# Production deployment
deploy-prod:
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build