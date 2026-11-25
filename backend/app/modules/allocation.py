"""Resource allocation module: OR-Tools optimisation vs nearest-eligible-team baseline (FR-05)."""

from __future__ import annotations

from ortools.linear_solver import pywraplp

from app.models.domain import Incident, RescueTeam, VerificationStatus
from app.modules.geospatial import RoadNetwork
from app.modules.simulation import shortest_path_between

HUMAN_REVIEW_NOTE = (
    "Recommendations require human coordinator approval; no autonomous dispatch is performed."
)
PRIORITY_WEIGHT_SEC = 1000.0


def run_allocation(
    network: RoadNetwork,
    teams: list[RescueTeam],
    incidents: list[Incident],
) -> dict:
    """Compute OR-Tools constrained team-to-incident allocation and compare with greedy baseline."""
    active_dg = network.active_digraph()
    available_teams = [t for t in teams if t.availability == "available"]

    # Precompute reachable travel costs for eligible (team, incident) pairs
    travel_matrix: dict[tuple[str, str], tuple[float, float, list[list[float]]]] = {}
    ineligible_reasons: dict[str, str] = {}
    eligible_incidents: list[Incident] = []

    for inc in incidents:
        if inc.coordinates is None or inc.verification != VerificationStatus.VERIFIED:
            ineligible_reasons[inc.id] = (
                "Location unverified; requires operator verification before assignment."
            )
            continue

        capable_teams = [t for t in available_teams if inc.required_capability in t.capabilities]
        if not capable_teams:
            ineligible_reasons[inc.id] = (
                f"No available team supports required capability '{inc.required_capability}'."
            )
            continue

        any_reachable = False
        for team in capable_teams:
            if team.capacity < inc.estimated_demand:
                continue
            res = shortest_path_between(active_dg, network, team.coordinates, inc.coordinates)
            if res is not None:
                travel_time_sec, dist_m, path_coords, _ = res
                travel_matrix[(team.id, inc.id)] = (travel_time_sec, dist_m, path_coords)
                any_reachable = True

        if not any_reachable:
            ineligible_reasons[inc.id] = (
                "Unreachable on current disrupted road network or insufficient team capacity."
            )
            continue

        eligible_incidents.append(inc)

    optimised = _solve_ortools(available_teams, eligible_incidents, incidents, travel_matrix, ineligible_reasons)
    baseline = _solve_nearest_baseline(available_teams, eligible_incidents, incidents, travel_matrix, ineligible_reasons)

    time_saved_sec = round(
        baseline["total_travel_time_sec"] - optimised["total_travel_time_sec"], 2
    )
    priority_gain = optimised["total_priority_covered"] - baseline["total_priority_covered"]

    return {
        "human_review_note": HUMAN_REVIEW_NOTE,
        "optimised": optimised,
        "baseline": baseline,
        "comparison": {
            "travel_time_saved_sec": time_saved_sec,
            "priority_gain": priority_gain,
            "summary": (
                f"OR-Tools covered priority {optimised['total_priority_covered']} "
                f"in {optimised['total_travel_time_sec']:.0f}s vs baseline priority "
                f"{baseline['total_priority_covered']} in {baseline['total_travel_time_sec']:.0f}s."
            ),
        },
    }


