from datetime import date
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from ..database import get_db
from ..models import BlockoutDate
from ..schemas import BlockoutDateCreate, BlockoutDateRead

router = APIRouter(prefix="/api", tags=["blockouts"])

@router.get("/blockouts", response_model=list[BlockoutDateRead])
def list_blockouts(db: Session = Depends(get_db)):
    return db.scalars(select(BlockoutDate).order_by(BlockoutDate.date.asc())).all()

@router.post("/blockouts", response_model=BlockoutDateRead, status_code=status.HTTP_201_CREATED)
def create_blockout(payload: BlockoutDateCreate, db: Session = Depends(get_db)):
    blockout = BlockoutDate(date=payload.date, reason=payload.reason)
    db.add(blockout)
    try:
        db.commit()
        db.refresh(blockout)
        return blockout
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Date is already blocked out.")

@router.delete("/blockouts/{blockout_date}", status_code=status.HTTP_204_NO_CONTENT)
def delete_blockout(blockout_date: date, db: Session = Depends(get_db)):
    blockout = db.scalar(select(BlockoutDate).where(BlockoutDate.date == blockout_date))
    if not blockout:
        raise HTTPException(status_code=404, detail="Blockout date not found.")
    db.delete(blockout)
    db.commit()
    return None
