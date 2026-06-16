"""
CarbonLens — Activities Router
POST /api/v1/activities/calculate   — compute CO2e for an activity
POST /api/v1/activities/suggest-alternative — Gemini-powered alternative suggestion
"""
import json
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.calculator import calculate_co2e, city_distance
from services.llm import generate_json, sanitize
from services.prompts import alternative_suggestion_prompt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/activities", tags=["activities"])


# ── Request / Response Models ─────────────────────────────────────────────────

class CalculateRequest(BaseModel):
    category: str = Field(..., examples=["transport"])
    activity_type: str = Field(..., examples=["flight_short"])
    origin: Optional[str] = Field(None, examples=["Chennai"])
    destination: Optional[str] = Field(None, examples=["Mumbai"])
    quantity: float = Field(..., gt=0)
    unit: str = Field(..., examples=["km"])
    date: str = Field(..., examples=["2026-06-16"])


class CalculateResponse(BaseModel):
    co2e_kg: float
    distance_km: Optional[float] = None


class ActivityPayload(BaseModel):
    """Full activity object sent by frontend after saving."""
    id: str
    date: str
    category: str
    activity_type: str
    origin: Optional[str] = None
    destination: Optional[str] = None
    distance_km: Optional[float] = None
    quantity: float
    unit: str
    co2e_kg: float
    conscious_swap: bool = False
    co2_avoided_kg: Optional[float] = None
    inline_suggestion: Optional[str] = None
    created_at: str


class SuggestRequest(BaseModel):
    activity: ActivityPayload
    rag_chunks: list[str] = Field(default_factory=list)


class SuggestResponse(BaseModel):
    suggestion: str
    co2_saving_kg: float
    is_positive_reinforcement: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/calculate", response_model=CalculateResponse)
async def calculate(req: CalculateRequest) -> CalculateResponse:
    """
    Calculate CO2e for a logged activity.
    If origin + destination are provided (transport), compute distance via haversine.
    """
    distance_km: Optional[float] = None

    quantity = req.quantity
    if req.origin and req.destination:
        origin = sanitize(req.origin, max_len=100)
        destination = sanitize(req.destination, max_len=100)
        distance_km = city_distance(origin, destination)
        if distance_km is None:
            raise HTTPException(
                status_code=422,
                detail=f"City not found: '{origin}' or '{destination}'. Enter distance manually.",
            )
        quantity = distance_km

    try:
        co2e = calculate_co2e(req.category, req.activity_type, quantity, req.unit)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    return CalculateResponse(co2e_kg=co2e, distance_km=distance_km)


@router.post("/suggest-alternative", response_model=SuggestResponse)
async def suggest_alternative(req: SuggestRequest) -> SuggestResponse:
    """
    Use Gemini to suggest a lower-carbon alternative for the logged activity.
    RAG chunks are injected as climate context into the prompt.
    All user-supplied fields are sanitized before prompt construction.
    """
    # Sanitize all user-supplied string fields before they touch the LLM prompt
    safe_activity = req.activity.model_dump()
    for field in ("origin", "destination", "activity_type", "category", "unit"):
        if safe_activity.get(field):
            safe_activity[field] = sanitize(str(safe_activity[field]), max_len=200)

    activity_json = json.dumps(safe_activity, indent=2)
    rag_context = "\n\n".join(req.rag_chunks) if req.rag_chunks else "No specific context available."

    prompt = alternative_suggestion_prompt(activity_json, rag_context)

    try:
        result = await generate_json(prompt)
    except Exception as e:
        logger.error("Gemini suggestion failed: %s", str(e))
        raise HTTPException(status_code=502, detail="AI suggestion unavailable. Please try again.") from e

    return SuggestResponse(
        suggestion=result.get("suggestion", ""),
        co2_saving_kg=float(result.get("co2_saving_kg", 0.0)),
        is_positive_reinforcement=bool(result.get("is_positive_reinforcement", False)),
    )
