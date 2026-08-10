"""Execute a host's workflows in response to booking events."""

from __future__ import annotations

import asyncio
import logging
from html import escape
from typing import Optional

import httpx
from bson import ObjectId
from pymongo.database import Database

from .email_service import send_email_now

logger = logging.getLogger("schedulr.workflows")

_TRIGGER_MAP = {
    "booking.confirmed": "booking_created",
    "booking.cancelled": "booking_cancelled",
    "booking.rescheduled": "booking_rescheduled",
}

_VARIABLES = {
    "{{guest_name}}": "booker_name",
    "{{guest_email}}": "booker_email",
    "{{event_title}}": "event_title",
    "{{start_time}}": "start_time",
    "{{meeting_url}}": "meeting_url",
    "{{host_name}}": "host_name",
    "{{notes}}": "notes",
    "{{manage_url}}": "manage_url",
}


def render_template(template: str, payload: dict) -> str:
    result = template
    for placeholder, key in _VARIABLES.items():
        result = result.replace(placeholder, str(payload.get(key, "")))
    return result


def workflow_html(subject: str, body: str) -> str:
    safe_body = escape(body).replace("\n", "<br>")
    return (
        f'<!doctype html><html><body style="margin:0;background:#fafafa;padding:32px 0;">'
        f'<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;'
        f'color:#18181b;max-width:520px;margin:0 auto;padding:32px;background:#ffffff;'
        f'border:1px solid #e4e4e7;border-radius:12px;">'
        f'<h2 style="margin:0 0 16px;font-size:17px;font-weight:600;">{escape(subject)}</h2>'
        f'<div style="line-height:1.6;color:#3f3f46;font-size:14px;">{safe_body}</div>'
        f'<p style="margin:28px 0 0;font-size:12px;color:#a1a1aa;">Sent by Shopper</p>'
        f"</div></body></html>"
    )


def _host_email(db: Database, owner_id: str) -> Optional[str]:
    try:
        host = db.users.find_one({"_id": ObjectId(owner_id)}, {"email": 1})
    except Exception:
        return None
    return host.get("email") if host else None


async def _execute_workflow(db: Database, workflow: dict, payload: dict) -> None:
    action = workflow.get("action", "")
    wf_id = str(workflow.get("_id", "?"))
    owner_id = workflow.get("owner_id", "")

    if action in ("email_guest", "email_host"):
        subject = render_template(workflow.get("subject", ""), payload)
        body = render_template(workflow.get("body", ""), payload)

        if not subject.strip() and not body.strip():
            logger.warning("Workflow %s: empty subject and body, skipping", wf_id)
            return

        if action == "email_guest":
            recipient = payload.get("booker_email", "")
        else:
            recipient = _host_email(db, owner_id)

        if not recipient:
            logger.warning("Workflow %s: no recipient resolved", wf_id)
            return

        ok = send_email_now(
            subject=subject or "Booking update",
            recipient=recipient,
            html_body=workflow_html(subject or "Booking update", body),
            text_body=body,
        )
        logger.info("Workflow %s email -> %s: %s", wf_id, recipient, "sent" if ok else "failed")

    elif action == "webhook":
        webhook_url = workflow.get("webhook_url", "").strip()
        if not webhook_url:
            logger.warning("Workflow %s: no webhook URL", wf_id)
            return
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    webhook_url, json={"trigger": workflow.get("trigger"), **payload}
                )
                logger.info("Workflow %s webhook -> %s: %d", wf_id, webhook_url, resp.status_code)
        except Exception as exc:
            logger.warning("Workflow %s webhook failed: %r", wf_id, exc)

    else:
        logger.debug("Workflow %s: unknown action %r", wf_id, action)


def enrich_payload(db: Database, owner_id: str, payload: dict) -> dict:
    """Add host details that email templates can reference."""
    if payload.get("host_name"):
        return payload
    try:
        host = db.users.find_one({"_id": ObjectId(owner_id)}, {"name": 1})
    except Exception:
        host = None
    return {**payload, "host_name": (host or {}).get("name", "")}


async def fire_workflows(db: Database, owner_id: str, event: str, payload: dict) -> None:
    """Run every active workflow of this owner whose trigger matches ``event``."""
    trigger_key = _TRIGGER_MAP.get(event)
    if not trigger_key or not owner_id:
        return

    workflows = list(db.workflows.find({
        "owner_id": owner_id,
        "trigger": trigger_key,
        "active": True,
    }))
    if not workflows:
        return

    enriched = enrich_payload(db, owner_id, payload)
    await asyncio.gather(
        *(_execute_workflow(db, wf, enriched) for wf in workflows),
        return_exceptions=True,
    )


async def execute_scheduled_workflow(db: Database, workflow: dict, payload: dict) -> None:
    """Entry point used by the reminder scheduler for time-based triggers."""
    enriched = enrich_payload(db, workflow.get("owner_id", ""), payload)
    await _execute_workflow(db, workflow, enriched)
