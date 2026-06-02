from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging

router = APIRouter()
logger = logging.getLogger("venueiq-ml.crowd")


class CrowdFlowRequest(BaseModel):
    tenant_id: str
    event_id: str
    minutes_until_halftime: Optional[int] = None
    minutes_until_event_end: Optional[int] = None
    current_gate_scan_rate: float  # scans per minute
    total_scanned: int
    total_expected: int
    zone_densities: List[Dict]  # [{zone_id, zone_name, density_level, capacity}]


class CrowdFlowResponse(BaseModel):
    tenant_id: str
    event_id: str
    predicted_halftime_surge: Optional[Dict]
    predicted_exit_wave: Optional[Dict]
    high_risk_zones: List[Dict]
    recommended_staff_positions: List[Dict]
    estimated_venue_clear_minutes: Optional[int]


class EgressPredictionRequest(BaseModel):
    tenant_id: str
    total_attendance: int
    active_exits: int
    exit_capacity_per_minute: int  # vehicles or people per exit per minute
    current_exit_rate: float


@router.post("/flow", response_model=CrowdFlowResponse)
async def predict_crowd_flow(req: CrowdFlowRequest):
    """Predict crowd movement patterns for halftime and event end."""
    try:
        high_risk_zones = []
        for zone in req.zone_densities:
            density = zone.get("density_level", 0)
            if density > 75:
                high_risk_zones.append({
                    "zone_id": zone.get("zone_id"),
                    "zone_name": zone.get("zone_name"),
                    "density_level": density,
                    "risk": "critical" if density > 90 else "high",
                    "action": "Dispatch 2 additional staff to manage flow" if density > 90 else "Monitor closely",
                })

        # Halftime surge prediction
        halftime_surge = None
        if req.minutes_until_halftime is not None and req.minutes_until_halftime < 20:
            concourse_spike_pct = 0.65  # ~65% of fans visit concessions/bathrooms at halftime
            surge_fans = int(req.total_scanned * concourse_spike_pct)
            halftime_surge = {
                "minutes_away": req.minutes_until_halftime,
                "expected_concourse_fans": surge_fans,
                "peak_minute": req.minutes_until_halftime + 3,
                "duration_minutes": 18,
            }

        # Exit wave prediction
        exit_wave = None
        if req.minutes_until_event_end is not None and req.minutes_until_event_end < 30:
            exit_wave = {
                "minutes_away": req.minutes_until_event_end,
                "expected_simultaneous_exits": int(req.total_scanned * 0.40),
                "peak_exit_minute": req.minutes_until_event_end + 8,
                "estimated_clear_minutes": int(req.total_attendance / max(req.exit_capacity_per_minute * req.active_exits, 1)),
            }

        # Staff recommendations
        staff_recs = []
        for zone in high_risk_zones:
            staff_recs.append({
                "zone_id": zone["zone_id"],
                "zone_name": zone["zone_name"],
                "staff_to_add": 2 if zone["risk"] == "critical" else 1,
                "urgency": "immediate",
            })

        estimated_clear = int(req.total_scanned / max(req.current_exit_rate, 1)) if req.current_exit_rate > 0 else None

        return CrowdFlowResponse(
            tenant_id=req.tenant_id,
            event_id=req.event_id,
            predicted_halftime_surge=halftime_surge,
            predicted_exit_wave=exit_wave,
            high_risk_zones=high_risk_zones,
            recommended_staff_positions=staff_recs,
            estimated_venue_clear_minutes=estimated_clear,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
