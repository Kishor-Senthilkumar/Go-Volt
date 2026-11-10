from app.services.chargers import normalize_station, parse_price


def test_parse_price_recognizes_explicit_per_kwh_currency():
    assert parse_price("INR 18 per kWh") == {
        "amount": 18.0,
        "currency": "INR",
        "unit": "kWh",
        "is_estimated": False,
    }
    assert parse_price("€0.35/kWh") == {
        "amount": 0.35,
        "currency": "EUR",
        "unit": "kWh",
        "is_estimated": False,
    }
    assert parse_price("$0.40 per kWh") == {
        "amount": 0.4,
        "currency": "USD",
        "unit": "kWh",
        "is_estimated": False,
    }


def test_parse_price_does_not_guess_ambiguous_fees():
    assert parse_price("$2 connection fee + $0.50/minute") is None
    assert parse_price("₹18 session fee") is None
    assert parse_price(None) is None


def test_normalize_station_calculates_distance_and_connector_data():
    station = normalize_station(
        {
            "ID": 23,
            "AddressInfo": {"Title": "Test charger", "AddressLine1": "1 Main St", "Town": "Pune", "Latitude": 18.52, "Longitude": 73.85},
            "OperatorInfo": {"Title": "Example operator", "WebsiteURL": "https://example.test"},
            "UsageCost": "₹18/kWh",
            "Connections": [{"ConnectionType": {"Title": "CCS (Type 2)"}, "PowerKW": 60, "Level": {"Title": "Level 3"}}],
        },
        18.5,
        73.8,
    )
    assert station is not None
    assert station["id"] == 23
    assert station["connector_types"] == ["CCS"]
    assert station["max_power_kw"] == 60
    assert station["price_per_kwh"]["currency"] == "INR"
    assert 5 < station["distance_km"] < 7


def test_normalize_station_rejects_missing_coordinates():
    assert normalize_station({"ID": 1, "AddressInfo": {}}, 0, 0) is None