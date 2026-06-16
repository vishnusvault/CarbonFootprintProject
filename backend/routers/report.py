"""
CarbonLens — Weekly Report Router
POST /api/v1/report/weekly — Gemini-generated weekly digest
"""
import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.llm import generate_json
from services.prompts import weekly_report_prompt

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/report", tags=["report"])


class WeeklyReportRequest(BaseModel):
    activities: list[dict[str, Any]] = Field(..., description="This week's activity log")
    baseline_activities: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Baseline activities (4-week avg) or empty for global avg",
    )
    suggestions_shown: list[str] = Field(
        default_factory=list,
        description="Inline suggestions already displayed this week",
    )


class WeeklyReportResponse(BaseModel):
    wins: list[str]
    opportunities: list[str]
    week_summary: str
    equivalent: str


@router.post("/weekly", response_model=WeeklyReportResponse)
async def weekly_report(req: WeeklyReportRequest) -> WeeklyReportResponse:
    """
    Generate a weekly carbon footprint digest using Gemini.
    """
    this_week_json = json.dumps(req.activities, indent=2)
    baseline_json = json.dumps(req.baseline_activities, indent=2) if req.baseline_activities else "No baseline — using global average (77 kg CO2e/week)"
    suggestions_shown = "\n".join(req.suggestions_shown) if req.suggestions_shown else "None shown yet."

    prompt = weekly_report_prompt(this_week_json, baseline_json, suggestions_shown)

    try:
        result = await generate_json(prompt)
    except Exception as e:
        logger.error("Gemini weekly report failed: %s", str(e))
        raise HTTPException(status_code=502, detail="Weekly report generation unavailable.") from e

    return WeeklyReportResponse(
        wins=result.get("wins", []),
        opportunities=result.get("opportunities", [])[:3],
        week_summary=result.get("week_summary", ""),
        equivalent=result.get("equivalent", ""),
    )
