from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Booking
from ..schemas import BookingRead, BookingReschedule
from ..services.booking_service import (
    generate_slots,
    get_timezone,
    normalize_booking_start,
)
from ..services.email_service import send_email_background

router = APIRouter(prefix="/api", tags=["bookings"])


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/bookings", response_model=list[BookingRead])
def list_bookings(scope: str = "all", db: Session = Depends(get_db)):
    if scope not in {"all", "upcoming", "past"}:
        raise HTTPException(status_code=400, detail="Invalid scope. Use all, upcoming, or past.")

    now = _utcnow_naive()
    query = (
        select(Booking)
        .options(joinedload(Booking.event_type))
        .order_by(Booking.start_time.asc())
    )

    if scope == "upcoming":
        query = query.where(Booking.start_time >= now, Booking.status == "confirmed")
    elif scope == "past":
        query = query.where(Booking.start_time < now)

    return db.scalars(query).unique().all()


@router.post("/bookings/{booking_id}/cancel", response_model=BookingRead)
def cancel_booking(
    booking_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    booking = db.scalar(
        select(Booking).options(joinedload(Booking.event_type)).where(Booking.id == booking_id)
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status == "cancelled":
        return booking

    booking.status = "cancelled"
    db.commit()
    db.refresh(booking)

    background_tasks.add_task(
        send_email_background,
        action="cancelled",
        recipient=booking.booker_email,
        event_title=booking.event_type.title,
        start_time=booking.start_time.strftime("%A, %B %d, %Y at %I:%M %p"),
        meeting_url=None,
    )

    return booking


@router.post("/bookings/{booking_id}/reschedule", response_model=BookingRead)
def reschedule_booking(
    booking_id: int,
    payload: BookingReschedule,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    booking = db.scalar(
        select(Booking).options(joinedload(Booking.event_type)).where(Booking.id == booking_id)
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    if booking.status == "cancelled":
        raise HTTPException(status_code=400, detail="Cannot reschedule a cancelled booking.")

    timezone_name = get_timezone(db)
    start_utc = normalize_booking_start(payload.start_time, timezone_name)

    # Validate against the actual availability window for that day so a
    # reschedule cannot land on a non-working hour, blocked date, or past time.
    requested_date_local = payload.start_time.date()
    available_slots = generate_slots(db, booking.event_type, requested_date_local)
    available_utc_keys = {
        normalize_booking_start(
            datetime.fromisoformat(slot["start_time"]), timezone_name
        ).strftime("%Y-%m-%dT%H:%M:%S")
        for slot in available_slots
    }
    if start_utc.strftime("%Y-%m-%dT%H:%M:%S") not in available_utc_keys:
        raise HTTPException(status_code=400, detail="That slot is not available.")

    duration = booking.event_type.duration
    previous_start = booking.start_time
    previous_end = booking.end_time
    booking.start_time = start_utc
    booking.end_time = start_utc + timedelta(minutes=duration)

    try:
        db.commit()
        db.refresh(booking)
    except IntegrityError:
        db.rollback()
        # Restore in-memory state so subsequent reads do not see the partial change.
        booking.start_time = previous_start
        booking.end_time = previous_end
        raise HTTPException(
            status_code=409,
            detail="That slot is no longer available.",
        )

    background_tasks.add_task(
        send_email_background,
        action="rescheduled",
        recipient=booking.booker_email,
        event_title=booking.event_type.title,
        start_time=booking.start_time.strftime("%A, %B %d, %Y at %I:%M %p"),
        meeting_url=booking.meeting_url or None,
    )

    return booking
