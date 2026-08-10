import csv
import io
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pymongo.database import Database

from ..database import get_db, _doc, _oid
from ..schemas import AdminBookingCreate, BookingRead, BookingReschedule
from ..security import require_owner_id
from ..serializers import booking_with_event_type
from ..services.booking_service import (
    find_slot_conflict,
    get_timezone,
    normalize_booking_start,
)
from ..services.email_service import send_email_background
from ..services.webhook_service import fire_webhooks
from ..services.workflow_service import fire_workflows as fire_workflow_actions

router = APIRouter(prefix="/api", tags=["bookings"])

VALID_SCOPES = {"all", "upcoming", "past", "cancelled"}


class NotesUpdate(BaseModel):
    notes: str = Field(default="", max_length=2000)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _owned_booking(db: Database, booking_id: str, owner_id: str) -> dict:
    try:
        oid = _oid(booking_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Booking not found.")

    booking = db.bookings.find_one({"_id": oid, "owner_id": owner_id})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return booking


def build_booking_document(
    event_type: dict, payload, start_utc: datetime, owner_id: str, answers=None
) -> dict:
    """The canonical booking shape, shared by the admin and public flows."""
    return {
        "owner_id": owner_id,
        "event_type_id": event_type["id"],
        "booker_name": payload.booker_name,
        "booker_email": payload.booker_email,
        "notes": payload.notes,
        "status": "confirmed",
        "meeting_url": f"https://meet.jit.si/shopper-{uuid.uuid4().hex[:12]}",
        "start_time": start_utc,
        "end_time": start_utc + timedelta(minutes=event_type["duration"]),
        "answers": answers or [],
        "manage_token": secrets.token_urlsafe(24),
        "created_at": _utcnow(),
    }


def event_payload_for(enriched: dict, booking: dict, *, include_meeting_url: bool = True) -> dict:
    """Flat payload handed to webhooks and workflow templates."""
    return {
        "booker_name": enriched["booker_name"],
        "booker_email": enriched["booker_email"],
        "event_title": enriched["event_type"]["title"],
        "start_time": booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
        "meeting_url": booking.get("meeting_url", "") if include_meeting_url else "",
        "notes": enriched.get("notes", ""),
    }


def build_booking_query(owner_id: str, scope: str, search: str | None,
                        event_type_id: str | None) -> dict:
    now = _utcnow()
    query: dict = {"owner_id": owner_id}

    if scope == "upcoming":
        query.update({"start_time": {"$gte": now}, "status": "confirmed"})
    elif scope == "past":
        query.update({"start_time": {"$lt": now}, "status": {"$ne": "cancelled"}})
    elif scope == "cancelled":
        query["status"] = "cancelled"

    if event_type_id:
        query["event_type_id"] = event_type_id

    if search:
        # Escaped so a stray "(" in a name can't break the query.
        import re
        pattern = re.escape(search.strip())
        if pattern:
            query["$or"] = [
                {"booker_name": {"$regex": pattern, "$options": "i"}},
                {"booker_email": {"$regex": pattern, "$options": "i"}},
                {"notes": {"$regex": pattern, "$options": "i"}},
            ]
    return query


@router.get("/bookings", response_model=list[BookingRead])
def list_bookings(
    scope: str = "all",
    search: str | None = Query(default=None, max_length=120),
    event_type_id: str | None = Query(default=None, max_length=64),
    limit: int = Query(default=500, ge=1, le=2000),
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    if scope not in VALID_SCOPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scope. Use one of: {', '.join(sorted(VALID_SCOPES))}.",
        )

    query = build_booking_query(owner_id, scope, search, event_type_id)
    bookings = db.bookings.find(query, sort=[("start_time", 1)], limit=limit)
    return [booking_with_event_type(b, db) for b in bookings]


@router.get("/bookings/export.csv", response_class=StreamingResponse)
def export_bookings_csv(
    scope: str = "all",
    search: str | None = Query(default=None, max_length=120),
    event_type_id: str | None = Query(default=None, max_length=64),
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    """Download the current booking view as CSV."""
    if scope not in VALID_SCOPES:
        raise HTTPException(status_code=400, detail="Invalid scope.")

    query = build_booking_query(owner_id, scope, search, event_type_id)
    bookings = list(db.bookings.find(query, sort=[("start_time", 1)]))
    timezone_name = get_timezone(db, owner_id)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow([
        "Booking ID", "Event", "Guest name", "Guest email", "Status",
        f"Start ({timezone_name})", "Start (UTC)", "Duration (min)",
        "Meeting URL", "Notes", "Answers", "Booked at (UTC)",
    ])

    from zoneinfo import ZoneInfo
    try:
        host_zone = ZoneInfo(timezone_name)
    except Exception:
        host_zone = timezone.utc

    for booking in bookings:
        enriched = booking_with_event_type(booking, db)
        start = booking["start_time"]
        local_start = start.replace(tzinfo=timezone.utc).astimezone(host_zone)
        duration = int((booking["end_time"] - start).total_seconds() // 60)
        answers = "; ".join(
            f"{a.get('label') or a.get('question_id')}: {a.get('value', '')}"
            for a in enriched.get("answers", [])
        )
        writer.writerow([
            enriched["id"],
            enriched["event_type"]["title"],
            enriched["booker_name"],
            enriched["booker_email"],
            enriched["status"],
            local_start.strftime("%Y-%m-%d %H:%M"),
            start.strftime("%Y-%m-%d %H:%M"),
            duration,
            enriched.get("meeting_url", ""),
            enriched.get("notes", ""),
            answers,
            booking["created_at"].strftime("%Y-%m-%d %H:%M") if booking.get("created_at") else "",
        ])

    buffer.seek(0)
    filename = f"shopper-bookings-{datetime.now(timezone.utc):%Y-%m-%d}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/bookings", response_model=BookingRead)
def create_booking_admin(
    payload: AdminBookingCreate,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    try:
        event_type_doc_raw = db.event_types.find_one(
            {"_id": _oid(payload.event_type_id), "owner_id": owner_id}
        )
    except ValueError:
        event_type_doc_raw = None

    if not event_type_doc_raw:
        raise HTTPException(status_code=404, detail="Event type not found.")

    event_type = _doc(event_type_doc_raw)
    if not event_type.get("is_active", True):
        raise HTTPException(status_code=400, detail="This event type is currently paused.")

    timezone_name = get_timezone(db, owner_id)
    start_utc = normalize_booking_start(payload.start_time, timezone_name)

    # The host may double-book themselves deliberately, but never silently:
    # only a hard conflict with an existing meeting is refused.
    if find_slot_conflict(db, owner_id, start_utc, event_type["duration"]):
        raise HTTPException(
            status_code=409,
            detail="That time overlaps an existing booking.",
        )

    booking_doc = build_booking_document(event_type, payload, start_utc, owner_id)
    result = db.bookings.insert_one(booking_doc)
    booking = db.bookings.find_one({"_id": result.inserted_id})
    enriched = booking_with_event_type(booking, db)

    if payload.send_email:
        background_tasks.add_task(
            send_email_background,
            action="booked",
            recipient=enriched["booker_email"],
            event_title=enriched["event_type"]["title"],
            start_time=booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
            meeting_url=booking.get("meeting_url"),
            manage_token=booking.get("manage_token"),
        )

    payload_dict = event_payload_for(enriched, booking)
    background_tasks.add_task(fire_webhooks, db, owner_id, "booking.confirmed", payload_dict)
    background_tasks.add_task(fire_workflow_actions, db, owner_id, "booking.confirmed", payload_dict)
    return enriched


@router.patch("/bookings/{booking_id}/notes", response_model=BookingRead)
def update_booking_notes(
    booking_id: str,
    payload: NotesUpdate,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    booking = _owned_booking(db, booking_id, owner_id)
    db.bookings.update_one({"_id": booking["_id"]}, {"$set": {"notes": payload.notes}})
    return booking_with_event_type(db.bookings.find_one({"_id": booking["_id"]}), db)


@router.post("/bookings/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(
    booking_id: str,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    booking = _owned_booking(db, booking_id, owner_id)
    if booking["status"] == "cancelled":
        return booking_with_event_type(booking, db)

    db.bookings.update_one(
        {"_id": booking["_id"]},
        {"$set": {"status": "cancelled", "cancelled_at": _utcnow(), "cancelled_by": "host"}},
    )
    booking = db.bookings.find_one({"_id": booking["_id"]})
    enriched = booking_with_event_type(booking, db)

    background_tasks.add_task(
        send_email_background,
        action="cancelled",
        recipient=booking["booker_email"],
        event_title=enriched["event_type"]["title"],
        start_time=booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
        meeting_url=None,
    )

    payload_dict = event_payload_for(enriched, booking, include_meeting_url=False)
    background_tasks.add_task(fire_webhooks, db, owner_id, "booking.cancelled", payload_dict)
    background_tasks.add_task(fire_workflow_actions, db, owner_id, "booking.cancelled", payload_dict)
    return enriched


@router.post("/bookings/{booking_id}/reschedule", response_model=BookingRead)
def reschedule_booking(
    booking_id: str,
    payload: BookingReschedule,
    background_tasks: BackgroundTasks,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    booking = _owned_booking(db, booking_id, owner_id)
    if booking["status"] == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot reschedule a cancelled booking.")

    event_type_raw = db.event_types.find_one(
        {"_id": _oid(booking["event_type_id"]), "owner_id": owner_id}
    )
    if not event_type_raw:
        raise HTTPException(status_code=404, detail="Event type not found.")

    event_type = _doc(event_type_raw)
    timezone_name = get_timezone(db, owner_id)
    start_utc = normalize_booking_start(payload.start_time, timezone_name)

    if find_slot_conflict(
        db, owner_id, start_utc, event_type["duration"], exclude_booking_id=booking["_id"]
    ):
        raise HTTPException(status_code=409, detail="That time overlaps an existing booking.")

    db.bookings.update_one(
        {"_id": booking["_id"]},
        {"$set": {
            "start_time": start_utc,
            "end_time": start_utc + timedelta(minutes=event_type["duration"]),
            "rescheduled_at": _utcnow(),
        }},
    )
    booking = db.bookings.find_one({"_id": booking["_id"]})
    enriched = booking_with_event_type(booking, db)

    background_tasks.add_task(
        send_email_background,
        action="rescheduled",
        recipient=booking["booker_email"],
        event_title=enriched["event_type"]["title"],
        start_time=booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
        meeting_url=booking.get("meeting_url") or None,
        manage_token=booking.get("manage_token"),
    )

    payload_dict = event_payload_for(enriched, booking)
    background_tasks.add_task(fire_webhooks, db, owner_id, "booking.rescheduled", payload_dict)
    background_tasks.add_task(
        fire_workflow_actions, db, owner_id, "booking.rescheduled", payload_dict
    )
    return enriched
