"""Slot generation and availability checks.

Datetime convention:
- DB stores *naive UTC* datetimes.
- The host's timezone (from their availability_settings) is what working hours
  are interpreted in.
- Each slot is returned with an unambiguous ``start_utc`` so the invitee's
  browser can render it in whatever timezone they pick.

All reads are scoped by ``owner_id``: two hosts never see each other's rules,
blockouts or bookings.
"""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from pymongo.database import Database

from ..config import settings


def get_timezone(db: Database, owner_id: str) -> str:
    setting = db.availability_settings.find_one({"owner_id": owner_id})
    return setting["timezone"] if setting else settings.DEFAULT_TIMEZONE


def get_public_event_type(db: Database, slug: str) -> tuple[dict | None, str]:
    """Resolve a public slug to its event type and the host's timezone."""
    event_type = db.event_types.find_one({"url_slug": slug, "is_active": True})
    if not event_type:
        return None, settings.DEFAULT_TIMEZONE

    event_type = dict(event_type)
    event_type["id"] = str(event_type.pop("_id"))
    owner_id = event_type.get("owner_id", "")
    return event_type, get_timezone(db, owner_id)


def _to_naive_utc(dt_aware: datetime) -> datetime:
    return dt_aware.astimezone(timezone.utc).replace(tzinfo=None)


def _parse_time(t) -> time:
    if isinstance(t, time):
        return t
    if isinstance(t, str):
        return time.fromisoformat(t)
    raise ValueError(f"Cannot parse time: {t!r}")


def _safe_zone(timezone_name: str) -> ZoneInfo:
    try:
        return ZoneInfo(timezone_name)
    except Exception:
        return ZoneInfo(settings.DEFAULT_TIMEZONE)


def is_blocked(db: Database, owner_id: str, day: date) -> bool:
    """True when the day falls inside any of the owner's blockout ranges.

    ISO date strings compare correctly with ``$lte``/``$gte`` lexicographically,
    so ranges can be matched without deserialising every document.
    """
    day_str = day.isoformat()
    return db.blockout_dates.find_one({
        "owner_id": owner_id,
        "start_date": {"$lte": day_str},
        "end_date": {"$gte": day_str},
    }) is not None


def _windows_for_day(db: Database, owner_id: str, day_index: int) -> list[tuple[time, time]]:
    """Every active availability window for a weekday, earliest first.

    Multiple windows per day is what makes lunch breaks and split shifts work.
    """
    rules = db.availability_rules.find({
        "owner_id": owner_id,
        "day_of_week": day_index,
        "is_active": True,
    })

    windows: list[tuple[time, time]] = []
    for rule in rules:
        try:
            start = _parse_time(rule["start_time"])
            end = _parse_time(rule["end_time"])
        except (KeyError, ValueError):
            continue
        if start < end:
            windows.append((start, end))

    return sorted(windows)


def generate_slots(db: Database, event_type: dict, requested_date: date) -> list[dict]:
    """Bookable slots for one calendar day, in the host's timezone."""
    if not event_type.get("is_active", True):
        return []

    owner_id = event_type.get("owner_id", "")
    timezone_name = get_timezone(db, owner_id)
    tz = _safe_zone(timezone_name)

    max_advance = event_type.get("max_advance_days", 60)
    max_date = datetime.now(tz).date() + timedelta(days=max_advance)
    if requested_date > max_date:
        return []

    if is_blocked(db, owner_id, requested_date):
        return []

    windows = _windows_for_day(db, owner_id, requested_date.weekday())
    if not windows:
        return []

    now_utc_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    earliest_allowed_utc = now_utc_naive + timedelta(
        hours=event_type.get("min_notice_hours", 0)
    )

    buffer = timedelta(minutes=event_type.get("buffer_minutes", 0))
    slot_duration = timedelta(minutes=event_type["duration"])
    slot_step = slot_duration + buffer

    day_start_local = datetime.combine(requested_date, time.min, tz)
    day_start_utc = _to_naive_utc(day_start_local)
    day_end_utc = _to_naive_utc(day_start_local + timedelta(days=1))

    # Busy times span every event type this owner offers — a 09:00 booking on
    # "Intro Call" must also block 09:00 on "Deep Dive".
    busy = list(db.bookings.find({
        "owner_id": owner_id,
        "status": "confirmed",
        "start_time": {"$gte": day_start_utc - timedelta(days=1), "$lt": day_end_utc},
    }))
    busy_ranges = [
        (b["start_time"], b.get("end_time") or b["start_time"] + slot_duration)
        for b in busy
    ]

    slots: list[dict] = []
    for window_start, window_end in windows:
        current_local = datetime.combine(requested_date, window_start, tz)
        end_boundary_local = datetime.combine(requested_date, window_end, tz)

        while current_local + slot_duration <= end_boundary_local:
            start_utc = _to_naive_utc(current_local)
            end_utc = start_utc + slot_duration

            too_soon = start_utc <= earliest_allowed_utc
            overlaps = any(
                start_utc < busy_end and end_utc > busy_start
                for busy_start, busy_end in busy_ranges
            )

            if not too_soon and not overlaps:
                local_end = current_local + slot_duration
                slots.append({
                    "start_time": current_local.isoformat(),
                    "end_time": local_end.isoformat(),
                    "start_utc": start_utc.replace(tzinfo=timezone.utc).isoformat(),
                    "display_time": current_local.strftime("%I:%M %p").lstrip("0"),
                })
            current_local += slot_step

    slots.sort(key=lambda s: s["start_utc"])
    return slots


def normalize_booking_start(start_time_value: datetime, timezone_name: str) -> datetime:
    """Interpret an incoming start time and return naive UTC.

    A value carrying an offset (the invitee's browser sending UTC) is trusted
    as-is; a naive value is read in the host's timezone.
    """
    if start_time_value.tzinfo is None:
        start_time_value = start_time_value.replace(tzinfo=_safe_zone(timezone_name))
    return _to_naive_utc(start_time_value)


def local_date_for(start_time_value: datetime, timezone_name: str) -> date:
    """The host-local calendar day a start time falls on.

    Deriving this from the raw payload would use the *sender's* offset, so a
    22:00 IST slot sent as UTC would look like the previous day and validate
    against the wrong set of slots.
    """
    start_utc = normalize_booking_start(start_time_value, timezone_name)
    return start_utc.replace(tzinfo=timezone.utc).astimezone(_safe_zone(timezone_name)).date()


def find_slot_conflict(db: Database, owner_id: str, start_utc: datetime,
                       duration_minutes: int, exclude_booking_id=None) -> dict | None:
    """An existing confirmed booking overlapping the proposed window, if any."""
    end_utc = start_utc + timedelta(minutes=duration_minutes)
    query: dict = {
        "owner_id": owner_id,
        "status": "confirmed",
        "start_time": {"$lt": end_utc},
        "end_time": {"$gt": start_utc},
    }
    if exclude_booking_id is not None:
        query["_id"] = {"$ne": exclude_booking_id}
    return db.bookings.find_one(query)


def slot_is_available(db: Database, event_type: dict, start_time_value: datetime,
                      timezone_name: str) -> bool:
    """Whether a requested start matches a currently generated slot."""
    start_utc = normalize_booking_start(start_time_value, timezone_name)
    local_day = local_date_for(start_time_value, timezone_name)
    target = start_utc.replace(tzinfo=timezone.utc).isoformat()
    return any(
        slot["start_utc"] == target
        for slot in generate_slots(db, event_type, local_day)
    )
