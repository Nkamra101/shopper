"""OTP issuance and verification.

Flow:

1. ``request_otp`` — generates a 6-digit code, stores its sha256 hash with an
   expiry, mails it to the user. Rate-limited per email so we don't blast
   inboxes (or burn through Gmail's daily quota).
2. ``verify_otp`` — checks the latest unused code for the email, marks it
   used on success, and issues a short-lived bearer token (random 32-byte
   hex string) tied to that email.
3. ``consume_verification_token`` — invoked by /book. Checks the token is
   live for the supplied email and marks it consumed so it can't be reused.

We use sha256 (not bcrypt) because the codes are 6 digits and live for ~10
minutes — the value of slowing down a brute force is dwarfed by the
``OTP_MAX_ATTEMPTS`` rate limit. Tokens themselves are stored verbatim
because they're already 256 bits of entropy.
"""

from __future__ import annotations

import hashlib
import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings
from ..models import EmailOtp, VerificationToken
from .email_service import send_otp_email

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _hash_code(code: str) -> str:
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _generate_code() -> str:
    # secrets.randbelow gives a uniform 0..999999 — zero-pad to keep length 6.
    return f"{secrets.randbelow(1_000_000):06d}"


def _normalize_email(email: str) -> str:
    return email.strip().lower()


@dataclass
class OtpRequestResult:
    sent: bool
    expires_in_seconds: int
    resend_after_seconds: int
    error: Optional[str] = None


@dataclass
class OtpVerifyResult:
    ok: bool
    token: Optional[str] = None
    expires_in_seconds: int = 0
    error: Optional[str] = None


def request_otp(db: Session, email: str) -> OtpRequestResult:
    email = _normalize_email(email)
    now = _utcnow()

    # Rate limit: refuse if a code was issued for this email in the last
    # OTP_RATE_LIMIT_SECONDS window.
    rate_window_start = now - timedelta(seconds=settings.OTP_RATE_LIMIT_SECONDS)
    recent = db.scalar(
        select(EmailOtp)
        .where(EmailOtp.email == email)
        .where(EmailOtp.created_at >= rate_window_start)
        .order_by(EmailOtp.created_at.desc())
    )
    if recent is not None:
        wait = settings.OTP_RATE_LIMIT_SECONDS - int((now - recent.created_at).total_seconds())
        return OtpRequestResult(
            sent=False,
            expires_in_seconds=settings.OTP_TTL_SECONDS,
            resend_after_seconds=max(1, wait),
            error="Please wait before requesting another code.",
        )

    code = _generate_code()
    expires_at = now + timedelta(seconds=settings.OTP_TTL_SECONDS)

    otp = EmailOtp(
        email=email,
        code_hash=_hash_code(code),
        expires_at=expires_at,
        attempts=0,
        used=False,
    )
    db.add(otp)
    db.commit()

    delivered = send_otp_email(
        recipient=email, code=code, ttl_seconds=settings.OTP_TTL_SECONDS
    )
    if not delivered:
        # Mark used so we don't leave a phantom valid code in the DB.
        otp.used = True
        db.commit()
        return OtpRequestResult(
            sent=False,
            expires_in_seconds=settings.OTP_TTL_SECONDS,
            resend_after_seconds=settings.OTP_RATE_LIMIT_SECONDS,
            error="Failed to send verification email. Please try again.",
        )

    return OtpRequestResult(
        sent=True,
        expires_in_seconds=settings.OTP_TTL_SECONDS,
        resend_after_seconds=settings.OTP_RATE_LIMIT_SECONDS,
    )


def verify_otp(db: Session, email: str, code: str) -> OtpVerifyResult:
    email = _normalize_email(email)
    code = code.strip()
    now = _utcnow()

    otp = db.scalar(
        select(EmailOtp)
        .where(EmailOtp.email == email)
        .where(EmailOtp.used.is_(False))
        .order_by(EmailOtp.created_at.desc())
    )
    if otp is None:
        return OtpVerifyResult(ok=False, error="No active code. Please request a new one.")

    if otp.expires_at <= now:
        otp.used = True
        db.commit()
        return OtpVerifyResult(ok=False, error="Code expired. Please request a new one.")

    if otp.attempts >= settings.OTP_MAX_ATTEMPTS:
        otp.used = True
        db.commit()
        return OtpVerifyResult(ok=False, error="Too many attempts. Please request a new code.")

    otp.attempts += 1

    if otp.code_hash != _hash_code(code):
        db.commit()
        remaining = settings.OTP_MAX_ATTEMPTS - otp.attempts
        if remaining <= 0:
            otp.used = True
            db.commit()
            return OtpVerifyResult(ok=False, error="Too many attempts. Please request a new code.")
        return OtpVerifyResult(ok=False, error=f"Incorrect code. {remaining} attempt(s) left.")

    # Success — burn the OTP and mint a verification token.
    otp.used = True

    token_value = secrets.token_hex(32)  # 64 chars
    token = VerificationToken(
        token=token_value,
        email=email,
        expires_at=now + timedelta(seconds=settings.VERIFICATION_TOKEN_TTL_SECONDS),
    )
    db.add(token)
    db.commit()

    return OtpVerifyResult(
        ok=True,
        token=token_value,
        expires_in_seconds=settings.VERIFICATION_TOKEN_TTL_SECONDS,
    )


def consume_verification_token(db: Session, token_value: str, email: str) -> bool:
    """Validate and burn a verification token. Returns True if it was valid."""
    email = _normalize_email(email)
    now = _utcnow()

    token = db.scalar(
        select(VerificationToken).where(VerificationToken.token == token_value)
    )
    if token is None:
        return False
    if token.consumed_at is not None:
        return False
    if token.email != email:
        return False
    if token.expires_at <= now:
        return False

    token.consumed_at = now
    db.commit()
    return True
