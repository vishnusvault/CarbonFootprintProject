"""
CarbonLens — RAG + Utility Router
POST /api/v1/rag/query  — RAG Q&A with Gemini
GET  /api/v1/factors    — emission factor lookup
GET  /api/v1/cities/distance — haversine distance between two cities
GET  /api/v1/health     — health check
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from services.calculator import get_all_factors, city_distance, list_cities
from services.llm import generate_json, sanitize
from services.prompts import rag_qa_prompt

logger = logging.getLogger(__name__)
router = APIRouter(tags=["rag", "utility"])


# ── RAG Q&A ───────────────────────────────────────────────────────────────────

class RAGQueryRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    rag_chunks: list[str] = Field(default_factory=list)


class RAGQueryResponse(BaseModel):
    answer: str
    sources: list[dict[str, str]]


@router.post("/api/v1/rag/query", response_model=RAGQueryResponse)
async def rag_query(req: RAGQueryRequest) -> RAGQueryResponse:
    """Single-turn RAG Q&A: retrieves climate context and answers via Gemini."""
    question = sanitize(req.question, max_len=500)
    rag_context = "\n\n".join(req.rag_chunks) if req.rag_chunks else "No specific context available."

    prompt = rag_qa_prompt(question, rag_context)

    try:
        result = await generate_json(prompt)
    except Exception as e:
        logger.error("RAG Q&A failed: %s", str(e))
        raise HTTPException(status_code=502, detail="Q&A unavailable. Please try again.") from e

    return RAGQueryResponse(
        answer=result.get("answer", ""),
        sources=result.get("sources", []),
    )


# ── Emission Factors ──────────────────────────────────────────────────────────

@router.get("/api/v1/factors")
async def get_factors() -> dict:
    """Return all emission factors (used by frontend to display factor info)."""
    return {"data": get_all_factors(), "error": None}


# ── City Distance ─────────────────────────────────────────────────────────────

class DistanceResponse(BaseModel):
    distance_km: Optional[float]
    origin: str
    destination: str
    found: bool


@router.get("/api/v1/cities/distance", response_model=DistanceResponse)
async def get_city_distance(
    origin: str = Query(..., min_length=2, max_length=100),
    destination: str = Query(..., min_length=2, max_length=100),
) -> DistanceResponse:
    """Compute great-circle distance between two cities."""
    origin = sanitize(origin, max_len=100)
    destination = sanitize(destination, max_len=100)
    dist = city_distance(origin, destination)
    return DistanceResponse(
        distance_km=dist,
        origin=origin,
        destination=destination,
        found=dist is not None,
    )


@router.get("/api/v1/cities")
async def get_cities() -> dict:
    """Return all known city names (for frontend autocomplete)."""
    return {"data": list_cities(), "error": None}


# ── Health Check ──────────────────────────────────────────────────────────────

@router.get("/api/v1/health")
async def health() -> dict:
    return {"status": "ok", "version": "1.0.0", "service": "CarbonLens"}
