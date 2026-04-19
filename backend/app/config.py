import os
from pathlib import Path
from typing import List

from dotenv import load_dotenv

load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent


def _bool_env(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _list_env(name: str, default: List[str] | None = None) -> List[str]:
    raw = os.getenv(name)
    if not raw:
        return default or []
    return [item.strip() for item in raw.split(",") if item.strip()]


class Settings:
    # ----- App metadata -----
    APP_NAME: str = os.getenv("APP_NAME", "Schedulr API")
    APP_ENV: str = os.getenv("APP_ENV", "development")
    DEBUG: bool = _bool_env("DEBUG", default=False)

    # ----- MongoDB -----
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "schedulr")

    # ----- CORS -----
    CORS_ORIGINS: List[str] = _list_env(
        "CORS_ORIGINS",
        default=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
            "https://shoppernk.netlify.app",
        ],
    )

    # ----- Behaviour toggles -----
    SEED_ON_STARTUP: bool = _bool_env("SEED_ON_STARTUP", default=False)

    # ----- Defaults -----
    DEFAULT_TIMEZONE: str = os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata")

    # ----- SMTP -----
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Schedulr")
    SMTP_TIMEOUT_SECONDS: int = int(os.getenv("SMTP_TIMEOUT_SECONDS", "10"))
    SMTP_RETRY_COUNT: int = int(os.getenv("SMTP_RETRY_COUNT", "1"))

    # ----- Auth / JWT -----
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me-in-production-use-a-long-random-string")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

    # ----- Google OAuth -----
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv(
        "GOOGLE_REDIRECT_URI", "http://localhost:8000/api/auth/google/callback"
    )
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    # ----- OTP -----
    OTP_TTL_SECONDS: int = int(os.getenv("OTP_TTL_SECONDS", "600"))
    OTP_RATE_LIMIT_SECONDS: int = int(os.getenv("OTP_RATE_LIMIT_SECONDS", "60"))
    OTP_MAX_ATTEMPTS: int = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
    VERIFICATION_TOKEN_TTL_SECONDS: int = int(os.getenv("VERIFICATION_TOKEN_TTL_SECONDS", "900"))

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASS)

    @property
    def email_delivery_mode(self) -> str:
        if self.smtp_configured:
            return "smtp"
        if not self.is_production:
            return "console"
        return "disabled"

    @property
    def email_enabled(self) -> bool:
        return self.email_delivery_mode in {"smtp", "console"}


settings = Settings()
