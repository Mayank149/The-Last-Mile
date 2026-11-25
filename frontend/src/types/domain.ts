export interface Coordinates {
  lat: number;
  lon: number;
}

export type UrgencyLevel = "critical" | "high" | "medium" | "low";
export type VerificationStatus = "verified" | "unverified_location" | "pending_review";
export type IncidentStatus = "open" | "assigned" | "resolved";
export type RoadStatus = "open" | "degraded" | "blocked";

export interface Incident {
  id: string;
  original_message: string;
  incident_type: string;
  need_type: string;
  urgency: UrgencyLevel;
  priority_score: number;
  required_capability: string;
  estimated_demand: number;
  vulnerable_indicators: string[];
  location_hint: string;
  uncertainty_notes: string;
  coordinates: Coordinates | null;
  confidence: number;
  verification: VerificationStatus;
  status: IncidentStatus;
  extraction_source: "gemini" | "local_fallback" | "manual" | "synthetic_seed";
}

export interface RescueTeam {
  id: string;
  name: string;
  coordinates: Coordinates;
  availability: "available" | "busy" | "offline";
  capacity: number;
  capabilities: string[];
  assigned_incident_ids: string[];
}

export interface Shelter {
  id: string;
  name: string;
  coordinates: Coordinates;
  capacity: number;
  simulated_occupancy: number;
}

export interface RoadEdge {
  id: string;
  u: string;
  v: string;
  key: number;
  name: string;
  road_type: string;
  length_m: number;
  base_travel_time_sec: number;
  effective_travel_time_sec: number;
  status: RoadStatus;
  coords: [number, number][];
}

export interface ZoneDefinition {
  id: string;
  name: string;
  description: string;
  polygon: [number, number][];
  center: Coordinates;
  baseline_reporting_count: number;
}

export interface ScenarioMetadata {
  scenario_name: string;
  area_name: string;
  is_synthetic: boolean;
  disclaimer: string;
  attribution: string;
  bbox: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  travel_time_note: string;
  node_count: number;
  edge_count: number;
  disrupted_edge_count: number;
}

export interface ScenarioResponse {
  metadata: ScenarioMetadata;
  teams: RescueTeam[];
  shelters: Shelter[];
  incidents: Incident[];
  zones: ZoneDefinition[];
}
