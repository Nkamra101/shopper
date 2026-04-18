from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pymongo.database import Database

from ..database import get_db, _doc, _oid
from ..schemas import DashboardSummary, EventTypeCreate, EventTypeRead, EventTypeUpdate
from ..services.email_service import send_email_background

router = APIRouter(prefix="/api", tags=["event-types"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _et_doc(doc: dict) -> dict:
    d = _doc(doc)
    d.setdefault("is_active", True)
    d.setdefault("buffer_minutes", 0)
    d.setdefault("min_notice_hours", 0)
    d.setdefault("max_advance_days", 60)
    d.setdefault("location", "")
    d.setdefault("location_type", "video")
    return d


@router.get("/event-types", response_model=list[EventTypeRead])
def list_event_types(db: Database = Depends(get_db)):
    docs = db.event_types.find({}, sort=[("created_at", -1)])
    return [_et_doc(d) for d in docs]


@router.post("/event-types", response_model=EventTypeRead, status_code=status.HTTP_201_CREATED)
def create_event_type(payload: EventTypeCreate, db: Database = Depends(get_db)):
    if db.event_types.find_one({"url_slug": payload.url_slug}):
        raise HTTPException(status_code=400, detail="Slug already exists.")

    doc = payload.model_dump()
    doc["created_at"] = _utcnow()
    result = db.event_types.insert_one(doc)
    return _et_doc(db.event_types.find_one({"_id": result.inserted_id}))


@router.put("/event-types/{event_type_id}", response_model=EventTypeRead)
def update_event_type(event_type_id: str, payload: EventTypeUpdate, db: Database = Depends(get_db)):
    try:
        oid = _oid(event_type_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Event type not found.")

    if not db.event_types.find_one({"_id": oid}):
        raise HTTPException(status_code=404, detail="Event type not found.")

    if db.event_types.find_one({"url_slug": payload.url_slug, "_id": {"$ne": oid}}):
        raise HTTPException(status_code=400, detail="Slug already exists.")

    db.event_types.update_one({"_id": oid}, {"$set": payload.model_dump()})
    return _et_doc(db.event_types.find_one({"_id": oid}))


@router.delete("/event-types/{event_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event_type(
    event_type_id: str,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_db),
):
    try:
        oid = _oid(event_type_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Event type not found.")

    event_type = db.event_types.find_one({"_id": oid})
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")

    now = _utcnow()
    upcoming = list(db.bookings.find({
        "event_type_id": event_type_id,
        "status": "confirmed",
        "start_time": {"$gte": now},
    }))
    event_title = event_type["title"]
    for booking in upcoming:
        background_tasks.add_task(
            send_email_background,
            action="cancelled",
            recipient=booking["booker_email"],
            event_title=event_title,
            start_time=booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
            meeting_url=booking.get("meeting_url") or None,
        )

    db.bookings.delete_many({"event_type_id": event_type_id})
    db.event_types.delete_one({"_id": oid})


@router.patch("/event-types/{event_type_id}/toggle", response_model=EventTypeRead)
def toggle_event_type(event_type_id: str, db: Database = Depends(get_db)):
    try:
        oid = _oid(event_type_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Event type not found.")

    event_type = db.event_types.find_one({"_id": oid})
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")

    db.event_types.update_one({"_id": oid}, {"$set": {"is_active": not event_type.get("is_active", True)}})
    return _et_doc(db.event_types.find_one({"_id": oid}))


@router.post("/event-types/{event_type_id}/duplicate", response_model=EventTypeRead,
             status_code=status.HTTP_201_CREATED)
def duplicate_event_type(event_type_id: str, db: Database = Depends(get_db)):
    try:
        oid = _oid(event_type_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Event type not found.")

    source = db.event_types.find_one({"_id": oid})
    if not source:
        raise HTTPException(status_code=404, detail="Event type not found.")

    base_slug = f"{source['url_slug']}-copy"
    slug = base_slug
    counter = 2
    while db.event_types.find_one({"url_slug": slug}):
        slug = f"{base_slug}-{counter}"
        counter += 1

    copy = {
        "title": f"{source['title']} (Copy)",
        "description": source.get("description", ""),
        "duration": source["duration"],
        "url_slug": slug,
        "accent_color": source.get("accent_color", "#6366f1"),
        "is_active": False,
        "buffer_minutes": source.get("buffer_minutes", 0),
        "min_notice_hours": source.get("min_notice_hours", 0),
        "max_advance_days": source.get("max_advance_days", 60),
        "location": source.get("location", ""),
        "location_type": source.get("location_type", "video"),
        "created_at": _utcnow(),
    }
    result = db.event_types.insert_one(copy)
    return _et_doc(db.event_types.find_one({"_id": result.inserted_id}))


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Database = Depends(get_db)):
    from datetime import timedelta
    now = _utcnow()
    week_start = now - timedelta(days=now.weekday())
    week_start = week_start.replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)

    event_types_count = db.event_types.count_documents({})
    upcoming_count = db.bookings.count_documents({
        "start_time": {"$gte": now}, "status": "confirmed"
    })
    past_count = db.bookings.count_documents({
        "start_time": {"$lt": now}, "status": "confirmed"
    })
    this_week_count = db.bookings.count_documents({
        "start_time": {"$gte": week_start, "$lt": week_end}, "status": "confirmed"
    })
    total_count = db.bookings.count_documents({})

    return DashboardSummary(
        event_types_count=event_types_count,
        upcoming_bookings_count=upcoming_count,
        past_bookings_count=past_count,
        this_week_count=this_week_count,
        total_bookings_count=total_count,
    )
