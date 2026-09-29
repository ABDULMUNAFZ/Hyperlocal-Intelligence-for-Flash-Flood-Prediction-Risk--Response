# FloodGuard Data Sources Endpoints
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from uuid import UUID
from app.db.session import get_db
from app.models.core import DataSource, ProcessingJob
from app.schemas.core import DataSourceResponse, ProcessingJobResponse

router = APIRouter(prefix="/data-sources", tags=["Data Sources"])


def data_source_to_response(source: DataSource) -> DataSourceResponse:
    return DataSourceResponse(
        id=source.id,
        name=source.name,
        description=source.description,
        source_type=source.source_type,
        provider=source.provider,
        api_endpoint=source.api_endpoint,
        license=source.license,
        attribution=source.attribution,
        update_frequency=source.update_frequency,
        spatial_resolution=source.spatial_resolution,
        temporal_resolution=source.temporal_resolution,
        coverage_area=source.coverage_area,
        is_active=source.is_active,
        last_fetched=source.last_fetched,
        last_successful_fetch=source.last_successful_fetch,
        fetch_error_count=source.fetch_error_count,
        metadata=source.extra_metadata or {},
        created_at=source.created_at,
        updated_at=source.updated_at,
    )


@router.get("", response_model=List[DataSourceResponse])
async def list_data_sources(
    source_type: Optional[str] = None,
    provider: Optional[str] = None,
    is_active: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """List all data sources."""
    query = select(DataSource).where(DataSource.is_active == is_active)

    if source_type:
        query = query.where(DataSource.source_type == source_type)
    if provider:
        query = query.where(DataSource.provider == provider)

    query = query.order_by(DataSource.source_type, DataSource.name)
    result = await db.execute(query)
    return [data_source_to_response(s) for s in result.scalars().all()]


@router.get("/{source_id}", response_model=DataSourceResponse)
async def get_data_source(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Get data source by ID."""
    source = await db.get(DataSource, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")
    return data_source_to_response(source)


@router.get("/{source_id}/jobs", response_model=List[ProcessingJobResponse])
async def get_data_source_jobs(
    source_id: UUID,
    status: Optional[str] = None,
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """Get processing jobs for a data source."""
    query = select(ProcessingJob).where(ProcessingJob.data_source_id == source_id)

    if status:
        query = query.where(ProcessingJob.status == status)

    query = query.order_by(ProcessingJob.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/{source_id}/trigger-fetch")
async def trigger_data_fetch(
    source_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    """Trigger a data fetch for a source."""
    source = await db.get(DataSource, source_id)
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found")

    # In production, this would queue a Celery task
    import uuid
    job = ProcessingJob(
        job_type=f"fetch_{source.source_type}",
        data_source_id=source_id,
        status="queued",
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    return {
        "job_id": job.id,
        "status": "queued",
        "message": f"Fetch job queued for {source.name}",
    }