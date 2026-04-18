import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from pymongo.database import Database

from ..database import get_db, _doc, _oid
from ..schemas import BookingCreate, BookingRead, PublicEventTypeRead, SlotRead
from ..services.booking_service import generate_slots, get_public_event_type, normalize_booking_start
from ..services.email_service import send_email_background
from ..services.otp_service import consume_verification_token

router = APIRouter(prefix="/api/public", tags=["public"])


def _booking_with_event_type(booking: dict, db: Database) -> dict:
    b = _doc(booking)
    et = db.event_types.find_one({"_id": _oid(b["event_type_id"])})
    if et:
        b["event_type"] = _doc(et)
        b["event_type"].setdefault("is_active", True)
        b["event_type"].setdefault("buffer_minutes", 0)
        b["event_type"].setdefault("min_notice_hours", 0)
        b["event_type"].setdefault("max_advance_days", 60)
        b["event_type"].setdefault("location", "")
        b["event_type"].setdefault("location_type", "video")
    b.setdefault("notes", "")
    b.setdefault("meeting_url", "")
    return b


@router.get("/event-types/{slug}", response_model=PublicEventTypeRead)
def get_public_event(slug: str, db: Database = Depends(get_db)):
    event_type, timezone_name = get_public_event_type(db, slug)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")
    return PublicEventTypeRead(
        id=event_type["id"],
        title=event_type["title"],
        description=event_type.get("description", ""),
        duration=event_type["duration"],
        url_slug=event_type["url_slug"],
        accent_color=event_type.get("accent_color", "#6366f1"),
        timezone=timezone_name,
    )


@router.get("/event-types/{slug}/slots", response_model=list[SlotRead])
def get_slots(slug: str, date: str = Query(...), db: Database = Depends(get_db)):
    event_type, _ = get_public_event_type(db, slug)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")
    try:
        requested_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date. Use YYYY-MM-DD.")
    return generate_slots(db, event_type, requested_date)


@router.post(
    "/event-types/{slug}/book",
    response_model=BookingRead,
    status_code=status.HTTP_201_CREATED,
)
def create_booking(
    slug: str,
    payload: BookingCreate,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_db),
):
    event_type, timezone_name = get_public_event_type(db, slug)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")

    if not consume_verification_token(db, payload.verification_token, payload.booker_email):
        raise HTTPException(
            status_code=401,
            detail="Email verification expired or invalid. Please verify your email again.",
        )

    start_utc = normalize_booking_start(payload.start_time, timezone_name)

    requested_date_local = payload.start_time.date()
    available_slots = generate_slots(db, event_type, requested_date_local)
    available_utc_keys = {
        normalize_booking_start(
            datetime.fromisoformat(slot["start_time"]), timezone_name
        ).strftime("%Y-%m-%dT%H:%M:%S")
        for slot in available_slots
    }
    if start_utc.strftime("%Y-%m-%dT%H:%M:%S") not in available_utc_keys:
        raise HTTPException(status_code=400, detail="That slot is no longer available.")

    # Check for slot conflict
    if db.bookings.find_one({
        "event_type_id": event_type["id"],
        "start_time": start_utc,
        "status": "confirmed",
    }):
        raise HTTPException(
            status_code=409,
            detail="That slot was just booked by someone else. Please pick another.",
        )

    from datetime import timezone as tz_module
    from datetime import datetime as dt_module
    now = dt_module.now(tz_module.utc).replace(tzinfo=None)

    booking_doc = {
        "event_type_id": event_type["id"],
        "booker_name": payload.booker_name,
        "booker_email": payload.booker_email,
        "notes": payload.notes,
        "status": "confirmed",
        "meeting_url": f"https://meet.jit.si/schedulr-{uuid.uuid4().hex[:12]}",
        "start_time": start_utc,
        "end_time": start_utc + timedelta(minutes=event_type["duration"]),
        "created_at": now,
    }
    result = db.bookings.insert_one(booking_doc)
    booking = db.bookings.find_one({"_id": result.inserted_id})
    enriched = _booking_with_event_type(booking, db)

    background_tasks.add_task(
        send_email_background,
        action="booked",
        recipient=enriched["booker_email"],
        event_title=enriched["event_type"]["title"],
        start_time=booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
        meeting_url=booking.get("meeting_url"),
    )
    return enriched


@router.get("/bookings/{booking_id}", response_model=BookingRead)
def get_booking(booking_id: str, db: Database = Depends(get_db)):
    try:
        oid = _oid(booking_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking = db.bookings.find_one({"_id": oid})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return _booking_with_event_type(booking, db)
