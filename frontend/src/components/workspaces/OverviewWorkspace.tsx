import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  Cpu,
  FilePlus,
  Layers,
  Maximize2,
  Navigation,
  Play,
  Radio,
  Route,
  ShieldAlert,
  Square,
  Users,
  X,
} from "lucide-react";
import MapView from "../MapView";
import type { AnimationRoute } from "../MapView";
import type {
  AllocationResponse,
  CoverageGapsResponse,
  RoadEdge,
  RoadStatus,
  RouteComparison,
  ScenarioResponse,
  SimulationResult,
  UrgencyLevel,
  WorkspaceId,
} from "../../types/domain";

interface OverviewWorkspaceProps {
  scenario: ScenarioResponse;
  roads: RoadEdge[];
  simulation: SimulationResult | null;
  gaps: CoverageGapsResponse | null;
  allocation: AllocationResponse | null;
  selectedRoad: RoadEdge | null;
  onSelectRoad: (edge: RoadEdge | null) => void;
  onDisruptRoad: (status: RoadStatus) => void;
  activeRoute: RouteComparison | null;
  onClearActiveRoute: () => void;
  layers: {
    roads: boolean;
    routes: boolean;
    incidents: boolean;
    teams: boolean;
    shelters: boolean;
    zones: boolean;
  };
  onToggleLayer: (layerKey: keyof OverviewWorkspaceProps["layers"]) => void;
  animationRoutes: AnimationRoute[];
  onNavigate: (workspace: WorkspaceId) => void;
  onSelectUrgencyFilter: (urgency: UrgencyLevel | "all") => void;
  onRunSimulation: () => void;
  onAnalyzeGaps: () => void;
  onRunAllocation: () => void;
  busy: boolean;
}

const LAYER_ITEMS: {
  key: keyof OverviewWorkspaceProps["layers"];
  label: string;
  icon: typeof Route;
  activeColor: string;
}[] = [
  { key: "roads", label: "Roads", icon: Route, activeColor: "#38bdf8" },
  { key: "routes", label: "Routes", icon: Navigation, activeColor: "#a855f7" },
  { key: "incidents", label: "Incidents", icon: AlertTriangle, activeColor: "#f97316" },
  { key: "teams", label: "Teams", icon: Users, activeColor: "#3b82f6" },
  { key: "shelters", label: "Shelters", icon: Building2, activeColor: "#10b981" },
  { key: "zones", label: "Zones", icon: Square, activeColor: "#60a5fa" },
];

function DonutGauge({
  value,
  max = 100,
  label,
  sublabel,
  color = "#0ea5e9",
  size = 78,
}: {
  value: number;
  max?: number;
  label: string;
  sublabel: string;
  color?: string;
  size?: number;
}) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  const dashOffset = circumference * (1 - pct);

  return (
    <div className="tactical-donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(56, 189, 248, 0.14)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="tactical-donut-center">
        <span className="tactical-donut-val">{label}</span>
        <span className="tactical-donut-sub">{sublabel}</span>
      </div>
    </div>
  );
}

