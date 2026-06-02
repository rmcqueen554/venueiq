from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import logging

router = APIRouter()
logger = logging.getLogger("venueiq-ml.pricing")


class DynamicPricingRequest(BaseModel):
    tenant_id: str
    event_id: str
    target_type: str  # ticket_section|concession_product|parking_lot
    target_id: str
    current_price: float
    demand_velocity: float  # current sales rate vs. baseline (1.0 = on pace)
    inventory_remaining_pct: float  # 0-1
    minutes_until_event: int
    weather_precip_pct: Optional[float] = None
    secondary_market_price: Optional[float] = None
    historical_avg_price: Optional[float] = None


class DynamicPricingResponse(BaseModel):
    tenant_id: str
    event_id: str
    target_type: str
    target_id: str
    current_price: float
    recommended_price: float
    price_change_pct: float
    rationale: str
    expected_revenue_lift: float
    confidence: float
    requires_approval: bool


class RenewalLikelihoodRequest(BaseModel):
    tenant_id: str
    fan_id: str
    usage_rate: float  # 0-1, fraction of games attended
    upgrade_requests: int
    complaint_count: int
    account_value: float
    years_as_holder: int
    last_interaction_days: int


class RenewalLikelihoodResponse(BaseModel):
    tenant_id: str
    fan_id: str
    renewal_score: float  # 0-1
    risk_level: str  # low|medium|high|critical
    key_factors: dict
    recommended_action: str


@router.post("/dynamic", response_model=DynamicPricingResponse)
async def dynamic_pricing(req: DynamicPricingRequest):
    """Multi-variable dynamic pricing optimization."""
    try:
        price = req.current_price
        rationale_parts = []

        # High demand → increase price
        if req.demand_velocity > 1.4:
            increase = min(0.15, (req.demand_velocity - 1.0) * 0.1)
            price *= (1 + increase)
            rationale_parts.append(f"demand running at {req.demand_velocity:.1f}x baseline")

        # Low demand + event approaching → decrease price
        elif req.demand_velocity < 0.6 and req.minutes_until_event < 180:
            decrease = min(0.20, (1.0 - req.demand_velocity) * 0.15)
            price *= (1 - decrease)
            rationale_parts.append(f"slow demand ({req.demand_velocity:.1f}x), event in {req.minutes_until_event // 60}h")

        # Low inventory → price up
        if req.inventory_remaining_pct < 0.15:
            price *= 1.08
            rationale_parts.append("low inventory remaining")

        # Secondary market signal
        if req.secondary_market_price and req.secondary_market_price > price * 1.3:
            price = min(price * 1.12, req.secondary_market_price * 0.85)
            rationale_parts.append(f"secondary market at ${req.secondary_market_price:.2f}")

        price = round(price, 2)
        price_change_pct = ((price - req.current_price) / req.current_price) * 100
        expected_lift = abs(price - req.current_price) * 50  # rough units estimate

        return DynamicPricingResponse(
            tenant_id=req.tenant_id,
            event_id=req.event_id,
            target_type=req.target_type,
            target_id=req.target_id,
            current_price=req.current_price,
            recommended_price=price,
            price_change_pct=round(price_change_pct, 1),
            rationale="; ".join(rationale_parts) if rationale_parts else "Current pricing is optimal",
            expected_revenue_lift=round(expected_lift, 2),
            confidence=0.72,
            requires_approval=True,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/renewal-likelihood", response_model=RenewalLikelihoodResponse)
async def renewal_likelihood(req: RenewalLikelihoodRequest):
    """Season ticket renewal likelihood classification."""
    try:
        score = 0.5

        # Usage rate is the strongest signal
        score += (req.usage_rate - 0.5) * 0.4

        # Years as holder (loyalty bonus)
        score += min(req.years_as_holder * 0.03, 0.15)

        # Complaints are a major red flag
        score -= req.complaint_count * 0.08

        # Recency of interaction
        if req.last_interaction_days > 180:
            score -= 0.12
        elif req.last_interaction_days < 30:
            score += 0.05

        # Account value — higher value accounts are usually stickier
        if req.account_value > 10000:
            score += 0.05

        score = max(0.0, min(1.0, score))

        risk_level = "low" if score > 0.75 else "medium" if score > 0.50 else "high" if score > 0.30 else "critical"

        actions = {
            "low": "Standard renewal outreach at 90 days",
            "medium": "Personal outreach call recommended at 60 days",
            "high": "Upgrade offer or event invite — escalate to director",
            "critical": "Immediate personal call from GM or ownership group",
        }

        return RenewalLikelihoodResponse(
            tenant_id=req.tenant_id,
            fan_id=req.fan_id,
            renewal_score=round(score, 3),
            risk_level=risk_level,
            key_factors={
                "usage_rate": req.usage_rate,
                "years_as_holder": req.years_as_holder,
                "complaints": req.complaint_count,
                "last_interaction_days": req.last_interaction_days,
            },
            recommended_action=actions[risk_level],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
