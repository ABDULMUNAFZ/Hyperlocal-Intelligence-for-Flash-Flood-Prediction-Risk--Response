# FloodGuard Alembic Configuration
from logging.config import fileConfig
from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config
from alembic import context
import sys
import os

# Add app directory to path
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from app.db.session import Base
from app.core.config import settings

# Import all models to register them
from app.models import (  # noqa: F401
    core,
    terrain,
    rainfall,
    soil,
    landcover,
    population,
    iot_sensor,
    simulation,
    evacuation,
    alerts,
    live,
    emergency,
)

config = context.config

# Set the database URL from settings
config.set_main_option("sqlalchemy.url", str(settings.ALEMBIC_DATABASE_URL))

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    config.set_main_option("sqlalchemy.url", str(settings.ALEMBIC_DATABASE_URL))
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in 'online' mode with async engine."""
    config.set_main_option("sqlalchemy.url", str(settings.DATABASE_URL))
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    import asyncio
    asyncio.run(run_async_migrations())