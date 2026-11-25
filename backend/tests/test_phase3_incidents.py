"""Phase 3 tests: emergency report extraction (fallback), schema validation, and operator verification."""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

from app.main import (  # noqa: E402
    create_incident,
    extract_incident,
    list_incidents,
    reset_scenario,
    verify_incident_location,
)
from app.models.domain import (  # noqa: E402
    Coordinates,
    IncidentCreateRequest,
    IncidentExtractRequest,
    IncidentType,
    NeedType,
    UrgencyLevel,
)


def test_extract_incident_never_invents_coordinates() -> None:
    res = extract_incident(
        IncidentExtractRequest(
            message="Elderly man trapped in waist-deep water near Ejipura Main Road, needs boat rescue."
        )
    )
    assert res["incident_type"] == "stranded_persons"
    assert res["need_type"] == "boat_rescue"
    assert res["urgency"] == "critical"
    assert "elderly" in res["vulnerable_indicators"]
    assert "Ejipura" in res["location_hint"]
    assert res["coordinates"] is None
    assert res["verification"] == "unverified_location"
    assert res["extraction_source"] in ("gemini", "local_fallback")


def test_ambiguous_message_stays_unverified() -> None:
    res = extract_incident(
        IncidentExtractRequest(message="Water entering ground floor, please send help quickly.")
    )
    assert res["coordinates"] is None
    assert res["verification"] == "unverified_location"
    assert res["confidence"] < 0.7


def test_create_and_verify_incident_retains_original_message() -> None:
    reset_scenario()
    msg = "Dialysis patient stranded near Sony World junction; power out."
    created = create_incident(
        IncidentCreateRequest(
            original_message=msg,
            incident_type=IncidentType.MEDICAL_EMERGENCY,
            need_type=NeedType.MEDICAL_AID,
            urgency=UrgencyLevel.CRITICAL,
            priority_score=10,
            location_hint="Sony World junction",
            coordinates=None,
            operator_confirmed=False,
            extraction_source="local_fallback",
        )
    )
    assert created["original_message"] == msg
    assert created["verification"] == "unverified_location"

    verified = verify_incident_location(created["id"], Coordinates(lat=12.9362, lon=77.6268))
    assert verified["verification"] == "verified"
    assert verified["coordinates"]["lat"] == 12.9362

    all_inc = list_incidents()["incidents"]
    assert any(i["id"] == created["id"] for i in all_inc)
