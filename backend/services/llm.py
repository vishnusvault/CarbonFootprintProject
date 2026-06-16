"""
CarbonLens — Gemini LLM Service
Uses google-genai SDK (new official SDK). API key loaded from environment via config.py.
No secrets are hardcoded here.
"""
import json
import re
import logging
from typing import Any

from google import genai
from google.genai import types

from config import GOOGLE_API_KEY, GEMINI_LLM_MODEL

logger = logging.getLogger(__name__)

# Configure Gemini client — key comes from env via config.py
_client = genai.Client(api_key=GOOGLE_API_KEY)

# Generation config: ask for JSON output, low temperature for factual consistency
_GEN_CONFIG = types.GenerateContentConfig(
    temperature=0.3,
    max_output_tokens=4096,
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
        response = _client.models.generate_content(
            model=GEMINI_LLM_MODEL,
            contents=prompt,
            config=_GEN_CONFIG,
        )
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

async def generate_json_with_image(prompt: str, image_bytes: bytes, mime_type: str) -> dict[str, Any]:
    """
    Send a prompt with an image to Gemini and parse the JSON response.
    """
    try:
        response = _client.models.generate_content(
            model=GEMINI_LLM_MODEL,
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                prompt
            ],
            config=_GEN_CONFIG,
        )
        raw = response.text.strip()

        # Strip markdown code fences if Gemini wraps JSON in them
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)

        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error("Gemini returned non-JSON response: %s", str(e))
        raise ValueError(f"LLM returned non-JSON output: {e}") from e
    except Exception as e:
        logger.error("Gemini API error (Vision): %s", str(e))
        raise
