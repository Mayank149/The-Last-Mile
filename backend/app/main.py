"""FastAPI entrypoint for THE LAST MILE modular monolith."""

from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.domain import (
    Coordinates,
    IncidentCreateRequest,
    IncidentExtractRequest,
    RoadDisruptionRequest,
    SimulationRunRequest,
    VerificationStatus,
)
from app.modules.allocation import run_allocation
from app.modules.coverage import compute_zone_gaps
from app.modules.incidents import create_incident_record, extract_incident_from_text
from app.modules.simulation import apply_road_disruptions, run_simulation
from app.state import get_state

app = FastAPI(
    title="THE LAST MILE API",
    description="AI-assisted emergency response intelligence and resource allocation prototype (Synthetic Demo).",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> dict:
    return {"status": "ok", "service": "the-last-mile"}


@app.get("/api/scenario")
def get_scenario() -> dict:
    s = get_state()
    return {
        "metadata": s.get_metadata().model_dump(),
        "teams": [t.model_dump() for t in s.teams.values()],
        "shelters": [sh.model_dump() for sh in s.shelters.values()],
        "incidents": [inc.model_dump() for inc in s.incidents.values()],
        "zones": [z.model_dump() for z in s.zones],
    }


@app.get("/api/map/roads")
def get_map_roads() -> dict:
    s = get_state()
    assert s.network is not None
    return {
        "metadata": s.network.metadata,
        "edges": [e.model_dump() for e in s.network.edges.values()],
    }


@app.get("/api/incidents")
def list_incidents() -> dict:
    s = get_state()
    return {"incidents": [inc.model_dump() for inc in s.incidents.values()]}


@app.post("/api/incidents/extract")
def extract_incident(req: IncidentExtractRequest) -> dict:
    result = extract_incident_from_text(req.message)
    return result.model_dump()


@app.post("/api/incidents")
def create_incident(req: IncidentCreateRequest) -> dict:
    s = get_state()
    inc = create_incident_record(req)
    s.incidents[inc.id] = inc
    return inc.model_dump()


@app.patch("/api/incidents/{incident_id}/verify")
def verify_incident_location(incident_id: str, coords: Coordinates) -> dict:
    s = get_state()
    inc = s.incidents.get(incident_id)
    if inc is None:
        raise HTTPException(status_code=404, detail="Incident not found.")
    inc.coordinates = coords
    inc.verification = VerificationStatus.VERIFIED
    return inc.model_dump()


@app.post("/api/roads/disruptions")
def update_road_disruptions(req: RoadDisruptionRequest) -> dict:
    s = get_state()
    assert s.network is not None
    updated = apply_road_disruptions(
        network=s.network,
        edge_ids=req.edge_ids,
        status=req.status,
        apply_reverse=req.apply_reverse,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="No matching road edges found.")
    return {
        "updated_edges": [e.model_dump() for e in updated],
        "disrupted_edge_count": s.network.disrupted_count(),
    }


@app.post("/api/simulation/run")
def run_route_simulation(req: SimulationRunRequest | None = None) -> dict:
    s = get_state()
    assert s.network is not None
    result = run_simulation(
        network=s.network,
        teams=list(s.teams.values()),
        incidents=list(s.incidents.values()),
        travel_time_note=s.travel_time_note,
        team_id=req.team_id if req else None,
        incident_id=req.incident_id if req else None,
    )
    return result.model_dump()


@app.get("/api/coverage/gaps")
def get_coverage_gaps() -> dict:
    s = get_state()
    assert s.network is not None
    return compute_zone_gaps(
        network=s.network,
        zones=s.zones,
        teams=list(s.teams.values()),
        incidents=list(s.incidents.values()),
    )


@app.post("/api/allocation/run")
def run_resource_allocation() -> dict:
    s = get_state()
    assert s.network is not None
    return run_allocation(
        network=s.network,
        teams=list(s.teams.values()),
        incidents=list(s.incidents.values()),
    )


@app.post("/api/scenario/reset")
def reset_scenario() -> dict:
    s = get_state()
    s.reset()
    return {
        "status": "reset_complete",
        "metadata": s.get_metadata().model_dump(),
        "teams": [t.model_dump() for t in s.teams.values()],
        "shelters": [sh.model_dump() for sh in s.shelters.values()],
        "incidents": [inc.model_dump() for inc in s.incidents.values()],
        "zones": [z.model_dump() for z in s.zones],
    }
