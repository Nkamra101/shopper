"""Slot generation and availability checks.

Datetime convention:
- DB stores *naive UTC* datetimes.
- Public-facing timezone from availability_settings is used for display
  and interpreting configured working hours.
- All comparisons happen in aware datetimes, converted to UTC before
  touching the DB, then stripped of tzinfo for storage.
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from pymongo.database import Database

from ..config import settings


def get_timezone(db: Database) -> str:
    setting = db.availability_settings.find_one({})
    return setting["timezone"] if setting else settings.DEFAULT_TIMEZONE


def get_public_event_type(db: Database, slug: str) -> tuple[dict | None, str]:
    event_type = db.event_types.find_one({"url_slug": slug, "is_active": True})
    if event_type:
        event_type = dict(event_type)
        event_type["id"] = str(event_type.pop("_id"))
    return event_type, get_timezone(db)


def _to_naive_utc(dt_aware: datetime) -> datetime:
    return dt_aware.astimezone(timezone.utc).replace(tzinfo=None)


def _parse_time(t) -> time:
    if isinstance(t, time):
        return t
    if isinstance(t, str):
        return time.fromisoformat(t)
    raise ValueError(f"Cannot parse time: {t!r}")


def generate_slots(db: Database, event_type: dict, requested_date: date) -> list[dict]:
    if not event_type.get("is_active", True):
        return []

    timezone_name = get_timezone(db)
    tz = ZoneInfo(timezone_name)
    day_index = requested_date.weekday()

    rule = db.availability_rules.find_one({"day_of_week": day_index, "is_active": True})
    if not rule:
        return []

    # Check blockout
    date_str = requested_date.isoformat()
    if db.blockout_dates.find_one({"date": date_str}):
        return []

    now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)

    min_notice_delta = timedelta(hours=event_type.get("min_notice_hours", 0))
    earliest_allowed_utc = now_utc_naive + min_notice_delta

    max_advance = event_type.get("max_advance_days", 60)
    max_date = datetime.now(timezone.utc).date() + timedelta(days=max_advance)
    if requested_date > max_date:
        return []

    buffer = timedelta(minutes=event_type.get("buffer_minutes", 0))
    slot_step = timedelta(minutes=event_type["duration"]) + buffer
    slot_duration = timedelta(minutes=event_type["duration"])

    start_time = _parse_time(rule["start_time"])
    end_time = _parse_time(rule["end_time"])

    start_at_local = datetime.combine(requested_date, start_time, tz)
    end_boundary_local = datetime.combine(requested_date, end_time, tz)

    day_start_local = datetime.combine(requested_date, time.min, tz)
    day_end_local = day_start_local + timedelta(days=1)
    day_start_utc = _to_naive_utc(day_start_local)
    day_end_utc = _to_naive_utc(day_end_local)

    event_type_id = str(event_type.get("id") or event_type.get("_id", ""))
    existing_bookings = list(db.bookings.find({
        "event_type_id": event_type_id,
        "status": "confirmed",
        "start_time": {"$gte": day_start_utc, "$lt": day_end_utc},
    }))

    busy_utc_keys = {b["start_time"].strftime("%Y-%m-%dT%H:%M:%S") for b in existing_bookings}

    slots: list[dict] = []
    current_local = start_at_local

    while current_local + slot_duration <= end_boundary_local:
        current_utc_naive = _to_naive_utc(current_local)
        slot_key = current_utc_naive.strftime("%Y-%m-%dT%H:%M:%S")

        if current_utc_naive > earliest_allowed_utc and slot_key not in busy_utc_keys:
            end_local = current_local + slot_duration
            slots.append({
                "start_time": current_local.isoformat(),
                "end_time": end_local.isoformat(),
                "display_time": current_local.strftime("%I:%M %p").lstrip("0"),
            })
        current_local += slot_step

    return slots


def normalize_booking_start(start_time_value: datetime, timezone_name: str) -> datetime:
    if start_time_value.tzinfo is None:
        start_time_value = start_time_value.replace(tzinfo=ZoneInfo(timezone_name))
    return _to_naive_utc(start_time_value)
