"""
CarbonLens — Central Configuration
Reads all settings from environment variables.
Never hardcodes secrets.
"""
import os
from dotenv import load_dotenv

# Load .env in development; in Cloud Run env vars come from Secret Manager
load_dotenv()

# --- Google AI (required — fail fast at startup if missing) ---
GOOGLE_API_KEY: str = os.environ["GOOGLE_API_KEY"]

# --- App ---
APP_ENV: str = os.getenv("APP_ENV", "production")
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

# --- RAG / ChromaDB ---
RAG_DB_PATH: str = os.getenv("RAG_DB_PATH", "/app/rag/db")

# --- CORS ---
CORS_ORIGIN: str = os.getenv("CORS_ORIGIN", "http://localhost:5173")

# --- Gemini Models ---
GEMINI_LLM_MODEL: str = "gemini-2.5-flash"
GEMINI_EMBEDDING_MODEL: str = "gemini-embedding-001"