def _solve_ortools(
    teams: list[RescueTeam],
    eligible_incidents: list[Incident],
    all_incidents: list[Incident],
    travel_matrix: dict[tuple[str, str], tuple[float, float, list[list[float]]]],
    ineligible_reasons: dict[str, str],
) -> dict:
    solver = pywraplp.Solver.CreateSolver("SCIP")
    if solver is None:
        solver = pywraplp.Solver.CreateSolver("CBC")
    assert solver is not None, "No MILP solver available in OR-Tools."

    x: dict[tuple[str, str], pywraplp.Variable] = {}
    for team in teams:
        for inc in eligible_incidents:
            if (team.id, inc.id) in travel_matrix:
                x[(team.id, inc.id)] = solver.BoolVar(f"x_{team.id}_{inc.id}")

    # Each incident assigned to at most 1 team
    for inc in eligible_incidents:
        vars_for_inc = [x[(t.id, inc.id)] for t in teams if (t.id, inc.id) in x]
        if vars_for_inc:
            solver.Add(sum(vars_for_inc) <= 1)

    # Team capacity constraint
    for team in teams:
        vars_for_team = [
            inc.estimated_demand * x[(team.id, inc.id)]
            for inc in eligible_incidents
            if (team.id, inc.id) in x
        ]
        if vars_for_team:
            solver.Add(sum(vars_for_team) <= team.capacity)

    # Minimize travel time - priority reward
    objective = solver.Objective()
    for (tid, iid), var in x.items():
        travel_time_sec = travel_matrix[(tid, iid)][0]
        inc = next(i for i in eligible_incidents if i.id == iid)
        cost = travel_time_sec - PRIORITY_WEIGHT_SEC * inc.priority_score
        objective.SetCoefficient(var, cost)
    objective.SetMinimization()

    status = solver.Solve()
    assignments: list[dict] = []
    assigned_inc_ids: set[str] = set()

    if status in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        for (tid, iid), var in x.items():
            if var.solution_value() > 0.5:
                team = next(t for t in teams if t.id == tid)
                inc = next(i for i in eligible_incidents if i.id == iid)
                t_sec, dist_m, path_coords = travel_matrix[(tid, iid)]
                assigned_inc_ids.add(iid)
                assignments.append(
                    {
                        "incident_id": inc.id,
                        "incident_label": inc.location_hint or inc.id,
                        "priority_score": inc.priority_score,
                        "urgency": inc.urgency.value,
                        "team_id": team.id,
                        "team_name": team.name,
                        "travel_time_sec": t_sec,
                        "distance_m": dist_m,
                        "path_coords": path_coords,
                        "rationale": (
                            f"Assigned {team.name} (supports {inc.required_capability}, "
                            f"modelled ETA {t_sec:.0f}s) to priority-{inc.priority_score} incident."
                        ),
                    }
                )

    unassigned: list[dict] = []
    for inc in all_incidents:
        if inc.id in assigned_inc_ids:
            continue
        reason = ineligible_reasons.get(
            inc.id,
            "All eligible teams reached capacity constraints for higher-priority incidents.",
        )
        unassigned.append(
            {
                "incident_id": inc.id,
                "incident_label": inc.location_hint or inc.id,
                "urgency": inc.urgency.value,
                "priority_score": inc.priority_score,
                "reason": reason,
            }
        )

    return {
        "method": "or_tools_milp",
        "assignments": sorted(assignments, key=lambda a: a["priority_score"], reverse=True),
        "unassigned": unassigned,
        "total_assigned": len(assignments),
        "total_unassigned": len(unassigned),
        "total_travel_time_sec": round(sum(a["travel_time_sec"] for a in assignments), 2),
        "total_priority_covered": sum(a["priority_score"] for a in assignments),
    }


def _solve_nearest_baseline(
    teams: list[RescueTeam],
    eligible_incidents: list[Incident],
    all_incidents: list[Incident],
    travel_matrix: dict[tuple[str, str], tuple[float, float, list[list[float]]]],
    ineligible_reasons: dict[str, str],
) -> dict:
    """Greedy nearest-eligible-team baseline (FIFO incident order)."""
    remaining_cap = {t.id: t.capacity for t in teams}
    assignments: list[dict] = []
    assigned_inc_ids: set[str] = set()

    for inc in eligible_incidents:
        best_team: RescueTeam | None = None
        best_cost: tuple[float, float, list[list[float]]] | None = None

        for team in teams:
            if remaining_cap[team.id] < inc.estimated_demand:
                continue
            cost = travel_matrix.get((team.id, inc.id))
            if cost is None:
                continue
            if best_cost is None or cost[0] < best_cost[0]:
                best_cost = cost
                best_team = team

        if best_team is not None and best_cost is not None:
            remaining_cap[best_team.id] -= inc.estimated_demand
            assigned_inc_ids.add(inc.id)
            t_sec, dist_m, path_coords = best_cost
            assignments.append(
                {
                    "incident_id": inc.id,
                    "incident_label": inc.location_hint or inc.id,
                    "priority_score": inc.priority_score,
                    "urgency": inc.urgency.value,
                    "team_id": best_team.id,
                    "team_name": best_team.name,
                    "travel_time_sec": t_sec,
                    "distance_m": dist_m,
                    "path_coords": path_coords,
                    "rationale": f"Greedy nearest eligible team ({t_sec:.0f}s).",
                }
            )

    unassigned: list[dict] = []
    for inc in all_incidents:
        if inc.id in assigned_inc_ids:
            continue
        reason = ineligible_reasons.get(
            inc.id, "No remaining capacity on eligible teams in greedy baseline."
        )
        unassigned.append(
            {
                "incident_id": inc.id,
                "incident_label": inc.location_hint or inc.id,
                "urgency": inc.urgency.value,
                "priority_score": inc.priority_score,
                "reason": reason,
            }
        )

    return {
        "method": "nearest_eligible_baseline",
        "assignments": assignments,
        "unassigned": unassigned,
        "total_assigned": len(assignments),
        "total_unassigned": len(unassigned),
        "total_travel_time_sec": round(sum(a["travel_time_sec"] for a in assignments), 2),
        "total_priority_covered": sum(a["priority_score"] for a in assignments),
    }
