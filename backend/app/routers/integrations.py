from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from pymongo.database import Database

from ..database import get_db
from .auth import get_current_user

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

_WEBHOOK_KEYS = {"slack", "discord", "teams_notify", "generic_webhook"}
_VIDEO_KEYS = {"zoom", "teams", "webex"}
_OAUTH_KEYS = {"google_calendar", "outlook", "apple_calendar", "google_meet"}


def _key_to_type(key: str) -> str:
    if key in _WEBHOOK_KEYS:
        return "webhook"
    if key in _VIDEO_KEYS:
        return "video_url"
    if key in _OAUTH_KEYS:
        return "oauth"
    return "other"


def _utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _auth(authorization: str, db: Database):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    return get_current_user(authorization[len("Bearer "):], db)


class IntegrationSave(BaseModel):
    config: dict[str, Any] = {}


@router.get("")
def list_integrations(authorization: str = Header(default=""), db: Database = Depends(get_db)):
    user = _auth(authorization, db)
    user_id = str(user["_id"])
    docs = list(db.integrations.find({"user_id": user_id}))
    return [
        {
            "key": d["key"],
            "type": d.get("type", "other"),
            "config": d.get("config", {}),
            "connected_at": d["connected_at"].isoformat() if d.get("connected_at") else None,
        }
        for d in docs
    ]


@router.post("/{key}")
def save_integration(
    key: str,
    payload: IntegrationSave,
    authorization: str = Header(default=""),
    db: Database = Depends(get_db),
):
    user = _auth(authorization, db)
    user_id = str(user["_id"])
    integration_type = _key_to_type(key)
    db.integrations.update_one(
        {"user_id": user_id, "key": key},
        {"$set": {
            "user_id": user_id,
            "key": key,
            "type": integration_type,
            "config": payload.config,
            "connected_at": _utcnow(),
        }},
        upsert=True,
    )
    return {"ok": True, "key": key, "type": integration_type}


@router.delete("/{key}")
def delete_integration(
    key: str,
    authorization: str = Header(default=""),
    db: Database = Depends(get_db),
):
    user = _auth(authorization, db)
    user_id = str(user["_id"])
    db.integrations.delete_one({"user_id": user_id, "key": key})
    return {"ok": True}


@router.post("/{key}/test")
async def test_integration(
    key: str,
    authorization: str = Header(default=""),
    db: Database = Depends(get_db),
):
    user = _auth(authorization, db)
    user_id = str(user["_id"])
    integration = db.integrations.find_one({"user_id": user_id, "key": key})
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not connected.")

    config = integration.get("config", {})
    if not config.get("webhook_url"):
        raise HTTPException(status_code=400, detail="No webhook URL configured for this integration.")

    from ..services.webhook_service import fire_single_webhook
    await fire_single_webhook(integration, "booking.confirmed", {
        "booker_name": "Test Guest",
        "booker_email": "test@example.com",
        "event_title": "Test Meeting (webhook test)",
        "start_time": "Wednesday, January 01, 2025 at 10:00 AM",
        "meeting_url": "https://meet.example.com/test",
        "notes": "",
    })
    return {"ok": True}
