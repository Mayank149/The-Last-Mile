"""Simulation module: road closures/degradations, shortest-path routing, and reachability."""

from __future__ import annotations

import networkx as nx

from app.config import DEGRADED_TIME_MULTIPLIER
from app.models.domain import (
    Coordinates,
    Incident,
    RescueTeam,
    RoadEdge,
    RoadStatus,
    RouteComparison,
    SimulationResult,
)
from app.modules.geospatial import RoadNetwork


def apply_road_disruptions(
    network: RoadNetwork,
    edge_ids: list[str],
    status: RoadStatus,
    apply_reverse: bool = True,
) -> list[RoadEdge]:
    """Update status and effective travel time for target edges (and optional reverse edges)."""
    updated: list[RoadEdge] = []
    target_pairs: set[tuple[str, str]] = set()

    for eid in edge_ids:
        edge = network.edges.get(eid)
        if edge is None:
            continue
        _set_edge_status(edge, status)
        updated.append(edge)
        if apply_reverse:
            target_pairs.add((edge.v, edge.u))

    if apply_reverse and target_pairs:
        for edge in network.edges.values():
            if (edge.u, edge.v) in target_pairs and edge.id not in edge_ids:
                _set_edge_status(edge, status)
                updated.append(edge)

    network.rebuild_graph()
    return updated


def _set_edge_status(edge: RoadEdge, status: RoadStatus) -> None:
    edge.status = status
    if status == RoadStatus.OPEN:
        edge.effective_travel_time_sec = edge.base_travel_time_sec
    elif status == RoadStatus.DEGRADED:
        edge.effective_travel_time_sec = round(
            edge.base_travel_time_sec * DEGRADED_TIME_MULTIPLIER, 2
        )
    else:  # BLOCKED
        edge.effective_travel_time_sec = float("inf")


def build_baseline_digraph(network: RoadNetwork) -> nx.DiGraph:
    """Build an undisrupted directed graph using base_travel_time_sec."""
    dg = nx.DiGraph()
    for node_id, node in network.nodes.items():
        dg.add_node(node_id, lat=node.lat, lon=node.lon)
    for edge in network.edges.values():
        w = edge.base_travel_time_sec
        if dg.has_edge(edge.u, edge.v):
            if w < dg[edge.u][edge.v]["weight"]:
                dg[edge.u][edge.v]["weight"] = w
                dg[edge.u][edge.v]["edge_id"] = edge.id
        else:
            dg.add_edge(edge.u, edge.v, weight=w, edge_id=edge.id)
    return dg


def shortest_path_between(
    dg: nx.DiGraph,
    network: RoadNetwork,
    origin: Coordinates,
    destination: Coordinates,
) -> tuple[float, float, list[list[float]], list[str]] | None:
    """Compute shortest path by travel time between two coordinates.

    Returns (travel_time_sec, distance_m, path_coords, used_edge_ids) or None if unreachable.
    """
    orig_node = network.nearest_node(origin)
    dest_node = network.nearest_node(destination)
    if not orig_node or not dest_node:
        return None
    if orig_node == dest_node:
        n = network.nodes[orig_node]
        return 0.0, 0.0, [[n.lat, n.lon]], []

    try:
        node_path = nx.shortest_path(dg, source=orig_node, target=dest_node, weight="weight")
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return None

    total_time = 0.0
    total_dist = 0.0
    path_coords: list[list[float]] = []
    used_edge_ids: list[str] = []

    for i in range(len(node_path) - 1):
        u, v = node_path[i], node_path[i + 1]
        edata = dg[u][v]
        eid = edata["edge_id"]
        edge = network.edges[eid]
        total_time += edata["weight"]
        total_dist += edge.length_m
        used_edge_ids.append(eid)
        if not path_coords:
            path_coords.extend(edge.coords)
        else:
            path_coords.extend(edge.coords[1:])

    return round(total_time, 2), round(total_dist, 2), path_coords, used_edge_ids


def run_simulation(
    network: RoadNetwork,
    teams: list[RescueTeam],
    incidents: list[Incident],
    travel_time_note: str,
    team_id: str | None = None,
    incident_id: str | None = None,
) -> SimulationResult:
    """Recalculate routes and reachability across team-to-incident pairs vs baseline."""
    baseline_dg = build_baseline_digraph(network)
    active_dg = network.active_digraph()

    target_teams = [t for t in teams if (team_id is None or t.id == team_id)]
    target_incidents = [
        inc
        for inc in incidents
        if inc.coordinates is not None and (incident_id is None or inc.id == incident_id)
    ]

    routes: list[RouteComparison] = []
    reachable_pairs = 0
    unreachable_pairs = 0
    delayed_or_detoured_pairs = 0

    for team in target_teams:
        for inc in target_incidents:
            assert inc.coordinates is not None
            base_res = shortest_path_between(baseline_dg, network, team.coordinates, inc.coordinates)
            curr_res = shortest_path_between(active_dg, network, team.coordinates, inc.coordinates)

            base_time = base_res[0] if base_res else None
            if curr_res is None:
                unreachable_pairs += 1
                routes.append(
                    RouteComparison(
                        team_id=team.id,
                        team_name=team.name,
                        incident_id=inc.id,
                        incident_label=inc.location_hint or inc.id,
                        reachable=False,
                        baseline_travel_time_sec=base_time,
                        current_travel_time_sec=None,
                        delta_sec=None,
                        distance_m=None,
                        route_status="unreachable",
                        path_coords=[],
                        used_edge_ids=[],
                        note="No open path in current disrupted road network.",
                    )
                )
            else:
                curr_time, dist_m, coords, eids = curr_res
                reachable_pairs += 1
                delta = round(curr_time - base_time, 2) if base_time is not None else 0.0
                if delta > 0.5:
                    delayed_or_detoured_pairs += 1
                    r_status = "detoured_or_delayed"
                    note = f"Modelled travel time increased by +{delta:.0f}s due to road disruption."
                else:
                    r_status = "unchanged"
                    note = "Unaffected by current road disruptions."

                routes.append(
                    RouteComparison(
                        team_id=team.id,
                        team_name=team.name,
                        incident_id=inc.id,
                        incident_label=inc.location_hint or inc.id,
                        reachable=True,
                        baseline_travel_time_sec=base_time,
                        current_travel_time_sec=curr_time,
                        delta_sec=delta,
                        distance_m=dist_m,
                        route_status=r_status,
                        path_coords=coords,
                        used_edge_ids=eids,
                        note=note,
                    )
                )

    blocked_count = sum(1 for e in network.edges.values() if e.status == RoadStatus.BLOCKED)
    degraded_count = sum(1 for e in network.edges.values() if e.status == RoadStatus.DEGRADED)

    return SimulationResult(
        disrupted_edge_count=blocked_count + degraded_count,
        blocked_edge_count=blocked_count,
        degraded_edge_count=degraded_count,
        reachable_pairs=reachable_pairs,
        unreachable_pairs=unreachable_pairs,
        delayed_or_detoured_pairs=delayed_or_detoured_pairs,
        travel_time_note=travel_time_note,
        routes=routes,
    )