export default function OverviewWorkspace({
  scenario,
  roads,
  simulation,
  gaps,
  allocation,
  selectedRoad,
  onSelectRoad,
  onDisruptRoad,
  activeRoute,
  onClearActiveRoute,
  layers,
  onToggleLayer,
  animationRoutes,
  onNavigate,
  onSelectUrgencyFilter,
  onRunSimulation,
  onAnalyzeGaps,
  onRunAllocation,
  busy,
}: OverviewWorkspaceProps) {
  const { metadata, teams, shelters, incidents, zones } = scenario;
  const [bottomChartTab, setBottomChartTab] = useState<"routes" | "teams" | "incidents">("routes");

  const verifiedCount = incidents.filter((i) => i.verification === "verified").length;
  const unverifiedCount = incidents.length - verifiedCount;
  const criticalCount = incidents.filter((i) => i.urgency === "critical").length;
  const highCount = incidents.filter((i) => i.urgency === "high").length;
  const mediumCount = incidents.filter((i) => i.urgency === "medium").length;
  const lowCount = incidents.filter((i) => i.urgency === "low").length;
  const maxSeverityCount = Math.max(criticalCount, highCount, mediumCount, lowCount, 1);

  const availableTeams = teams.filter((t) => t.availability === "available");
  const totalTeamCapacity = teams.reduce((acc, t) => acc + t.capacity, 0);

  const totalShelterCapacity = shelters.reduce((acc, s) => acc + s.capacity, 0);
  const totalShelterOccupancy = shelters.reduce((acc, s) => acc + s.simulated_occupancy, 0);
  const shelterOccupancyPct =
    totalShelterCapacity > 0
      ? Math.round((totalShelterOccupancy / totalShelterCapacity) * 100)
      : 0;

  const roadOperationalPct =
    metadata.edge_count > 0
      ? Number(
          (
            ((metadata.edge_count - metadata.disrupted_edge_count) / metadata.edge_count) *
            100
          ).toFixed(1)
        )
      : 100;

  const totalSimPairs = simulation
    ? simulation.reachable_pairs + simulation.unreachable_pairs
    : 0;
  const reachabilityPct =
    simulation && totalSimPairs > 0
      ? Math.round((simulation.reachable_pairs / totalSimPairs) * 100)
      : 0;

  // Area chart points for Bottom Card 2 (route travel times or team capacities)
  const routeChartPoints = useMemo(() => {
    if (bottomChartTab === "routes" && simulation && simulation.routes.length > 0) {
      return simulation.routes
        .filter((r) => r.reachable && r.current_travel_time_sec !== null)
        .slice(0, 10)
        .map((r) => ({
          label: `${r.team_name.split(" ")[0]}→${r.incident_id.toUpperCase()}`,
          value: r.current_travel_time_sec ?? 0,
        }));
    }
    if (bottomChartTab === "teams") {
      return teams.map((t) => ({
        label: t.name.split(" ")[0],
        value: t.capacity,
      }));
    }
    return incidents.slice(0, 8).map((inc) => ({
      label: inc.id.toUpperCase(),
      value: inc.priority_score,
    }));
  }, [bottomChartTab, simulation, teams, incidents]);

  const areaPathData = useMemo(() => {
    const w = 260;
    const h = 72;
    if (routeChartPoints.length === 0) {
      return { line: "", area: "", dots: [] as { x: number; y: number }[], maxVal: 0 };
    }
    const maxVal = Math.max(...routeChartPoints.map((p) => p.value), 1);
    const step = routeChartPoints.length > 1 ? w / (routeChartPoints.length - 1) : w;
    const coords = routeChartPoints.map((p, idx) => ({
      x: routeChartPoints.length > 1 ? idx * step : w / 2,
      y: h - 8 - (p.value / maxVal) * (h - 18),
    }));
    const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
    const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${h} L ${coords[0].x.toFixed(1)} ${h} Z`;
    return { line, area, dots: coords, maxVal };
  }, [routeChartPoints]);

  // Zone Gap / Priority area chart for Bottom Card 4
  const gapChartSeries = useMemo(() => {
    if (gaps && gaps.zones.length > 0) {
      return gaps.zones.map((z) => ({
        label: z.name.split(":")[0],
        value: z.gap_score,
        level: z.gap_level,
      }));
    }
    return zones.map((z) => ({
      label: z.name.split(":")[0],
      value: z.baseline_reporting_count,
      level: "low" as const,
    }));
  }, [gaps, zones]);

  const gapAreaPath = useMemo(() => {
    const w = 260;
    const h = 72;
    if (gapChartSeries.length === 0) {
      return { line: "", area: "", dots: [] as { x: number; y: number; label: string; value: number }[] };
    }
    const maxVal = Math.max(...gapChartSeries.map((g) => g.value), 1);
    const step = gapChartSeries.length > 1 ? w / (gapChartSeries.length - 1) : w;
    const coords = gapChartSeries.map((g, idx) => ({
      x: gapChartSeries.length > 1 ? idx * step : w / 2,
      y: h - 10 - (g.value / maxVal) * (h - 20),
      label: g.label,
      value: g.value,
    }));
    const line = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
    const area = `${line} L ${coords[coords.length - 1].x.toFixed(1)} ${h} L ${coords[0].x.toFixed(1)} ${h} Z`;
    return { line, area, dots: coords };
  }, [gapChartSeries]);

  function handleFilterAndNavigate(u: UrgencyLevel | "all") {
    onSelectUrgencyFilter(u);
    onNavigate("operations");
  }

  return (
    <div className="cockpit-container">
      {/* Compact Command Strip */}
      <div className="cockpit-top-strip">
        <div className="cockpit-title-group">
          <h2 className="cockpit-title">Command Overview — Live Situational Cockpit</h2>
          <span className="cockpit-subtitle">
            {metadata.area_name} · {metadata.node_count.toLocaleString()} nodes ·{" "}
            {metadata.edge_count.toLocaleString()} OSM segments
          </span>
        </div>

        <div className="cockpit-actions">
          <button className="btn btn-sm btn-primary" onClick={() => onNavigate("intake")}>
            <FilePlus size={13} />
            <span>Intake Incident</span>
          </button>
          <button className="btn btn-sm btn-secondary" onClick={onAnalyzeGaps} disabled={busy}>
            <ShieldAlert size={13} />
            <span>{gaps ? "Re-Analyze Gaps" : "Analyze Gaps"}</span>
          </button>
          <button className="btn btn-sm btn-secondary" onClick={onRunAllocation} disabled={busy}>
            <Cpu size={13} />
            <span>{allocation ? "Re-Run OR-Tools" : "Run OR-Tools"}</span>
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => onNavigate("map")}>
            <Maximize2 size={13} />
            <span>Full Map</span>
          </button>
        </div>
      </div>

      {/* Main 2-Region Grid: Center Map Viewport + Right 3 Telemetry Cards */}
      <div className="cockpit-main-grid">
        {/* Center Tactical Map Panel */}
        <div className="cmd-card cockpit-map-panel">
          {/* Compact Layer Toolbar over Map */}
          <div className="cockpit-map-toolbar">
            <div className="cockpit-layer-group" role="toolbar" aria-label="Map layers">
              <span className="cockpit-layer-prefix">
                <Layers size={12} />
                <span>Layers</span>
              </span>
              {LAYER_ITEMS.map(({ key, label, icon: Icon, activeColor }) => {
                const isActive = layers[key];
                return (
                  <button
                    key={key}
                    type="button"
                    className={`cockpit-layer-chip ${isActive ? "active" : ""}`}
                    style={{ "--layer-color": activeColor } as CSSProperties}
                    onClick={() => onToggleLayer(key)}
                    aria-pressed={isActive}
                  >
                    <Icon size={11} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {activeRoute && (
              <div className="cockpit-route-pill">
                <span>
                  <strong>{activeRoute.team_name.split(" ")[0]}</strong> →{" "}
                  <strong>{activeRoute.incident_id.toUpperCase()}</strong> (
                  {activeRoute.reachable ? `${activeRoute.current_travel_time_sec}s` : "Blocked"})
                </span>
                <button
                  className="pill-clear-btn"
                  onClick={onClearActiveRoute}
                  title="Clear highlighted route"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>

          {/* Floating Road Disruption Card when a road is clicked */}
          {selectedRoad && (
            <div className="cockpit-road-popover">
              <div className="floating-card-header">
                <div>
                  <h4 className="floating-road-name">{selectedRoad.name || "Unnamed Segment"}</h4>
                  <span className="floating-road-type">{selectedRoad.road_type}</span>
                </div>
                <button
                  className="btn btn-xs btn-ghost"
                  onClick={() => onSelectRoad(null)}
                  title="Close"
                >
                  <X size={13} />
                </button>
              </div>
              <div className="floating-road-meta">
                {selectedRoad.length_m}m ·{" "}
                <strong>
                  {selectedRoad.status === "blocked"
                    ? "BLOCKED"
                    : `${selectedRoad.effective_travel_time_sec}s`}
                </strong>{" "}
                ({selectedRoad.status})
              </div>
              <div className="floating-road-actions">
                <button
                  className={`btn btn-xs ${
                    selectedRoad.status === "open" ? "btn-ok active" : "btn-secondary"
                  }`}
                  disabled={busy}
                  onClick={() => onDisruptRoad("open")}
                >
                  Open
                </button>
                <button
                  className={`btn btn-xs ${
                    selectedRoad.status === "degraded" ? "btn-warn active" : "btn-secondary"
                  }`}
                  disabled={busy}
                  onClick={() => onDisruptRoad("degraded")}
                >
                  Degrade (3x)
                </button>
                <button
                  className={`btn btn-xs ${
                    selectedRoad.status === "blocked" ? "btn-critical active" : "btn-secondary"
                  }`}
                  disabled={busy}
                  onClick={() => onDisruptRoad("blocked")}
                >
                  Block
                </button>
              </div>
            </div>
          )}

          {/* Embedded Interactive Leaflet Map */}
          <div className="cockpit-map-canvas">
            <MapView
              bbox={metadata.bbox}
              roads={roads}
              incidents={incidents}
              teams={teams}
              shelters={shelters}
              zones={zones}
              zoneGaps={gaps?.zones ?? []}
              allocationAssignments={allocation?.optimised.assignments ?? []}
              activeRoute={activeRoute}
              selectedRoadId={selectedRoad?.id ?? null}
              onSelectRoad={(edge) => onSelectRoad(edge)}
              pickingLocation={false}
              onPickLocation={() => {}}
              layers={layers}
              animationRoutes={animationRoutes}
            />
          </div>
        </div>

        {/* Right Telemetry Stack (3 Cards) */}
        <div className="cockpit-right-stack">
          {/* Card 1: Network & Operational Readiness Donut */}
          <div className="cmd-card cockpit-tele-card">
            <div className="cmd-card-header">
              <span className="cmd-card-title">Operational Readiness</span>
              <button
                className="cmd-card-link"
                onClick={() => handleFilterAndNavigate("all")}
                title="Open Operations"
              >
                <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="tele-donut-row">
              <DonutGauge
                value={roadOperationalPct}
                label={`${roadOperationalPct}%`}
                sublabel="Roads Open"
                color={metadata.disrupted_edge_count > 0 ? "#f59e0b" : "#0ea5e9"}
              />
              <div className="tele-kpis-grid">
                <div className="tele-kpi">
                  <span className="tele-kpi-label">Verified Inc.</span>
                  <span className="tele-kpi-val">
                    {verifiedCount}
                    <small>/{incidents.length}</small>
                  </span>
                </div>
                <div className="tele-kpi">
                  <span className="tele-kpi-label">Avail. Teams</span>
                  <span className="tele-kpi-val">
                    {availableTeams.length}
                    <small>/{teams.length}</small>
                  </span>
                </div>
                <div className="tele-kpi">
                  <span className="tele-kpi-label">Disrupted</span>
                  <span className={`tele-kpi-val ${metadata.disrupted_edge_count > 0 ? "text-amber" : "text-green"}`}>
                    {metadata.disrupted_edge_count}
                  </span>
                </div>
                <div className="tele-kpi">
                  <span className="tele-kpi-label">Pending Pin</span>
                  <span className={`tele-kpi-val ${unverifiedCount > 0 ? "text-amber" : "text-green"}`}>
                    {unverifiedCount}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Incidents by Severity Bar Chart */}
          <div className="cmd-card cockpit-tele-card">
            <div className="cmd-card-header">
              <span className="cmd-card-title">Incidents by Severity</span>
              <button
                className="cmd-card-link"
                onClick={() => handleFilterAndNavigate("all")}
              >
                Queue ({incidents.length}) <ArrowUpRight size={13} />
              </button>
            </div>

            <div className="tactical-bars-row">
              {[
                { key: "critical" as const, label: "CRIT", count: criticalCount, color: "#ef4444" },
                { key: "high" as const, label: "HIGH", count: highCount, color: "#f97316" },
                { key: "medium" as const, label: "MED", count: mediumCount, color: "#38bdf8" },
                { key: "low" as const, label: "LOW", count: lowCount, color: "#22c55e" },
              ].map((bar) => {
                const heightPct = Math.max(12, Math.round((bar.count / maxSeverityCount) * 100));
                return (
                  <button
                    key={bar.key}
                    type="button"
                    className="tactical-bar-col"
                    onClick={() => handleFilterAndNavigate(bar.key)}
                    title={`Filter ${bar.key} incidents in Operations`}
                  >
                    <span className="tactical-bar-count">{bar.count}</span>
                    <div className="tactical-bar-track">
                      <div
                        className="tactical-bar-fill"
                        style={{
                          height: `${heightPct}%`,
                          background: `linear-gradient(180deg, ${bar.color}, ${bar.color}55)`,
                          boxShadow: `0 0 12px ${bar.color}40`,
                        }}
                      />
                    </div>
                    <span className="tactical-bar-label">{bar.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="tele-mini-list">
              {incidents.slice(0, 2).map((inc) => (
                <div key={inc.id} className="tele-mini-row">
                  <span className="tele-mini-id">{inc.id.toUpperCase()}</span>
                  <span className="tele-mini-hint">{inc.location_hint}</span>
                  <span className={`badge badge-${inc.urgency}`}>{inc.urgency}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Card 3: Shelter Occupancy Donut & Breakdown */}
          <div className="cmd-card cockpit-tele-card">
            <div className="cmd-card-header">
              <span className="cmd-card-title">Shelter Capacity</span>
              <span className="cmd-card-meta">
                {totalShelterOccupancy}/{totalShelterCapacity}
              </span>
            </div>
            <div className="tele-shelter-layout">
              <DonutGauge
                value={shelterOccupancyPct}
                label={`${shelterOccupancyPct}%`}
                sublabel="Occupied"
                color="#10b981"
                size={72}
              />
              <div className="tele-shelter-bars">
                {shelters.slice(0, 3).map((sh) => {
                  const pct = sh.capacity > 0 ? Math.round((sh.simulated_occupancy / sh.capacity) * 100) : 0;
                  return (
                    <div key={sh.id} className="shelter-bar-item">
                      <div className="shelter-bar-top">
                        <span className="shelter-bar-name">{sh.name.replace(" (Simulated)", "")}</span>
                        <span className="shelter-bar-pct">{pct}%</span>
                      </div>
                      <div className="progress-bar-wrap">
                        <div
                          className="progress-bar-fill fill-sky"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 4-Card Analytical Deck */}
      <div className="cockpit-bottom-grid">
        {/* Bottom Card 1: Route Simulation Health */}
        <div className="cmd-card cockpit-bottom-card">
          <div className="cmd-card-header">
            <span className="cmd-card-title">Route Simulation</span>
            <button
              className="btn btn-xs btn-primary"
              onClick={onRunSimulation}
              disabled={busy}
            >
              <Play size={11} />
              <span>{busy ? "..." : "Simulate"}</span>
            </button>
          </div>
          {simulation ? (
            <div className="bottom-sim-body">
              <DonutGauge
                value={reachabilityPct}
                label={`${reachabilityPct}%`}
                sublabel="Reachable"
                color={simulation.unreachable_pairs > 0 ? "#f59e0b" : "#0ea5e9"}
                size={74}
              />
              <div className="bottom-sim-stats">
                <div className="bottom-stat-line">
                  <span>Reachable Pairs</span>
                  <strong className="text-green">{simulation.reachable_pairs}</strong>
                </div>
                <div className="bottom-stat-line">
                  <span>Unreachable</span>
                  <strong className="text-red">{simulation.unreachable_pairs}</strong>
                </div>
                <div className="bottom-stat-line">
                  <span>Delayed / Detour</span>
                  <strong className="text-amber">{simulation.delayed_or_detoured_pairs}</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="bottom-empty">
              <Radio size={18} className="text-muted" />
              <span>Simulation initializing...</span>
            </div>
          )}
        </div>

        {/* Bottom Card 2: Travel Time / Fleet Area Chart + Switcher Tabs */}
        <div className="cmd-card cockpit-bottom-card">
          <div className="cmd-card-header">
            <span className="cmd-card-title">Telemetry Profile</span>
            <button className="cmd-card-link" onClick={() => onNavigate("operations")}>
              Details <ArrowUpRight size={13} />
            </button>
          </div>
          <div className="tactical-area-wrap">
            <svg viewBox="0 0 260 72" className="tactical-area-svg" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cmdAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {areaPathData.area && <path d={areaPathData.area} fill="url(#cmdAreaGrad)" />}
              {areaPathData.line && (
                <path
                  d={areaPathData.line}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.6))" }}
                />
              )}
              {areaPathData.dots.map((d, idx) => (
                <circle key={idx} cx={d.x} cy={d.y} r="2.6" fill="#e0f2fe" />
              ))}
            </svg>
          </div>
          <div className="bottom-pill-tabs">
            <button
              type="button"
              className={`bottom-pill-tab ${bottomChartTab === "routes" ? "active" : ""}`}
              onClick={() => setBottomChartTab("routes")}
            >
              Route ETAs
            </button>
            <button
              type="button"
              className={`bottom-pill-tab ${bottomChartTab === "teams" ? "active" : ""}`}
              onClick={() => setBottomChartTab("teams")}
            >
              Fleet Cap.
            </button>
            <button
              type="button"
              className={`bottom-pill-tab ${bottomChartTab === "incidents" ? "active" : ""}`}
              onClick={() => setBottomChartTab("incidents")}
            >
              Priorities
            </button>
          </div>
        </div>

        {/* Bottom Card 3: OR-Tools Allocation & Team Resources */}
        <div className="cmd-card cockpit-bottom-card">
          <div className="cmd-card-header">
            <span className="cmd-card-title">OR-Tools Allocation (FR-05)</span>
            <button
              className="cmd-card-link"
              onClick={() => onNavigate("coverage-allocation")}
            >
              Solver <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="bottom-alloc-body">
            <div className="alloc-bar-group">
              <div className="alloc-bar-row">
                <span>Responder Fleet</span>
                <strong>
                  {availableTeams.length}/{teams.length} ({totalTeamCapacity} cap)
                </strong>
              </div>
              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill fill-sky"
                  style={{
                    width: `${teams.length > 0 ? (availableTeams.length / teams.length) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {allocation ? (
              <div className="bottom-sim-stats">
                <div className="bottom-stat-line">
                  <span>Assigned Incidents</span>
                  <strong className="text-sky">{allocation.optimised.total_assigned}</strong>
                </div>
                <div className="bottom-stat-line">
                  <span>Travel Time Saved</span>
                  <strong className="text-green">{allocation.comparison.travel_time_saved_sec}s</strong>
                </div>
                <div className="bottom-stat-line">
                  <span>Priority Covered</span>
                  <strong>{allocation.optimised.total_priority_covered}</strong>
                </div>
              </div>
            ) : (
              <div className="bottom-cta-row">
                <span className="text-muted text-xs">
                  MILP optimization compares routes vs greedy baseline.
                </span>
                <button
                  className="btn btn-xs btn-secondary"
                  onClick={onRunAllocation}
                  disabled={busy}
                >
                  <Cpu size={11} />
                  <span>Run OR-Tools</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Card 4: Coverage Gaps (FR-04) */}
        <div className="cmd-card cockpit-bottom-card">
          <div className="cmd-card-header">
            <span className="cmd-card-title">Coverage Gaps (FR-04)</span>
            <button
              className="cmd-card-link"
              onClick={() => onNavigate("coverage-allocation")}
            >
              Zones <ArrowUpRight size={13} />
            </button>
          </div>

          <div className="tactical-area-wrap">
            <svg viewBox="0 0 260 72" className="tactical-area-svg" preserveAspectRatio="none">
              <defs>
                <linearGradient id="cmdGapGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={gaps ? "#f59e0b" : "#38bdf8"} stopOpacity="0.5" />
                  <stop offset="100%" stopColor={gaps ? "#f59e0b" : "#38bdf8"} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              {gapAreaPath.area && <path d={gapAreaPath.area} fill="url(#cmdGapGrad)" />}
              {gapAreaPath.line && (
                <path
                  d={gapAreaPath.line}
                  fill="none"
                  stroke={gaps ? "#fbbf24" : "#38bdf8"}
                  strokeWidth="2"
                />
              )}
              {gapAreaPath.dots.map((d, idx) => (
                <circle key={idx} cx={d.x} cy={d.y} r="2.6" fill="#fef3c7" />
              ))}
            </svg>
          </div>

          {gaps ? (
            <div className="gap-chips-compact">
              {gaps.zones.slice(0, 3).map((z) => (
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
                  {z.name.split(":")[0]}: {z.gap_score}
                </span>
              ))}
            </div>
          ) : (
            <div className="bottom-cta-row">
              <span className="text-muted text-xs">{zones.length} zones ready for deficit scoring.</span>
              <button
                className="btn btn-xs btn-secondary"
                onClick={onAnalyzeGaps}
                disabled={busy}
              >
                <ShieldAlert size={11} />
                <span>Analyze</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
