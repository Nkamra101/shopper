"""Centralised runtime configuration, driven by environment variables.

Everything the app needs to adapt per-environment lives here so that main.py,
database.py, and the routers don't read os.getenv directly. This keeps
deployment tweaks to a single file.
"""

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
    APP_NAME: str = os.getenv("APP_NAME", "Shopper Scheduling API")
    APP_ENV: str = os.getenv("APP_ENV", "development")  # development | production
    DEBUG: bool = _bool_env("DEBUG", default=False)

    # ----- Database -----
    # Default to a local SQLite DB so the app still boots with zero config.
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{BASE_DIR / 'shopper.db'}",
    )

    # ----- CORS -----
    # Comma-separated list of allowed origins.
    # In dev, include localhost defaults automatically if CORS_ORIGINS is unset.
    CORS_ORIGINS: List[str] = _list_env(
        "CORS_ORIGINS",
        default=[
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
    )

    # ----- Behaviour toggles -----
    SEED_ON_STARTUP: bool = _bool_env("SEED_ON_STARTUP", default=False)

    # ----- Defaults -----
    DEFAULT_TIMEZONE: str = os.getenv("DEFAULT_TIMEZONE", "Asia/Kolkata")

    # ----- SMTP Settings -----
    SMTP_HOST: str = os.getenv("SMTP_HOST", "")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    SMTP_FROM: str = os.getenv("SMTP_FROM", "")
    SMTP_FROM_NAME: str = os.getenv("SMTP_FROM_NAME", "Shopper Scheduler")
    SMTP_TIMEOUT_SECONDS: int = int(os.getenv("SMTP_TIMEOUT_SECONDS", "10"))
    SMTP_RETRY_COUNT: int = int(os.getenv("SMTP_RETRY_COUNT", "1"))

    # ----- OTP -----
    OTP_TTL_SECONDS: int = int(os.getenv("OTP_TTL_SECONDS", "600"))  # 10 minutes
    OTP_RATE_LIMIT_SECONDS: int = int(os.getenv("OTP_RATE_LIMIT_SECONDS", "60"))
    OTP_MAX_ATTEMPTS: int = int(os.getenv("OTP_MAX_ATTEMPTS", "5"))
    VERIFICATION_TOKEN_TTL_SECONDS: int = int(
        os.getenv("VERIFICATION_TOKEN_TTL_SECONDS", "900")
    )  # 15 minutes

    @property
    def is_production(self) -> bool:
        return self.APP_ENV.lower() == "production"

    @property
    def smtp_configured(self) -> bool:
        return bool(self.SMTP_HOST and self.SMTP_USER and self.SMTP_PASS)


settings = Settings()
