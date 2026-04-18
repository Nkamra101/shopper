from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EventTypeBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    duration: int = Field(..., ge=5, le=480)
    url_slug: str = Field(..., min_length=2, max_length=120, pattern=r"^[a-z0-9-]+$")
    accent_color: str = Field(default="#6366f1", max_length=30)
    is_active: bool = True
    buffer_minutes: int = Field(default=0, ge=0, le=120)
    min_notice_hours: int = Field(default=0, ge=0, le=168)
    max_advance_days: int = Field(default=60, ge=1, le=365)
    location: str = Field(default="", max_length=255)
    location_type: str = Field(default="video", max_length=32)


class EventTypeCreate(EventTypeBase):
    pass


class EventTypeUpdate(EventTypeBase):
    pass


class EventTypeRead(EventTypeBase):
    id: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AvailabilityRuleInput(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time
    is_active: bool = True


class AvailabilityRuleRead(BaseModel):
    id: str
    day_of_week: int
    start_time: time
    end_time: time
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)


class AvailabilityUpdate(BaseModel):
    timezone: str
    rules: list[AvailabilityRuleInput]


class AvailabilityRead(BaseModel):
    timezone: str
    rules: list[AvailabilityRuleRead]


class BookingRead(BaseModel):
    id: str
    event_type_id: str
    booker_name: str
    booker_email: str
    notes: str
    status: str
    meeting_url: str = ""
    start_time: datetime
    end_time: datetime
    created_at: datetime
    event_type: EventTypeRead

    model_config = ConfigDict(from_attributes=True)


class PublicEventTypeRead(BaseModel):
    id: str
    title: str
    description: str
    duration: int
    url_slug: str
    accent_color: str
    timezone: str


class SlotRead(BaseModel):
    start_time: str
    end_time: str
    display_time: str


class BookingCreate(BaseModel):
    booker_name: str = Field(..., min_length=2, max_length=120)
    booker_email: EmailStr
    notes: str = Field(default="", max_length=500)
    start_time: datetime
    verification_token: str = Field(..., min_length=16, max_length=64)


class OtpRequest(BaseModel):
    email: EmailStr


class OtpRequestResponse(BaseModel):
    sent: bool
    expires_in_seconds: int
    resend_after_seconds: int


class OtpVerify(BaseModel):
    email: EmailStr
    code: str = Field(..., min_length=4, max_length=10)


class OtpVerifyResponse(BaseModel):
    verification_token: str
    expires_in_seconds: int


class BookingReschedule(BaseModel):
    start_time: datetime


class BlockoutDateCreate(BaseModel):
    date: date
    reason: str = Field(default="", max_length=120)


class BlockoutDateRead(BaseModel):
    id: str
    date: date
    reason: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardSummary(BaseModel):
    event_types_count: int
    upcoming_bookings_count: int
    past_bookings_count: int
    this_week_count: int = 0
    total_bookings_count: int = 0
