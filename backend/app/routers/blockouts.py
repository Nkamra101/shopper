from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database
from pymongo.errors import DuplicateKeyError

from ..database import get_db, _doc
from ..schemas import BlockoutDateCreate, BlockoutDateRead

router = APIRouter(prefix="/api", tags=["blockouts"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _blockout_doc(doc: dict) -> dict:
    d = _doc(doc)
    # Convert stored ISO string back to date object for Pydantic
    if isinstance(d.get("date"), str):
        d["date"] = date.fromisoformat(d["date"])
    return d


@router.get("/blockouts", response_model=list[BlockoutDateRead])
def list_blockouts(db: Database = Depends(get_db)):
    docs = db.blockout_dates.find({}, sort=[("date", 1)])
    return [_blockout_doc(d) for d in docs]


@router.post("/blockouts", response_model=BlockoutDateRead, status_code=status.HTTP_201_CREATED)
def create_blockout(payload: BlockoutDateCreate, db: Database = Depends(get_db)):
    date_str = payload.date.isoformat()
    if db.blockout_dates.find_one({"date": date_str}):
        raise HTTPException(status_code=400, detail="Date is already blocked out.")

    doc = {
        "date": date_str,
        "reason": payload.reason,
        "created_at": _utcnow(),
    }
    result = db.blockout_dates.insert_one(doc)
    return _blockout_doc(db.blockout_dates.find_one({"_id": result.inserted_id}))


@router.delete("/blockouts/{blockout_date}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blockout(blockout_date: date, db: Database = Depends(get_db)):
    result = db.blockout_dates.delete_one({"date": blockout_date.isoformat()})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blockout date not found.")
    return None
