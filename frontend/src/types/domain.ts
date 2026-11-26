export interface Coordinates {
  lat: number;
  lon: number;
}

export type UrgencyLevel = "critical" | "high" | "medium" | "low";
export type VerificationStatus = "verified" | "unverified_location" | "pending_review";
export type IncidentStatus = "open" | "assigned" | "resolved";
export type RoadStatus = "open" | "degraded" | "blocked";
export type WorkspaceId = "overview" | "operations" | "intake" | "coverage-allocation" | "map";

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

export interface RouteComparison {
  team_id: string;
  team_name: string;
  incident_id: string;
  incident_label: string;
  reachable: boolean;
  baseline_travel_time_sec: number | null;
  current_travel_time_sec: number | null;
  delta_sec: number | null;
  distance_m: number | null;
  route_status: "unchanged" | "detoured_or_delayed" | "unreachable";
  path_coords: [number, number][];
  used_edge_ids: string[];
  note: string;
}

export interface SimulationResult {
  disrupted_edge_count: number;
  blocked_edge_count: number;
  degraded_edge_count: number;
  reachable_pairs: number;
  unreachable_pairs: number;
  delayed_or_detoured_pairs: number;
  travel_time_note: string;
  routes: RouteComparison[];
}

export interface IncidentExtractionResult {
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
  confidence: number;
  coordinates: Coordinates | null;
  verification: VerificationStatus;
  extraction_source: "gemini" | "local_fallback";
}

export interface ZoneGapAssessment {
  id: string;
  name: string;
  description: string;
  polygon: [number, number][];
  center: Coordinates;
  coverage_deficit: number;
  accessibility_deficit: number;
  reporting_uncertainty: number;
  resource_deficit: number;
  gap_score: number;
  gap_level: "high" | "moderate" | "low";
  contributing_factors: string[];
  verification_warning: string;
}

export interface CoverageGapsResponse {
  weights: Record<string, number>;
  note: string;
  zones: ZoneGapAssessment[];
}

export interface AllocationAssignment {
  incident_id: string;
  incident_label: string;
  priority_score: number;
  urgency: UrgencyLevel;
  team_id: string;
  team_name: string;
  travel_time_sec: number;
  distance_m: number;
  path_coords: [number, number][];
  rationale: string;
}

export interface UnassignedIncident {
  incident_id: string;
  incident_label: string;
  urgency: UrgencyLevel;
  priority_score: number;
  reason: string;
}

export interface AllocationPlan {
  method: string;
  assignments: AllocationAssignment[];
  unassigned: UnassignedIncident[];
  total_assigned: number;
  total_unassigned: number;
  total_travel_time_sec: number;
  total_priority_covered: number;
}

export interface AllocationResponse {
  human_review_note: string;
  optimised: AllocationPlan;
  baseline: AllocationPlan;
  comparison: {
    travel_time_saved_sec: number;
    priority_gain: number;
    summary: string;
  };
}
