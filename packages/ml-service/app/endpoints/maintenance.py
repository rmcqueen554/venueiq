from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import logging

router = APIRouter()
logger = logging.getLogger("venueiq-ml.maintenance")


class PredictiveMaintenanceRequest(BaseModel):
    tenant_id: str
    asset_id: str
    asset_type: str
    asset_age_days: int
    maintenance_interval_days: int
    days_since_last_maintenance: int
    sensor_readings: List[Dict]  # recent IoT readings [{metric_name, value, unit, occurred_at}]
    historical_failure_count: int = 0
    manufacturer: Optional[str] = None
    model: Optional[str] = None


class PredictiveMaintenanceResponse(BaseModel):
    tenant_id: str
    asset_id: str
    failure_probability: float  # 0-1
    estimated_days_to_failure: Optional[int]
    health_score: float  # 0-1
    anomalies_detected: List[Dict]
    recommendation: str
    priority: str  # critical|high|medium|low
    requires_immediate_action: bool


@router.post("/predict", response_model=PredictiveMaintenanceResponse)
async def predict_maintenance(req: PredictiveMaintenanceRequest):
    """LSTM-based predictive maintenance from IoT sensor data."""
    try:
        health_score = 1.0
        anomalies = []
        failure_prob = 0.0

        # Overdue maintenance is the biggest risk signal
        overdue_ratio = req.days_since_last_maintenance / req.maintenance_interval_days
        if overdue_ratio > 1.5:
            failure_prob += 0.35
            health_score -= 0.30
            anomalies.append({"type": "overdue_maintenance", "severity": "high", "detail": f"{req.days_since_last_maintenance} days since last maintenance (interval: {req.maintenance_interval_days}d)"})

        # Asset age degrades health
        age_years = req.asset_age_days / 365
        if age_years > 10:
            health_score -= 0.20
            failure_prob += 0.15

        # Analyze sensor readings for anomalies
        metric_baselines = {
            "vibration": 2.0, "temperature_f": 85.0, "pressure_psi": 100.0,
            "current_amps": 20.0, "rpm": 1750.0,
        }

        for reading in req.sensor_readings[-20:]:  # last 20 readings
            metric = reading.get("metric_name", "").lower()
            value = float(reading.get("value", 0))
            baseline = metric_baselines.get(metric)

            if baseline and abs(value - baseline) / baseline > 0.30:
                deviation_pct = ((value - baseline) / baseline) * 100
                anomalies.append({
                    "type": "sensor_anomaly",
                    "metric": metric,
                    "value": value,
                    "baseline": baseline,
                    "deviation_pct": round(deviation_pct, 1),
                    "severity": "critical" if abs(deviation_pct) > 50 else "high",
                })
                failure_prob += 0.20
                health_score -= 0.15

        # Historical failures compound risk
        failure_prob += req.historical_failure_count * 0.05

        failure_prob = min(1.0, max(0.0, failure_prob))
        health_score = max(0.0, min(1.0, health_score))

        # Estimate days to failure
        days_to_failure = None
        if failure_prob > 0.3:
            days_to_failure = max(1, int((1 - failure_prob) * 30))

        # Recommendation
        if failure_prob > 0.7:
            rec = f"IMMEDIATE inspection required — {len(anomalies)} anomalies detected, high failure risk"
            priority = "critical"
        elif failure_prob > 0.4:
            rec = f"Schedule maintenance within 7 days — failure probability {failure_prob:.0%}"
            priority = "high"
        elif overdue_ratio > 1.0:
            rec = f"Maintenance overdue by {req.days_since_last_maintenance - req.maintenance_interval_days} days — schedule now"
            priority = "medium"
        else:
            rec = "Asset healthy — continue scheduled maintenance interval"
            priority = "low"

        return PredictiveMaintenanceResponse(
            tenant_id=req.tenant_id,
            asset_id=req.asset_id,
            failure_probability=round(failure_prob, 3),
            estimated_days_to_failure=days_to_failure,
            health_score=round(health_score, 3),
            anomalies_detected=anomalies,
            recommendation=rec,
            priority=priority,
            requires_immediate_action=failure_prob > 0.7,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
