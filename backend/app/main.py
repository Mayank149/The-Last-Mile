"""FastAPI entrypoint for THE LAST MILE modular monolith."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
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
