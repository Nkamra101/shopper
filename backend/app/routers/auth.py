"""Authentication routes: password login, Google OAuth2, JWT token management."""

import hashlib
import logging
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.responses import RedirectResponse
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr
from pymongo.database import Database

from ..config import settings
from ..database import get_db, _doc, _oid

logger = logging.getLogger("schedulr.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ------------------------------------------------------------------ helpers --

def _hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _get_or_create_oauth_user(db: Database, *, email: str, name: str, avatar_url: str,
                               provider: str, provider_id: str) -> dict:
    user = db.users.find_one({"email": email})
    now = _utcnow()
    if user:
        db.users.update_one({"_id": user["_id"]}, {"$set": {
            "name": name or user.get("name", ""),
            "avatar_url": avatar_url or user.get("avatar_url", ""),
            "oauth_provider": provider,
            "oauth_provider_id": provider_id,
            "last_login": now,
        }})
        return dict(db.users.find_one({"_id": user["_id"]}))

    new_user = {
        "email": email,
        "name": name,
        "avatar_url": avatar_url,
        "hashed_password": None,
        "oauth_provider": provider,
        "oauth_provider_id": provider_id,
        "is_active": True,
        "created_at": now,
        "last_login": now,
    }
    result = db.users.insert_one(new_user)
    return dict(db.users.find_one({"_id": result.inserted_id}))


def _token_response(user: dict) -> dict:
    user_id = str(user.get("id") or user["_id"])
    token = _create_access_token({"sub": user_id, "email": user["email"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "email": user["email"],
            "name": user.get("name", ""),
            "avatar_url": user.get("avatar_url", ""),
        },
    }


# ------------------------------------------------------------------ schemas --

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdate(BaseModel):
    name: str = ""
    bio: str = ""
    title: str = ""
    company: str = ""
    website: str = ""
    twitter: str = ""
    linkedin: str = ""
    avatar_color: str = "#d06132"
    welcome_message: str = ""
    booking_username: str = ""


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


# ------------------------------------------------------------------ routes --

@router.post("/register", summary="Create a new admin account")
def register(payload: RegisterRequest, db: Database = Depends(get_db)):
    if db.users.find_one({"email": payload.email}):
        raise HTTPException(status_code=409, detail="Email already registered.")
    if len(payload.password) < 8:
        raise HTTPException(status_code=422, detail="Password must be at least 8 characters.")

    now = _utcnow()
    doc = {
        "email": payload.email,
        "name": payload.name or payload.email.split("@")[0],
        "avatar_url": "",
        "hashed_password": _hash_password(payload.password),
        "oauth_provider": None,
        "oauth_provider_id": None,
        "is_active": True,
        "created_at": now,
        "last_login": now,
    }
    result = db.users.insert_one(doc)
    user = dict(db.users.find_one({"_id": result.inserted_id}))
    logger.info("New user registered: %s", user["email"])
    return _token_response(user)


@router.post("/login", summary="Email + password login")
def login(payload: LoginRequest, db: Database = Depends(get_db)):
    user = db.users.find_one({"email": payload.email})
    if not user or not user.get("hashed_password"):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    if not _verify_password(payload.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials.")
    db.users.update_one({"_id": user["_id"]}, {"$set": {"last_login": _utcnow()}})
    return _token_response(user)


# ---------------------------------------------------------------- Google OAuth --

GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo"


@router.get("/google", summary="Redirect to Google OAuth consent screen")
def google_login():
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured.")
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "select_account",
    }
    return RedirectResponse(url=f"{GOOGLE_AUTH_URL}?{urllib.parse.urlencode(params)}")


@router.get("/google/callback", summary="Handle Google OAuth callback")
async def google_callback(code: str, db: Database = Depends(get_db)):
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google OAuth is not configured.")

    async with httpx.AsyncClient() as client:
        token_resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code",
        })
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange authorization code.")

        access_token = token_resp.json().get("access_token")
        userinfo_resp = await client.get(
            GOOGLE_USERINFO_URL,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info from Google.")
        userinfo = userinfo_resp.json()

    email = userinfo.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Google did not return an email address.")

    user = _get_or_create_oauth_user(
        db,
        email=email,
        name=userinfo.get("name", ""),
        avatar_url=userinfo.get("picture", ""),
        provider="google",
        provider_id=userinfo.get("sub", ""),
    )
    jwt_token = _create_access_token({"sub": str(user["_id"]), "email": user["email"]})
    return RedirectResponse(url=f"{settings.FRONTEND_URL}/auth/callback?token={jwt_token}")


# ------------------------------------------------------------------ /me --

def get_current_user(token: str, db: Database) -> dict:
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # API key auth (sk_live_ prefix)
    if token.startswith("sk_live_"):
        key_hash = hashlib.sha256(token.encode()).hexdigest()
        user = db.users.find_one({"api_keys.hashed": key_hash})
        if not user or not user.get("is_active"):
            raise credentials_exc
        return user

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except JWTError:
        raise credentials_exc

    try:
        user = db.users.find_one({"_id": _oid(user_id)})
    except ValueError:
        raise credentials_exc

    if not user or not user.get("is_active"):
        raise credentials_exc
    return user


@router.get("/me", summary="Return the currently authenticated user")
def me(authorization: str = Header(default=""), db: Database = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    user = get_current_user(authorization[len("Bearer "):], db)
    return {
        "id": str(user["_id"]),
        "email": user["email"],
        "name": user.get("name", ""),
        "avatar_url": user.get("avatar_url", ""),
        "oauth_provider": user.get("oauth_provider"),
        "created_at": user["created_at"].isoformat() if user.get("created_at") else None,
        # extended profile fields
        "bio": user.get("bio", ""),
        "title": user.get("title", ""),
        "company": user.get("company", ""),
        "website": user.get("website", ""),
        "twitter": user.get("twitter", ""),
        "linkedin": user.get("linkedin", ""),
        "avatar_color": user.get("avatar_color", "#d06132"),
        "welcome_message": user.get("welcome_message", ""),
        "booking_username": user.get("booking_username", ""),
    }


@router.put("/profile", summary="Update the current user's profile")
def update_profile(
    payload: ProfileUpdate,
    authorization: str = Header(default=""),
    db: Database = Depends(get_db),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    user = get_current_user(authorization[len("Bearer "):], db)

    # Ensure booking_username is unique if provided
    username = payload.booking_username.strip().lower()
    if username:
        import re
        if len(username) < 2 or not re.match(r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", username):
            raise HTTPException(status_code=422, detail="Booking username must be at least 2 characters, start and end with a letter or number, and may only contain lowercase letters, numbers, and hyphens.")
        existing = db.users.find_one({"booking_username": username, "_id": {"$ne": user["_id"]}})
        if existing:
            raise HTTPException(status_code=409, detail="That booking username is already taken.")

    db.users.update_one({"_id": user["_id"]}, {"$set": {
        "name": payload.name.strip() or user.get("name", ""),
        "bio": payload.bio,
        "title": payload.title,
        "company": payload.company,
        "website": payload.website,
        "twitter": payload.twitter,
        "linkedin": payload.linkedin,
        "avatar_color": payload.avatar_color or "#d06132",
        "welcome_message": payload.welcome_message,
        "booking_username": username,
    }})
    updated = db.users.find_one({"_id": user["_id"]})
    return {
        "id": str(updated["_id"]),
        "email": updated["email"],
        "name": updated.get("name", ""),
        "avatar_url": updated.get("avatar_url", ""),
        "bio": updated.get("bio", ""),
        "title": updated.get("title", ""),
        "company": updated.get("company", ""),
        "website": updated.get("website", ""),
        "twitter": updated.get("twitter", ""),
        "linkedin": updated.get("linkedin", ""),
        "avatar_color": updated.get("avatar_color", "#d06132"),
        "welcome_message": updated.get("welcome_message", ""),
        "booking_username": updated.get("booking_username", ""),
    }


@router.put("/change-password", summary="Change password for email-registered users")
def change_password(
    payload: ChangePasswordRequest,
    authorization: str = Header(default=""),
    db: Database = Depends(get_db),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    user = get_current_user(authorization[len("Bearer "):], db)

    if not user.get("hashed_password"):
        raise HTTPException(status_code=400, detail="Password change is only available for email/password accounts.")
    if not _verify_password(payload.current_password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=422, detail="New password must be at least 8 characters.")

    db.users.update_one({"_id": user["_id"]}, {"$set": {"hashed_password": _hash_password(payload.new_password)}})
    return {"ok": True}


# ---------------------------------------------------------------- API keys --

@router.get("/api-keys", summary="List API keys (prefix only)")
def list_api_keys(authorization: str = Header(default=""), db: Database = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    user = get_current_user(authorization[len("Bearer "):], db)
    keys = user.get("api_keys") or []
    return [
        {
            "prefix": k["prefix"],
            "created_at": k["created_at"].isoformat() if isinstance(k.get("created_at"), datetime) else k.get("created_at"),
        }
        for k in keys
    ]


@router.post("/api-keys", summary="Generate a new API key")
def generate_api_key(authorization: str = Header(default=""), db: Database = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    user = get_current_user(authorization[len("Bearer "):], db)

    raw = "sk_live_" + secrets.token_urlsafe(32)
    prefix = raw[:16]
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    now = _utcnow()

    db.users.update_one(
        {"_id": user["_id"]},
        {"$set": {"api_keys": [{"prefix": prefix, "hashed": key_hash, "created_at": now}]}},
    )
    return {"key": raw, "prefix": prefix, "created_at": now.isoformat()}


@router.delete("/api-keys", summary="Revoke all API keys")
def revoke_api_keys(authorization: str = Header(default=""), db: Database = Depends(get_db)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token.")
    user = get_current_user(authorization[len("Bearer "):], db)
    db.users.update_one({"_id": user["_id"]}, {"$set": {"api_keys": []}})
    return {"ok": True}
