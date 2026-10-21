import os
from pathlib import Path
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BASE_DIR.parent

if (WORKSPACE_DIR / "cold-call-transcripts-100").exists():
    TRANSCRIPTS_DIR = WORKSPACE_DIR / "cold-call-transcripts-100"
elif (BASE_DIR / "cold-call-transcripts-100").exists():
    TRANSCRIPTS_DIR = BASE_DIR / "cold-call-transcripts-100"
else:
    TRANSCRIPTS_DIR = WORKSPACE_DIR / "cold-call-transcripts-100"

load_dotenv(BASE_DIR / ".env")

class Settings(BaseSettings):
    PROJECT_NAME: str = "CallerLog AI Cold Calling Platform"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Database
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")
    
    # Gemini API Key
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.8-flash")
    
    # CORS
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,*")
    
    # Data Paths
    TRANSCRIPTS_PATH: Path = TRANSCRIPTS_DIR
    
    @property
    def cors_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
if not settings.DATABASE_URL:
    settings.DATABASE_URL = f"sqlite:///{BASE_DIR}/callerlog.db"
