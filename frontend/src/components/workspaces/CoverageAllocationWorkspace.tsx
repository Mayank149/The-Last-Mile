import { useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Cpu,
  Info,
  MapPin,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type {
  AllocationAssignment,
  AllocationResponse,
  CoverageGapsResponse,
  RouteComparison,
  WorkspaceId,
} from "../../types/domain";

interface CoverageAllocationWorkspaceProps {
  gaps: CoverageGapsResponse | null;
  allocation: AllocationResponse | null;
  busy: boolean;
  onRefreshGaps: () => void;
  onRunAllocation: () => void;
  onNavigate: (workspace: WorkspaceId) => void;
  onSelectActiveRoute: (route: RouteComparison | null) => void;
}

export default function CoverageAllocationWorkspace({
  gaps,
  allocation,
  busy,
  onRefreshGaps,
  onRunAllocation,
  onNavigate,
  onSelectActiveRoute,
}: CoverageAllocationWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<"both" | "gaps" | "allocation">("both");

  function handleViewAssignmentOnMap(assignment: AllocationAssignment) {
    if (assignment.path_coords.length > 0) {
      onSelectActiveRoute({
        team_id: assignment.team_id,
        team_name: assignment.team_name,
        incident_id: assignment.incident_id,
        incident_label: assignment.incident_label,
        reachable: true,
        baseline_travel_time_sec: assignment.travel_time_sec,
        current_travel_time_sec: assignment.travel_time_sec,
        delta_sec: 0,
        distance_m: assignment.distance_m,
        route_status: "unchanged",
        path_coords: assignment.path_coords,
        used_edge_ids: [],
        note: assignment.rationale,
      });
    }
    onNavigate("map");
  }

  return (
    <div className="workspace-container coverage-allocation-workspace">
      {/* Workspace Header */}
      <div className="workspace-header">
        <div>
          <h2 className="workspace-title">Coverage Gaps &amp; Resource Allocation</h2>
          <p className="workspace-subtitle">
            Probabilistic gap assessment (FR-04) and Google OR-Tools MILP resource allocation solver (FR-05)
          </p>
        </div>
        <div className="workspace-header-actions">
          <button className="btn btn-secondary" onClick={onRefreshGaps} disabled={busy}>
            <ShieldAlert size={14} className={busy ? "spin-icon" : ""} />
            <span>{busy ? "Analyzing..." : "Analyze Gaps"}</span>
          </button>
          <button className="btn btn-primary" onClick={onRunAllocation} disabled={busy}>
            <Cpu size={14} className={busy ? "spin-icon" : ""} />
            <span>{busy ? "Solving..." : "Run OR-Tools"}</span>
          </button>
        </div>
      </div>

      {/* Sub-view switcher tabs */}
      <div className="sub-view-tabs">
        <button
          className={`tab-btn ${activeTab === "both" ? "active" : ""}`}
          onClick={() => setActiveTab("both")}
        >
          Combined Intelligence View
        </button>
        <button
          className={`tab-btn ${activeTab === "gaps" ? "active" : ""}`}
          onClick={() => setActiveTab("gaps")}
        >
          Response Gaps (FR-04)
        </button>
        <button
          className={`tab-btn ${activeTab === "allocation" ? "active" : ""}`}
          onClick={() => setActiveTab("allocation")}
        >
          OR-Tools Allocation (FR-05)
        </button>
      </div>

      {/* Main Grid */}
      <div
        className={`coverage-grid ${
          activeTab === "both" ? "grid-2col" : "grid-1col"
        }`}
      >
        {/* Section 1: Potential Response Gaps (FR-04) */}
        {(activeTab === "both" || activeTab === "gaps") && (
          <div className="coverage-column">
            <div className="card">
              <div className="card-header-row">
                <div className="section-title-wrap">
                  <ShieldAlert size={18} className="text-amber" />
                  <h3 className="card-title">Potential Response Gaps (FR-04)</h3>
                </div>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={onRefreshGaps}
                  disabled={busy}
                >
                  <ShieldAlert size={12} />
                  <span>{gaps ? "Re-evaluate" : "Analyze Gaps"}</span>
                </button>
              </div>

              {/* Methodology callout banner */}
              <div className="gap-formula-card">
                <div className="formula-title">
                  <Info size={14} className="text-sky flex-shrink-0" />
                  <strong>Multi-Factor Gap Formulation:</strong>
                </div>
                <div className="formula-expression">
                  <code>
                    0.35 × coverage_deficit + 0.30 × accessibility_deficit + 0.20 × reporting_uncertainty + 0.15 × resource_deficit
                  </code>
                </div>
                <div className="uncertainty-disclaimer">
                  <AlertTriangle size={13} className="text-amber flex-shrink-0" />
                  <span>
                    <strong>Information Uncertainty Principle:</strong> Sparse citizen reporting in a zone is strictly modelled as information uncertainty, never as proof of absence or low risk.
                  </span>
                </div>
              </div>

              {gaps ? (
                <div className="zones-gaps-list">
                  {gaps.zones.map((zone) => (
                    <div key={zone.id} className="zone-gap-card">
                      <div className="zone-gap-header">
                        <div>
                          <h4 className="zone-name">{zone.name}</h4>
                          <span className="zone-desc">{zone.description}</span>
                        </div>
                        <span
                          className={`badge ${
                            zone.gap_level === "high"
                              ? "badge-critical"
                              : zone.gap_level === "moderate"
                              ? "badge-warn"
                              : "badge-ok"
                          }`}
                        >
                          {zone.gap_level.toUpperCase()} ({zone.gap_score})
                        </span>
                      </div>

                      {/* Deficit Bars */}
                      <div className="deficit-bars-grid">
                        <div className="deficit-metric">
                          <div className="deficit-metric-header">
                            <span>Coverage Deficit (35%)</span>
                            <strong>{zone.coverage_deficit.toFixed(2)}</strong>
                          </div>
                          <div className="progress-bar-wrap">
                            <div
                              className="progress-bar-fill fill-amber"
                              style={{ width: `${Math.min(100, zone.coverage_deficit * 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="deficit-metric">
                          <div className="deficit-metric-header">
                            <span>Accessibility Deficit (30%)</span>
                            <strong>{zone.accessibility_deficit.toFixed(2)}</strong>
                          </div>
                          <div className="progress-bar-wrap">
                            <div
                              className="progress-bar-fill fill-amber"
                              style={{ width: `${Math.min(100, zone.accessibility_deficit * 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="deficit-metric">
                          <div className="deficit-metric-header">
                            <span>Reporting Uncertainty (20%)</span>
                            <strong>{zone.reporting_uncertainty.toFixed(2)}</strong>
                          </div>
                          <div className="progress-bar-wrap">
                            <div
                              className="progress-bar-fill fill-sky"
                              style={{ width: `${Math.min(100, zone.reporting_uncertainty * 100)}%` }}
                            />
                          </div>
                        </div>

                        <div className="deficit-metric">
                          <div className="deficit-metric-header">
                            <span>Resource Deficit (15%)</span>
                            <strong>{zone.resource_deficit.toFixed(2)}</strong>
                          </div>
                          <div className="progress-bar-wrap">
                            <div
                              className="progress-bar-fill fill-red"
                              style={{ width: `${Math.min(100, zone.resource_deficit * 100)}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Contributing Factors */}
                      <div className="contributing-factors-box">
                        <span className="factors-label">Contributing Factors:</span>
                        <ul className="factors-list">
                          {zone.contributing_factors.map((f, i) => (
                            <li key={i}>{f}</li>
                          ))}
                        </ul>
                      </div>

                      {zone.verification_warning && (
                        <div className="verification-warning-line">
                          <AlertTriangle size={12} className="text-amber flex-shrink-0" />
                          <span>{zone.verification_warning}</span>
                        </div>
                      )}

                      <div className="zone-action-row">
                        <button
                          className="btn btn-xs btn-secondary"
                          onClick={() => onNavigate("map")}
                        >
                          <MapPin size={11} />
                          <span>View Zone on Map</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state-card">
                  <ShieldAlert size={24} className="text-muted" />
                  <p>Click <strong>Analyze Gaps</strong> to score geographic zones for potential response blindspots.</p>
                  <button className="btn btn-secondary btn-sm" onClick={onRefreshGaps} disabled={busy}>
                    Run Response Gap Analysis
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 2: Resource Allocation Optimization (FR-05) */}
        {(activeTab === "both" || activeTab === "allocation") && (
          <div className="coverage-column">
            <div className="card">
              <div className="card-header-row">
                <div className="section-title-wrap">
                  <Cpu size={18} className="text-sky" />
                  <h3 className="card-title">OR-Tools Resource Allocation (FR-05)</h3>
                </div>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={onRunAllocation}
                  disabled={busy}
                >
                  <Cpu size={12} />
                  <span>{allocation ? "Re-run Solver" : "Run OR-Tools"}</span>
                </button>
              </div>

              {/* Coordinator Review Notice */}
              <div className="coordinator-notice-card">
                <AlertCircle size={14} className="text-sky flex-shrink-0" />
                <span>
                  <strong>Human Coordinator Review:</strong> Assignments generated by Google OR-Tools (SCIP/CBC MILP) are advisory decision recommendations requiring human coordinator confirmation. Autonomous dispatch is prohibited.
                </span>
              </div>

              {allocation ? (
                <div>
                  {/* Solver Comparison Banner */}
                  <div className="solver-comparison-banner">
                    <div className="comparison-headline">
                      <strong>OR-Tools MILP vs Greedy Nearest-Team Baseline</strong>
                    </div>
                    <div className="comparison-metrics-row">
                      <div className="comp-metric-box">
                        <span className="comp-metric-val text-green">
                          <TrendingDown size={14} className="inline mr-1" />
                          {allocation.comparison.travel_time_saved_sec}s
                        </span>
                        <span className="comp-metric-label">Travel Time Saved</span>
                      </div>
                      <div className="comp-metric-box">
                        <span className="comp-metric-val text-sky">
                          <TrendingUp size={14} className="inline mr-1" />
                          +{allocation.comparison.priority_gain}
                        </span>
                        <span className="comp-metric-label">Priority Points Covered</span>
                      </div>
                      <div className="comp-metric-box">
                        <span className="comp-metric-val text-muted">
                          {allocation.optimised.total_assigned} /{" "}
                          {allocation.optimised.total_assigned + allocation.optimised.total_unassigned}
                        </span>
                        <span className="comp-metric-label">Assigned Ratio</span>
                      </div>
                    </div>
                    <p className="comp-summary-text">{allocation.comparison.summary}</p>
                  </div>

                  {/* Recommended Assignments List */}
                  <div className="assignments-section">
                    <h4 className="assignments-title">
                      Optimized Assignments ({allocation.optimised.assignments.length})
                    </h4>

                    <div className="assignments-list">
                      {allocation.optimised.assignments.map((a) => (
                        <div key={`${a.team_id}-${a.incident_id}`} className="assignment-card">
                          <div className="assignment-header">
                            <div className="assignment-title">
                              <strong>{a.team_name}</strong> → <strong>{a.incident_id.toUpperCase()}</strong>
                            </div>
                            <div className="assignment-tags">
                              <span className={`badge badge-${a.urgency}`}>{a.urgency}</span>
                              <span className="badge badge-info">P{a.priority_score}</span>
                            </div>
                          </div>

                          <div className="assignment-stats">
                            <span>
                              Modelled ETA: <strong>{a.travel_time_sec}s</strong>
                            </span>
                            <span>
                              Distance: <strong>{a.distance_m}m</strong>
                            </span>
                          </div>

                          <div className="assignment-rationale">
                            "{a.rationale}"
                          </div>

                          <div className="assignment-actions">
                            <button
                              className="btn btn-xs btn-secondary"
                              onClick={() => handleViewAssignmentOnMap(a)}
                            >
                              <MapPin size={11} />
                              <span>View Route on Map</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Unassigned Incidents */}
                    {allocation.optimised.unassigned.length > 0 && (
                      <div className="unassigned-section">
                        <h4 className="unassigned-title">
                          Unassigned Queue ({allocation.optimised.unassigned.length})
                        </h4>
                        <div className="unassigned-list">
                          {allocation.optimised.unassigned.map((u) => (
                            <div key={u.incident_id} className="unassigned-card">
                              <div className="unassigned-header">
                                <strong>{u.incident_id.toUpperCase()}</strong>
                                <span className={`badge badge-${u.urgency}`}>{u.urgency}</span>
                                <span className="badge badge-warn">Unassigned</span>
                              </div>
                              <div className="unassigned-reason">
                                <strong>Constraint Barrier:</strong> {u.reason}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="empty-state-card">
                  <Cpu size={24} className="text-muted" />
                  <p>Click <strong>Run OR-Tools</strong> to compute constrained team-to-incident allocations and compare against the greedy baseline.</p>
                  <button className="btn btn-primary btn-sm" onClick={onRunAllocation} disabled={busy}>
                    Run OR-Tools Solver
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
