from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from fastapi import BackgroundTasks

from ..database import get_db
from ..models import Booking, EventType
from ..schemas import DashboardSummary, EventTypeCreate, EventTypeRead, EventTypeUpdate
from ..services.email_service import send_email_background

router = APIRouter(prefix="/api", tags=["event-types"])


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/event-types", response_model=list[EventTypeRead])
def list_event_types(db: Session = Depends(get_db)):
    return db.scalars(select(EventType).order_by(EventType.created_at.desc())).all()


@router.post("/event-types", response_model=EventTypeRead, status_code=status.HTTP_201_CREATED)
def create_event_type(payload: EventTypeCreate, db: Session = Depends(get_db)):
    existing_slug = db.scalar(select(EventType).where(EventType.url_slug == payload.url_slug))
    if existing_slug:
        raise HTTPException(status_code=400, detail="Slug already exists.")

    event_type = EventType(**payload.model_dump())
    db.add(event_type)
    db.commit()
    db.refresh(event_type)
    return event_type


@router.put("/event-types/{event_type_id}", response_model=EventTypeRead)
def update_event_type(event_type_id: int, payload: EventTypeUpdate, db: Session = Depends(get_db)):
    event_type = db.get(EventType, event_type_id)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")

    existing_slug = db.scalar(
        select(EventType).where(
            EventType.url_slug == payload.url_slug, EventType.id != event_type_id
        )
    )
    if existing_slug:
        raise HTTPException(status_code=400, detail="Slug already exists.")

    for field, value in payload.model_dump().items():
        setattr(event_type, field, value)

    db.commit()
    db.refresh(event_type)
    return event_type


@router.delete("/event-types/{event_type_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event_type(
    event_type_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    event_type = db.get(EventType, event_type_id)
    if not event_type:
        raise HTTPException(status_code=404, detail="Event type not found.")

    # Notify all upcoming confirmed bookers that their meeting is cancelled
    # before the event type (and its bookings) are removed via cascade.
    now = _utcnow_naive()
    upcoming = db.scalars(
        select(Booking).where(
            Booking.event_type_id == event_type_id,
            Booking.status == "confirmed",
            Booking.start_time >= now,
        )
    ).all()
    event_title = event_type.title
    for booking in upcoming:
        background_tasks.add_task(
            send_email_background,
            action="cancelled",
            recipient=booking.booker_email,
            event_title=event_title,
            start_time=booking.start_time.strftime("%A, %B %d, %Y at %I:%M %p"),
            meeting_url=booking.meeting_url or None,
        )

    db.delete(event_type)
    db.commit()


@router.get("/summary", response_model=DashboardSummary)
def get_dashboard_summary(db: Session = Depends(get_db)):
    now = _utcnow_naive()
    event_types_count = db.scalar(select(func.count()).select_from(EventType)) or 0
    upcoming_count = (
        db.scalar(
            select(func.count())
            .select_from(Booking)
            .where(Booking.start_time >= now, Booking.status == "confirmed")
        )
        or 0
    )
    past_count = (
        db.scalar(
            select(func.count())
            .select_from(Booking)
            .where(Booking.start_time < now, Booking.status == "confirmed")
        )
        or 0
    )
    return DashboardSummary(
        event_types_count=event_types_count,
        upcoming_bookings_count=upcoming_count,
        past_bookings_count=past_count,
    )
