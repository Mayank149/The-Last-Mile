"""Pydantic domain schemas and API contracts for THE LAST MILE."""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


class Coordinates(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)


class IncidentType(str, Enum):
    FLOODING = "flooding"
    STRANDED_PERSONS = "stranded_persons"
    MEDICAL_EMERGENCY = "medical_emergency"
    INFRASTRUCTURE_DAMAGE = "infrastructure_damage"
    POWER_OUTAGE = "power_outage"
    OTHER = "other"


class NeedType(str, Enum):
    BOAT_RESCUE = "boat_rescue"
    MEDICAL_AID = "medical_aid"
    EVACUATION = "evacuation"
    FOOD_WATER = "food_water"
    SHELTER = "shelter"
    ASSESSMENT = "assessment"


class UrgencyLevel(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class VerificationStatus(str, Enum):
    VERIFIED = "verified"
    UNVERIFIED_LOCATION = "unverified_location"
    PENDING_REVIEW = "pending_review"


class IncidentStatus(str, Enum):
    OPEN = "open"
    ASSIGNED = "assigned"
    RESOLVED = "resolved"


class RoadStatus(str, Enum):
    OPEN = "open"
    DEGRADED = "degraded"
    BLOCKED = "blocked"


class Incident(BaseModel):
    id: str
    original_message: str
    incident_type: IncidentType
    need_type: NeedType
    urgency: UrgencyLevel
    priority_score: int = Field(..., ge=1, le=10)
    required_capability: str
    estimated_demand: int = Field(default=1, ge=1, le=10)
    vulnerable_indicators: list[str] = Field(default_factory=list)
    location_hint: str = ""
    uncertainty_notes: str = ""
    coordinates: Coordinates | None = None
    confidence: float = Field(..., ge=0.0, le=1.0)
    verification: VerificationStatus
    status: IncidentStatus = IncidentStatus.OPEN
    extraction_source: Literal["gemini", "local_fallback", "manual", "synthetic_seed"] = "synthetic_seed"


class RescueTeam(BaseModel):
    id: str
    name: str
    coordinates: Coordinates
    availability: Literal["available", "busy", "offline"] = "available"
    capacity: int = Field(..., ge=1)
    capabilities: list[str] = Field(default_factory=list)
    assigned_incident_ids: list[str] = Field(default_factory=list)


class Shelter(BaseModel):
    id: str
    name: str
    coordinates: Coordinates
    capacity: int = Field(..., ge=1)
    simulated_occupancy: int = Field(..., ge=0)


class RoadNode(BaseModel):
    id: str
    lat: float
    lon: float


class RoadEdge(BaseModel):
    id: str
    u: str
    v: str
    key: int = 0
    name: str
    road_type: str
    length_m: float
    base_travel_time_sec: float
    effective_travel_time_sec: float
    status: RoadStatus = RoadStatus.OPEN
    coords: list[list[float]]


class ZoneDefinition(BaseModel):
    id: str
    name: str
    description: str
    polygon: list[list[float]]  # [[lat, lon], ...]
    center: Coordinates
    baseline_reporting_count: int = 0


class ZoneGapAssessment(BaseModel):
    id: str
    name: str
    description: str
    polygon: list[list[float]]
    center: Coordinates
    coverage_deficit: float
    accessibility_deficit: float
    reporting_uncertainty: float
    resource_deficit: float
    gap_score: float
    gap_level: Literal["high", "moderate", "low"]
    contributing_factors: list[str]
    verification_warning: str


class ScenarioMetadata(BaseModel):
    scenario_name: str
    area_name: str
    is_synthetic: bool = True
    disclaimer: str
    attribution: str
    bbox: dict[str, float]
    travel_time_note: str
    node_count: int
    edge_count: int
    disrupted_edge_count: int = 0
