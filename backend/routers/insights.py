"""
CarbonLens — Insights Router
POST /api/v1/insights/generate — Gemini + RAG personalised insights
"""
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.llm import generate_json, sanitize
from services.prompts import insights_prompt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/insights", tags=["insights"])


class ActivitySummary(BaseModel):
    timeframe: str = Field(..., examples=["weekly"])
    total_co2e_kg: float
    by_category: dict[str, float]
    top_activities: list[dict[str, Any]]


class Profile(BaseModel):
    country: str = Field(..., examples=["IN"])
    primary_transport: str = Field(..., examples=["public"])
    diet: str = Field(..., examples=["vegetarian"])


class InsightsRequest(BaseModel):
    activity_summary: dict[str, Any]   # flexible: accepts flat {activity_type: co2e_kg} or structured
    profile: Profile
    rag_chunks: list[str] = Field(default_factory=list)


class InsightsResponse(BaseModel):
    summary: str
    suggestions: list[str]
    fact: str
    sources: list[dict[str, str]]


@router.post("/generate", response_model=InsightsResponse)
async def generate_insights(req: InsightsRequest) -> InsightsResponse:
    """
    Generate personalised AI insights grounded in RAG climate context.
    User profile fields are sanitized before prompt injection.
    """
    # Sanitize profile fields
    country = sanitize(req.profile.country, max_len=50)
    diet = sanitize(req.profile.diet, max_len=50)
    transport = sanitize(req.profile.primary_transport, max_len=50)

    import json
    activity_summary_json = json.dumps(req.activity_summary, indent=2)
    rag_context = "\n\n".join(req.rag_chunks) if req.rag_chunks else "No specific context available."

    prompt = insights_prompt(activity_summary_json, rag_context, country, diet, transport)

    try:
        result = await generate_json(prompt)
    except Exception as e:
        err_str = str(e)
        logger.error("Gemini insights failed: %s", err_str)
        if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
            raise HTTPException(
                status_code=503,
                detail="Gemini API quota reached. Please wait a minute and try again."
            ) from e
        raise HTTPException(status_code=502, detail="AI insights unavailable. Please try again.") from e

    raw_sources = result.get("sources", [])
    sources_list = []
    for src in raw_sources:
        if isinstance(src, dict):
            sources_list.append({"doc": str(src.get("doc", "Source")), "excerpt": str(src.get("excerpt", ""))})
        elif isinstance(src, str):
            sources_list.append({"doc": "Source", "excerpt": src})

    return InsightsResponse(
        summary=result.get("summary", ""),
        suggestions=result.get("suggestions", [])[:3],
        fact=result.get("fact", ""),
        sources=sources_list,
    )
