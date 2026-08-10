from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

from ..database import get_db, _doc, _oid
from ..schemas import BlockoutCreate, BlockoutRead
from ..security import require_owner_id

router = APIRouter(prefix="/api", tags=["blockouts"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _blockout_doc(doc: dict) -> dict:
    d = _doc(doc)
    d.pop("owner_id", None)
    # Legacy single-day documents stored one `date` field.
    legacy_day = d.pop("date", None)
    for field, fallback in (("start_date", legacy_day), ("end_date", legacy_day)):
        value = d.get(field) or fallback
        if isinstance(value, str):
            value = date.fromisoformat(value)
        elif isinstance(value, datetime):
            value = value.date()
        d[field] = value
    return d


@router.get("/blockouts", response_model=list[BlockoutRead])
def list_blockouts(
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    docs = db.blockout_dates.find({"owner_id": owner_id}, sort=[("start_date", 1)])
    return [_blockout_doc(d) for d in docs]


@router.post("/blockouts", response_model=BlockoutRead, status_code=status.HTTP_201_CREATED)
def create_blockout(
    payload: BlockoutCreate,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    start_str = payload.start_date.isoformat()
    end_str = payload.end_date.isoformat()

    # Reject a range that touches an existing one rather than silently
    # creating overlapping blockouts the host can't tell apart.
    overlap = db.blockout_dates.find_one({
        "owner_id": owner_id,
        "start_date": {"$lte": end_str},
        "end_date": {"$gte": start_str},
    })
    if overlap:
        raise HTTPException(
            status_code=409,
            detail=(
                f"That range overlaps an existing blockout "
                f"({overlap.get('start_date')} to {overlap.get('end_date')})."
            ),
        )

    doc = {
        "owner_id": owner_id,
        "start_date": start_str,
        "end_date": end_str,
        "reason": payload.reason,
        "created_at": _utcnow(),
    }
    result = db.blockout_dates.insert_one(doc)
    return _blockout_doc(db.blockout_dates.find_one({"_id": result.inserted_id}))


@router.delete("/blockouts/{blockout_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blockout(
    blockout_id: str,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    """Delete by id, or by a YYYY-MM-DD start date for older clients."""
    query: dict = {"owner_id": owner_id}
    try:
        query["_id"] = _oid(blockout_id)
    except ValueError:
        try:
            query["start_date"] = date.fromisoformat(blockout_id).isoformat()
        except ValueError:
            raise HTTPException(status_code=404, detail="Blockout not found.")

    if db.blockout_dates.delete_one(query).deleted_count == 0:
        raise HTTPException(status_code=404, detail="Blockout not found.")
    return None
