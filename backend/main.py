"""
CarbonLens — FastAPI Application Entry Point
Mounts all routers, serves React static files, configures CORS.
CORS restricted to CORS_ORIGIN env var — never '*' in production.
"""
import logging
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from config import APP_ENV, CORS_ORIGIN, LOG_LEVEL
from routers import activities, insights, report, rag as rag_router

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="CarbonLens API",
    description="Personal Carbon Footprint Tracker — Powered by Google Gemini",
    version="1.0.0",
    docs_url="/docs" if APP_ENV == "development" else None,  # hide docs in production
    redoc_url=None,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Never use allow_origins=["*"] — restrict to the deployment domain
allowed_origins = [CORS_ORIGIN] if CORS_ORIGIN else []
if APP_ENV == "development":
    allowed_origins = ["http://localhost:5173", "http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type", "Accept"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(activities.router)
app.include_router(insights.router)
app.include_router(report.router)
app.include_router(rag_router.router)

# ── Static Files (React SPA) ──────────────────────────────────────────────────
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str) -> FileResponse:
        """Serve the React SPA for all non-API routes (client-side routing)."""
        index = STATIC_DIR / "index.html"
        return FileResponse(str(index))

logger.info("CarbonLens API starting — env=%s, cors=%s", APP_ENV, allowed_origins)
