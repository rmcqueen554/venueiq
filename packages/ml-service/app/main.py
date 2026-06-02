from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
import logging

from app.endpoints.forecast import router as forecast_router
from app.endpoints.pricing import router as pricing_router
from app.endpoints.maintenance import router as maintenance_router
from app.endpoints.crowd import router as crowd_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("venueiq-ml")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("VenueIQ ML Service starting...")
    # Pre-load models here in production
    yield
    logger.info("VenueIQ ML Service shutting down")


app = FastAPI(
    title="VenueIQ ML Service",
    description="Per-venue ML models: attendance forecasting, demand forecasting, dynamic pricing, predictive maintenance, renewal likelihood, crowd flow",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def verify_api_key(x_api_key: str = Header(...)):
    """Service-to-service auth."""
    expected = os.environ.get("ML_SERVICE_API_KEY", "dev-key")
    if x_api_key != expected:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return x_api_key


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ml-service"}


app.include_router(forecast_router, prefix="/forecast", tags=["Forecasting"])
app.include_router(pricing_router, prefix="/pricing", tags=["Dynamic Pricing"])
app.include_router(maintenance_router, prefix="/maintenance", tags=["Predictive Maintenance"])
app.include_router(crowd_router, prefix="/crowd", tags=["Crowd Analytics"])
