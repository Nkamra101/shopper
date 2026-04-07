from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Booking
from ..schemas import BookingRead

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
def cancel_booking(booking_id: int, db: Session = Depends(get_db)):
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
    return booking
