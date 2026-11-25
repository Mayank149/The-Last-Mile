"""Configuration, constants, and declared modelling assumptions for THE LAST MILE."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


# Bounded demonstration area: Koramangala & Ejipura, Bengaluru, India
BBOX_NORTH = 12.9460
BBOX_SOUTH = 12.9220
BBOX_EAST = 77.6420
BBOX_WEST = 77.6120

AREA_NAME = "Koramangala & Ejipura, Bengaluru"

# Documented assumed speeds (km/h) by OSM highway class for planning estimates
# (Used when reliable speed data is unavailable; not live traffic data.)
ASSUMED_SPEED_KMH: dict[str, float] = {
    "trunk": 40.0,
    "trunk_link": 30.0,
    "primary": 35.0,
    "primary_link": 25.0,
    "secondary": 30.0,
    "secondary_link": 22.0,
    "tertiary": 25.0,
    "tertiary_link": 20.0,
    "residential": 18.0,
    "unclassified": 18.0,
    "living_street": 12.0,
    "service": 12.0,
}
DEFAULT_SPEED_KMH = 18.0

# Degraded road travel-time multiplier (simulated floodwater / partial obstruction)
DEGRADED_TIME_MULTIPLIER = 3.0


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
