from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, model_validator
from pymongo.database import Database

from ..database import get_db, _doc, _oid
from ..security import require_owner_id

router = APIRouter(prefix="/api/workflows", tags=["workflows"])

WorkflowTrigger = Literal[
    "booking_created",
    "booking_cancelled",
    "booking_rescheduled",
    "before_event",
    "after_event",
]
WorkflowAction = Literal["email_guest", "email_host", "webhook"]


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class WorkflowCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    trigger: WorkflowTrigger
    action: WorkflowAction
    subject: str = Field(default="", max_length=200)
    body: str = Field(default="", max_length=5000)
    webhook_url: str = Field(default="", max_length=500)
    active: bool = True
    # Only meaningful for the time-based triggers.
    offset_minutes: int = Field(default=1440, ge=5, le=20160)

    @model_validator(mode="after")
    def _action_requirements(self) -> "WorkflowCreate":
        if self.action == "webhook":
            if not self.webhook_url.strip():
                raise ValueError("A webhook workflow needs a webhook URL.")
            if not self.webhook_url.startswith(("http://", "https://")):
                raise ValueError("The webhook URL must start with http:// or https://.")
        elif not self.subject.strip() and not self.body.strip():
            raise ValueError("An email workflow needs a subject or a body.")
        return self


class WorkflowUpdate(WorkflowCreate):
    pass


def _fmt(doc: dict) -> dict:
    d = _doc(doc)
    d.pop("owner_id", None)
    d.setdefault("subject", "")
    d.setdefault("body", "")
    d.setdefault("webhook_url", "")
    d.setdefault("active", True)
    d.setdefault("offset_minutes", 1440)
    for field in ("created_at", "updated_at"):
        if isinstance(d.get(field), datetime):
            d[field] = d[field].isoformat()
    return d


def _owned_workflow(db: Database, workflow_id: str, owner_id: str) -> dict:
    try:
        oid = _oid(workflow_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    doc = db.workflows.find_one({"_id": oid, "owner_id": owner_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Workflow not found.")
    return doc


@router.get("")
def list_workflows(
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    docs = db.workflows.find({"owner_id": owner_id}, sort=[("created_at", 1)])
    return [_fmt(d) for d in docs]


@router.post("", status_code=201)
def create_workflow(
    payload: WorkflowCreate,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    now = _utcnow()
    doc = {**payload.model_dump(), "owner_id": owner_id, "created_at": now, "updated_at": now}
    result = db.workflows.insert_one(doc)
    return _fmt(db.workflows.find_one({"_id": result.inserted_id}))


@router.put("/{workflow_id}")
def update_workflow(
    workflow_id: str,
    payload: WorkflowUpdate,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    existing = _owned_workflow(db, workflow_id, owner_id)
    db.workflows.update_one(
        {"_id": existing["_id"]},
        {"$set": {**payload.model_dump(), "updated_at": _utcnow()}},
    )
    return _fmt(db.workflows.find_one({"_id": existing["_id"]}))


@router.patch("/{workflow_id}/toggle")
def toggle_workflow(
    workflow_id: str,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    existing = _owned_workflow(db, workflow_id, owner_id)
    db.workflows.update_one(
        {"_id": existing["_id"]},
        {"$set": {"active": not existing.get("active", True), "updated_at": _utcnow()}},
    )
    return _fmt(db.workflows.find_one({"_id": existing["_id"]}))


@router.delete("/{workflow_id}", status_code=204)
def delete_workflow(
    workflow_id: str,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    existing = _owned_workflow(db, workflow_id, owner_id)
    db.workflows.delete_one({"_id": existing["_id"]})
