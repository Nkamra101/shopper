"""Demo data for a fresh install.

Only runs when SEED_ON_STARTUP is on and the database has no event types.
Everything is attached to the oldest account, so it's a no-op until someone
has registered.
"""

import logging
import secrets
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from pymongo.database import Database

from .config import settings

logger = logging.getLogger("schedulr.seed")


def _to_naive_utc(dt_aware: datetime) -> datetime:
    return dt_aware.astimezone(timezone.utc).replace(tzinfo=None)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def seed_database(db: Database) -> None:
    if db.event_types.count_documents({}) > 0:
        return

    owner = db.users.find_one({}, sort=[("created_at", 1)])
    if not owner:
        logger.info("Seed skipped: no account exists yet")
        return
    owner_id = str(owner["_id"])

    db.availability_settings.update_one(
        {"owner_id": owner_id},
        {"$set": {"timezone": settings.DEFAULT_TIMEZONE}},
        upsert=True,
    )

    # Mon–Fri, with a lunch break — showing off multi-window availability.
    rules = []
    for day in range(5):
        rules.append({
            "owner_id": owner_id, "day_of_week": day,
            "start_time": "10:00:00", "end_time": "13:00:00", "is_active": True,
        })
        rules.append({
            "owner_id": owner_id, "day_of_week": day,
            "start_time": "14:00:00", "end_time": "17:00:00", "is_active": True,
        })
    db.availability_rules.delete_many({"owner_id": owner_id})
    db.availability_rules.insert_many(rules)

    now = _utcnow()
    event_docs = [
        {
            "owner_id": owner_id,
            "title": "Product Discovery Call",
            "description": "A short intro call to understand project needs and goals.",
            "duration": 30,
            "url_slug": "product-discovery",
            "accent_color": "#18181b",
            "is_active": True,
            "buffer_minutes": 0,
            "min_notice_hours": 0,
            "max_advance_days": 60,
            "location": "",
            "location_type": "video",
            "questions": [
                {
                    "id": "company",
                    "label": "What company are you with?",
                    "type": "text",
                    "required": False,
                    "placeholder": "Acme Inc.",
                    "options": [],
                },
                {
                    "id": "topic",
                    "label": "What would you like to cover?",
                    "type": "textarea",
                    "required": True,
                    "placeholder": "A sentence or two is plenty",
                    "options": [],
                },
            ],
            "created_at": now,
        },
        {
            "owner_id": owner_id,
            "title": "Frontend Review Session",
            "description": "Discuss UI improvements, components, and responsive fixes.",
            "duration": 45,
            "url_slug": "frontend-review",
            "accent_color": "#18181b",
            "is_active": True,
            "buffer_minutes": 5,
            "min_notice_hours": 1,
            "max_advance_days": 30,
            "location": "",
            "location_type": "video",
            "questions": [],
            "created_at": now,
        },
    ]
    event_ids = db.event_types.insert_many(event_docs).inserted_ids

    tz = ZoneInfo(settings.DEFAULT_TIMEZONE)
    now_local = datetime.now(tz).replace(minute=0, second=0, microsecond=0)
    upcoming_start = _to_naive_utc(now_local + timedelta(days=1, hours=2))
    past_start = _to_naive_utc(now_local - timedelta(days=2))

    db.bookings.insert_many([
        {
            "owner_id": owner_id,
            "event_type_id": str(event_ids[0]),
            "booker_name": "Aarav Sharma",
            "booker_email": "aarav@example.com",
            "notes": "Looking for a beginner friendly demo.",
            "status": "confirmed",
            "meeting_url": "https://meet.jit.si/shopper-demo-1",
            "start_time": upcoming_start,
            "end_time": upcoming_start + timedelta(minutes=30),
            "answers": [],
            "manage_token": secrets.token_urlsafe(24),
            "created_at": now,
        },
        {
            "owner_id": owner_id,
            "event_type_id": str(event_ids[1]),
            "booker_name": "Neha Verma",
            "booker_email": "neha@example.com",
            "notes": "Wanted feedback on a React product page.",
            "status": "confirmed",
            "meeting_url": "https://meet.jit.si/shopper-demo-2",
            "start_time": past_start,
            "end_time": past_start + timedelta(minutes=45),
            "answers": [],
            "manage_token": secrets.token_urlsafe(24),
            "created_at": now,
        },
    ])
    logger.info("Seeded demo data for %s", owner.get("email"))
