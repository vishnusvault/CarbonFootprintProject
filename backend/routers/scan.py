import logging
from fastapi import APIRouter, HTTPException, UploadFile
from services.llm import generate_json_with_image
from services.calculator import calculate_co2e, get_all_factors

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/scan", tags=["scan"])

@router.post("/receipt")
async def scan_receipt(file: UploadFile):
    """
    Scan a receipt/bill using Gemini Vision and extract carbon-emitting activities.
    """
    image_bytes = await file.read()
    mime_type = file.content_type
    
    if not mime_type or not (mime_type.startswith("image/") or mime_type == "application/pdf"):
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload an image or PDF.")

    factors = get_all_factors()
    valid_categories = list(factors.keys())
    valid_activities = []
    for cat in factors.values():
        valid_activities.extend(cat.keys())

    prompt = f"""Extract all carbon-relevant items from this receipt or bill.
Return ONLY a valid JSON object with an "items" array, no other text or explanation.

Valid categories: {', '.join(valid_categories)}
Valid activity_type values: {', '.join(valid_activities)}

Return format:
{{
  "items": [
    {{
      "description": "human readable name",
      "category": "transport|energy|food|purchase",
      "activity_type": "one of the valid activity_type keys",
      "quantity": number,
      "unit": "km|kWh|litre|meal|item|kg",
      "confidence": "high|medium|low"
    }}
  ]
}}
If nothing relevant found, return {{"items": []}}.
Only include items that have a carbon footprint."""

    try:
        result = await generate_json_with_image(prompt, image_bytes, mime_type)
    except Exception as e:
        logger.error("Gemini vision scan failed: %s", str(e))
        raise HTTPException(status_code=502, detail="Failed to scan receipt. Please try again.") from e

    items = result.get("items", [])

    # Add CO2e calculations
    for item in items:
        try:
            item["co2e_kg"] = calculate_co2e(
                item["category"],
                item["activity_type"],
                item["quantity"],
                item["unit"]
            )
        except Exception:
            item["co2e_kg"] = 0.0

    return {"items": items, "count": len(items)}
