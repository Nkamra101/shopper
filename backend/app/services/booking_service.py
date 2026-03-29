from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..models import AvailabilityRule, AvailabilitySetting, Booking, EventType


def get_timezone(db: Session) -> str:
    setting = db.get(AvailabilitySetting, 1)
    return setting.timezone if setting else "Asia/Kolkata"


def get_public_event_type(db: Session, slug: str) -> tuple[EventType | None, str]:
    event_type = db.scalar(select(EventType).where(EventType.url_slug == slug))
    return event_type, get_timezone(db)


def generate_slots(db: Session, event_type: EventType, requested_date: date) -> list[dict]:
    timezone_name = get_timezone(db)
    timezone = ZoneInfo(timezone_name)
    day_index = requested_date.weekday()

    rule = db.scalar(
        select(AvailabilityRule).where(
            AvailabilityRule.day_of_week == day_index,
            AvailabilityRule.is_active.is_(True),
        )
    )
    if not rule:
        return []

    start_at = datetime.combine(requested_date, rule.start_time, timezone)
    end_boundary = datetime.combine(requested_date, rule.end_time, timezone)
    now = datetime.now(timezone)
    duration = timedelta(minutes=event_type.duration)

    day_start = datetime.combine(requested_date, datetime.min.time())
    day_end = day_start + timedelta(days=1)

    existing_bookings = db.scalars(
        select(Booking).where(
            Booking.event_type_id == event_type.id,
            Booking.status == "confirmed",
            Booking.start_time >= day_start,
            Booking.start_time < day_end,
        )
    ).all()

    busy_times = {
        booking.start_time.replace(tzinfo=timezone).strftime("%Y-%m-%dT%H:%M:%S")
        for booking in existing_bookings
    }

    slots = []
    current_start = start_at
    while current_start + duration <= end_boundary:
        slot_key = current_start.strftime("%Y-%m-%dT%H:%M:%S")
        if current_start > now and slot_key not in busy_times:
            slots.append(
                {
                    "start_time": current_start.isoformat(),
                    "end_time": (current_start + duration).isoformat(),
                    "display_time": current_start.strftime("%I:%M %p"),
                }
            )
        current_start += duration

    return slots


def is_slot_available(db: Session, event_type: EventType, start_time_value: datetime) -> bool:
    requested_date = start_time_value.date()
    slots = generate_slots(db, event_type, requested_date)
    start_key = start_time_value.strftime("%Y-%m-%dT%H:%M:%S%z")
    normalized = {datetime.fromisoformat(slot["start_time"]).strftime("%Y-%m-%dT%H:%M:%S%z") for slot in slots}
    return start_key in normalized
