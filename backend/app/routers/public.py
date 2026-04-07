from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Booking
from ..schemas import BookingCreate, BookingRead, PublicEventTypeRead, SlotRead
from ..services.booking_service import (
    generate_slots,
    get_public_event_type,
    normalize_booking_start,
)

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/event-types/{slug}", response_model=PublicEventTypeRead)
def get_public_event(slug: str, db: Session = Depends(get_db)):
    event_type, timezone_name = get_public_event_type(db, slug)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")

    return PublicEventTypeRead(
        id=event_type.id,
        title=event_type.title,
        description=event_type.description,
        duration=event_type.duration,
        url_slug=event_type.url_slug,
        accent_color=event_type.accent_color,
        timezone=timezone_name,
    )


@router.get("/event-types/{slug}/slots", response_model=list[SlotRead])
def get_slots(slug: str, date: str = Query(...), db: Session = Depends(get_db)):
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
def create_booking(slug: str, payload: BookingCreate, db: Session = Depends(get_db)):
    event_type, timezone_name = get_public_event_type(db, slug)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")

    # Convert the requested start into naive UTC so it can be compared and
    # stored consistently with generate_slots().
    start_utc = normalize_booking_start(payload.start_time, timezone_name)

    # Re-check availability in the same request. The partial unique index
    # below provides the final race-condition guarantee.
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

    booking = Booking(
        event_type_id=event_type.id,
        booker_name=payload.booker_name,
        booker_email=payload.booker_email,
        notes=payload.notes,
        status="confirmed",
        start_time=start_utc,
        end_time=start_utc + timedelta(minutes=event_type.duration),
    )
    db.add(booking)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="That slot was just booked by someone else. Please pick another.",
        )

    created = db.scalar(
        select(Booking).options(joinedload(Booking.event_type)).where(Booking.id == booking.id)
    )
    return created


@router.get("/bookings/{booking_id}", response_model=BookingRead)
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.scalar(
        select(Booking).options(joinedload(Booking.event_type)).where(Booking.id == booking_id)
    )
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return booking
