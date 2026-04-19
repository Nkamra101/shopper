import asyncio
import logging

import httpx
from pymongo.database import Database

logger = logging.getLogger("schedulr.webhooks")


async def fire_single_webhook(integration_doc: dict, event: str, payload: dict) -> None:
    config = integration_doc.get("config", {})
    webhook_url = config.get("webhook_url", "")
    if not webhook_url:
        return
    fmt = config.get("format", "json")
    await _fire_single(integration_doc.get("key", "webhook"), webhook_url, fmt, event, payload)


async def fire_webhooks(db: Database, event: str, payload: dict) -> None:
    integrations = list(db.integrations.find({"type": "webhook"}))
    tasks = []
    for integration in integrations:
        config = integration.get("config", {})
        subscribed = config.get("events", ["booking.confirmed", "booking.cancelled", "booking.rescheduled"])
        if event not in subscribed:
            continue
        webhook_url = config.get("webhook_url", "")
        if not webhook_url:
            continue
        fmt = config.get("format", "json")
        tasks.append(_fire_single(integration.get("key", "webhook"), webhook_url, fmt, event, payload))

    if tasks:
        await asyncio.gather(*tasks, return_exceptions=True)


async def _fire_single(key: str, url: str, fmt: str, event: str, payload: dict) -> None:
    body = _format_payload(fmt, event, payload)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(url, json=body)
            logger.info("Webhook %s -> %s: %d", key, url, resp.status_code)
    except Exception as exc:
        logger.warning("Webhook %s -> %s failed: %r", key, url, exc)


def _format_payload(fmt: str, event: str, payload: dict) -> dict:
    booker = payload.get("booker_name", "Someone")
    title = payload.get("event_title", "a meeting")
    start = payload.get("start_time", "")
    action_map = {
        "booking.confirmed": "booked",
        "booking.cancelled": "cancelled",
        "booking.rescheduled": "rescheduled",
    }
    action = action_map.get(event, event.split(".")[-1] if "." in event else event)

    if fmt == "slack":
        text = f":calendar: *{booker}* {action} *{title}*"
        if start:
            text += f" on {start}"
        return {"text": text}

    if fmt == "discord":
        content = f"**{booker}** {action} **{title}**"
        if start:
            content += f" on {start}"
        return {"content": content}

    return {"event": event, **payload}
