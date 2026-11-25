"""Incidents module: Gemini-assisted extraction with deterministic local fallback and verification."""

from __future__ import annotations

import json
import logging
import re
import uuid

from pydantic import BaseModel, Field

from app.config import settings
from app.models.domain import (
    Incident,
    IncidentCreateRequest,
    IncidentExtractionResult,
    IncidentStatus,
    IncidentType,
    NeedType,
    UrgencyLevel,
    VerificationStatus,
)


class _GeminiSchema(BaseModel):
    incident_type: IncidentType
    need_type: NeedType
    urgency: UrgencyLevel
    vulnerable_indicators: list[str] = Field(default_factory=list)
    location_hint: str = ""
    uncertainty_notes: str = ""
    confidence: float = Field(..., ge=0.0, le=1.0)


URGENCY_TO_PRIORITY: dict[UrgencyLevel, int] = {
    UrgencyLevel.CRITICAL: 9,
    UrgencyLevel.HIGH: 7,
    UrgencyLevel.MEDIUM: 5,
    UrgencyLevel.LOW: 3,
}


logger = logging.getLogger(__name__)


def extract_incident_from_text(message: str) -> IncidentExtractionResult:
    """Extract structured incident fields using Gemini API, falling back locally if unavailable."""
    if settings.gemini_api_key.strip():
        try:
            return _extract_with_gemini(message)
        except Exception as exc:
            logger.warning("Gemini extraction failed (%s: %s); falling back locally.", type(exc).__name__, exc)
            fallback = _local_fallback_extract(message)
            fallback.uncertainty_notes = (
                f"{fallback.uncertainty_notes} (Gemini unavailable: {type(exc).__name__}; used local fallback.)"
            ).strip()
            return fallback
    return _local_fallback_extract(message)


def _extract_with_gemini(message: str) -> IncidentExtractionResult:
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=settings.gemini_api_key)
    prompt = (
        "Extract structured emergency incident fields from the following flood-response report. "
        "Return ONLY valid JSON matching the schema. "
        "Do NOT invent coordinates or street numbers not present in the message. "
        "If location is vague or missing, describe the ambiguity in uncertainty_notes and lower confidence.\n\n"
        f"Report: {message}"
    )

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=_GeminiSchema,
            temperature=0.1,
        ),
    )

    parsed = _GeminiSchema.model_validate(json.loads(response.text))
    return IncidentExtractionResult(
        original_message=message,
        incident_type=parsed.incident_type,
        need_type=parsed.need_type,
        urgency=parsed.urgency,
        priority_score=URGENCY_TO_PRIORITY[parsed.urgency],
        required_capability=parsed.need_type.value,
        estimated_demand=1,
        vulnerable_indicators=parsed.vulnerable_indicators,
        location_hint=parsed.location_hint or "Unspecified location",
        uncertainty_notes=parsed.uncertainty_notes or "Extracted via Gemini; coordinates require operator confirmation.",
        confidence=parsed.confidence,
        coordinates=None,  # FR-01: Never invent coordinates
        verification=VerificationStatus.UNVERIFIED_LOCATION,
        extraction_source="gemini",
    )


