"""Execute active workflows triggered by booking lifecycle events."""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx
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
    "{{event_title}}": "event_title",
    "{{start_time}}": "start_time",
    "{{meeting_url}}": "meeting_url",
    "{{host_name}}": "host_name",
}


def _render(template: str, payload: dict) -> str:
    result = template
    for placeholder, key in _VARIABLES.items():
        result = result.replace(placeholder, str(payload.get(key, "")))
    return result


def _workflow_html(subject: str, body: str) -> str:
    safe_body = body.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>")
    return (
        f'<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px 0;">'
        f'<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif;'
        f"color:#0f172a;max-width:560px;margin:0 auto;padding:24px;background:#ffffff;\">"
        f'<h2 style="margin:0 0 16px;font-size:18px;">{subject}</h2>'
        f'<div style="line-height:1.6;color:#334155;">{safe_body}</div>'
        f'<p style="margin-top:24px;font-size:12px;color:#94a3b8;">Sent by Shopper Scheduler</p>'
        f"</div></body></html>"
    )


async def _execute_workflow(db: Database, workflow: dict, payload: dict) -> None:
    action = workflow.get("action", "")
    wf_id = str(workflow.get("_id", "?"))

    if action in ("email_guest", "email_host"):
        subject = _render(workflow.get("subject", ""), payload)
        body = _render(workflow.get("body", ""), payload)

        if not subject.strip() and not body.strip():
            logger.warning("Workflow %s: empty subject and body, skipping", wf_id)
            return

        if action == "email_guest":
            recipient: Optional[str] = payload.get("booker_email", "")
        else:
            admin = db.users.find_one({}, {"email": 1})
            recipient = admin["email"] if admin else None

        if not recipient:
            logger.warning("Workflow %s: no recipient resolved", wf_id)
            return

        html_body = _workflow_html(subject, body)
        ok = send_email_now(subject=subject, recipient=recipient, html_body=html_body, text_body=body)
        if ok:
            logger.info("Workflow %s email -> %s", wf_id, recipient)
        else:
            logger.warning("Workflow %s email failed -> %s", wf_id, recipient)

    elif action == "webhook":
        webhook_url = workflow.get("webhook_url", "").strip()
        if not webhook_url:
            logger.warning("Workflow %s: no webhook URL", wf_id)
            return
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(webhook_url, json={"trigger": workflow.get("trigger"), **payload})
                logger.info("Workflow %s webhook -> %s: %d", wf_id, webhook_url, resp.status_code)
        except Exception as exc:
            logger.warning("Workflow %s webhook failed: %r", wf_id, exc)

    else:
        logger.debug("Workflow %s: unknown action %r", wf_id, action)


async def fire_workflows(db: Database, event: str, payload: dict) -> None:
    """Fire all active workflows whose trigger matches the booking event."""
    trigger_key = _TRIGGER_MAP.get(event)
    if not trigger_key:
        return

    workflows = list(db.workflows.find({"trigger": trigger_key, "active": True}))
    if not workflows:
        return

    # Enrich payload with host name (single-owner: first admin user)
    if not payload.get("host_name"):
        admin = db.users.find_one({}, {"name": 1})
        enriched_payload = {**payload, "host_name": (admin or {}).get("name", "")}
    else:
        enriched_payload = payload

    tasks = [_execute_workflow(db, wf, enriched_payload) for wf in workflows]
    await asyncio.gather(*tasks, return_exceptions=True)
