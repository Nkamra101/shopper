"""Idempotent data migrations run at startup.

The app began life single-tenant: every event type, booking, availability rule
and workflow was a global document. These migrations move that data under an
``owner_id`` so each account gets its own scheduling world, and backfill the
fields newer features depend on.

Every step is safe to run repeatedly and safe to run on an empty database.
"""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timezone

from pymongo.database import Database

logger = logging.getLogger("schedulr.migrations")

# Collections that were global and now belong to a single owner.
OWNED_COLLECTIONS = (
    "event_types",
    "availability_settings",
    "availability_rules",
    "blockout_dates",
    "bookings",
    "workflows",
)

# Legacy indexes whose shape blocks the multi-tenant schema.
_STALE_INDEXES = (
    ("blockout_dates", "date_1"),          # unique on date alone: only one user could block a day
    ("integrations", "user_id_1_key_1"),   # replaced by owner_id + key
    ("availability_rules", "day_of_week_1"),
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _primary_owner_id(db: Database) -> str | None:
    """The account that inherits pre-multi-tenant data: the oldest user."""
    user = db.users.find_one({}, sort=[("created_at", 1)])
    return str(user["_id"]) if user else None


def _drop_stale_indexes(db: Database) -> None:
    for collection_name, index_name in _STALE_INDEXES:
        try:
            db[collection_name].drop_index(index_name)
            logger.info("Dropped stale index %s.%s", collection_name, index_name)
        except Exception:
            # Index already absent — the normal case after the first run.
            pass


def _clear_blank_booking_usernames(db: Database) -> None:
    """Empty-string usernames collide under a unique index; unset them.

    A sparse unique index skips missing fields but still indexes ``""``, so
    every user who never chose a username would collide with every other.
    """
    result = db.users.update_many(
        {"booking_username": ""}, {"$unset": {"booking_username": ""}}
    )
    if result.modified_count:
        logger.info("Cleared %d blank booking usernames", result.modified_count)


def _assign_owner(db: Database, owner_id: str) -> None:
    for collection_name in OWNED_COLLECTIONS:
        result = db[collection_name].update_many(
            {"owner_id": {"$exists": False}}, {"$set": {"owner_id": owner_id}}
        )
        if result.modified_count:
            logger.info(
                "Assigned %d orphaned %s documents to owner %s",
                result.modified_count, collection_name, owner_id,
            )


def _migrate_integrations(db: Database) -> None:
    """Integrations used ``user_id``; everything else now uses ``owner_id``."""
    result = db.integrations.update_many(
        {"user_id": {"$exists": True}, "owner_id": {"$exists": False}},
        {"$rename": {"user_id": "owner_id"}},
    )
    if result.modified_count:
        logger.info("Renamed user_id -> owner_id on %d integrations", result.modified_count)


def _migrate_blockouts_to_ranges(db: Database) -> None:
    """Single-day blockouts become one-day ranges."""
    legacy = list(db.blockout_dates.find({"date": {"$exists": True}}))
    for doc in legacy:
        day = doc["date"]
        if isinstance(day, datetime):
            day = day.date().isoformat()
        db.blockout_dates.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "start_date": doc.get("start_date") or day,
                    "end_date": doc.get("end_date") or day,
                },
                "$unset": {"date": ""},
            },
        )
    if legacy:
        logger.info("Converted %d single-day blockouts to date ranges", len(legacy))


def _backfill_manage_tokens(db: Database) -> None:
    """Existing bookings predate invitee self-service and have no token."""
    pending = list(
        db.bookings.find({"manage_token": {"$exists": False}}, {"_id": 1})
    )
    for doc in pending:
        db.bookings.update_one(
            {"_id": doc["_id"]},
            {"$set": {"manage_token": secrets.token_urlsafe(24)}},
        )
    if pending:
        logger.info("Backfilled manage tokens for %d bookings", len(pending))


def _backfill_booking_denormalized_fields(db: Database) -> None:
    """Newer code reads these; older documents predate them."""
    db.bookings.update_many(
        {"answers": {"$exists": False}}, {"$set": {"answers": []}}
    )
    db.event_types.update_many(
        {"questions": {"$exists": False}}, {"$set": {"questions": []}}
    )
    db.workflows.update_many(
        {"offset_minutes": {"$exists": False}}, {"$set": {"offset_minutes": 1440}}
    )


def run_migrations(db: Database) -> None:
    """Bring an existing database up to the current schema. Idempotent."""
    started = _utcnow()

    _drop_stale_indexes(db)
    _clear_blank_booking_usernames(db)
    _migrate_integrations(db)
    _migrate_blockouts_to_ranges(db)
    _backfill_manage_tokens(db)
    _backfill_booking_denormalized_fields(db)

    owner_id = _primary_owner_id(db)
    if owner_id:
        _assign_owner(db, owner_id)
    else:
        # Fresh install with no accounts yet. Any pre-existing orphaned data
        # would be seed data; the first registered user claims it on next boot.
        logger.info("No users yet — skipping owner backfill")

    elapsed_ms = int((_utcnow() - started).total_seconds() * 1000)
    logger.info("Migrations complete in %dms", elapsed_ms)


def claim_orphaned_data(db: Database, owner_id: str) -> None:
    """Give any still-unowned documents to a newly registered first user.

    Only meaningful on a database that was seeded before anyone signed up.
    """
    if db.users.count_documents({}) != 1:
        return
    _assign_owner(db, owner_id)
