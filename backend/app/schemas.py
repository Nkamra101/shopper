from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EventTypeBase(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    description: str = Field(default="", max_length=500)
    duration: int = Field(..., ge=15, le=240)
    url_slug: str = Field(..., min_length=2, max_length=120, pattern=r"^[a-z0-9-]+$")
    accent_color: str = Field(default="#0f172a", max_length=30)


class EventTypeCreate(EventTypeBase):
    pass


class EventTypeUpdate(EventTypeBase):
    pass


class EventTypeRead(EventTypeBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class AvailabilityRuleInput(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: time
    end_time: time
    is_active: bool = True


class AvailabilityRuleRead(AvailabilityRuleInput):
    id: int

    model_config = ConfigDict(from_attributes=True)


class AvailabilityUpdate(BaseModel):
    timezone: str
    rules: list[AvailabilityRuleInput]


class AvailabilityRead(BaseModel):
    timezone: str
    rules: list[AvailabilityRuleRead]


class BookingRead(BaseModel):
    id: int
    event_type_id: int
    booker_name: str
    booker_email: str
    notes: str
    status: str
    start_time: datetime
    end_time: datetime
    created_at: datetime
    event_type: EventTypeRead

    model_config = ConfigDict(from_attributes=True)


class PublicEventTypeRead(BaseModel):
    id: int
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


class DashboardSummary(BaseModel):
    event_types_count: int
    upcoming_bookings_count: int
    past_bookings_count: int

