"""Coverage module: explainable potential underserved-area detection (FR-04)."""

from __future__ import annotations

from app.models.domain import (
    Incident,
    RescueTeam,
    RoadStatus,
    ZoneDefinition,
    ZoneGapAssessment,
)
from app.modules.geospatial import RoadNetwork, point_in_polygon
from app.modules.simulation import shortest_path_between

# Documented weights for the potential response-gap prioritisation signal
WEIGHT_COVERAGE = 0.35
WEIGHT_ACCESSIBILITY = 0.30
WEIGHT_REPORTING_UNCERTAINTY = 0.20
WEIGHT_RESOURCE_DEFICIT = 0.15

# Reference travel-time horizon (seconds) for full coverage deficit in this ~3km urban grid
COVERAGE_HORIZON_SEC = 480.0
NEARBY_RESOURCE_HORIZON_SEC = 300.0

HUMAN_VERIFICATION_WARNING = (
    "Prioritisation signal for human review only — does NOT estimate or claim a known "
    "number of trapped or unreported people. Sparse reporting indicates information uncertainty."
)


def compute_zone_gaps(
    network: RoadNetwork,
    zones: list[ZoneDefinition],
    teams: list[RescueTeam],
    incidents: list[Incident],
) -> dict:
    """Evaluate potential response-gap indicators for each predefined geographic zone."""
    active_dg = network.active_digraph()
    available_teams = [t for t in teams if t.availability == "available"]

    assessments: list[ZoneGapAssessment] = []

    for zone in zones:
        # 1. Response coverage deficit: min travel time from any available team to zone center
        best_time_sec: float | None = None
        nearby_capacity = 0

        for team in available_teams:
            res = shortest_path_between(active_dg, network, team.coordinates, zone.center)
            if res is not None:
                t_sec = res[0]
                if best_time_sec is None or t_sec < best_time_sec:
                    best_time_sec = t_sec
                if t_sec <= NEARBY_RESOURCE_HORIZON_SEC:
                    nearby_capacity += team.capacity

        if best_time_sec is None:
            coverage_deficit = 1.0
        else:
            coverage_deficit = round(min(best_time_sec / COVERAGE_HORIZON_SEC, 1.0), 3)

        # 2. Road accessibility deficit: disrupted edges within zone + unreachability
        zone_edges = [
            e
            for e in network.edges.values()
            if e.coords and point_in_polygon(e.coords[0][0], e.coords[0][1], zone.polygon)
        ]
        if zone_edges:
            blocked_in_zone = sum(1 for e in zone_edges if e.status == RoadStatus.BLOCKED)
            degraded_in_zone = sum(1 for e in zone_edges if e.status == RoadStatus.DEGRADED)
            disrupted_ratio = (blocked_in_zone + 0.5 * degraded_in_zone) / len(zone_edges)
        else:
            disrupted_ratio = 0.0

        unreachable_penalty = 0.5 if best_time_sec is None else 0.0
        accessibility_deficit = round(min(disrupted_ratio * 2.5 + unreachable_penalty, 1.0), 3)

        # 3. Reporting sparsity as an uncertainty signal (not proof of unmet demand)
        verified_in_zone = sum(
            1
            for inc in incidents
            if inc.coordinates is not None
            and point_in_polygon(inc.coordinates.lat, inc.coordinates.lon, zone.polygon)
        )
        total_signals = verified_in_zone + zone.baseline_reporting_count
        if total_signals == 0:
            reporting_uncertainty = 0.9
        elif total_signals == 1:
            reporting_uncertainty = 0.6
        elif total_signals == 2:
            reporting_uncertainty = 0.35
        else:
            reporting_uncertainty = 0.15

        # 4. Resource deficit based on nearby available team capacity
        # Target reference nearby capacity = 6 units
        resource_deficit = round(max(0.0, 1.0 - min(nearby_capacity / 6.0, 1.0)), 3)

        gap_score = round(
            WEIGHT_COVERAGE * coverage_deficit
            + WEIGHT_ACCESSIBILITY * accessibility_deficit
            + WEIGHT_REPORTING_UNCERTAINTY * reporting_uncertainty
            + WEIGHT_RESOURCE_DEFICIT * resource_deficit,
            3,
        )

        if gap_score >= 0.55:
            gap_level = "high"
        elif gap_score >= 0.35:
            gap_level = "moderate"
        else:
            gap_level = "low"

        factors: list[str] = []
        if best_time_sec is None:
            factors.append("Zone center currently unreachable by available teams on open road graph.")
        else:
            factors.append(
                f"Fastest available team ETA (modelled): {best_time_sec:.0f}s (coverage deficit {coverage_deficit:.2f})."
            )
        if zone_edges and (blocked_in_zone > 0 or degraded_in_zone > 0):
            factors.append(
                f"Road disruptions in zone: {blocked_in_zone} blocked, {degraded_in_zone} degraded."
            )
        else:
            factors.append("No direct road closures inside zone; accessibility reflects network reachability.")
        if total_signals <= 1:
            factors.append(
                f"Low report volume ({total_signals} signal(s)) — treated as information uncertainty, not proof of unmet demand."
            )
        else:
            factors.append(f"Moderate/active reporting ({total_signals} signal(s) observed).")
        factors.append(f"Nearby available team capacity (<=5 min): {nearby_capacity} unit(s).")

        assessments.append(
            ZoneGapAssessment(
                id=zone.id,
                name=zone.name,
                description=zone.description,
                polygon=zone.polygon,
                center=zone.center,
                coverage_deficit=coverage_deficit,
                accessibility_deficit=accessibility_deficit,
                reporting_uncertainty=reporting_uncertainty,
                resource_deficit=resource_deficit,
                gap_score=gap_score,
                gap_level=gap_level,
                contributing_factors=factors,
                verification_warning=HUMAN_VERIFICATION_WARNING,
            )
        )

    assessments.sort(key=lambda z: z.gap_score, reverse=True)
    return {
        "weights": {
            "coverage_deficit": WEIGHT_COVERAGE,
            "accessibility_deficit": WEIGHT_ACCESSIBILITY,
            "reporting_uncertainty": WEIGHT_REPORTING_UNCERTAINTY,
            "resource_deficit": WEIGHT_RESOURCE_DEFICIT,
        },
        "note": HUMAN_VERIFICATION_WARNING,
        "zones": [z.model_dump() for z in assessments],
    }
