import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pymongo.database import Database

from ..database import get_db, _doc, _oid
from pydantic import BaseModel

from ..schemas import AdminBookingCreate, BookingRead, BookingReschedule


class NotesUpdate(BaseModel):
    notes: str = ""
from ..services.booking_service import generate_slots, get_timezone, normalize_booking_start
from ..services.email_service import send_email_background
from ..services.webhook_service import fire_webhooks
from ..services.workflow_service import fire_workflows as fire_workflow_actions

router = APIRouter(prefix="/api", tags=["bookings"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


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


def _ensure_slot_available(db: Database, event_type: dict, start_time: datetime, timezone_name: str) -> datetime:
    start_utc = normalize_booking_start(start_time, timezone_name)

    requested_date_local = start_time.date()
    available_slots = generate_slots(db, event_type, requested_date_local)
    available_utc_keys = {
        normalize_booking_start(datetime.fromisoformat(slot["start_time"]), timezone_name).strftime(
            "%Y-%m-%dT%H:%M:%S"
        )
        for slot in available_slots
    }
    if start_utc.strftime("%Y-%m-%dT%H:%M:%S") not in available_utc_keys:
        raise HTTPException(status_code=400, detail="That slot is not available.")

    if db.bookings.find_one({
        "event_type_id": event_type["id"],
        "start_time": start_utc,
        "status": "confirmed",
    }):
        raise HTTPException(
            status_code=409,
            detail="That slot was just booked by someone else. Please pick another.",
        )

    return start_utc


def _create_booking_document(event_type: dict, payload, start_utc: datetime) -> dict:
    return {
        "event_type_id": event_type["id"],
        "booker_name": payload.booker_name,
        "booker_email": payload.booker_email,
        "notes": payload.notes,
        "status": "confirmed",
        "meeting_url": f"https://meet.jit.si/shopper-{uuid.uuid4().hex[:12]}",
        "start_time": start_utc,
        "end_time": start_utc + timedelta(minutes=event_type["duration"]),
        "created_at": _utcnow(),
    }


@router.get("/bookings", response_model=list[BookingRead])
def list_bookings(scope: str = "all", db: Database = Depends(get_db)):
    if scope not in {"all", "upcoming", "past"}:
        raise HTTPException(status_code=400, detail="Invalid scope. Use all, upcoming, or past.")

    now = _utcnow()
    query: dict = {}
    if scope == "upcoming":
        query = {"start_time": {"$gte": now}, "status": "confirmed"}
    elif scope == "past":
        query = {"start_time": {"$lt": now}}

    bookings = list(db.bookings.find(query, sort=[("start_time", 1)]))
    return [_booking_with_event_type(b, db) for b in bookings]


@router.post("/bookings", response_model=BookingRead)
def create_booking_admin(
    payload: AdminBookingCreate,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_db),
):
    try:
        event_type_doc = db.event_types.find_one({"_id": _oid(payload.event_type_id)})
    except ValueError:
        event_type_doc = None

    if not event_type_doc:
        raise HTTPException(status_code=404, detail="Event type not found.")

    event_type = _doc(event_type_doc)
    if not event_type.get("is_active", True):
        raise HTTPException(status_code=400, detail="This event type is currently paused.")

    timezone_name = get_timezone(db)
    start_utc = _ensure_slot_available(db, event_type, payload.start_time, timezone_name)

    booking_doc = _create_booking_document(event_type, payload, start_utc)
    result = db.bookings.insert_one(booking_doc)
    booking = db.bookings.find_one({"_id": result.inserted_id})
    enriched = _booking_with_event_type(booking, db)

    if payload.send_email:
        background_tasks.add_task(
            send_email_background,
            action="booked",
            recipient=enriched["booker_email"],
            event_title=enriched["event_type"]["title"],
            start_time=booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
            meeting_url=booking.get("meeting_url"),
        )
    _event_payload = {
        "booker_name": enriched["booker_name"],
        "booker_email": enriched["booker_email"],
        "event_title": enriched["event_type"]["title"],
        "start_time": booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
        "meeting_url": booking.get("meeting_url", ""),
        "notes": enriched.get("notes", ""),
    }
    background_tasks.add_task(fire_webhooks, db, "booking.confirmed", _event_payload)
    background_tasks.add_task(fire_workflow_actions, db, "booking.confirmed", _event_payload)
    return enriched


@router.patch("/bookings/{booking_id}/notes", response_model=BookingRead)
def update_booking_notes(
    booking_id: str,
    payload: NotesUpdate,
    db: Database = Depends(get_db),
):
    try:
        oid = _oid(booking_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking = db.bookings.find_one({"_id": oid})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")

    db.bookings.update_one({"_id": oid}, {"$set": {"notes": payload.notes}})
    booking = db.bookings.find_one({"_id": oid})
    return _booking_with_event_type(booking, db)


@router.post("/bookings/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(
    booking_id: str,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_db),
):
    try:
        oid = _oid(booking_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking = db.bookings.find_one({"_id": oid})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking["status"] == "cancelled":
        return _booking_with_event_type(booking, db)

    db.bookings.update_one({"_id": oid}, {"$set": {"status": "cancelled"}})
    booking = db.bookings.find_one({"_id": oid})
    enriched = _booking_with_event_type(booking, db)

    background_tasks.add_task(
        send_email_background,
        action="cancelled",
        recipient=booking["booker_email"],
        event_title=enriched["event_type"]["title"],
        start_time=booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
        meeting_url=None,
    )
    _cancel_payload = {
        "booker_name": enriched["booker_name"],
        "booker_email": enriched["booker_email"],
        "event_title": enriched["event_type"]["title"],
        "start_time": booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
        "meeting_url": "",
        "notes": enriched.get("notes", ""),
    }
    background_tasks.add_task(fire_webhooks, db, "booking.cancelled", _cancel_payload)
    background_tasks.add_task(fire_workflow_actions, db, "booking.cancelled", _cancel_payload)
    return enriched


@router.post("/bookings/{booking_id}/reschedule", response_model=BookingRead)
def reschedule_booking(
    booking_id: str,
    payload: BookingReschedule,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_db),
):
    try:
        oid = _oid(booking_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking = db.bookings.find_one({"_id": oid})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot reschedule a cancelled booking.")

    event_type = db.event_types.find_one({"_id": _oid(booking["event_type_id"])})
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")

    et_dict = _doc(event_type)
    timezone_name = get_timezone(db)
    start_utc = _ensure_slot_available(db, et_dict, payload.start_time, timezone_name)

    new_end = start_utc + timedelta(minutes=event_type["duration"])
    db.bookings.update_one({"_id": oid}, {"$set": {"start_time": start_utc, "end_time": new_end}})
    booking = db.bookings.find_one({"_id": oid})
    enriched = _booking_with_event_type(booking, db)

    background_tasks.add_task(
        send_email_background,
        action="rescheduled",
        recipient=booking["booker_email"],
        event_title=enriched["event_type"]["title"],
        start_time=booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
        meeting_url=booking.get("meeting_url") or None,
    )
    _reschedule_payload = {
        "booker_name": enriched["booker_name"],
        "booker_email": enriched["booker_email"],
        "event_title": enriched["event_type"]["title"],
        "start_time": booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
        "meeting_url": booking.get("meeting_url", ""),
        "notes": enriched.get("notes", ""),
    }
    background_tasks.add_task(fire_webhooks, db, "booking.rescheduled", _reschedule_payload)
    background_tasks.add_task(fire_workflow_actions, db, "booking.rescheduled", _reschedule_payload)
    return enriched
