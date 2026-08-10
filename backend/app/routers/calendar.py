"""Private iCal subscription feed.

The feed is addressed by an unguessable per-user token rather than the public
booking username: the earlier username-addressed feed exposed every booking on
the instance — guest names, emails and notes included — to anyone who could
guess a username.
"""

import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pymongo.database import Database

from ..config import settings
from ..database import get_db, _oid
from ..security import require_user

public_router = APIRouter(prefix="/api/public", tags=["calendar"])
router = APIRouter(prefix="/api/calendar", tags=["calendar"])

# How much history a freshly subscribed calendar client receives.
FEED_HISTORY = timedelta(days=90)


def _escape(value: str) -> str:
    return (
        (value or "")
        .replace("\\", "\\\\")
        .replace("\n", "\\n")
        .replace(",", "\\,")
        .replace(";", "\\;")
    )


def _fold(line: str) -> str:
    """RFC 5545 caps content lines at 75 octets; continuations start with a space."""
    if len(line) <= 73:
        return line
    chunks = [line[:73]]
    remaining = line[73:]
    while remaining:
        chunks.append(" " + remaining[:72])
        remaining = remaining[72:]
    return "\r\n".join(chunks)


def _fmt_dt(value: datetime) -> str:
    return value.strftime("%Y%m%dT%H%M%SZ")


def _ensure_calendar_token(db: Database, user: dict) -> str:
    token = user.get("calendar_token")
    if not token:
        token = secrets.token_urlsafe(24)
        db.users.update_one({"_id": user["_id"]}, {"$set": {"calendar_token": token}})
    return token


@router.get("/feed", summary="Get this account's private iCal subscription URL")
def get_feed_url(user: dict = Depends(require_user), db: Database = Depends(get_db)):
    token = _ensure_calendar_token(db, user)
    return {"url": f"{settings.API_PUBLIC_URL.rstrip('/')}/api/public/ical/{token}.ics"}


@router.post("/feed/rotate", summary="Invalidate the old feed URL and issue a new one")
def rotate_feed_url(user: dict = Depends(require_user), db: Database = Depends(get_db)):
    token = secrets.token_urlsafe(24)
    db.users.update_one({"_id": user["_id"]}, {"$set": {"calendar_token": token}})
    return {"url": f"{settings.API_PUBLIC_URL.rstrip('/')}/api/public/ical/{token}.ics"}


@public_router.get("/ical/{token}.ics", summary="Private iCal feed")
@public_router.get("/ical/{token}", include_in_schema=False)
def get_ical_feed(token: str, db: Database = Depends(get_db)):
    user = db.users.find_one({"calendar_token": token})
    if not user:
        raise HTTPException(status_code=404, detail="Calendar feed not found.")

    owner_id = str(user["_id"])
    since = datetime.now(timezone.utc).replace(tzinfo=None) - FEED_HISTORY
    bookings = db.bookings.find(
        {"owner_id": owner_id, "status": "confirmed", "start_time": {"$gte": since}},
        sort=[("start_time", 1)],
    )

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Shopper//Shopper Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(user.get('name') or 'Shopper')} Bookings",
        "X-WR-TIMEZONE:UTC",
    ]

    for booking in bookings:
        start, end = booking.get("start_time"), booking.get("end_time")
        if not start or not end:
            continue

        event_type = None
        try:
            event_type = db.event_types.find_one({"_id": _oid(booking.get("event_type_id", ""))})
        except ValueError:
            pass
        event_type = event_type or {}

        meeting_url = booking.get("meeting_url", "")
        description_parts = [booking.get("notes", "")]
        for answer in booking.get("answers", []):
            description_parts.append(f"{answer.get('label', '')}: {answer.get('value', '')}")
        description = "\n".join(part for part in description_parts if part)

        lines += [
            "BEGIN:VEVENT",
            f"UID:{booking['_id']}@shopper",
            f"DTSTAMP:{_fmt_dt(booking.get('created_at') or start)}",
            f"DTSTART:{_fmt_dt(start)}",
            f"DTEND:{_fmt_dt(end)}",
            _fold(
                f"SUMMARY:{_escape(event_type.get('title', 'Meeting'))} with "
                f"{_escape(booking.get('booker_name', ''))}"
            ),
            _fold(f"DESCRIPTION:{_escape(description)}"),
            _fold(f"LOCATION:{_escape(meeting_url or event_type.get('location', ''))}"),
        ]
        if meeting_url:
            lines.append(_fold(f"URL:{meeting_url}"))
        lines.append("END:VEVENT")

    lines.append("END:VCALENDAR")

    return Response(
        content="\r\n".join(lines) + "\r\n",
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": "inline; filename=shopper.ics",
            "Cache-Control": "no-store, private",
        },
    )
