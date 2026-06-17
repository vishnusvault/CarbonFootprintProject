"""
CarbonLens — Unit Tests: Emission Calculator & City Distance
Run with: pytest tests/ -v
"""

import sys
from pathlib import Path

# Add backend root to path so imports work
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
from services.calculator import calculate_co2e, city_distance, list_cities


class TestCalculateCo2e:
    def test_car_petrol_basic(self):
        """100 km in a petrol car = 18 kg CO2e"""
        result = calculate_co2e("transport", "car_petrol", 100, "km")
        assert result == pytest.approx(18.0, rel=0.01)

    def test_flight_short(self):
        """1330 km short flight at 0.158 kg/km = 210.14 kg CO2e"""
        result = calculate_co2e("transport", "flight_short", 1330, "km")
        assert result == pytest.approx(210.14, rel=0.01)

    def test_ev_lower_than_petrol(self):
        """EV should emit less than petrol for same distance"""
        ev = calculate_co2e("transport", "car_ev", 100, "km")
        petrol = calculate_co2e("transport", "car_petrol", 100, "km")
        assert ev < petrol

    def test_vegan_lower_than_chicken(self):
        """Plant-based foods (lentils/apples) should emit less than chicken."""
        lentils = calculate_co2e("food", "food_lentils", 100, "g")
        apples = calculate_co2e("food", "food_apples", 100, "g")
        chicken = calculate_co2e("food", "food_chicken", 100, "g")
        assert lentils < chicken
        assert apples < chicken

    def test_electricity_india_factor(self):
        """1 kWh India electricity = 0.82 kg CO2e"""
        result = calculate_co2e("energy", "electricity_IN", 1, "kWh")
        assert result == pytest.approx(0.82, rel=0.001)

    def test_invalid_category_raises(self):
        with pytest.raises(ValueError, match="Unknown category"):
            calculate_co2e("invalid_cat", "car_petrol", 100, "km")

    def test_invalid_activity_type_raises(self):
        with pytest.raises(ValueError, match="Unknown activity_type"):
            calculate_co2e("transport", "flying_carpet", 100, "km")

    def test_invalid_unit_raises(self):
        with pytest.raises(ValueError, match="Unknown unit"):
            calculate_co2e("transport", "car_petrol", 100, "litres")

    def test_zero_quantity(self):
        """Zero quantity should return 0.0"""
        result = calculate_co2e("food", "food_apples", 0, "g")
        assert result == 0.0

    def test_purchase_electronics_large(self):
        result = calculate_co2e("purchase", "electronics_large", 1, "item")
        assert result == pytest.approx(200.0, rel=0.001)


class TestCityDistance:
    def test_chennai_to_mumbai(self):
        """Chennai to Mumbai great-circle distance is ~1033 km
        (Note: flight routes are longer due to airways; haversine gives straight-line)"""
        dist = city_distance("Chennai", "Mumbai")
        assert dist is not None
        assert 950 < dist < 1100

    def test_delhi_to_bangalore(self):
        """Delhi to Bangalore should be roughly 1750 km"""
        dist = city_distance("Delhi", "Bangalore")
        assert dist is not None
        assert 1600 < dist < 1900

    def test_same_city_is_zero(self):
        """Same origin and destination should be 0"""
        dist = city_distance("Mumbai", "Mumbai")
        assert dist == pytest.approx(0.0, abs=1.0)

    def test_unknown_city_returns_none(self):
        dist = city_distance("Atlantis", "Mumbai")
        assert dist is None

    def test_both_unknown_returns_none(self):
        dist = city_distance("Narnia", "Hogwarts")
        assert dist is None

    def test_london_to_new_york(self):
        """Transatlantic: ~5500 km"""
        dist = city_distance("London", "New York")
        assert dist is not None
        assert 5000 < dist < 6000

    def test_symmetric(self):
        """Distance A→B should equal B→A"""
        d1 = city_distance("Chennai", "Delhi")
        d2 = city_distance("Delhi", "Chennai")
        assert d1 == pytest.approx(d2, rel=0.001)


class TestListCities:
    def test_returns_list(self):
        cities = list_cities()
        assert isinstance(cities, list)
        assert len(cities) > 50

    def test_includes_major_indian_cities(self):
        cities = list_cities()
        for city in ["Mumbai", "Delhi", "Chennai", "Bangalore", "Kolkata", "Hyderabad"]:
            assert city in cities, f"{city} missing from cities list"

    def test_sorted(self):
        cities = list_cities()
        assert cities == sorted(cities)
