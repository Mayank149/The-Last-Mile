"""In-memory scenario state manager for THE LAST MILE."""

from __future__ import annotations

import copy
import json
from pathlib import Path

from app.config import AREA_NAME
from app.models.domain import (
    Incident,
    RescueTeam,
    ScenarioMetadata,
    Shelter,
    ZoneDefinition,
)
from app.modules.geospatial import RoadNetwork, load_road_network

DATA_DIR = Path(__file__).resolve().parent / "data"
ROAD_GRAPH_PATH = DATA_DIR / "road_graph.json"
SCENARIO_SEED_PATH = DATA_DIR / "scenario_seed.json"


class ScenarioState:
    """Holds active scenario entities and supports deterministic reset."""

    def __init__(self) -> None:
        self._seed_raw: dict = {}
        self.network: RoadNetwork | None = None
        self.scenario_name: str = ""
        self.disclaimer: str = ""
        self.travel_time_note: str = ""
        self.teams: dict[str, RescueTeam] = {}
        self.shelters: dict[str, Shelter] = {}
        self.incidents: dict[str, Incident] = {}
        self.zones: list[ZoneDefinition] = []
        self.load_initial()

    def load_initial(self) -> None:
        """Load prepared road graph and synthetic seed scenario into memory."""
        self._seed_raw = json.loads(SCENARIO_SEED_PATH.read_text(encoding="utf-8"))
        self.network = load_road_network(ROAD_GRAPH_PATH)
        self.reset()

    def reset(self) -> None:
        """Restore scenario entities and road disruption states to initial baseline."""
        if self.network is None:
            self.network = load_road_network(ROAD_GRAPH_PATH)
        else:
            # Reload clean edge states from road_graph.json
            self.network = load_road_network(ROAD_GRAPH_PATH)

        seed = copy.deepcopy(self._seed_raw)
        self.scenario_name = seed["scenario_name"]
        self.disclaimer = seed["disclaimer"]
        self.travel_time_note = seed["travel_time_note"]
        self.teams = {t["id"]: RescueTeam(**t) for t in seed["teams"]}
        self.shelters = {s["id"]: Shelter(**s) for s in seed["shelters"]}
        self.incidents = {i["id"]: Incident(**i) for i in seed["incidents"]}
        self.zones = [ZoneDefinition(**z) for z in seed["zones"]]

    def get_metadata(self) -> ScenarioMetadata:
        assert self.network is not None
        meta = self.network.metadata
        return ScenarioMetadata(
            scenario_name=self.scenario_name,
            area_name=meta.get("area_name", AREA_NAME),
            is_synthetic=True,
            disclaimer=self.disclaimer,
            attribution=meta.get("attribution", "© OpenStreetMap contributors"),
            bbox=meta["bbox"],
            travel_time_note=self.travel_time_note,
            node_count=len(self.network.nodes),
            edge_count=len(self.network.edges),
            disrupted_edge_count=self.network.disrupted_count(),
        )


state: ScenarioState | None = None


def get_state() -> ScenarioState:
    global state
    if state is None:
        state = ScenarioState()
    return state
