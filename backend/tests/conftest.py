"""
CarbonLens — pytest Configuration

Test suite validates the core problem statement:
  "Help individuals understand and reduce their personal carbon footprint
  through AI-powered activity tracking and personalised suggestions."

Coverage targets:
  - Emission calculation accuracy  (IPCC/DEFRA/IEA emission factors)
  - API endpoint correctness       (all 5 routers)
  - Input sanitisation / security  (prompt injection prevention)
  - City distance computation      (haversine formula)
  - Data validation                (pydantic model enforcement)

Run all tests:
  pytest tests/ -v --cov=. --cov-report=term-missing

Run fast (no network):
  pytest tests/test_calculator.py tests/test_security.py -v
"""

import os

# Ensure env vars are set before any imports that read them
os.environ.setdefault("GOOGLE_API_KEY", "test-placeholder-not-used-in-unit-tests")
os.environ.setdefault("CORS_ORIGIN", "http://localhost:5173")


def pytest_configure(config):
    """Register custom pytest markers."""
    config.addinivalue_line("markers", "unit: fast unit tests with no I/O")
    config.addinivalue_line("markers", "integration: tests that call the FastAPI app")
    config.addinivalue_line("markers", "security: tests validating input sanitisation")
