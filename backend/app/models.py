from datetime import datetime, time, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, text
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
