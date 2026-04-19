from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from pymongo.database import Database
from typing import Optional

from ..database import get_db, _doc, _oid

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class WorkflowCreate(BaseModel):
    name: str
    trigger: str
    action: str
    subject: str = ""
    body: str = ""
    webhook_url: str = ""
    active: bool = True


class WorkflowUpdate(WorkflowCreate):
    pass


def _fmt(doc: dict) -> dict:
    d = _doc(doc)
    d.setdefault("subject", "")
    d.setdefault("body", "")
    d.setdefault("webhook_url", "")
    d.setdefault("active", True)
    if isinstance(d.get("created_at"), datetime):
        d["created_at"] = d["created_at"].isoformat()
    if isinstance(d.get("updated_at"), datetime):
        d["updated_at"] = d["updated_at"].isoformat()
    return d


@router.get("")
def list_workflows(db: Database = Depends(get_db)):
    docs = list(db.workflows.find({}, sort=[("created_at", 1)]))
    return [_fmt(d) for d in docs]


@router.post("", status_code=201)
def create_workflow(payload: WorkflowCreate, db: Database = Depends(get_db)):
    if not payload.name.strip():
        raise HTTPException(status_code=422, detail="Workflow name is required.")
    now = _utcnow()
    doc = {**payload.model_dump(), "created_at": now, "updated_at": now}
    result = db.workflows.insert_one(doc)
    return _fmt(db.workflows.find_one({"_id": result.inserted_id}))


@router.put("/{workflow_id}")
def update_workflow(workflow_id: str, payload: WorkflowUpdate, db: Database = Depends(get_db)):
    try:
        oid = _oid(workflow_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    if not db.workflows.find_one({"_id": oid}):
        raise HTTPException(status_code=404, detail="Workflow not found.")
    db.workflows.update_one({"_id": oid}, {"$set": {**payload.model_dump(), "updated_at": _utcnow()}})
    return _fmt(db.workflows.find_one({"_id": oid}))


@router.patch("/{workflow_id}/toggle")
def toggle_workflow(workflow_id: str, db: Database = Depends(get_db)):
    try:
        oid = _oid(workflow_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    doc = db.workflows.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    db.workflows.update_one({"_id": oid}, {"$set": {"active": not doc.get("active", True), "updated_at": _utcnow()}})
    return _fmt(db.workflows.find_one({"_id": oid}))


@router.delete("/{workflow_id}", status_code=204)
def delete_workflow(workflow_id: str, db: Database = Depends(get_db)):
    try:
        oid = _oid(workflow_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    result = db.workflows.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Workflow not found.")
