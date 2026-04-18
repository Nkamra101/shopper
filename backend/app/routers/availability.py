from datetime import time

from fastapi import APIRouter, Depends
from pymongo.database import Database

from ..database import get_db, _doc
from ..schemas import AvailabilityRead, AvailabilityRuleRead, AvailabilityUpdate

router = APIRouter(prefix="/api", tags=["availability"])


def _rule_doc(doc: dict) -> dict:
    d = _doc(doc)
    # Convert stored "HH:MM:SS" strings back to time objects for Pydantic
    for field in ("start_time", "end_time"):
        val = d.get(field)
        if isinstance(val, str):
            d[field] = time.fromisoformat(val)
    return d


@router.get("/availability", response_model=AvailabilityRead)
def get_availability(db: Database = Depends(get_db)):
    setting = db.availability_settings.find_one({})
    if not setting:
        db.availability_settings.insert_one({"timezone": "Asia/Kolkata"})
        setting = db.availability_settings.find_one({})

    rules = list(db.availability_rules.find({}, sort=[("day_of_week", 1)]))
    return AvailabilityRead(
        timezone=setting["timezone"],
        rules=[AvailabilityRuleRead(**_rule_doc(r)) for r in rules],
    )


@router.put("/availability", response_model=AvailabilityRead)
def update_availability(payload: AvailabilityUpdate, db: Database = Depends(get_db)):
    db.availability_settings.update_one(
        {},
        {"$set": {"timezone": payload.timezone}},
        upsert=True,
    )

    db.availability_rules.delete_many({})
    if payload.rules:
        db.availability_rules.insert_many([
            {
                "day_of_week": r.day_of_week,
                "start_time": r.start_time.strftime("%H:%M:%S"),
                "end_time": r.end_time.strftime("%H:%M:%S"),
                "is_active": r.is_active,
            }
            for r in payload.rules
        ])

    rules = list(db.availability_rules.find({}, sort=[("day_of_week", 1)]))
    return AvailabilityRead(
        timezone=payload.timezone,
        rules=[AvailabilityRuleRead(**_rule_doc(r)) for r in rules],
    )
