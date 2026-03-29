from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine
from .routers import availability, bookings, event_types, public
from .seed import seed_database

@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_database(db)
        yield
    finally:
        db.close()


app = FastAPI(title="Shopper Scheduling API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://shopper-nk.netlify.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}


app.include_router(event_types.router)
app.include_router(availability.router)
app.include_router(bookings.router)
app.include_router(public.router)
