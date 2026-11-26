import { useMemo, useState } from "react";
import {
  AlertTriangle,
  MapPin,
  Play,
  Search,
  Sliders,
  Users,
} from "lucide-react";
import type {
  Incident,
  RescueTeam,
  RoadEdge,
  RoadStatus,
  RouteComparison,
  SimulationResult,
  UrgencyLevel,
  WorkspaceId,
} from "../../types/domain";

interface OperationsWorkspaceProps {
  roads: RoadEdge[];
  incidents: Incident[];
  teams: RescueTeam[];
  selectedRoad: RoadEdge | null;
  onSelectRoad: (road: RoadEdge | null) => void;
  onDisruptRoad: (status: RoadStatus) => void;
  simulation: SimulationResult | null;
  activeRoute: RouteComparison | null;
  onSelectActiveRoute: (route: RouteComparison | null) => void;
  onRunSimulation: () => void;
  urgencyFilter: UrgencyLevel | "all";
  onSetUrgencyFilter: (u: UrgencyLevel | "all") => void;
  onStartPinLocation: (incidentId: string) => void;
  onNavigate: (workspace: WorkspaceId) => void;
  busy: boolean;
}

export default function OperationsWorkspace({
  roads,
  incidents,
  teams,
  selectedRoad,
  onSelectRoad,
  onDisruptRoad,
  simulation,
  activeRoute,
  onSelectActiveRoute,
  onRunSimulation,
  urgencyFilter,
  onSetUrgencyFilter,
  onStartPinLocation,
  onNavigate,
  busy,
}: OperationsWorkspaceProps) {
  const [roadSearch, setRoadSearch] = useState("");
  const [roadStatusFilter, setRoadStatusFilter] = useState<"all" | RoadStatus>("all");
  const [incidentSearch, setIncidentSearch] = useState("");

  const filteredRoads = useMemo(() => {
    return roads.filter((r) => {
      const matchSearch =
        roadSearch === "" ||
        r.name.toLowerCase().includes(roadSearch.toLowerCase()) ||
        r.road_type.toLowerCase().includes(roadSearch.toLowerCase());
      const matchStatus = roadStatusFilter === "all" || r.status === roadStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [roads, roadSearch, roadStatusFilter]);

  const disruptedRoads = useMemo(() => {
    return roads.filter((r) => r.status !== "open");
  }, [roads]);

  const filteredIncidents = useMemo(() => {
    return incidents.filter((i) => {
      const matchUrgency = urgencyFilter === "all" || i.urgency === urgencyFilter;
      const matchSearch =
        incidentSearch === "" ||
        i.location_hint.toLowerCase().includes(incidentSearch.toLowerCase()) ||
        i.id.toLowerCase().includes(incidentSearch.toLowerCase()) ||
        i.need_type.toLowerCase().includes(incidentSearch.toLowerCase());
      return matchUrgency && matchSearch;
    });
  }, [incidents, urgencyFilter, incidentSearch]);

  function handleViewRouteOnMap(route: RouteComparison) {
    onSelectActiveRoute(route);
    onNavigate("map");
  }

  function handleVerifyOnMap(incidentId: string) {
    onStartPinLocation(incidentId);
    onNavigate("map");
  }

  return (
    <div className="workspace-container operations-workspace">
      {/* Workspace Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Operations &amp; Road Disruption Simulation</h2>
          <p className="workspace-subtitle">
            Manage simulated flood disruptions, evaluate shortest paths vs baseline, and oversee response queues
          </p>
        </div>
        <div className="workspace-header-actions">
          <button className="btn btn-primary" onClick={onRunSimulation} disabled={busy}>
            <Play size={14} />
            <span>{busy ? "Simulating..." : "Simulate Routes"}</span>
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate("map")}>
            <MapPin size={14} />
            <span>Open Map Workspace</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="operations-grid">
        {/* Left Column: Road Disruptions & Route Simulation */}
        <div className="operations-column">
          {/* Selected Road Inspector Card */}
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-title">Road Disruption Controller</h3>
              {selectedRoad && (
                <button
                  className="btn btn-xs btn-ghost"
                  onClick={() => onSelectRoad(null)}
                >
                  Clear Selection
                </button>
              )}
            </div>

            {selectedRoad ? (
              <div className="selected-road-panel">
                <div className="road-title-row">
                  <div>
                    <h4 className="road-name">{selectedRoad.name || "Unnamed Segment"}</h4>
                    <span className="road-type-tag">{selectedRoad.road_type}</span>
                  </div>
                  <span
                    className={`badge ${
                      selectedRoad.status === "blocked"
                        ? "badge-critical"
                        : selectedRoad.status === "degraded"
                        ? "badge-warn"
                        : "badge-ok"
                    }`}
                  >
                    {selectedRoad.status.toUpperCase()}
                  </span>
                </div>

                <div className="road-metrics-row">
                  <div className="road-metric">
                    <span className="road-metric-label">Segment Length</span>
                    <span className="road-metric-val">{selectedRoad.length_m} m</span>
                  </div>
                  <div className="road-metric">
                    <span className="road-metric-label">Base Travel Time</span>
                    <span className="road-metric-val">{selectedRoad.base_travel_time_sec} s</span>
                  </div>
                  <div className="road-metric">
                    <span className="road-metric-label">Effective Time</span>
                    <span className="road-metric-val">
                      {selectedRoad.status === "blocked"
                        ? "BLOCKED (∞)"
                        : `${selectedRoad.effective_travel_time_sec} s`}
                    </span>
                  </div>
                </div>

                <div className="disruption-action-group">
                  <span className="action-group-label">Apply Simulation Status:</span>
                  <div className="btn-row">
                    <button
                      className={`btn btn-sm ${
                        selectedRoad.status === "open" ? "btn-ok active" : "btn-secondary"
                      }`}
                      disabled={busy}
                      onClick={() => onDisruptRoad("open")}
                    >
                      Mark Open
                    </button>
                    <button
                      className={`btn btn-sm ${
                        selectedRoad.status === "degraded" ? "btn-warn active" : "btn-secondary"
                      }`}
                      disabled={busy}
                      onClick={() => onDisruptRoad("degraded")}
                      title="Degraded flood condition: 3.0x travel time multiplier"
                    >
                      Degrade (3.0x)
                    </button>
                    <button
                      className={`btn btn-sm ${
                        selectedRoad.status === "blocked" ? "btn-critical active" : "btn-secondary"
                      }`}
                      disabled={busy}
                      onClick={() => onDisruptRoad("blocked")}
                      title="Closed/Blocked: removed from traversable graph edges"
                    >
                      Block Segment
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="road-select-prompt">
                <Sliders size={20} className="text-muted" />
                <p>
                  Select a road from the list below or click any road segment on the <strong>Map</strong> to alter disruption status.
                </p>
                {disruptedRoads.length > 0 && (
                  <div className="active-disruptions-hint">
                    Currently <strong>{disruptedRoads.length}</strong> road segment(s) disrupted in this scenario.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Road Network Directory */}
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-title">Road Network Directory ({filteredRoads.length})</h3>
            </div>

            <div className="road-filter-bar">
              <div className="search-input-wrap">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search road name or highway type..."
                  value={roadSearch}
                  onChange={(e) => setRoadSearch(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="chip-row">
                <button
                  className={`chip ${roadStatusFilter === "all" ? "active" : ""}`}
                  onClick={() => setRoadStatusFilter("all")}
                >
                  All ({roads.length})
                </button>
                <button
                  className={`chip ${roadStatusFilter === "blocked" ? "active" : ""}`}
                  onClick={() => setRoadStatusFilter("blocked")}
                >
                  Blocked ({roads.filter((r) => r.status === "blocked").length})
                </button>
                <button
                  className={`chip ${roadStatusFilter === "degraded" ? "active" : ""}`}
                  onClick={() => setRoadStatusFilter("degraded")}
                >
                  Degraded ({roads.filter((r) => r.status === "degraded").length})
                </button>
                <button
                  className={`chip ${roadStatusFilter === "open" ? "active" : ""}`}
                  onClick={() => setRoadStatusFilter("open")}
                >
                  Open ({roads.filter((r) => r.status === "open").length})
                </button>
              </div>
            </div>

            <div className="scrollable-table-wrap">
              <div className="roads-list-container">
                {filteredRoads.slice(0, 15).map((road) => {
                  const isSelected = selectedRoad?.id === road.id;
                  return (
                    <div
                      key={road.id}
                      className={`road-list-item ${isSelected ? "road-item-selected" : ""}`}
                      onClick={() => onSelectRoad(road)}
                    >
                      <div className="road-item-left">
                        <div className="road-item-name">{road.name || "Unnamed Road"}</div>
                        <div className="road-item-details">
                          <span>{road.road_type}</span> · <span>{road.length_m}m</span> ·{" "}
                          <span>Base: {road.base_travel_time_sec}s</span>
                        </div>
                      </div>
                      <div className="road-item-right">
                        <span
                          className={`badge ${
                            road.status === "blocked"
                              ? "badge-critical"
                              : road.status === "degraded"
                              ? "badge-warn"
                              : "badge-ok"
                          }`}
                        >
                          {road.status}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
              {filteredRoads.length > 15 && (
                <div className="table-pagination-note">
                  Showing top 15 of {filteredRoads.length} segments. Use search to refine.
                </div>
              )}
            </div>
          </div>

          {/* Route Simulation Results */}
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-title">Route Simulation Results</h3>
              <button
                className="btn btn-sm btn-primary"
                onClick={onRunSimulation}
                disabled={busy}
              >
                <Play size={12} />
                <span>Simulate</span>
              </button>
            </div>

            {simulation ? (
              <div>
                <div className="sim-stats-grid">
                  <div className="sim-stat-box">
                    <span className="sim-stat-val text-green">{simulation.reachable_pairs}</span>
                    <span className="sim-stat-label">Reachable</span>
                  </div>
                  <div className="sim-stat-box">
                    <span className="sim-stat-val text-red">{simulation.unreachable_pairs}</span>
                    <span className="sim-stat-label">Unreachable</span>
                  </div>
                  <div className="sim-stat-box">
                    <span className="sim-stat-val text-amber">{simulation.delayed_or_detoured_pairs}</span>
                    <span className="sim-stat-label">Delayed / Detoured</span>
                  </div>
                </div>

                <div className="sim-routes-list">
                  {simulation.routes.map((r) => {
                    const isActive =
                      activeRoute?.team_id === r.team_id && activeRoute?.incident_id === r.incident_id;
                    return (
                      <div
                        key={`${r.team_id}-${r.incident_id}`}
                        className={`sim-route-card ${isActive ? "sim-route-active" : ""}`}
                        onClick={() => onSelectActiveRoute(r)}
                      >
                        <div className="sim-route-header">
                          <div className="sim-route-title">
                            <strong>{r.team_name}</strong> → <strong>{r.incident_id.toUpperCase()}</strong>
                          </div>
                          <span
                            className={`badge ${
                              r.route_status === "unreachable"
                                ? "badge-critical"
                                : r.route_status === "detoured_or_delayed"
                                ? "badge-warn"
                                : "badge-ok"
                            }`}
                          >
                            {r.route_status.replace(/_/g, " ")}
                          </span>
                        </div>

                        <div className="sim-route-details">
                          {r.reachable ? (
                            <span>
                              Modelled ETA: <strong>{r.current_travel_time_sec}s</strong>{" "}
                              <span className="text-muted">(Baseline: {r.baseline_travel_time_sec}s)</span>
                              {r.delta_sec && r.delta_sec > 0 && (
                                <span className="delta-tag text-amber"> +{r.delta_sec}s delay</span>
                              )}
                            </span>
                          ) : (
                            <span className="text-red">{r.note}</span>
                          )}
                        </div>

                        <div className="sim-route-actions">
                          <button
                            className="btn btn-xs btn-secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewRouteOnMap(r);
                            }}
                          >
                            <MapPin size={11} />
                            <span>View Route on Map</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="empty-state-card">
                <Play size={20} className="text-muted" />
                <p>Run simulation to compute Dijkstra shortest paths vs baseline.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Incidents Management Queue & Teams */}
        <div className="operations-column">
          {/* Incidents Queue */}
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-title">Incidents Management Queue ({filteredIncidents.length})</h3>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => onNavigate("intake")}
              >
                + New Intake
              </button>
            </div>

            {/* Urgency and Search Filters */}
            <div className="incident-filter-bar">
              <div className="search-input-wrap">
                <Search size={14} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search incident, location hint or need..."
                  value={incidentSearch}
                  onChange={(e) => setIncidentSearch(e.target.value)}
                  className="search-input"
                />
              </div>

              <div className="chip-row">
                {(["all", "critical", "high", "medium", "low"] as const).map((u) => (
                  <button
                    key={u}
                    className={`chip ${urgencyFilter === u ? "active" : ""}`}
                    onClick={() => onSetUrgencyFilter(u)}
                  >
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Incidents List */}
            <div className="incidents-stack">
              {filteredIncidents.map((inc) => (
                <div key={inc.id} className="incident-manage-card">
                  <div className="incident-card-top">
                    <div className="incident-id-lockup">
                      <span className="incident-id-badge">{inc.id.toUpperCase()}</span>
                      <span className={`badge badge-${inc.urgency}`}>{inc.urgency}</span>
                      <span className="badge badge-neutral">P{inc.priority_score}</span>
                    </div>

                    <span
                      className={`badge ${
                        inc.verification === "verified" ? "badge-ok" : "badge-warn"
                      }`}
                    >
                      {inc.verification === "verified" ? "Verified Location" : "Unverified Location"}
                    </span>
                  </div>

                  <div className="incident-location-line">
                    <MapPin size={13} className="text-muted flex-shrink-0" />
                    <span>{inc.location_hint}</span>
                  </div>

                  <div className="incident-specs-grid">
                    <div>
                      <span className="spec-label">Need Type:</span>{" "}
                      <strong>{inc.need_type}</strong>
                    </div>
                    <div>
                      <span className="spec-label">Required Capability:</span>{" "}
                      <strong>{inc.required_capability}</strong>
                    </div>
                    <div>
                      <span className="spec-label">Demand:</span>{" "}
                      <strong>{inc.estimated_demand} person(s)</strong>
                    </div>
                    <div>
                      <span className="spec-label">Confidence:</span>{" "}
                      <strong>{(inc.confidence * 100).toFixed(0)}%</strong>
                    </div>
                  </div>

                  <div className="incident-raw-quote">
                    "{inc.original_message}"
                  </div>

                  {inc.uncertainty_notes && (
                    <div className="uncertainty-callout">
                      <AlertTriangle size={12} className="text-amber flex-shrink-0" />
                      <span>{inc.uncertainty_notes}</span>
                    </div>
                  )}

                  <div className="incident-action-row">
                    {inc.verification !== "verified" ? (
                      <button
                        className="btn btn-sm btn-warn w-full justify-center"
                        onClick={() => handleVerifyOnMap(inc.id)}
                      >
                        <MapPin size={13} />
                        <span>Verify &amp; Pin Location on Map</span>
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => onNavigate("map")}
                      >
                        <MapPin size={13} />
                        <span>Inspect on Map ({inc.coordinates?.lat}, {inc.coordinates?.lon})</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rescue Teams Deployment Status */}
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-title">Field Rescue Teams ({teams.length})</h3>
            </div>
            <div className="teams-stack">
              {teams.map((team) => (
                <div key={team.id} className="team-status-card">
                  <div className="team-status-top">
                    <div className="team-name-wrap">
                      <Users size={16} className="text-sky" />
                      <strong>{team.name}</strong>
                    </div>
                    <span
                      className={`badge ${
                        team.availability === "available" ? "badge-ok" : "badge-neutral"
                      }`}
                    >
                      {team.availability}
                    </span>
                  </div>
                  <div className="team-sub-info">
                    Capacity: <strong>{team.capacity}</strong> · Location:{" "}
                    {team.coordinates.lat.toFixed(4)}, {team.coordinates.lon.toFixed(4)}
                  </div>
                  <div className="team-capabilities">
                    {team.capabilities.map((c) => (
                      <span key={c} className="capability-pill">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
