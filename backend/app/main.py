import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from .config import settings
from .database import Base, SessionLocal, engine
from .routers import availability, bookings, event_types, public
from .seed import seed_database

# ----- Logging -----
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("shopper")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting %s (env=%s)", settings.APP_NAME, settings.APP_ENV)

    # Create tables if they do not yet exist. For production schema changes
    # in the future, switch this to Alembic migrations.
    Base.metadata.create_all(bind=engine)
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
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
