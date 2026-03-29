from fastapi import APIRouter, Depends
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import AvailabilityRule, AvailabilitySetting
from ..schemas import AvailabilityRead, AvailabilityRuleRead, AvailabilityUpdate

router = APIRouter(prefix="/api", tags=["availability"])


@router.get("/availability", response_model=AvailabilityRead)
def get_availability(db: Session = Depends(get_db)):
    setting = db.get(AvailabilitySetting, 1)
    if not setting:
        setting = AvailabilitySetting(id=1, timezone="Asia/Kolkata")
        db.add(setting)
        db.commit()
        db.refresh(setting)

    rules = db.scalars(select(AvailabilityRule).order_by(AvailabilityRule.day_of_week.asc())).all()
    return AvailabilityRead(timezone=setting.timezone, rules=[AvailabilityRuleRead.model_validate(rule) for rule in rules])


@router.put("/availability", response_model=AvailabilityRead)
def update_availability(payload: AvailabilityUpdate, db: Session = Depends(get_db)):
    setting = db.get(AvailabilitySetting, 1)
    if not setting:
        setting = AvailabilitySetting(id=1, timezone=payload.timezone)
        db.add(setting)
    else:
        setting.timezone = payload.timezone

    db.execute(delete(AvailabilityRule))
    for rule in payload.rules:
        db.add(AvailabilityRule(**rule.model_dump()))

    db.commit()

    rules = db.scalars(select(AvailabilityRule).order_by(AvailabilityRule.day_of_week.asc())).all()
    return AvailabilityRead(timezone=setting.timezone, rules=[AvailabilityRuleRead.model_validate(rule) for rule in rules])

