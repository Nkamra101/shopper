"""Authentication routes: password login, Google OAuth2, JWT token management."""

import logging
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
    }
