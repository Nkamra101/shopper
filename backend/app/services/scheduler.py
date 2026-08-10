"""Background scheduler for time-based workflows.

Until now a "send a reminder 24h before the meeting" workflow only existed as a
row in the database — nothing ever fired it, because every other workflow runs
inline on a booking request. This polls for bookings entering their reminder
window and dispatches them.

Delivery is at-most-once per (booking, workflow): a unique index on
``reminder_log`` makes the insert itself the lock, so overlapping polls or a
second instance can't double-send.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from ..config import settings
from ..database import get_db, _oid
from .workflow_service import execute_scheduled_workflow

logger = logging.getLogger("schedulr.scheduler")

TIME_TRIGGERS = {"before_event", "after_event"}

# How far back to look when catching up. Bounded so a service that was asleep
# for a week doesn't suddenly send a pile of reminders for meetings that have
# already happened.
CATCHUP_WINDOW = timedelta(hours=2)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _claim(db: Database, booking_id: str, workflow_id: str) -> bool:
    """Reserve this reminder. False means someone already sent it."""
    try:
        db.reminder_log.insert_one({
            "booking_id": booking_id,
            "workflow_id": workflow_id,
            "sent_at": _utcnow(),
        })
        return True
    except DuplicateKeyError:
        return False


def _payload_for(db: Database, booking: dict) -> dict:
    event_type = None
    try:
        event_type = db.event_types.find_one({"_id": _oid(booking.get("event_type_id", ""))})
    except ValueError:
        pass

    manage_token = booking.get("manage_token", "")
    manage_url = (
        f"{settings.FRONTEND_URL.rstrip('/')}/manage/{manage_token}" if manage_token else ""
    )
    return {
        "booker_name": booking.get("booker_name", ""),
        "booker_email": booking.get("booker_email", ""),
        "event_title": (event_type or {}).get("title", "your meeting"),
        "start_time": booking["start_time"].strftime("%A, %B %d, %Y at %I:%M %p"),
        "meeting_url": booking.get("meeting_url", ""),
        "notes": booking.get("notes", ""),
        "manage_url": manage_url,
    }


async def _process_workflow(db: Database, workflow: dict, now: datetime) -> int:
    """Fire one workflow for every booking currently inside its window."""
    offset = timedelta(minutes=workflow.get("offset_minutes", 1440))
    owner_id = workflow.get("owner_id", "")
    if not owner_id:
        return 0

    if workflow.get("trigger") == "before_event":
        # Meeting starts within `offset` from now.
        target_field = "start_time"
        window_end = now + offset
        window_start = window_end - CATCHUP_WINDOW
        # Never remind about a meeting that already began.
        window_start = max(window_start, now)
        if window_start >= window_end:
            return 0
    else:  # after_event
        target_field = "end_time"
        window_end = now - offset
        window_start = window_end - CATCHUP_WINDOW
        if window_end <= window_start:
            return 0

    bookings = list(db.bookings.find({
        "owner_id": owner_id,
        "status": "confirmed",
        target_field: {"$gte": window_start, "$lte": window_end},
    }))

    sent = 0
    workflow_id = str(workflow["_id"])
    for booking in bookings:
        if not _claim(db, str(booking["_id"]), workflow_id):
            continue
        try:
            await execute_scheduled_workflow(db, workflow, _payload_for(db, booking))
            sent += 1
        except Exception:
            logger.exception(
                "Scheduled workflow %s failed for booking %s", workflow_id, booking["_id"]
            )
            # Release the claim so the next poll can retry.
            db.reminder_log.delete_one(
                {"booking_id": str(booking["_id"]), "workflow_id": workflow_id}
            )
    return sent


async def run_due_workflows(db: Database) -> int:
    """One scheduler pass. Returns how many reminders were dispatched."""
    now = _utcnow()
    workflows = list(db.workflows.find({
        "trigger": {"$in": list(TIME_TRIGGERS)},
        "active": True,
    }))
    if not workflows:
        return 0

    total = 0
    for workflow in workflows:
        try:
            total += await _process_workflow(db, workflow, now)
        except Exception:
            logger.exception("Scheduler pass failed for workflow %s", workflow.get("_id"))
    if total:
        logger.info("Dispatched %d scheduled workflow message(s)", total)
    return total


async def scheduler_loop() -> None:
    """Poll forever. Cancelled on shutdown by the lifespan handler."""
    interval = max(15, settings.REMINDER_POLL_SECONDS)
    logger.info("Reminder scheduler started (every %ds)", interval)
    try:
        while True:
            await asyncio.sleep(interval)
            try:
                # pymongo is blocking; keep it off the event loop.
                await asyncio.to_thread(_run_sync_pass)
            except Exception:
                logger.exception("Reminder scheduler pass failed")
    except asyncio.CancelledError:
        logger.info("Reminder scheduler stopped")
        raise


def _run_sync_pass() -> None:
    """Bridge: run the async pass on its own loop inside a worker thread."""
    asyncio.run(run_due_workflows(get_db()))
