"""Fixed-window rate limiting backed by MongoDB.

Mongo-backed rather than in-process so the limit still holds if the API ever
runs more than one worker, and so a restart doesn't reset every counter.
Documents expire via a TTL index (see ``ensure_indexes``), so nothing
accumulates.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request, status
from pymongo.database import Database

from ..config import settings

logger = logging.getLogger("schedulr.ratelimit")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def client_ip(request: Request) -> str:
    """Best-effort client IP behind Render/Netlify style proxies."""
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(
    db: Database,
    *,
    bucket: str,
    identifier: str,
    limit: int,
    window_seconds: int,
) -> None:
    """Count one hit against ``bucket:identifier``; raise 429 past ``limit``.

    Fails open: if the counter write errors, the request is allowed through
    rather than taking the whole endpoint down with the limiter.
    """
    if not settings.RATE_LIMIT_ENABLED or limit <= 0:
        return

    now = _utcnow()
    key = f"{bucket}:{identifier}"

    try:
        doc = db.rate_limits.find_one_and_update(
            {"_id": key, "expires_at": {"$gt": now}},
            {"$inc": {"count": 1}},
            return_document=True,
        )
        if doc is None:
            # No live window — start a new one. upsert races settle into a
            # single document because _id is the key.
            db.rate_limits.update_one(
                {"_id": key},
                {"$set": {"count": 1, "expires_at": now + timedelta(seconds=window_seconds)}},
                upsert=True,
            )
            return
    except Exception:
        logger.exception("Rate limit check failed for %s; allowing request", key)
        return

    if doc.get("count", 0) > limit:
        retry_after = max(1, int((doc["expires_at"] - now).total_seconds()))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )
