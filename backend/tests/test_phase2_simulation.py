"""Phase 2 tests: road disruption (blocked/degraded), routing, and reset."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import (  # noqa: E402
    reset_scenario,
    run_route_simulation,
    update_road_disruptions,
)
from app.models.domain import RoadDisruptionRequest, RoadStatus, SimulationRunRequest  # noqa: E402


def test_baseline_simulation_routes_reachable() -> None:
    reset_scenario()
    sim = run_route_simulation(SimulationRunRequest(team_id="team-1", incident_id="inc-101"))
    assert sim["disrupted_edge_count"] == 0
    assert sim["reachable_pairs"] == 1
    assert sim["unreachable_pairs"] == 0
    route = sim["routes"][0]
    assert route["reachable"] is True
    assert route["current_travel_time_sec"] == route["baseline_travel_time_sec"]
    assert len(route["used_edge_ids"]) >= 1
    assert "Modelled estimates" in sim["travel_time_note"]


def test_degrading_used_edge_increases_travel_time() -> None:
    reset_scenario()
    base_sim = run_route_simulation(SimulationRunRequest(team_id="team-1", incident_id="inc-101"))
    base_route = base_sim["routes"][0]
    target_edge = base_route["used_edge_ids"][0]

    res = update_road_disruptions(
        RoadDisruptionRequest(edge_ids=[target_edge], status=RoadStatus.DEGRADED)
    )
    assert res["disrupted_edge_count"] >= 1

    after_sim = run_route_simulation(SimulationRunRequest(team_id="team-1", incident_id="inc-101"))
    after_route = after_sim["routes"][0]
    assert after_route["reachable"] is True
    assert after_route["current_travel_time_sec"] > base_route["current_travel_time_sec"]


def test_blocking_used_edge_changes_route_or_makes_unreachable() -> None:
    reset_scenario()
    base_sim = run_route_simulation(SimulationRunRequest(team_id="team-1", incident_id="inc-101"))
    used_edges = base_sim["routes"][0]["used_edge_ids"]
    mid_edge = used_edges[len(used_edges) // 2]

    update_road_disruptions(
        RoadDisruptionRequest(edge_ids=[mid_edge], status=RoadStatus.BLOCKED)
    )
    after_sim = run_route_simulation(SimulationRunRequest(team_id="team-1", incident_id="inc-101"))
    after_route = after_sim["routes"][0]
    # Either a detour was taken (different edge list / longer time) or it became unreachable
    if after_route["reachable"]:
        assert mid_edge not in after_route["used_edge_ids"]
        assert after_route["current_travel_time_sec"] >= base_sim["routes"][0]["current_travel_time_sec"]
    else:
        assert after_route["route_status"] == "unreachable"

    # Reset restores clean state
    reset_scenario()
    restored = run_route_simulation(SimulationRunRequest(team_id="team-1", incident_id="inc-101"))
    assert restored["disrupted_edge_count"] == 0
    assert restored["routes"][0]["current_travel_time_sec"] == base_sim["routes"][0]["current_travel_time_sec"]
