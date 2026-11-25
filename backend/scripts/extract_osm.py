"""Extract and prepare the bounded OpenStreetMap road network for Koramangala & Ejipura.

Outputs a compact JSON graph (`backend/app/data/road_graph.json`) with intersections
as nodes and road segments as directed edges with length, road class, name,
and modelled base travel time (seconds) based on documented assumed speeds.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

import networkx as nx
import osmnx as ox

# Allow importing app.config when executed as a standalone script
BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.config import (  # noqa: E402
    AREA_NAME,
    ASSUMED_SPEED_KMH,
    BBOX_EAST,
    BBOX_NORTH,
    BBOX_SOUTH,
    BBOX_WEST,
    DEFAULT_SPEED_KMH,
)


def _extract_highway_class(raw_highway: str | list[str] | None) -> str:
    """Normalize OSM highway attribute to a single string road class."""
    if isinstance(raw_highway, list):
        return str(raw_highway[0]) if raw_highway else "unclassified"
    if raw_highway:
        return str(raw_highway)
    return "unclassified"


def _extract_road_name(raw_name: str | list[str] | None) -> str:
    """Normalize OSM road name attribute."""
    if isinstance(raw_name, list):
        return ", ".join(str(n) for n in raw_name if n)
    if raw_name:
        return str(raw_name)
    return "Unnamed road"


def _estimate_travel_time_sec(length_m: float, road_type: str) -> float:
    """Compute modelled travel time in seconds from length and assumed class speed."""
    speed_kmh = ASSUMED_SPEED_KMH.get(road_type, DEFAULT_SPEED_KMH)
    speed_mps = speed_kmh * 1000.0 / 3600.0
    return round(length_m / max(speed_mps, 0.1), 2)


def download_and_prepare_graph() -> dict:
    """Download driveable road network from OSM and convert to prepared JSON."""
    ox.settings.requests_timeout = 60
    ox.settings.overpass_rate_limit = False

    endpoints = [
        "https://overpass.private.coffee/api",
        "https://maps.mail.ru/osm/tools/overpass/api",
        "https://overpass-api.de/api",
    ]

    ox_major = int(ox.__version__.split(".")[0])
    G = None
    last_err: Exception | None = None
    for endpoint in endpoints:
        try:
            ox.settings.overpass_url = endpoint
            print(f"Trying Overpass endpoint: {endpoint}", flush=True)
            if ox_major >= 2:
                G = ox.graph_from_bbox(
                    bbox=(BBOX_WEST, BBOX_SOUTH, BBOX_EAST, BBOX_NORTH),
                    network_type="drive",
                    simplify=True,
                )
            else:
                G = ox.graph_from_bbox(
                    north=BBOX_NORTH,
                    south=BBOX_SOUTH,
                    east=BBOX_EAST,
                    west=BBOX_WEST,
                    network_type="drive",
                    simplify=True,
                )
            break
        except Exception as exc:
            print(f"Endpoint {endpoint} failed: {exc}", flush=True)
            last_err = exc

    if G is None:
        raise RuntimeError(f"All Overpass endpoints failed: {last_err}")

    # Keep the largest strongly connected component so routing is well-behaved
    if not nx.is_strongly_connected(G):
        largest_scc = max(nx.strongly_connected_components(G), key=len)
        G = G.subgraph(largest_scc).copy()

    nodes_out = []
    for node_id, data in G.nodes(data=True):
        nodes_out.append(
            {
                "id": str(node_id),
                "lat": round(float(data["y"]), 6),
                "lon": round(float(data["x"]), 6),
            }
        )

    edges_out = []
    for idx, (u, v, key, data) in enumerate(G.edges(keys=True, data=True)):
        length_m = round(float(data.get("length", 50.0)), 2)
        road_type = _extract_highway_class(data.get("highway"))
        name = _extract_road_name(data.get("name"))
        travel_time_sec = _estimate_travel_time_sec(length_m, road_type)

        if "geometry" in data and data["geometry"] is not None:
            coords = [
                [round(float(lat), 6), round(float(lon), 6)]
                for lon, lat in data["geometry"].coords
            ]
        else:
            u_data = G.nodes[u]
            v_data = G.nodes[v]
            coords = [
                [round(float(u_data["y"]), 6), round(float(u_data["x"]), 6)],
                [round(float(v_data["y"]), 6), round(float(v_data["x"]), 6)],
            ]

        edges_out.append(
            {
                "id": f"e_{u}_{v}_{key}_{idx}",
                "u": str(u),
                "v": str(v),
                "key": int(key),
                "name": name,
                "road_type": road_type,
                "length_m": length_m,
                "base_travel_time_sec": travel_time_sec,
                "coords": coords,
            }
        )

    return {
        "metadata": {
            "area_name": AREA_NAME,
            "bbox": {
                "north": BBOX_NORTH,
                "south": BBOX_SOUTH,
                "east": BBOX_EAST,
                "west": BBOX_WEST,
            },
            "source": "OpenStreetMap via OSMnx (ODbL)",
            "attribution": "© OpenStreetMap contributors",
            "node_count": len(nodes_out),
            "edge_count": len(edges_out),
            "assumed_speeds_kmh": ASSUMED_SPEED_KMH,
        },
        "nodes": nodes_out,
        "edges": edges_out,
    }


def main() -> None:
    output_path = BACKEND_DIR / "app" / "data" / "road_graph.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    print(f"Downloading OSM drive network for {AREA_NAME}...")
    graph_data = download_and_prepare_graph()
    output_path.write_text(json.dumps(graph_data, indent=2), encoding="utf-8")
    meta = graph_data["metadata"]
    print(
        f"Saved prepared road graph to {output_path} "
        f"({meta['node_count']} nodes, {meta['edge_count']} edges)."
    )


if __name__ == "__main__":
    main()
