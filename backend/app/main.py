import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import inspect, text

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import availability, blockouts, bookings, event_types, otp, public
from .seed import seed_database

# ----- Logging -----
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("shopper")


def _ensure_runtime_schema_patches() -> None:
    """Lightweight, idempotent column-level migrations.

    `Base.metadata.create_all()` only creates *missing tables*. When new columns
    are added to existing tables (e.g. ``bookings.meeting_url``), older
    databases need an ALTER TABLE. We perform a tiny set of additive patches
    here so the app boots cleanly on existing dev/prod databases without
    pulling in Alembic for this scope.
    """
    inspector = inspect(engine)
    if "bookings" not in inspector.get_table_names():
        return

    existing_columns = {col["name"] for col in inspector.get_columns("bookings")}
    dialect = engine.dialect.name

    with engine.begin() as conn:
        if "meeting_url" not in existing_columns:
            logger.info("Adding bookings.meeting_url column")
            if dialect == "postgresql":
                conn.execute(
                    text(
                        "ALTER TABLE bookings "
                        "ADD COLUMN meeting_url VARCHAR(255) NOT NULL DEFAULT ''"
                    )
                )
            else:
                # SQLite syntax (also works on MySQL with minor differences,
                # but we no longer target MySQL).
                conn.execute(
                    text(
                        "ALTER TABLE bookings "
                        "ADD COLUMN meeting_url VARCHAR(255) NOT NULL DEFAULT ''"
                    )
                )


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting %s (env=%s)", settings.APP_NAME, settings.APP_ENV)

    # Create tables if they do not yet exist. For production schema changes
    # in the future, switch this to Alembic migrations.
    Base.metadata.create_all(bind=engine)
    try:
        _ensure_runtime_schema_patches()
    except Exception:  # noqa: BLE001
        logger.exception("Runtime schema patch failed")
    logger.info("Database schema ready")

    if settings.SEED_ON_STARTUP:
        db = SessionLocal()
        try:
            seed_database(db)
            logger.info("Seed complete")
        except Exception:  # noqa: BLE001
            logger.exception("Seeding failed")
            db.rollback()
        finally:
            db.close()

    yield
    logger.info("Shutting down %s", settings.APP_NAME)


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
)

# ----- CORS -----
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ----- Global exception handler -----
@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):  # noqa: ARG001
    logger.exception(
        "Unhandled error on %s %s: %r", request.method, request.url.path, exc
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error."},
    )


# ----- Health checks -----
@app.get("/", include_in_schema=False)
def root():
    return {
        "name": settings.APP_NAME,
        "env": settings.APP_ENV,
        "docs": "/docs",
    }


@app.get("/health", tags=["meta"])
def health_check():
    """Liveness + DB connectivity probe. Deployment platforms can hit this."""
    db_ok = True
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        logger.exception("DB health check failed")
        db_ok = False

    payload = {"status": "ok" if db_ok else "degraded", "database": "up" if db_ok else "down"}
    return JSONResponse(status_code=200 if db_ok else 503, content=payload)


# ----- Routers -----
app.include_router(event_types.router)
app.include_router(availability.router)
app.include_router(bookings.router)
app.include_router(public.router)
app.include_router(blockouts.router)
app.include_router(otp.router)
