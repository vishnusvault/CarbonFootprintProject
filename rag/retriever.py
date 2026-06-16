"""
CarbonLens RAG — Retriever
Loads the pre-built ChromaDB index and retrieves top-k chunks for a query.
Uses Google text-embedding-004 for query embedding (same model as ingestion).
"""
import os
import sys
import logging
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "backend"))

import google.generativeai as genai
import chromadb
from chromadb import Settings

from config import GOOGLE_API_KEY, RAG_DB_PATH, GEMINI_EMBEDDING_MODEL

logger = logging.getLogger(__name__)

genai.configure(api_key=GOOGLE_API_KEY)

COLLECTION_NAME = "carbonlens_climate"

# ── Lazy-loaded client (created on first use) ─────────────────────────────────
_client: chromadb.PersistentClient | None = None
_collection = None


def _get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(
            path=RAG_DB_PATH,
            settings=Settings(anonymized_telemetry=False),
        )
        try:
            _collection = _client.get_collection(COLLECTION_NAME)
            logger.info("RAG collection loaded: %d chunks", _collection.count())
        except Exception as e:
            logger.warning("RAG collection not found (%s) — RAG disabled", e)
            _collection = None
    return _collection


def _embed_query(text: str) -> list[float]:
    result = genai.embed_content(
        model=GEMINI_EMBEDDING_MODEL,
        content=text,
        task_type="retrieval_query",   # different task type for queries vs documents
    )
    return result["embedding"]


def retrieve(query: str, top_k: int = 3) -> list[dict]:
    """
    Retrieve top-k most relevant chunks for the given query.

    Args:
        query: user's question or activity description
        top_k: number of chunks to return

    Returns:
        List of dicts: [{"chunk_text": str, "source_doc": str, "chunk_index": int}]
        Returns empty list if RAG collection is unavailable.
    """
    collection = _get_collection()
    if collection is None:
        logger.warning("RAG unavailable — returning empty context")
        return []

    try:
        query_embedding = _embed_query(query)
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(top_k, collection.count()),
            include=["documents", "metadatas", "distances"],
        )

        chunks = []
        for doc, meta in zip(results["documents"][0], results["metadatas"][0]):
            chunks.append({
                "chunk_text": doc,
                "source_doc": meta.get("source_doc", "Unknown"),
                "chunk_index": meta.get("chunk_index", 0),
            })
        return chunks

    except Exception as e:
        logger.error("RAG retrieval error: %s", e)
        return []
