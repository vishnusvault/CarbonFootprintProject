"""
CarbonLens RAG — Document Ingestion Pipeline
Run once during Docker build to create ChromaDB index from source documents.

Usage:
    python rag/ingest.py

Requires GOOGLE_API_KEY in environment (for text-embedding-004).
Documents are read from rag/data/. ChromaDB index written to RAG_DB_PATH.
"""
import os
import sys
import logging
from pathlib import Path

# Allow running from repo root or rag/ directory
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT / "backend"))

from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from google import genai
import chromadb
from chromadb import Settings
from langchain_text_splitters import RecursiveCharacterTextSplitter

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s — %(message)s")
logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────
GOOGLE_API_KEY = os.environ["GOOGLE_API_KEY"]
RAG_DB_PATH = os.getenv("RAG_DB_PATH", str(ROOT / "rag" / "db"))
DATA_DIR = ROOT / "rag" / "data"
COLLECTION_NAME = "carbonlens_climate"
CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
EMBEDDING_MODEL = "models/text-embedding-004"

_client = genai.Client(api_key=GOOGLE_API_KEY)


# ── Embedding Function ────────────────────────────────────────────────────────
def embed_texts(texts: list[str], task_type: str = "retrieval_document") -> list[list[float]]:
    """Batch embed texts using Google text-embedding-004."""
    embeddings = []
    for text in texts:
        result = _client.models.embed_content(
            model=EMBEDDING_MODEL,
            contents=text,
            config={"task_type": task_type},
        )
        embeddings.append(result.embeddings[0].values)
    return embeddings


# ── ChromaDB Custom Embedding Function ───────────────────────────────────────
class GoogleEmbeddingFunction(chromadb.EmbeddingFunction):
    def __call__(self, input: list[str]) -> list[list[float]]:
        results = []
        for text in input:
            result = _client.models.embed_content(
                model=EMBEDDING_MODEL,
                contents=text,
                config={"task_type": "retrieval_document"},
            )
            results.append(result.embeddings[0].values)
        return results


# ── Main Ingestion ────────────────────────────────────────────────────────────
def ingest() -> None:
    logger.info("Starting RAG ingestion from %s", DATA_DIR)
    logger.info("ChromaDB will be written to %s", RAG_DB_PATH)

    if not DATA_DIR.exists():
        logger.error("Data directory not found: %s", DATA_DIR)
        sys.exit(1)

    # Collect all text documents
    doc_files = list(DATA_DIR.glob("*.txt")) + list(DATA_DIR.glob("*.md"))
    if not doc_files:
        logger.warning("No .txt or .md files found in %s", DATA_DIR)
        sys.exit(0)

    logger.info("Found %d document files", len(doc_files))

    # Split into chunks
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE * 4,   # approx chars (4 chars per token)
        chunk_overlap=CHUNK_OVERLAP * 4,
        length_function=len,
    )

    all_chunks: list[str] = []
    all_metadata: list[dict] = []

    for doc_file in doc_files:
        logger.info("Processing: %s", doc_file.name)
        text = doc_file.read_text(encoding="utf-8", errors="ignore")
        chunks = splitter.split_text(text)
        for i, chunk in enumerate(chunks):
            all_chunks.append(chunk)
            all_metadata.append({
                "source_doc": doc_file.stem,
                "chunk_index": i,
                "filename": doc_file.name,
            })

    logger.info("Total chunks: %d", len(all_chunks))

    # Create/reset ChromaDB collection
    client = chromadb.PersistentClient(
        path=RAG_DB_PATH,
        settings=Settings(anonymized_telemetry=False),
    )

    # Delete existing collection to rebuild fresh
    try:
        client.delete_collection(COLLECTION_NAME)
        logger.info("Deleted existing collection")
    except Exception:
        pass

    collection = client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=GoogleEmbeddingFunction(),
        metadata={"hnsw:space": "cosine"},
    )

    # Embed and add in batches of 10 (API rate limit friendly)
    BATCH = 10
    for i in range(0, len(all_chunks), BATCH):
        batch_texts = all_chunks[i : i + BATCH]
        batch_meta = all_metadata[i : i + BATCH]
        batch_ids = [f"chunk_{i + j}" for j in range(len(batch_texts))]

        collection.add(
            documents=batch_texts,
            metadatas=batch_meta,
            ids=batch_ids,
        )
        logger.info("Embedded chunks %d–%d", i, i + len(batch_texts) - 1)

    logger.info("✅ RAG ingestion complete — %d chunks indexed in %s", len(all_chunks), RAG_DB_PATH)


if __name__ == "__main__":
    ingest()
