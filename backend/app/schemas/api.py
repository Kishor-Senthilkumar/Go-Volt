import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ThreadCreate(BaseModel):
    title: str = Field(default="New chat", min_length=1, max_length=120)


class ThreadRename(BaseModel):
    title: str = Field(min_length=1, max_length=120)


class ThreadOut(BaseModel):
    id: uuid.UUID
    title: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageOut(BaseModel):
    id: uuid.UUID
    role: Literal["user", "assistant", "system"]
    parts: list[dict[str, Any]]
    created_at: datetime

    model_config = {"from_attributes": True}


class Location(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class ChatRequest(BaseModel):
    thread_id: uuid.UUID
    message: str = Field(min_length=1, max_length=8000)
    location: Location | None = None
    request_id: uuid.UUID


class ProfileOut(BaseModel):
    display_name: str | None
    email: str | None
    avatar_url: str | None


class PriceOut(BaseModel):
    amount: float
    currency: str
    unit: Literal["kWh"] = "kWh"
    is_estimated: bool = False


class StationOut(BaseModel):
    id: int
    name: str
    address: str
    latitude: float
    longitude: float
    distance_km: float
    operator: str | None = None
    operator_website: str | None = None
    operator_phone: str | None = None
    usage_cost: str | None = None
    price_per_kwh: PriceOut | None = None
    connector_types: list[str]
    max_power_kw: float | None = None
    data_source: str = "Open Charge Map"
    last_updated: datetime | None = None