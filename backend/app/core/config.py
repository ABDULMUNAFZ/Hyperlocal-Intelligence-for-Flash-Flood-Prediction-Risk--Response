# FloodGuard Backend Configuration
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field, PostgresDsn, RedisDsn, model_validator
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # Application
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "DEBUG"
    SECRET_KEY: str = Field(..., min_length=32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    POSTGRES_DB: str = "floodguard"
    POSTGRES_USER: str = "floodguard"
    POSTGRES_PASSWORD: str = "floodguard_dev_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: Optional[str] = None
    ALEMBIC_DATABASE_URL: Optional[str] = None

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: Optional[str] = None

    @model_validator(mode="after")
    def assemble_db_and_redis_urls(self):
        if not self.DATABASE_URL:
            self.DATABASE_URL = str(
                PostgresDsn.build(
                    scheme="postgresql+asyncpg",
                    username=self.POSTGRES_USER,
                    password=self.POSTGRES_PASSWORD,
                    host=self.POSTGRES_HOST,
                    port=self.POSTGRES_PORT,
                    path=self.POSTGRES_DB,
                )
            )
        if not self.ALEMBIC_DATABASE_URL:
            if self.DATABASE_URL and "+asyncpg" in str(self.DATABASE_URL):
                self.ALEMBIC_DATABASE_URL = str(self.DATABASE_URL).replace("postgresql+asyncpg", "postgresql")
            else:
                self.ALEMBIC_DATABASE_URL = str(
                    PostgresDsn.build(
                        scheme="postgresql",
                        username=self.POSTGRES_USER,
                        password=self.POSTGRES_PASSWORD,
                        host=self.POSTGRES_HOST,
                        port=self.POSTGRES_PORT,
                        path=self.POSTGRES_DB,
                    )
                )
        if not self.REDIS_URL:
            self.REDIS_URL = str(
                RedisDsn.build(
                    scheme="redis",
                    host=self.REDIS_HOST,
                    port=self.REDIS_PORT,
                    path=f"{self.REDIS_DB}",
                )
            )
        return self

    # External APIs
    OPEN_METEO_BASE_URL: str = "https://api.open-meteo.com/v1"
    IMD_API_BASE_URL: Optional[str] = None
    IMD_API_KEY: Optional[str] = None
    MOSDAC_API_BASE_URL: Optional[str] = None
    MOSDAC_API_KEY: Optional[str] = None
    BHUVAN_API_BASE_URL: Optional[str] = None
    BHUVAN_API_KEY: Optional[str] = None
    GEE_SERVICE_ACCOUNT_KEY_PATH: Optional[str] = None
    MAPTILER_KEY: Optional[str] = None
    MAPBOX_TOKEN: Optional[str] = None

    # Email/SMS
    SMTP_HOST: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USER: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    EMAIL_FROM: str = "noreply@floodguard.in"
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None
    FCM_SERVER_KEY: Optional[str] = None
    FCM_SENDER_ID: Optional[str] = None

    # Web Push (VAPID). The private key never leaves the backend; the frontend fetches only the public key.
    VAPID_PUBLIC_KEY: Optional[str] = None
    VAPID_PRIVATE_KEY: Optional[str] = None
    VAPID_SUBJECT: Optional[str] = None  # e.g. "mailto:ops@your-agency.gov.in"

    # Emergency response
    EMERGENCY_LOCATION_STALE_MINUTES: int = 15          # user location older than this is STALE
    EMERGENCY_TARGET_LOCATION_MAX_AGE_HOURS: int = 24   # only target users whose location is at most this old
    EMERGENCY_ARRIVAL_RADIUS_M: int = 200               # "REACHED HERE" accepted within this distance (+ GPS accuracy, capped)
    EMERGENCY_LOCATION_RETENTION_HOURS: int = 72        # raw user locations are purged after this
    EMERGENCY_RESCUE_RETENTION_DAYS: int = 30           # resolved rescue requests (and their history) purged after this
    EMERGENCY_AUTO_OFFICIAL_ALERTS: bool = True         # push official NDMA SACHET Severe/Extreme alerts covering Wayanad
    ROUTING_BASE_URL: str = "https://router.project-osrm.org"  # OSRM-compatible routing services (driving / foot)
    ROUTING_FOOT_BASE_URL: str = "https://routing.openstreetmap.de/routed-foot"

    # LLM
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4-turbo-preview"
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-opus-20240229"
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3:70b"

    # MLflow
    MLFLOW_TRACKING_URI: str = "file:./mlruns"

    # Data Directories
    CHIRPS_DATA_DIR: str = "/data/chirps"
    DEM_DATA_DIR: str = "/data/dem"
    TEMP_DATA_DIR: str = "/tmp/floodguard"

    # CORS
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60

    # Pagination
    DEFAULT_PAGE_SIZE: int = 50
    MAX_PAGE_SIZE: int = 500


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()