from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from pymongo.database import Database

from ..database import get_db
from ..security import require_owner_id

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

_WEBHOOK_KEYS = {"slack", "discord", "teams_notify", "generic_webhook"}
_VIDEO_KEYS = {"zoom", "teams", "webex"}
_OAUTH_KEYS = {"google_calendar", "outlook", "apple_calendar", "google_meet"}
_KNOWN_KEYS = _WEBHOOK_KEYS | _VIDEO_KEYS | _OAUTH_KEYS


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


class IntegrationSave(BaseModel):
    config: dict[str, Any] = Field(default_factory=dict)

    @field_validator("config")
    @classmethod
    def _reject_unsafe_webhook(cls, config: dict) -> dict:
        url = str(config.get("webhook_url", "")).strip()
        if url and not url.startswith(("http://", "https://")):
            raise ValueError("The webhook URL must start with http:// or https://.")
        return config


@router.get("")
def list_integrations(
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    docs = db.integrations.find({"owner_id": owner_id})
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
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    if key not in _KNOWN_KEYS:
        raise HTTPException(status_code=404, detail=f"Unknown integration: {key}")

    integration_type = _key_to_type(key)
    db.integrations.update_one(
        {"owner_id": owner_id, "key": key},
        {"$set": {
            "owner_id": owner_id,
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
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    db.integrations.delete_one({"owner_id": owner_id, "key": key})
    return {"ok": True}


@router.post("/{key}/test")
async def test_integration(
    key: str,
    db: Database = Depends(get_db),
    owner_id: str = Depends(require_owner_id),
):
    integration = db.integrations.find_one({"owner_id": owner_id, "key": key})
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not connected.")

    if not integration.get("config", {}).get("webhook_url"):
        raise HTTPException(
            status_code=400, detail="No webhook URL configured for this integration."
        )

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
