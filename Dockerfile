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

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy RAG pipeline + source documents
COPY rag/ ./rag/

# Copy frontend build output → served by FastAPI StaticFiles
COPY --from=frontend-build /app/frontend/dist ./static

# GOOGLE_API_KEY_ARG is passed via --build-arg from Cloud Build (sourced from Secret Manager).
# It is used ONLY during this RUN step for RAG ingestion and is NOT stored in any image layer.
# ARG values are not persisted in the final image — only the resulting /app/rag/db directory is kept.
ARG GOOGLE_API_KEY_ARG
RUN GOOGLE_API_KEY=${GOOGLE_API_KEY_ARG} \
    RAG_DB_PATH=/app/rag/db \
    python rag/ingest.py

# ── Runtime ───────────────────────────────────────────────────────────────
ENV PORT=8080
ENV APP_ENV=production
ENV RAG_DB_PATH=/app/rag/db

EXPOSE 8080

# GOOGLE_API_KEY injected at runtime via Cloud Run --set-secrets
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
