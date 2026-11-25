"""Geospatial module: road graph loading, NetworkX representation, and spatial helpers."""

from __future__ import annotations

import json
import math
from pathlib import Path

import networkx as nx

from app.models.domain import Coordinates, RoadEdge, RoadNode, RoadStatus


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute approximate great-circle distance in meters between two coordinates."""
    r = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def point_in_polygon(lat: float, lon: float, polygon: list[list[float]]) -> bool:
    """Ray-casting point-in-polygon check for [lat, lon] coordinates."""
    inside = False
    n = len(polygon)
    if n < 3:
        return False
    j = n - 1
    for i in range(n):
        yi, xi = polygon[i]
        yj, xj = polygon[j]
        intersects = ((yi > lat) != (yj > lat)) and (
            lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


class RoadNetwork:
    """In-memory prepared road network backed by NetworkX MultiDiGraph."""

    def __init__(self, metadata: dict, nodes: list[RoadNode], edges: list[RoadEdge]) -> None:
        self.metadata = metadata
        self.nodes: dict[str, RoadNode] = {n.id: n for n in nodes}
        self.edges: dict[str, RoadEdge] = {e.id: e for e in edges}
        self.graph = nx.MultiDiGraph()
        self._build_graph()

    def _build_graph(self) -> None:
        self.graph.clear()
        for node_id, node in self.nodes.items():
            self.graph.add_node(node_id, lat=node.lat, lon=node.lon)
        for edge in self.edges.values():
            self.graph.add_edge(
                edge.u,
                edge.v,
                key=edge.key,
                edge_id=edge.id,
                length_m=edge.length_m,
                base_travel_time_sec=edge.base_travel_time_sec,
                effective_travel_time_sec=edge.effective_travel_time_sec,
                status=edge.status.value,
            )

    def rebuild_graph(self) -> None:
        """Synchronize the NetworkX graph with current edge disruption states."""
        self._build_graph()

    def nearest_node(self, coords: Coordinates) -> str:
        """Find the nearest graph node ID to the given coordinates."""
        best_id = ""
        best_dist = float("inf")
        for node_id, node in self.nodes.items():
            d = haversine_m(coords.lat, coords.lon, node.lat, node.lon)
            if d < best_dist:
                best_dist = d
                best_id = node_id
        return best_id

    def active_digraph(self) -> nx.DiGraph:
        """Return a directed graph containing only non-blocked edges with minimum effective travel time."""
        dg = nx.DiGraph()
        for node_id, node in self.nodes.items():
            dg.add_node(node_id, lat=node.lat, lon=node.lon)
        for edge in self.edges.values():
            if edge.status == RoadStatus.BLOCKED:
                continue
            weight = edge.effective_travel_time_sec
            if dg.has_edge(edge.u, edge.v):
                if weight < dg[edge.u][edge.v]["weight"]:
                    dg[edge.u][edge.v]["weight"] = weight
                    dg[edge.u][edge.v]["edge_id"] = edge.id
            else:
                dg.add_edge(edge.u, edge.v, weight=weight, edge_id=edge.id)
        return dg

    def disrupted_count(self) -> int:
        return sum(1 for e in self.edges.values() if e.status != RoadStatus.OPEN)


def load_road_network(data_path: Path) -> RoadNetwork:
    """Load prepared road graph JSON from disk."""
    raw = json.loads(data_path.read_text(encoding="utf-8"))
    nodes = [RoadNode(**n) for n in raw["nodes"]]
    edges = [
        RoadEdge(
            **e,
            effective_travel_time_sec=e["base_travel_time_sec"],
            status=RoadStatus.OPEN,
        )
        for e in raw["edges"]
    ]
    return RoadNetwork(metadata=raw["metadata"], nodes=nodes, edges=edges)
