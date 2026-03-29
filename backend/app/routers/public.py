from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Booking
from ..schemas import BookingCreate, BookingRead, PublicEventTypeRead, SlotRead
from ..services.booking_service import generate_slots, get_public_event_type, get_timezone

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

    requested_date = datetime.strptime(date, "%Y-%m-%d").date()
    return generate_slots(db, event_type, requested_date)


@router.post("/event-types/{slug}/book", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
def create_booking(slug: str, payload: BookingCreate, db: Session = Depends(get_db)):
    event_type, timezone_name = get_public_event_type(db, slug)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")

    requested_date = payload.start_time.date()
    available_slots = generate_slots(db, event_type, requested_date)
    selected_key = payload.start_time.strftime("%Y-%m-%dT%H:%M:%S")
    valid_slot = next(
        (
            slot
            for slot in available_slots
            if datetime.fromisoformat(slot["start_time"]).strftime("%Y-%m-%dT%H:%M:%S") == selected_key
        ),
        None,
    )
    if not valid_slot:
        raise HTTPException(status_code=400, detail="That slot is no longer available.")

    booking = Booking(
        event_type_id=event_type.id,
        booker_name=payload.booker_name,
        booker_email=payload.booker_email,
        notes=payload.notes,
        status="confirmed",
        start_time=payload.start_time.replace(tzinfo=None),
        end_time=datetime.fromisoformat(valid_slot["end_time"]).replace(tzinfo=None),
    )
    db.add(booking)
    db.commit()

    created = db.scalar(
        select(Booking).options(joinedload(Booking.event_type)).where(Booking.id == booking.id)
    )
    return created


@router.get("/bookings/{booking_id}", response_model=BookingRead)
def get_booking(booking_id: int, db: Session = Depends(get_db)):
    booking = db.scalar(select(Booking).options(joinedload(Booking.event_type)).where(Booking.id == booking_id))
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found.")
    return booking

