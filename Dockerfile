# =============================================================
# CarbonLens — Multi-stage Dockerfile
# Stage 1: Build React SPA (Node 20)
# Stage 2: Python 3.12 backend + serve frontend + RAG
# =============================================================

# ── Stage 1: Frontend Build ───────────────────────────────────────────────
FROM node:20-slim AS frontend-build

WORKDIR /app/frontend

# Copy package files first for layer caching
COPY frontend/package*.json ./
RUN npm ci --silent

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ── Stage 2: Backend + RAG ───────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# System deps (needed for some chromadb native libs)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies (cached if requirements.txt unchanged)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy RAG pipeline + source documents
COPY rag/ ./rag/

# Copy frontend build output → served by FastAPI StaticFiles
COPY --from=frontend-build /app/frontend/dist ./static

# Pre-build ChromaDB index at image build time.
# GOOGLE_API_KEY must be passed as a build secret (not baked into image layer).
# Usage: docker build --secret id=google_api_key,env=GOOGLE_API_KEY .
RUN --mount=type=secret,id=google_api_key \
    GOOGLE_API_KEY=$(cat /run/secrets/google_api_key) \
    RAG_DB_PATH=/app/rag/db \
    python rag/ingest.py

# ── Runtime ───────────────────────────────────────────────────────────────
ENV PORT=8080
ENV APP_ENV=production
ENV RAG_DB_PATH=/app/rag/db

EXPOSE 8080

# GOOGLE_API_KEY injected at runtime via Cloud Run --set-secrets
# Never baked into the image
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
