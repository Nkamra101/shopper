"""Password hashing, JWT issuing, and the auth dependencies used by routers.

This module is the single source of truth for "who is making this request".
Routers should depend on :func:`require_user` rather than parsing the
Authorization header themselves.
"""

from __future__ import annotations

import hashlib
import logging
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from pymongo.database import Database

from .config import settings
from .database import get_db, _oid

logger = logging.getLogger("schedulr.security")

_CREDENTIALS_EXC = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Invalid or expired token.",
    headers={"WWW-Authenticate": "Bearer"},
)

API_KEY_PREFIX = "sk_live_"


# ---------------------------------------------------------------- passwords --

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str | None) -> bool:
    if not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        # Malformed/legacy hash in the database — treat as a failed login.
        return False


# -------------------------------------------------------------------- token --

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    to_encode["exp"] = datetime.now(timezone.utc) + timedelta(
        minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def resolve_user_from_token(db: Database, token: str) -> dict:
    """Resolve a bearer credential (JWT or API key) to a user document."""
    if token.startswith(API_KEY_PREFIX):
        user = db.users.find_one({"api_keys.hashed": hash_api_key(token)})
        if not user or not user.get("is_active"):
            raise _CREDENTIALS_EXC
        return user

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        raise _CREDENTIALS_EXC

    user_id = payload.get("sub")
    if not user_id:
        raise _CREDENTIALS_EXC

    try:
        user = db.users.find_one({"_id": _oid(user_id)})
    except ValueError:
        raise _CREDENTIALS_EXC

    if not user or not user.get("is_active"):
        raise _CREDENTIALS_EXC
    return user


# -------------------------------------------------------------- dependencies --

def require_user(
    authorization: str = Header(default=""),
    db: Database = Depends(get_db),
) -> dict:
    """FastAPI dependency: the authenticated user, or 401."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return resolve_user_from_token(db, authorization[len("Bearer "):])


def require_owner_id(user: dict = Depends(require_user)) -> str:
    """FastAPI dependency: the authenticated user's id as a string.

    Every owner-scoped collection stores this value in ``owner_id``.
    """
    return str(user["_id"])
