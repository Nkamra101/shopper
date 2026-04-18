from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from pymongo.database import Database

from .config import settings


def _to_naive_utc(dt_aware: datetime) -> datetime:
    return dt_aware.astimezone(timezone.utc).replace(tzinfo=None)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def seed_database(db: Database) -> None:
    if db.event_types.count_documents({}) > 0:
        return

    # Availability settings
    if db.availability_settings.count_documents({}) == 0:
        db.availability_settings.insert_one({"timezone": settings.DEFAULT_TIMEZONE})

    # Availability rules (Mon–Fri)
    day_rules = [
        {"day_of_week": d, "start_time": "10:00:00", "end_time": "17:00:00", "is_active": True}
        for d in range(5)
    ]
    day_rules[4]["end_time"] = "15:00:00"  # Friday ends at 15:00
    db.availability_rules.insert_many(day_rules)

    # Event types
    now = _utcnow()
    event_docs = [
        {
            "title": "Product Discovery Call",
            "description": "A short intro call to understand project needs and goals.",
            "duration": 30,
            "url_slug": "product-discovery",
            "accent_color": "#6366f1",
            "is_active": True,
            "buffer_minutes": 0,
            "min_notice_hours": 0,
            "max_advance_days": 60,
            "location": "",
            "location_type": "video",
            "created_at": now,
        },
        {
            "title": "Frontend Review Session",
            "description": "Discuss UI improvements, components, and responsive fixes.",
            "duration": 45,
            "url_slug": "frontend-review",
            "accent_color": "#8b5cf6",
            "is_active": True,
            "buffer_minutes": 5,
            "min_notice_hours": 1,
            "max_advance_days": 30,
            "location": "",
            "location_type": "video",
            "created_at": now,
        },
    ]
    result = db.event_types.insert_many(event_docs)
    et_ids = result.inserted_ids

    tz = ZoneInfo(settings.DEFAULT_TIMEZONE)
    now_local = datetime.now(tz).replace(minute=0, second=0, microsecond=0)
    upcoming_start = _to_naive_utc(now_local + timedelta(days=1, hours=2))
    past_start = _to_naive_utc(now_local - timedelta(days=2))

    db.bookings.insert_many([
        {
            "event_type_id": str(et_ids[0]),
            "booker_name": "Aarav Sharma",
            "booker_email": "aarav@example.com",
            "notes": "Looking for a beginner friendly demo.",
            "status": "confirmed",
            "meeting_url": "https://meet.jit.si/shopper-demo-1",
            "start_time": upcoming_start,
            "end_time": upcoming_start + timedelta(minutes=30),
            "created_at": now,
        },
        {
            "event_type_id": str(et_ids[1]),
            "booker_name": "Neha Verma",
            "booker_email": "neha@example.com",
            "notes": "Wanted feedback on a React product page.",
            "status": "confirmed",
            "meeting_url": "https://meet.jit.si/shopper-demo-2",
            "start_time": past_start,
            "end_time": past_start + timedelta(minutes=45),
            "created_at": now,
        },
    ])
