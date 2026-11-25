import type { RoadEdge, ScenarioResponse } from "../types/domain";

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
