"""
CarbonLens — API Integration Tests
Tests all FastAPI endpoints end-to-end using httpx AsyncClient.
Run with: pytest tests/ -v --asyncio-mode=auto
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from httpx import AsyncClient, ASGITransport

# Set required env var before importing app
import os

os.environ.setdefault("GOOGLE_API_KEY", "test-key-not-used-in-unit-tests")
os.environ.setdefault("CORS_ORIGIN", "http://localhost:5173")
os.environ.setdefault(
    "RAG_DB_PATH", str(Path(__file__).parent.parent.parent / "rag" / "db")
)

from main import app


@pytest.fixture
async def client():
    """Provide an async test client for the FastAPI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


class TestCalculateEndpoint:
    """Tests for POST /api/v1/activities/calculate"""

    async def test_petrol_car_100km(self, client):
        """100 km petrol car should return ~18 kg CO2e."""
        r = await client.post(
            "/api/v1/activities/calculate",
            json={
                "category": "transport",
                "activity_type": "car_petrol",
                "quantity": 100,
                "unit": "km",
                "date": "2026-06-17",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert "co2e_kg" in data
        assert 17.0 < data["co2e_kg"] < 20.0

    async def test_ev_car_lower_than_petrol(self, client):
        """EV should produce less CO2e than petrol for the same distance."""
        petrol = await client.post(
            "/api/v1/activities/calculate",
            json={
                "category": "transport",
                "activity_type": "car_petrol",
                "quantity": 100,
                "unit": "km",
                "date": "2026-06-17",
            },
        )
        ev = await client.post(
            "/api/v1/activities/calculate",
            json={
                "category": "transport",
                "activity_type": "car_ev",
                "quantity": 100,
                "unit": "km",
                "date": "2026-06-17",
            },
        )
        assert ev.status_code == 200
        assert ev.json()["co2e_kg"] < petrol.json()["co2e_kg"]

    async def test_route_calculation_chennai_mumbai(self, client):
        """Route Chennai→Mumbai should compute haversine distance and CO2e."""
        r = await client.post(
            "/api/v1/activities/calculate",
            json={
                "category": "transport",
                "activity_type": "car_petrol",
                "quantity": 1,
                "unit": "km",
                "origin": "Chennai",
                "destination": "Mumbai",
                "date": "2026-06-17",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data["distance_km"] is not None
        assert 900 < data["distance_km"] < 1200
        assert data["co2e_kg"] > 0

    async def test_food_biryani(self, client):
        """200g biryani should return a positive CO2e."""
        r = await client.post(
            "/api/v1/activities/calculate",
            json={
                "category": "food",
                "activity_type": "food_biryani",
                "quantity": 200,
                "unit": "g",
                "date": "2026-06-17",
            },
        )
        assert r.status_code == 200
        assert r.json()["co2e_kg"] > 0

    async def test_electricity_india(self, client):
        """10 kWh India electricity should return ~8.2 kg CO2e."""
        r = await client.post(
            "/api/v1/activities/calculate",
            json={
                "category": "energy",
                "activity_type": "electricity_IN",
                "quantity": 10,
                "unit": "kWh",
                "date": "2026-06-17",
            },
        )
        assert r.status_code == 200
        assert 7.0 < r.json()["co2e_kg"] < 10.0

    async def test_invalid_activity_type_returns_422(self, client):
        """Unknown activity type should return HTTP 422."""
        r = await client.post(
            "/api/v1/activities/calculate",
            json={
                "category": "transport",
                "activity_type": "flying_carpet",
                "quantity": 100,
                "unit": "km",
                "date": "2026-06-17",
            },
        )
        assert r.status_code == 422

    async def test_invalid_city_returns_422(self, client):
        """Unknown city in origin/destination should return HTTP 422."""
        r = await client.post(
            "/api/v1/activities/calculate",
            json={
                "category": "transport",
                "activity_type": "car_petrol",
                "quantity": 1,
                "unit": "km",
                "origin": "Narnia",
                "destination": "Mumbai",
                "date": "2026-06-17",
            },
        )
        assert r.status_code == 422

    async def test_missing_required_field_returns_422(self, client):
        """Missing required field should return HTTP 422 validation error."""
        r = await client.post(
            "/api/v1/activities/calculate",
            json={
                "category": "transport"
                # missing activity_type, quantity, unit, date
            },
        )
        assert r.status_code == 422


class TestCitiesEndpoint:
    """Tests for GET /api/v1/cities"""

    async def test_returns_200(self, client):
        """Cities endpoint should return 200 with a data list."""
        r = await client.get("/api/v1/cities")
        assert r.status_code == 200

    async def test_returns_data_key(self, client):
        """Response must include a 'data' key with a list."""
        r = await client.get("/api/v1/cities")
        data = r.json()
        assert "data" in data
        assert isinstance(data["data"], list)

    async def test_includes_major_indian_cities(self, client):
        """Response must include major Indian cities."""
        r = await client.get("/api/v1/cities")
        cities = r.json()["data"]
        for city in ["Mumbai", "Delhi", "Chennai", "Bangalore", "Hyderabad"]:
            assert city in cities, f"{city} not found in cities response"

    async def test_cities_are_sorted(self, client):
        """Cities list should be alphabetically sorted."""
        r = await client.get("/api/v1/cities")
        cities = r.json()["data"]
        assert cities == sorted(cities)

    async def test_more_than_50_cities(self, client):
        """Dataset should contain at least 50 cities."""
        r = await client.get("/api/v1/cities")
        assert len(r.json()["data"]) > 50


class TestHealthEndpoint:
    """Tests for GET /api/v1/health"""

    async def test_health_returns_200(self, client):
        """Health check must return 200."""
        r = await client.get("/api/v1/health")
        assert r.status_code == 200

    async def test_health_returns_status_ok(self, client):
        """Health check response must include status: ok."""
        r = await client.get("/api/v1/health")
        assert r.json().get("status") == "ok"


class TestSPAFallback:
    """Tests that the React SPA fallback works for client-side routes."""

    async def test_api_routes_not_caught_by_spa(self, client):
        """API routes must not be swallowed by the SPA fallback."""
        r = await client.get("/api/v1/cities")
        # Must be JSON, not HTML
        assert r.headers.get("content-type", "").startswith("application/json")
