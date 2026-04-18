import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .database import get_db, ensure_indexes
from .routers import auth, availability, blockouts, bookings, event_types, otp, public
from .seed import seed_database

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)
logger = logging.getLogger("schedulr")


@asynccontextmanager
async def lifespan(_: FastAPI):
    logger.info("Starting %s (env=%s)", settings.APP_NAME, settings.APP_ENV)

    db = get_db()
    try:
        ensure_indexes(db)
        logger.info("MongoDB indexes ready")
    except Exception:
        logger.exception("Failed to create indexes")

    if settings.SEED_ON_STARTUP:
        try:
            seed_database(db)
            logger.info("Seed complete")
        except Exception:
            logger.exception("Seeding failed")

    if settings.smtp_configured:
        logger.info("SMTP configured: %s at %s", settings.SMTP_USER, settings.SMTP_HOST)
    else:
        logger.warning("SMTP not configured — email delivery disabled.")

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s: %r", request.method, request.url.path, exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error."})


@app.get("/", include_in_schema=False)
def root():
    return {"name": settings.APP_NAME, "env": settings.APP_ENV, "docs": "/docs"}


@app.get("/health", tags=["meta"])
def health_check():
    db_ok = True
    try:
        get_db().command("ping")
    except Exception:
        logger.exception("MongoDB health check failed")
        db_ok = False
    payload = {"status": "ok" if db_ok else "degraded", "database": "up" if db_ok else "down"}
    return JSONResponse(status_code=200 if db_ok else 503, content=payload)


app.include_router(auth.router)
app.include_router(event_types.router)
app.include_router(availability.router)
app.include_router(bookings.router)
app.include_router(public.router)
app.include_router(blockouts.router)
app.include_router(otp.router)
