from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.trip_planner import EV_PRESETS, plan_ev_trip

router = APIRouter(prefix="/api/trip", tags=["trip"])


class TripPlanRequest(BaseModel):
    origin: str = Field(..., min_length=2, description="Origin city or location")
    destination: str = Field(..., min_length=2, description="Destination city or location")
    car_name: str | None = Field(default=None, description="EV model name")
    range_km: float | None = Field(default=None, ge=30, le=1200, description="Real-world driving range in km")
    initial_soc_pct: float = Field(default=95.0, ge=10, le=100, description="Battery percentage at departure")


@router.get("/presets")
async def get_presets() -> dict[str, Any]:
    """Return available electric vehicle presets for quick selection."""
    return {
        "presets": list(EV_PRESETS.values()),
    }


@router.post("/plan")
async def create_trip_plan(req: TripPlanRequest) -> dict[str, Any]:
    """Generate an autonomous highway EV route plan with optimal charging stops."""
    try:
        plan = await plan_ev_trip(
            origin=req.origin,
            destination=req.destination,
            car_name=req.car_name,
            range_km=req.range_km,
            initial_soc_pct=req.initial_soc_pct,
        )
        return plan
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not calculate trip plan: {e}")
