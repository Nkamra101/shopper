"""Slot generation and availability checks.

Datetime convention in this project:
- The database stores *naive UTC* datetimes (timezone-unaware columns).
- The public-facing timezone comes from AvailabilitySetting and is used
  purely for display + interpreting the configured working hours.
- All comparisons happen in aware datetimes, converted to UTC before
  touching the DB, then stripped of tzinfo for storage.
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import AvailabilityRule, AvailabilitySetting, BlockoutDate, Booking, EventType


def get_timezone(db: Session) -> str:
    setting = db.get(AvailabilitySetting, 1)
    return setting.timezone if setting else settings.DEFAULT_TIMEZONE


def get_public_event_type(db: Session, slug: str) -> tuple[EventType | None, str]:
    event_type = db.scalar(select(EventType).where(EventType.url_slug == slug))
    return event_type, get_timezone(db)


def _to_naive_utc(dt_aware: datetime) -> datetime:
    """Convert an aware datetime to naive UTC for DB comparison/storage."""
    return dt_aware.astimezone(timezone.utc).replace(tzinfo=None)


def generate_slots(db: Session, event_type: EventType, requested_date: date) -> list[dict]:
    timezone_name = get_timezone(db)
    tz = ZoneInfo(timezone_name)
    day_index = requested_date.weekday()

    rule = db.scalar(
        select(AvailabilityRule).where(
            AvailabilityRule.day_of_week == day_index,
            AvailabilityRule.is_active.is_(True),
        )
    )
    if not rule:
        return []

    is_blocked = db.scalar(
        select(BlockoutDate).where(BlockoutDate.date == requested_date)
    )
    if is_blocked:
        return []

    # Build the working-hour window in the configured timezone.
    start_at_local = datetime.combine(requested_date, rule.start_time, tz)
    end_boundary_local = datetime.combine(requested_date, rule.end_time, tz)
    now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    duration = timedelta(minutes=event_type.duration)

    # Day boundary in UTC, covering the full local day.
    day_start_local = datetime.combine(requested_date, time.min, tz)
    day_end_local = day_start_local + timedelta(days=1)
    day_start_utc = _to_naive_utc(day_start_local)
    day_end_utc = _to_naive_utc(day_end_local)

    existing_bookings = db.scalars(
        select(Booking).where(
            Booking.event_type_id == event_type.id,
            Booking.status == "confirmed",
            Booking.start_time >= day_start_utc,
            Booking.start_time < day_end_utc,
        )
    ).all()

    # Busy set keyed by naive-UTC start to compare precisely.
    busy_utc_keys = {
        booking.start_time.strftime("%Y-%m-%dT%H:%M:%S") for booking in existing_bookings
    }

    slots: list[dict] = []
    current_local = start_at_local
    while current_local + duration <= end_boundary_local:
        current_utc_naive = _to_naive_utc(current_local)
        slot_key = current_utc_naive.strftime("%Y-%m-%dT%H:%M:%S")
        if current_utc_naive > now_utc_naive and slot_key not in busy_utc_keys:
            end_local = current_local + duration
            slots.append(
                {
                    "start_time": current_local.isoformat(),
                    "end_time": end_local.isoformat(),
                    "display_time": current_local.strftime("%I:%M %p").lstrip("0"),
                }
            )
        current_local += duration

    return slots


def normalize_booking_start(start_time_value: datetime, timezone_name: str) -> datetime:
    """Normalise an incoming booking start to naive UTC for DB storage.

    Accepts either an aware datetime (whose tzinfo is honoured) or a naive
    datetime (assumed to already be in the public-facing display timezone).
    """
    if start_time_value.tzinfo is None:
        start_time_value = start_time_value.replace(tzinfo=ZoneInfo(timezone_name))
    return _to_naive_utc(start_time_value)
