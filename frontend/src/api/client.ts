import type {
  AllocationResponse,
  Coordinates,
  CoverageGapsResponse,
  Incident,
  IncidentExtractionResult,
  RoadEdge,
  RoadStatus,
  ScenarioResponse,
  SimulationResult,
  UrgencyLevel,
} from "../types/domain";

const BASE = "/api";

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export function fetchScenario(): Promise<ScenarioResponse> {
  return requestJson<ScenarioResponse>("/scenario");
}

export function fetchMapRoads(): Promise<{ metadata: Record<string, unknown>; edges: RoadEdge[] }> {
  return requestJson<{ metadata: Record<string, unknown>; edges: RoadEdge[] }>("/map/roads");
}

export function resetScenario(): Promise<ScenarioResponse> {
  return requestJson<ScenarioResponse>("/scenario/reset", { method: "POST" });
}

export function applyRoadDisruption(
  edgeIds: string[],
  status: RoadStatus
): Promise<{ updated_edges: RoadEdge[]; disrupted_edge_count: number }> {
  return requestJson<{ updated_edges: RoadEdge[]; disrupted_edge_count: number }>(
    "/roads/disruptions",
    {
      method: "POST",
      body: JSON.stringify({ edge_ids: edgeIds, status, apply_reverse: true }),
    }
  );
}

export function runSimulation(
  teamId?: string,
  incidentId?: string
): Promise<SimulationResult> {
  return requestJson<SimulationResult>("/simulation/run", {
    method: "POST",
    body: JSON.stringify({
      team_id: teamId ?? null,
      incident_id: incidentId ?? null,
    }),
  });
}

export function extractIncident(message: string): Promise<IncidentExtractionResult> {
  return requestJson<IncidentExtractionResult>("/incidents/extract", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

export function createIncident(payload: {
  original_message: string;
  incident_type: string;
  need_type: string;
  urgency: UrgencyLevel;
  priority_score: number;
  location_hint: string;
  uncertainty_notes: string;
  vulnerable_indicators: string[];
  coordinates: Coordinates | null;
  confidence: number;
  operator_confirmed: boolean;
  extraction_source: "gemini" | "local_fallback" | "manual";
}): Promise<Incident> {
  return requestJson<Incident>("/incidents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyIncidentLocation(
  incidentId: string,
  coords: Coordinates
): Promise<Incident> {
  return requestJson<Incident>(`/incidents/${incidentId}/verify`, {
    method: "PATCH",
    body: JSON.stringify(coords),
  });
}

export function fetchCoverageGaps(): Promise<CoverageGapsResponse> {
  return requestJson<CoverageGapsResponse>("/coverage/gaps");
}

export function runAllocation(): Promise<AllocationResponse> {
  return requestJson<AllocationResponse>("/allocation/run", {
    method: "POST",
  });
}
