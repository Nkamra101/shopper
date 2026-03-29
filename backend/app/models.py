from datetime import datetime, time

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class EventType(Base):
    __tablename__ = "event_types"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    duration: Mapped[int] = mapped_column(Integer, nullable=False)
    url_slug: Mapped[str] = mapped_column(String(120), unique=True, nullable=False, index=True)
    accent_color: Mapped[str] = mapped_column(String(30), default="#0f172a")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    bookings: Mapped[list["Booking"]] = relationship("Booking", back_populates="event_type")


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
    event_type_id: Mapped[int] = mapped_column(ForeignKey("event_types.id"), nullable=False)
    booker_name: Mapped[str] = mapped_column(String(120), nullable=False)
    booker_email: Mapped[str] = mapped_column(String(120), nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(20), default="confirmed")
    start_time: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    end_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    event_type: Mapped[EventType] = relationship("EventType", back_populates="bookings")

