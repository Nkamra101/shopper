from bson import ObjectId
from bson.errors import InvalidId
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.database import Database

from .config import settings

_client: MongoClient = MongoClient(settings.MONGODB_URI)


def get_db() -> Database:
    return _client[settings.MONGODB_DB_NAME]


def ensure_indexes(db: Database) -> None:
    """Create indexes on startup. All operations are idempotent."""
    db.users.create_index("email", unique=True)
    db.event_types.create_index("url_slug", unique=True)
    db.event_types.create_index([("created_at", DESCENDING)])
    db.bookings.create_index([("start_time", ASCENDING)])
    db.bookings.create_index("booker_email")
    db.bookings.create_index("event_type_id")
    db.bookings.create_index("status")
    db.blockout_dates.create_index("date", unique=True)
    db.email_otps.create_index("email")
    db.email_otps.create_index([("created_at", DESCENDING)])
    db.verification_tokens.create_index("token", unique=True)
    db.verification_tokens.create_index("email")
    db.integrations.create_index([("user_id", ASCENDING), ("key", ASCENDING)], unique=True)
    db.workflows.create_index([("created_at", ASCENDING)])


# ------------------------------------------------------------------ helpers --

def _doc(document: dict | None) -> dict | None:
    """Convert MongoDB _id (ObjectId) to string id."""
    if document is None:
        return None
    d = dict(document)
    if "_id" in d:
        d["id"] = str(d.pop("_id"))
    return d


def _oid(id_str: str) -> ObjectId:
    """Parse string to ObjectId, raising 404-friendly ValueError on bad input."""
    try:
        return ObjectId(id_str)
    except (InvalidId, TypeError):
        raise ValueError(f"Invalid id: {id_str!r}")
