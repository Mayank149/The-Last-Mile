"""Phase 1 tests: road graph loading, FastAPI scenario/map endpoints, and reset."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import get_map_roads, get_scenario, health_check, reset_scenario  # noqa: E402


def test_health_endpoint() -> None:
    data = health_check()
    assert data["status"] == "ok"


def test_scenario_endpoint_has_bounded_data_and_disclaimer() -> None:
    data = get_scenario()
    meta = data["metadata"]
    assert meta["is_synthetic"] is True
    assert "OpenStreetMap" in meta["attribution"]
    assert meta["node_count"] > 50
    assert meta["edge_count"] > 100
    assert len(data["teams"]) == 5
    assert len(data["shelters"]) == 4
    assert len(data["incidents"]) == 6
    assert len(data["zones"]) == 6

    # FR-01: Missing/ambiguous location remains unresolved
    unresolved = [i for i in data["incidents"] if i["id"] == "inc-106"][0]
    assert unresolved["coordinates"] is None
    assert unresolved["verification"] == "unverified_location"


def test_map_roads_endpoint() -> None:
    data = get_map_roads()
    assert len(data["edges"]) > 100
    sample = data["edges"][0]
    assert "u" in sample and "v" in sample
    assert sample["length_m"] > 0
    assert sample["effective_travel_time_sec"] > 0
    assert sample["status"] == "open"


def test_reset_endpoint() -> None:
    data = reset_scenario()
    assert data["status"] == "reset_complete"
