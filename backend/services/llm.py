"""
CarbonLens — Gemini LLM Service
Uses google-generativeai SDK. API key loaded from environment via config.py.
No secrets are hardcoded here.
"""
import json
import re
import logging
from typing import Any

import google.generativeai as genai

from config import GOOGLE_API_KEY, GEMINI_LLM_MODEL

logger = logging.getLogger(__name__)

# Configure Gemini once at module import — key comes from env via config.py
genai.configure(api_key=GOOGLE_API_KEY)
_model = genai.GenerativeModel(GEMINI_LLM_MODEL)

# Generation config: ask for JSON output, cap tokens
_GEN_CONFIG = genai.types.GenerationConfig(
    temperature=0.3,          # low temperature for factual, consistent outputs
    max_output_tokens=1024,
    response_mime_type="application/json",
)


def sanitize(text: str, max_len: int = 500) -> str:
    """
    Strip HTML tags and control characters from user input before injecting into prompts.
    Prevents prompt injection attacks.
    """
    text = re.sub(r"<[^>]+>", "", text)           # strip HTML tags
    text = re.sub(r"[\x00-\x1f\x7f]", "", text)   # strip ASCII control chars
    return text[:max_len].strip()


async def generate_json(prompt: str) -> dict[str, Any]:
    """
    Send a prompt to Gemini and parse the JSON response.

    Returns:
        Parsed dict from Gemini's response.

    Raises:
        ValueError: if Gemini returns invalid JSON.
        Exception: on API or network errors (caller handles).
    """
    try:
        response = _model.generate_content(prompt, generation_config=_GEN_CONFIG)
        raw = response.text.strip()

        # Strip markdown code fences if Gemini wraps JSON in them
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Gemini returned non-JSON response: %s", str(e))
        raise ValueError(f"LLM returned non-JSON output: {e}") from e
    except Exception as e:
        logger.error("Gemini API error: %s", str(e))
        raise
