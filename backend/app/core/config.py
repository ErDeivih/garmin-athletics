import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "PULSO API"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Garmin Credentials
    GARMIN_EMAIL: str = ""
    GARMIN_PASSWORD: str = ""
    GARMIN_TOKENS_DIR: str = str(Path(__file__).resolve().parent.parent.parent / "garmin_tokens")
    # Tracks GPS y rutas (Fase 7): data/tracks/{user}/{id}.json, data/routes/...
    TRACKS_DIR: str = str(Path(__file__).resolve().parent.parent.parent.parent / "data")
    
    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///./garmin_athletics.db"

    # Auth (multiusuario / social)
    SECRET_KEY: str = "dev-secret-change-me"

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
