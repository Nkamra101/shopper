from datetime import date, datetime, time, timezone

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def _utcnow() -> datetime:
    """Timezone-aware UTC now, stored as naive by the DB column."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EventType(Base):
    __tablename__ = "event_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    duration: Mapped[int] = mapped_column(Integer, nullable=False)
    url_slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    accent_color: Mapped[str] = mapped_column(String(30), default="#0f172a")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    bookings: Mapped[list["Booking"]] = relationship(
        "Booking", back_populates="event_type", cascade="all, delete-orphan"
    )


class AvailabilitySetting(Base):
    __tablename__ = "availability_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    timezone: Mapped[str] = mapped_column(String(80), default="Asia/Kolkata")


class AvailabilityRule(Base):
    __tablename__ = "availability_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    start_time: Mapped[time] = mapped_column(nullable=False)
    end_time: Mapped[time] = mapped_column(nullable=False)
    is_active: Mapped[bool] = mapped_column(default=True)


class BlockoutDate(Base):
    __tablename__ = "blockout_dates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    date: Mapped[date] = mapped_column(Date, unique=True, nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(120), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)



class EmailOtp(Base):
    """One-time codes mailed to a user before they're allowed to book."""

    __tablename__ = "email_otps"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    used: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow, index=True)


class VerificationToken(Base):
    """Short-lived bearer token issued after successful OTP verification.

    The token is presented to /book to prove the booker controls the email
    they are booking with.
    """

    __tablename__ = "verification_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    token: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    email: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)


class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    event_type_id: Mapped[int] = mapped_column(
        ForeignKey("event_types.id", ondelete="CASCADE"), nullable=False
    )
    booker_name: Mapped[str] = mapped_column(String(120), nullable=False)
    booker_email: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="confirmed", index=True)
    meeting_url: Mapped[str] = mapped_column(
        String(255), nullable=False, server_default="", default=""
    )
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    event_type: Mapped[EventType] = relationship("EventType", back_populates="bookings")

    __table_args__ = (
        # Postgres partial unique index: prevents two *confirmed* bookings
        # sharing the same slot for the same event type. Cancelled rows are
        # ignored so users can rebook after a cancellation.
        # On SQLite this degrades to a regular index (no enforcement), which
        # is fine for local dev — production should use Postgres.
        Index(
            "uq_booking_confirmed_slot",
            "event_type_id",
            "start_time",
            unique=True,
            postgresql_where=text("status = 'confirmed'"),
        ),
    )
