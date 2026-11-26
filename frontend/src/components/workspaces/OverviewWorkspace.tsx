import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Cpu,
  FilePlus,
  Home,
  MapPin,
  Play,
  Radio,
  Shield,
  ShieldAlert,
  Users,
} from "lucide-react";
import type {
  AllocationResponse,
  CoverageGapsResponse,
  ScenarioResponse,
  SimulationResult,
  UrgencyLevel,
  WorkspaceId,
} from "../../types/domain";

interface OverviewWorkspaceProps {
  scenario: ScenarioResponse;
  simulation: SimulationResult | null;
  gaps: CoverageGapsResponse | null;
  allocation: AllocationResponse | null;
  onNavigate: (workspace: WorkspaceId) => void;
  onSelectUrgencyFilter: (urgency: UrgencyLevel | "all") => void;
  onRunSimulation: () => void;
  onAnalyzeGaps: () => void;
  onRunAllocation: () => void;
  busy: boolean;
}

export default function OverviewWorkspace({
  scenario,
  simulation,
  gaps,
  allocation,
  onNavigate,
  onSelectUrgencyFilter,
  onRunSimulation,
  onAnalyzeGaps,
  onRunAllocation,
  busy,
}: OverviewWorkspaceProps) {
  const { metadata, teams, shelters, incidents, zones } = scenario;

  const verifiedCount = incidents.filter((i) => i.verification === "verified").length;
  const unverifiedCount = incidents.length - verifiedCount;
  const criticalCount = incidents.filter((i) => i.urgency === "critical").length;
  const highCount = incidents.filter((i) => i.urgency === "high").length;
  const mediumCount = incidents.filter((i) => i.urgency === "medium").length;
  const lowCount = incidents.filter((i) => i.urgency === "low").length;

  const availableTeams = teams.filter((t) => t.availability === "available");
  const totalShelterCapacity = shelters.reduce((acc, s) => acc + s.capacity, 0);
  const totalShelterOccupancy = shelters.reduce((acc, s) => acc + s.simulated_occupancy, 0);
  const shelterOccupancyPct = totalShelterCapacity > 0
    ? Math.round((totalShelterOccupancy / totalShelterCapacity) * 100)
    : 0;

  const roadOperationalPct = metadata.edge_count > 0
    ? (((metadata.edge_count - metadata.disrupted_edge_count) / metadata.edge_count) * 100).toFixed(1)
    : "100";

  function handleFilterAndNavigate(u: UrgencyLevel) {
    onSelectUrgencyFilter(u);
    onNavigate("operations");
  }

  return (
    <div className="workspace-container overview-workspace">
      {/* Workspace Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Situational Awareness Overview</h2>
          <p className="workspace-subtitle">
            Consolidated operational picture for {metadata.area_name} ({metadata.node_count} nodes, {metadata.edge_count} road segments)
          </p>
        </div>
        <div className="workspace-header-actions">
          <button className="btn btn-primary" onClick={() => onNavigate("intake")}>
            <FilePlus size={14} />
            <span>Intake Incident</span>
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate("map")}>
            <MapPin size={14} />
            <span>View Geospatial Canvas</span>
          </button>
        </div>
      </div>

      {/* High-Level Metric Tiles */}
      <div className="metrics-grid">
        {/* Incidents Metric */}
        <div className="metric-card" onClick={() => onNavigate("operations")}>
          <div className="metric-header">
            <span className="metric-title">TOTAL INCIDENTS</span>
            <div className="metric-icon-wrap icon-red">
              <AlertCircle size={18} />
            </div>
          </div>
          <div className="metric-main">
            <span className="metric-value">{incidents.length}</span>
            <span className="metric-sub">
              {criticalCount} critical · {highCount} high
            </span>
          </div>
          <div className="metric-footer">
            <span className="metric-tag tag-verified">
              <CheckCircle2 size={11} /> {verifiedCount} verified
            </span>
            {unverifiedCount > 0 && (
              <span className="metric-tag tag-unverified">
                <Clock size={11} /> {unverifiedCount} unverified
              </span>
            )}
          </div>
        </div>

        {/* Rescue Teams Metric */}
        <div className="metric-card" onClick={() => onNavigate("operations")}>
          <div className="metric-header">
            <span className="metric-title">RESCUE TEAMS</span>
            <div className="metric-icon-wrap icon-blue">
              <Users size={18} />
            </div>
          </div>
          <div className="metric-main">
            <span className="metric-value">
              {availableTeams.length}
              <span className="metric-denom">/{teams.length}</span>
            </span>
            <span className="metric-sub">available for dispatch</span>
          </div>
          <div className="metric-footer">
            <span className="metric-meta">
              Total responder capacity: {teams.reduce((acc, t) => acc + t.capacity, 0)} personnel
            </span>
          </div>
        </div>

        {/* Shelters Metric */}
        <div className="metric-card" onClick={() => onNavigate("map")}>
          <div className="metric-header">
            <span className="metric-title">SHELTER OCCUPANCY</span>
            <div className="metric-icon-wrap icon-green">
              <Home size={18} />
            </div>
          </div>
          <div className="metric-main">
            <span className="metric-value">{shelterOccupancyPct}%</span>
            <span className="metric-sub">
              {totalShelterOccupancy} / {totalShelterCapacity} capacity
            </span>
          </div>
          <div className="metric-footer">
            <div className="progress-bar-wrap">
              <div
                className="progress-bar-fill fill-green"
                style={{ width: `${Math.min(100, shelterOccupancyPct)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Road Network Health Metric */}
        <div className="metric-card" onClick={() => onNavigate("operations")}>
          <div className="metric-header">
            <span className="metric-title">ROAD NETWORK INTEGRITY</span>
            <div className={`metric-icon-wrap ${metadata.disrupted_edge_count > 0 ? "icon-amber" : "icon-green"}`}>
              <Shield size={18} />
            </div>
          </div>
          <div className="metric-main">
            <span className="metric-value">{roadOperationalPct}%</span>
            <span className="metric-sub">
              {metadata.disrupted_edge_count > 0
                ? `${metadata.disrupted_edge_count} road segments disrupted`
                : "All segments open"}
            </span>
          </div>
          <div className="metric-footer">
            <span className="metric-meta">
              Modelled with assumed speeds by OSM highway classification
            </span>
          </div>
        </div>
      </div>

      {/* 2-Column Analytical Layout */}
      <div className="overview-content-grid">
        {/* Left Column: Severity breakdown & Urgent Incidents */}
        <div className="overview-column">
          {/* Urgency Severity Distribution Card */}
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-title">Incidents by Severity</h3>
              <button
                className="card-action-link"
                onClick={() => {
                  onSelectUrgencyFilter("all");
                  onNavigate("operations");
                }}
              >
                View all in Operations <ArrowRight size={13} />
              </button>
            </div>

            <div className="urgency-cards-row">
              <button
                className="urgency-summary-chip chip-critical"
                onClick={() => handleFilterAndNavigate("critical")}
                title="Filter critical incidents"
              >
                <div className="urgency-chip-header">
                  <span className="urgency-dot bg-critical" />
                  <span className="urgency-name">Critical</span>
                </div>
                <div className="urgency-chip-val">{criticalCount}</div>
              </button>

              <button
                className="urgency-summary-chip chip-high"
                onClick={() => handleFilterAndNavigate("high")}
                title="Filter high incidents"
              >
                <div className="urgency-chip-header">
                  <span className="urgency-dot bg-high" />
                  <span className="urgency-name">High</span>
                </div>
                <div className="urgency-chip-val">{highCount}</div>
              </button>

              <button
                className="urgency-summary-chip chip-medium"
                onClick={() => handleFilterAndNavigate("medium")}
                title="Filter medium incidents"
              >
                <div className="urgency-chip-header">
                  <span className="urgency-dot bg-medium" />
                  <span className="urgency-name">Medium</span>
                </div>
                <div className="urgency-chip-val">{mediumCount}</div>
              </button>

              <button
                className="urgency-summary-chip chip-low"
                onClick={() => handleFilterAndNavigate("low")}
                title="Filter low incidents"
              >
                <div className="urgency-chip-header">
                  <span className="urgency-dot bg-low" />
                  <span className="urgency-name">Low</span>
                </div>
                <div className="urgency-chip-val">{lowCount}</div>
              </button>
            </div>

            {/* List of high-priority / unverified incidents */}
            <div className="incidents-preview-list">
              {incidents.slice(0, 4).map((inc) => (
                <div key={inc.id} className="preview-incident-row">
                  <div className="preview-incident-top">
                    <span className="preview-incident-id">{inc.id.toUpperCase()}</span>
                    <span className={`badge badge-${inc.urgency}`}>{inc.urgency}</span>
                    <span
                      className={`badge ${
                        inc.verification === "verified" ? "badge-ok" : "badge-warn"
                      }`}
                    >
                      {inc.verification === "verified" ? "verified" : "unverified"}
                    </span>
                  </div>
                  <div className="preview-incident-desc">{inc.location_hint}</div>
                  <div className="preview-incident-meta">
                    Need: <strong>{inc.need_type}</strong> · Priority Score:{" "}
                    <strong>P{inc.priority_score}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rescue Teams Readiness Card */}
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-title">Response Teams Readiness</h3>
              <span className="badge badge-ok">{availableTeams.length} Available</span>
            </div>
            <div className="teams-grid">
              {teams.map((t) => (
                <div key={t.id} className="team-item-card">
                  <div className="team-item-header">
                    <strong>{t.name}</strong>
                    <span
                      className={`badge ${
                        t.availability === "available" ? "badge-ok" : "badge-neutral"
                      }`}
                    >
                      {t.availability}
                    </span>
                  </div>
                  <div className="team-item-meta">
                    Capacity: <strong>{t.capacity}</strong> responder(s)
                  </div>
                  <div className="team-capabilities">
                    {t.capabilities.map((cap) => (
                      <span key={cap} className="capability-pill">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Road Mobility Simulation & Coverage Gaps */}
        <div className="overview-column">
          {/* Simulation & Mobility Health Card */}
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-title">Network Mobility &amp; Route Simulation</h3>
              <button
                className="btn btn-sm btn-primary"
                onClick={onRunSimulation}
                disabled={busy}
              >
                <Play size={12} />
                <span>{busy ? "Simulating..." : "Run Simulation"}</span>
              </button>
            </div>

            {simulation ? (
              <div className="simulation-overview-block">
                <div className="sim-stats-row">
                  <div className="sim-stat-box">
                    <div className="sim-stat-val text-green">{simulation.reachable_pairs}</div>
                    <div className="sim-stat-label">Reachable Pairs</div>
                  </div>
                  <div className="sim-stat-box">
                    <div className="sim-stat-val text-red">{simulation.unreachable_pairs}</div>
                    <div className="sim-stat-label">Unreachable</div>
                  </div>
                  <div className="sim-stat-box">
                    <div className="sim-stat-val text-amber">
                      {simulation.delayed_or_detoured_pairs}
                    </div>
                    <div className="sim-stat-label">Delayed / Detoured</div>
                  </div>
                </div>

                <div className="sim-note-alert">
                  <AlertTriangle size={14} className="text-amber flex-shrink-0" />
                  <span>{simulation.travel_time_note}</span>
                </div>

                <div className="sim-routes-preview">
                  <div className="sim-routes-title">Top Impacted Response Routes:</div>
                  {simulation.routes.slice(0, 3).map((r) => (
                    <div key={`${r.team_id}-${r.incident_id}`} className="sim-route-row">
                      <div className="sim-route-names">
                        <strong>{r.team_name.split(" ")[0]}</strong> →{" "}
                        <strong>{r.incident_id.toUpperCase()}</strong>
                      </div>
                      <div className="sim-route-info">
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
                        <span className="sim-route-time">
                          {r.reachable ? `${r.current_travel_time_sec}s` : "Blocked"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state-card">
                <Radio size={24} className="text-muted" />
                <p>No route simulation active yet.</p>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={onRunSimulation}
                  disabled={busy}
                >
                  <Play size={12} />
                  <span>Simulate Shortest Paths</span>
                </button>
              </div>
            )}
          </div>

          {/* Response Gap & OR-Tools Allocation Card */}
          <div className="card">
            <div className="card-header-row">
              <h3 className="card-title">Intelligence Modules (FR-04 &amp; FR-05)</h3>
              <button
                className="card-action-link"
                onClick={() => onNavigate("coverage-allocation")}
              >
                Go to Workspace <ArrowRight size={13} />
              </button>
            </div>

            <div className="modules-quick-status">
              {/* Gap Analysis Quick Status */}
              <div className="module-status-row">
                <div className="module-status-header">
                  <div className="module-title-wrap">
                    <ShieldAlert size={16} className="text-amber" />
                    <strong>Potential Response Gaps</strong>
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={onAnalyzeGaps}
                    disabled={busy}
                  >
                    {gaps ? "Re-Analyze" : "Analyze Gaps"}
                  </button>
                </div>
                <p className="module-status-desc">
                  {gaps
                    ? `${zones.length} zones assessed for coverage, accessibility & reporting uncertainty.`
                    : "Evaluates unreached areas without assuming zero reports means zero victims."}
                </p>
                {gaps && (
                  <div className="gap-chips-row">
                    {gaps.zones.map((z) => (
                      <span
                        key={z.id}
                        className={`badge ${
                          z.gap_level === "high"
                            ? "badge-critical"
                            : z.gap_level === "moderate"
                            ? "badge-warn"
                            : "badge-ok"
                        }`}
                      >
                        {z.name}: {z.gap_level} ({z.gap_score})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Resource Allocation Quick Status */}
              <div className="module-status-row">
                <div className="module-status-header">
                  <div className="module-title-wrap">
                    <Cpu size={16} className="text-sky" />
                    <strong>OR-Tools MILP Allocation</strong>
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={onRunAllocation}
                    disabled={busy}
                  >
                    {allocation ? "Re-Run Solver" : "Run OR-Tools"}
                  </button>
                </div>
                <p className="module-status-desc">
                  {allocation
                    ? `Solver recommended ${allocation.optimised.assignments.length} assignments (saved ${allocation.comparison.travel_time_saved_sec}s travel time).`
                    : "Mathematical optimization comparing MILP assignments vs greedy baseline."}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
