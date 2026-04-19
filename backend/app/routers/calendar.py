from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pymongo.database import Database

from ..database import get_db, _oid

router = APIRouter(prefix="/api/public", tags=["calendar"])


@router.get("/ical/{booking_username}")
def get_ical_feed(booking_username: str, db: Database = Depends(get_db)):
    user = db.users.find_one({"booking_username": booking_username.lower()})
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    bookings = list(db.bookings.find({"status": "confirmed"}, sort=[("start_time", 1)]))

    def esc(s: str) -> str:
        return (s or "").replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")

    def fmt_dt(dt) -> str:
        return dt.strftime("%Y%m%dT%H%M%SZ")

    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Shopper//Shopper Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{esc(user.get('name', booking_username))} Bookings",
        "X-WR-TIMEZONE:UTC",
    ]

    for b in bookings:
        start = b.get("start_time")
        end = b.get("end_time")
        if not start or not end:
            continue

        et_doc = None
        try:
            et_doc = db.event_types.find_one({"_id": _oid(b.get("event_type_id", ""))})
        except Exception:
            pass
        et = et_doc or {}

        meeting_url = b.get("meeting_url", "")
        lines += [
            "BEGIN:VEVENT",
            f"UID:{b['_id']}@shopper",
            f"DTSTAMP:{fmt_dt(start)}",
            f"DTSTART:{fmt_dt(start)}",
            f"DTEND:{fmt_dt(end)}",
            f"SUMMARY:{esc(et.get('title', 'Meeting'))} with {esc(b.get('booker_name', ''))}",
            f"DESCRIPTION:{esc(b.get('notes', ''))}",
            f"LOCATION:{esc(meeting_url)}",
            f"URL:{meeting_url}",
            "END:VEVENT",
        ]

    lines.append("END:VCALENDAR")
    content = "\r\n".join(lines) + "\r\n"

    return Response(
        content=content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f"inline; filename={booking_username}.ics"},
    )
