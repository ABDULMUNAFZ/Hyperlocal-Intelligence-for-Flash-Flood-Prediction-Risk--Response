#!/usr/bin/env python3
"""
Prepare a PostgreSQL/PostGIS database (e.g. Amazon RDS) and apply migrations.

Equivalent of the local docker `init-sql/00_init.sql` + `alembic upgrade head`, runnable as a
one-off ECS task (RDS is private, so this runs inside the VPC):

    python scripts/db_bootstrap.py            # extensions + helper function + migrations + checks

Idempotent: safe to run on every deployment.
"""

import asyncio
import subprocess
import sys
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.core.config import settings  # noqa: E402

EXTENSIONS = ["postgis", "postgis_raster", "pg_trgm", "btree_gist", "uuid-ossp"]
FUNCTION = """
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
"""


async def prepare() -> None:
    eng = create_async_engine(str(settings.DATABASE_URL))
    async with eng.begin() as c:
        for e in EXTENSIONS:
            await c.execute(text(f'CREATE EXTENSION IF NOT EXISTS "{e}"'))
        await c.execute(text(FUNCTION))
        v = (await c.execute(text("SELECT postgis_full_version()"))).scalar()
        print("PostGIS:", v.split(" ")[0:2])
    await eng.dispose()


async def verify() -> None:
    eng = create_async_engine(str(settings.DATABASE_URL))
    async with eng.connect() as c:
        head = (await c.execute(text("SELECT version_num FROM alembic_version"))).scalar()
        # a real spatial query: geography distance + ST_DWithin on the GIST-indexed tables
        d = (await c.execute(text("""SELECT round(ST_Distance(ST_SetSRID(ST_MakePoint(76.083, 11.61),4326)::geography,
                                                              ST_SetSRID(ST_MakePoint(76.133, 11.556),4326)::geography))"""))).scalar()
        idx = (await c.execute(text("""SELECT count(*) FROM pg_indexes WHERE indexname IN
                                        ('idx_user_locations_geog','idx_rescue_requests_geog','idx_shelters_geography')"""))).scalar()
        n = (await c.execute(text("SELECT count(*) FROM user_locations WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(76.08,11.61),4326)::geography, 5000)"))).scalar()
        print(f"alembic head={head}  kalpetta→meppadi={d} m  spatial indexes={idx}/3  dwithin query ok ({n} rows)")
    await eng.dispose()


def main() -> int:
    asyncio.run(prepare())
    r = subprocess.run(["alembic", "upgrade", "head"], cwd=str(Path(__file__).resolve().parent.parent))
    if r.returncode != 0:
        print("alembic upgrade failed", file=sys.stderr)
        return r.returncode
    asyncio.run(verify())
    return 0


if __name__ == "__main__":
    sys.exit(main())
