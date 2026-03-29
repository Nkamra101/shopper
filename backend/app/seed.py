from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import AvailabilityRule, AvailabilitySetting, Booking, EventType


def seed_database(db: Session) -> None:
    existing_event = db.scalar(select(EventType).limit(1))
    if existing_event:
        return

    db.add(AvailabilitySetting(id=1, timezone="Asia/Kolkata"))

    rules = [
        AvailabilityRule(day_of_week=0, start_time=time(10, 0), end_time=time(17, 0), is_active=True),
        AvailabilityRule(day_of_week=1, start_time=time(10, 0), end_time=time(17, 0), is_active=True),
        AvailabilityRule(day_of_week=2, start_time=time(10, 0), end_time=time(17, 0), is_active=True),
        AvailabilityRule(day_of_week=3, start_time=time(10, 0), end_time=time(17, 0), is_active=True),
        AvailabilityRule(day_of_week=4, start_time=time(10, 0), end_time=time(15, 0), is_active=True),
    ]
    db.add_all(rules)

    events = [
        EventType(
            title="Product Discovery Call",
            description="A short intro call to understand project needs and shopping goals.",
            duration=30,
            url_slug="product-discovery",
            accent_color="#0f172a",
        ),
        EventType(
            title="Frontend Review Session",
            description="Discuss UI improvements, components, and responsive fixes.",
            duration=45,
            url_slug="frontend-review",
            accent_color="#14532d",
        ),
    ]
    db.add_all(events)
    db.flush()

    tz = ZoneInfo("Asia/Kolkata")
    now = datetime.now(tz).replace(minute=0, second=0, microsecond=0)
    upcoming_start = now + timedelta(days=1, hours=2)
    past_start = now - timedelta(days=2)

    bookings = [
        Booking(
            event_type_id=events[0].id,
            booker_name="Aarav Sharma",
            booker_email="aarav@example.com",
            notes="Looking for a beginner friendly shopping demo.",
            start_time=upcoming_start.replace(tzinfo=None),
            end_time=(upcoming_start + timedelta(minutes=events[0].duration)).replace(tzinfo=None),
            status="confirmed",
        ),
        Booking(
            event_type_id=events[1].id,
            booker_name="Neha Verma",
            booker_email="neha@example.com",
            notes="Wanted feedback on a React product page.",
            start_time=past_start.replace(tzinfo=None),
            end_time=(past_start + timedelta(minutes=events[1].duration)).replace(tzinfo=None),
            status="confirmed",
        ),
    ]
    db.add_all(bookings)
    db.commit()