def _local_fallback_extract(message: str) -> IncidentExtractionResult:
    """Deterministic keyword-based extraction when Gemini API is unset or unavailable."""
    lower = message.lower()

    # Determine incident_type and need_type
    if any(k in lower for k in ["dialysis", "medical", "insulin", "pregnant", "injured", "hospital", "ambulance", "breathing"]):
        incident_type = IncidentType.MEDICAL_EMERGENCY
        need_type = NeedType.MEDICAL_AID
    elif any(k in lower for k in ["trapped", "stranded", "boat", "chest", "waist", "roof", "elderly", "wheelchair"]):
        incident_type = IncidentType.STRANDED_PERSONS
        need_type = NeedType.BOAT_RESCUE
    elif any(k in lower for k in ["evacuat", "rescue", "move", "shelter"]):
        incident_type = IncidentType.FLOODING
        need_type = NeedType.EVACUATION
    elif any(k in lower for k in ["food", "water", "baby", "ration", "drinking"]):
        incident_type = IncidentType.FLOODING
        need_type = NeedType.FOOD_WATER
    elif any(k in lower for k in ["transformer", "wire", "electric", "power", "collapse", "wall"]):
        incident_type = IncidentType.INFRASTRUCTURE_DAMAGE
        need_type = NeedType.ASSESSMENT
    else:
        incident_type = IncidentType.FLOODING
        need_type = NeedType.ASSESSMENT

    # Urgency
    if any(k in lower for k in ["critical", "urgent", "dialysis", "chest", "rising fast", "elderly", "infant", "spark"]):
        urgency = UrgencyLevel.CRITICAL
    elif any(k in lower for k in ["trapped", "stranded", "waist", "power out", "evacuat", "blocked"]):
        urgency = UrgencyLevel.HIGH
    elif any(k in lower for k in ["food", "drinking water", "waterlogging", "knee"]):
        urgency = UrgencyLevel.MEDIUM
    else:
        urgency = UrgencyLevel.LOW

    # Vulnerable indicators
    indicators: list[str] = []
    indicator_map = {
        "elderly": ["elderly", "senior", "old"],
        "infant_or_child": ["baby", "infant", "child", "children"],
        "medical_dependency": ["dialysis", "insulin", "oxygen", "pregnant", "patient"],
        "mobility_impairment": ["wheelchair", "unable to climb", "bedridden"],
        "electrical_hazard": ["transformer", "spark", "live wire"],
        "power_outage": ["power out", "no power", "blackout"],
    }
    for label, keywords in indicator_map.items():
        if any(k in lower for k in keywords):
            indicators.append(label)

    # Extract location hints without inventing coordinates
    known_landmarks = [
        "Ejipura",
        "Sony World",
        "Koramangala 4th Block",
        "Koramangala 6th Block",
        "Koramangala 1st Block",
        "Koramangala 3rd Block",
        "Koramangala 8th Block",
        "80 Feet Road",
        "100 Feet Road",
        "Inner Ring Road",
        "National Games Village",
        "NGV",
        "St. John",
        "Madiwala",
        "Vivek Nagar",
        "Adugodi",
    ]
    matched_landmarks = [lm for lm in known_landmarks if lm.lower() in lower]
    if matched_landmarks:
        location_hint = ", ".join(matched_landmarks)
        confidence = 0.72
        uncertainty = "Landmark text detected; coordinates remain unresolved until operator selects location on map."
    else:
        # Try simple regex for "near <phrase>"
        m = re.search(r"(?:near|at|in)\s+([A-Za-z0-9\s,/-]{4,40})", message, re.IGNORECASE)
        if m:
            location_hint = m.group(1).strip(" .,")
            confidence = 0.52
            uncertainty = "Approximate text hint only; coordinates require operator verification."
        else:
            location_hint = "Unspecified / ambiguous location"
            confidence = 0.35
            uncertainty = "No clear location found in message; coordinates remain unresolved."

    return IncidentExtractionResult(
        original_message=message,
        incident_type=incident_type,
        need_type=need_type,
        urgency=urgency,
        priority_score=URGENCY_TO_PRIORITY[urgency],
        required_capability=need_type.value,
        estimated_demand=1,
        vulnerable_indicators=indicators,
        location_hint=location_hint,
        uncertainty_notes=uncertainty,
        confidence=confidence,
        coordinates=None,  # FR-01: Never invent coordinates
        verification=VerificationStatus.UNVERIFIED_LOCATION,
        extraction_source="local_fallback",
    )


def create_incident_record(req: IncidentCreateRequest) -> Incident:
    """Validate and construct a new Incident record from operator-reviewed fields."""
    if req.coordinates is not None and req.operator_confirmed:
        verification = VerificationStatus.VERIFIED
    elif req.coordinates is None:
        verification = VerificationStatus.UNVERIFIED_LOCATION
    else:
        verification = VerificationStatus.PENDING_REVIEW

    inc_id = f"inc-{uuid.uuid4().hex[:6]}"
    return Incident(
        id=inc_id,
        original_message=req.original_message,
        incident_type=req.incident_type,
        need_type=req.need_type,
        urgency=req.urgency,
        priority_score=req.priority_score,
        required_capability=req.required_capability or req.need_type.value,
        estimated_demand=req.estimated_demand,
        vulnerable_indicators=req.vulnerable_indicators,
        location_hint=req.location_hint,
        uncertainty_notes=req.uncertainty_notes,
        coordinates=req.coordinates,
        confidence=req.confidence,
        verification=verification,
        status=IncidentStatus.OPEN,
        extraction_source=req.extraction_source,
    )
