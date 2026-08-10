from datetime import time
from zoneinfo import ZoneInfo, available_timezones

from fastapi import APIRouter, Depends, HTTPException
from pymongo.database import Database

from ..config import settings
from ..database import get_db, _doc
from ..schemas import AvailabilityRead, AvailabilityRuleRead, AvailabilityUpdate
from ..security import require_owner_id

router = APIRouter(prefix="/api", tags=["availability"])


def _rule_doc(doc: dict) -> dict:
    d = _doc(doc)
    # Times are stored as "HH:MM:SS" strings; Pydantic wants time objects.
    for field in ("start_time", "end_time"):
        value = d.get(field)
        if isinstance(value, str):
            d[field] = time.fromisoformat(value)
    d.pop("owner_id", None)
    return d


def _read_availability(db: Database, owner_id: str) -> AvailabilityRead:
    setting = db.availability_settings.find_one({"owner_id": owner_id})
    if not setting:
        db.availability_settings.update_one(
            {"owner_id": owner_id},
            {"$set": {"timezone": settings.DEFAULT_TIMEZONE}},
            upsert=True,
        )
        setting = db.availability_settings.find_one({"owner_id": owner_id})

    rules = db.availability_rules.find(
        {"owner_id": owner_id},
        sort=[("day_of_week", 1), ("start_time", 1)],
    )
    return AvailabilityRead(
        timezone=setting.get("timezone", settings.DEFAULT_TIMEZONE),
        rules=[AvailabilityRuleRead(**_rule_doc(r)) for r in rules],
    )


@router.get("/timezones", response_model=list[str], tags=["meta"])
def list_timezones():
    """IANA zones, for the host's settings and the public booking page picker."""
    return sorted(available_timezones())


@router.get("/availability", response_model=AvailabilityRead)
def get_availability(
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    return _read_availability(db, owner_id)


@router.put("/availability", response_model=AvailabilityRead)
def update_availability(
    payload: AvailabilityUpdate,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    try:
        ZoneInfo(payload.timezone)
    except Exception:
        raise HTTPException(status_code=422, detail=f"Unknown timezone: {payload.timezone}")

    db.availability_settings.update_one(
        {"owner_id": owner_id},
        {"$set": {"timezone": payload.timezone}},
        upsert=True,
    )

    # Rules are replaced wholesale — the client always sends the full week.
    db.availability_rules.delete_many({"owner_id": owner_id})
    if payload.rules:
        db.availability_rules.insert_many([
            {
                "owner_id": owner_id,
                "day_of_week": r.day_of_week,
                "start_time": r.start_time.strftime("%H:%M:%S"),
                "end_time": r.end_time.strftime("%H:%M:%S"),
                "is_active": r.is_active,
            }
            for r in payload.rules
        ])

    return _read_availability(db, owner_id)
