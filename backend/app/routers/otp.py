"""Public OTP endpoints used by the booker before they're allowed to /book."""

from fastapi import APIRouter, Depends, HTTPException, status
from pymongo.database import Database

from ..config import settings
from ..database import get_db
from ..schemas import OtpRequest, OtpRequestResponse, OtpVerify, OtpVerifyResponse
from ..services import otp_service

router = APIRouter(prefix="/api/public/otp", tags=["otp"])


@router.post("/request", response_model=OtpRequestResponse)
def request_code(payload: OtpRequest, db: Database = Depends(get_db)):
    if not settings.smtp_configured:
        raise HTTPException(
            status_code=503,
            detail="Email service is not configured. Please contact the organiser.",
        )
    result = otp_service.request_otp(db, payload.email)
    if not result.sent:
        code = (
            status.HTTP_429_TOO_MANY_REQUESTS
            if result.error and "wait" in result.error.lower()
            else status.HTTP_502_BAD_GATEWAY
        )
        raise HTTPException(status_code=code, detail=result.error or "Could not send code.")
    return OtpRequestResponse(
        sent=True,
        expires_in_seconds=result.expires_in_seconds,
        resend_after_seconds=result.resend_after_seconds,
    )


@router.post("/verify", response_model=OtpVerifyResponse)
def verify_code(payload: OtpVerify, db: Database = Depends(get_db)):
    result = otp_service.verify_otp(db, payload.email, payload.code)
    if not result.ok:
        raise HTTPException(status_code=400, detail=result.error or "Invalid code.")
    return OtpVerifyResponse(
        verification_token=result.token,
        expires_in_seconds=result.expires_in_seconds,
    )
