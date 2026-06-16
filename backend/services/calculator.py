"""
CarbonLens — CO2e Calculator Service
Emission factors sourced from IPCC AR6, GHG Protocol, IEA.
All factors documented in emission_factors.json _sources key.
"""
import json
import math
from pathlib import Path
from typing import Optional

# Load emission factors once at module import
_FACTORS_PATH = Path(__file__).parent.parent / "emission_factors.json"
with open(_FACTORS_PATH, "r") as f:
    _RAW = json.load(f)

FACTORS: dict = {k: v for k, v in _RAW.items() if not k.startswith("_")}

# Load city coordinates once at module import
_CITIES_PATH = Path(__file__).parent.parent / "cities.json"
with open(_CITIES_PATH, "r") as f:
    CITIES: dict = json.load(f)


def city_distance(origin: str, destination: str) -> Optional[float]:
    """
    Compute great-circle distance (km) between two cities using haversine formula.
    Returns None if either city is not in the dataset.
    """
    o = CITIES.get(origin)
    d = CITIES.get(destination)
    if o is None or d is None:
        return None

    R = 6371.0  # Earth radius in km
    lat1, lon1 = math.radians(o["lat"]), math.radians(o["lon"])
    lat2, lon2 = math.radians(d["lat"]), math.radians(d["lon"])

    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c, 1)


def calculate_co2e(
    category: str,
    activity_type: str,
    quantity: float,
    unit: str,
) -> float:
    """
    Calculate CO2e in kg for a given activity.

    Args:
        category: 'transport' | 'energy' | 'food' | 'purchase'
        activity_type: e.g. 'car_petrol', 'flight_short', 'meal_vegan'
        quantity: numeric amount
        unit: e.g. 'km', 'kWh', 'meal', 'item', 'litre', 'hour'

    Returns:
        CO2e in kg, rounded to 3 decimal places.

    Raises:
        ValueError: if category/activity_type/unit combination is unknown.
    """
    cat = FACTORS.get(category)
    if cat is None:
        raise ValueError(f"Unknown category: {category!r}")

    activity = cat.get(activity_type)
    if activity is None:
        raise ValueError(f"Unknown activity_type {activity_type!r} in category {category!r}")

    factor = activity.get(unit)
    if factor is None:
        raise ValueError(
            f"Unknown unit {unit!r} for {category}/{activity_type}. "
            f"Valid units: {list(activity.keys())}"
        )

    return round(quantity * factor, 3)


def get_all_factors() -> dict:
    """Return the full emission factors dictionary (excluding _sources)."""
    return FACTORS


def list_cities() -> list[str]:
    """Return sorted list of all known city names."""
    return sorted(CITIES.keys())
