import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Play, RotateCcw } from "lucide-react";
import {
  applyRoadDisruption,
  fetchCoverageGaps,
  fetchMapRoads,
  fetchScenario,
  resetScenario,
  runAllocation,
  runSimulation,
  verifyIncidentLocation,
} from "./api/client";
import AnalyticsPanel from "./components/AnalyticsPanel";
import IncidentIntakePanel from "./components/IncidentIntakePanel";
import MapView from "./components/MapView";
import type {
  AllocationResponse,
  Coordinates,
  CoverageGapsResponse,
  RoadEdge,
  RoadStatus,
  RouteComparison,
  ScenarioResponse,
  SimulationResult,
  UrgencyLevel,
} from "./types/domain";

type SidebarTab = "operations" | "intake" | "analytics";

export default function App() {
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [roads, setRoads] = useState<RoadEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState<SidebarTab>("operations");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | "all">("all");
  const [selectedRoad, setSelectedRoad] = useState<RoadEdge | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteComparison | null>(null);
  const [gaps, setGaps] = useState<CoverageGapsResponse | null>(null);
  const [allocation, setAllocation] = useState<AllocationResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const [pickingLocationFor, setPickingLocationFor] = useState<"draft" | string | null>(null);
  const [pickedDraftCoords, setPickedDraftCoords] = useState<Coordinates | null>(null);

  const [layers, setLayers] = useState({
    roads: true,
    routes: true,
    incidents: true,
    teams: true,
    shelters: true,
    zones: true,
  });

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const [scen, roadRes] = await Promise.all([fetchScenario(), fetchMapRoads()]);
      setScenario(scen);
      setRoads(roadRes.edges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scenario");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function handleReset() {
    const scen = await resetScenario();
    const roadRes = await fetchMapRoads();
    setScenario(scen);
    setRoads(roadRes.edges);
    setSelectedRoad(null);
    setSimulation(null);
    setActiveRoute(null);
    setGaps(null);
    setAllocation(null);
    setPickingLocationFor(null);
    setPickedDraftCoords(null);
  }

  async function handleMapPickLocation(coords: Coordinates) {
    if (pickingLocationFor === "draft") {
      setPickedDraftCoords(coords);
      setPickingLocationFor(null);
      return;
    }
    if (pickingLocationFor) {
      await verifyIncidentLocation(pickingLocationFor, coords);
      const scen = await fetchScenario();
      setScenario(scen);
      setPickingLocationFor(null);
    }
  }

  async function handleDisruptRoad(status: RoadStatus) {
    if (!selectedRoad) return;
    setBusy(true);
    try {
      await applyRoadDisruption([selectedRoad.id], status);
      const [scen, roadRes, sim] = await Promise.all([
        fetchScenario(),
        fetchMapRoads(),
        runSimulation(),
      ]);
      setScenario(scen);
      setRoads(roadRes.edges);
      setSelectedRoad(roadRes.edges.find((e) => e.id === selectedRoad.id) ?? null);
      setSimulation(sim);
      if (sim.routes.length > 0) {
        const delayed = sim.routes.find((r) => r.route_status === "detoured_or_delayed");
        setActiveRoute(delayed ?? sim.routes[0]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRunSimulation() {
    setBusy(true);
    try {
      const sim = await runSimulation();
      setSimulation(sim);
      if (sim.routes.length > 0) {
        const delayed = sim.routes.find((r) => r.route_status === "detoured_or_delayed");
        setActiveRoute(delayed ?? sim.routes[0]);
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRefreshGaps() {
    setBusy(true);
    try {
      const res = await fetchCoverageGaps();
      setGaps(res);
    } finally {
      setBusy(false);
    }
  }

  async function handleRunAllocation() {
    setBusy(true);
    try {
      const res = await runAllocation();
      setAllocation(res);
    } finally {
      setBusy(false);
    }
  }

  const filteredIncidents = useMemo(() => {
    if (!scenario) return [];
    if (urgencyFilter === "all") return scenario.incidents;
    return scenario.incidents.filter((i) => i.urgency === urgencyFilter);
  }, [scenario, urgencyFilter]);

  if (loading) {
    return (
      <div style={{ padding: 32, color: "#94a3b8" }}>
        Loading THE LAST MILE scenario &amp; OpenStreetMap road network...
      </div>
    );
  }

  if (error || !scenario) {
    return (
      <div style={{ padding: 32, color: "#fca5a5" }}>
        Error loading backend: {error ?? "Unknown error"}
      </div>
    );
  }

  const { metadata, teams, shelters, zones } = scenario;

  return (
    <div className="app-shell">
      <div className="top-banner">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={14} />
          <strong>{metadata.disclaimer}</strong>
        </span>
        <span>{metadata.attribution}</span>
      </div>

      <header className="header-bar">
        <div className="header-title">
          <h1>THE LAST MILE — Command Dashboard</h1>
          <div className="header-subtitle">
            {metadata.area_name} · {metadata.node_count} intersections · {metadata.edge_count} road segments ·{" "}
            {metadata.disrupted_edge_count} disrupted
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={handleRunSimulation} disabled={busy}>
            <Play size={14} />
            {busy ? "Working..." : "Simulate Routes"}
          </button>
          <button className="btn" onClick={handleReset} title="Restore initial prepared scenario">
            <RotateCcw size={14} />
            Reset Scenario
          </button>
        </div>
      </header>

      <main className="main-layout">
        <aside className="sidebar">
          <div className="filter-row">
            <button
              className={`chip ${tab === "operations" ? "active" : ""}`}
              onClick={() => setTab("operations")}
            >
              Operations &amp; Roads
            </button>
            <button
              className={`chip ${tab === "intake" ? "active" : ""}`}
              onClick={() => setTab("intake")}
            >
              Report Intake
            </button>
            <button
              className={`chip ${tab === "analytics" ? "active" : ""}`}
              onClick={() => setTab("analytics")}
            >
              Gaps &amp; Allocation
            </button>
          </div>

          <section className="card">
            <h2>Scenario Overview</h2>
            <div className="stats-grid">
              <div className="stat-box">
                <div className="stat-value">{scenario.incidents.length}</div>
                <div className="stat-label">Incidents (Synthetic)</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">
                  {teams.filter((t) => t.availability === "available").length}/{teams.length}
                </div>
                <div className="stat-label">Available Teams</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{shelters.length}</div>
                <div className="stat-label">Shelters</div>
              </div>
              <div className="stat-box">
                <div className="stat-value">{metadata.disrupted_edge_count}</div>
                <div className="stat-label">Disrupted Edges</div>
              </div>
            </div>
          </section>

          {tab === "intake" && (
            <IncidentIntakePanel
              pickedCoords={pickedDraftCoords}
              pickingLocation={pickingLocationFor === "draft"}
              onTogglePickLocation={() =>
                setPickingLocationFor((prev) => (prev === "draft" ? null : "draft"))
              }
              onIncidentCreated={() => {
                setPickedDraftCoords(null);
                setPickingLocationFor(null);
                void fetchScenario().then(setScenario);
              }}
            />
          )}

          {tab === "analytics" && (
            <AnalyticsPanel
              gaps={gaps}
              allocation={allocation}
              busy={busy}
              onRefreshGaps={handleRefreshGaps}
              onRunAllocation={handleRunAllocation}
            />
          )}

          {tab === "operations" && (
            <>
              <section className="card">
                <h2>Road Disruption Simulation</h2>
                {selectedRoad ? (
                  <div style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div>
                      <strong>{selectedRoad.name}</strong> ({selectedRoad.road_type})
                      <div style={{ color: "#94a3b8" }}>
                        Length: {selectedRoad.length_m}m · Base: {selectedRoad.base_travel_time_sec}s · Current:{" "}
                        {selectedRoad.status === "blocked"
                          ? "BLOCKED"
                          : `${selectedRoad.effective_travel_time_sec}s`}{" "}
                        ({selectedRoad.status})
                      </div>
                    </div>
                    <div className="filter-row">
                      <button className="btn" disabled={busy} onClick={() => handleDisruptRoad("open")}>
                        Open
                      </button>
                      <button className="btn" disabled={busy} onClick={() => handleDisruptRoad("degraded")}>
                        Degrade (3x)
                      </button>
                      <button className="btn" disabled={busy} onClick={() => handleDisruptRoad("blocked")}>
                        Block Road
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "#94a3b8" }}>
                    Click any road segment on the map to mark it <strong>Degraded</strong> or{" "}
                    <strong>Blocked</strong>, then inspect route &amp; travel-time changes.
                  </div>
                )}

                {simulation && (
                  <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div style={{ color: "#94a3b8", marginBottom: 6 }}>
                      Reachable: <strong>{simulation.reachable_pairs}</strong> · Unreachable:{" "}
                      <strong>{simulation.unreachable_pairs}</strong> · Delayed/Detoured:{" "}
                      <strong>{simulation.delayed_or_detoured_pairs}</strong>
                    </div>
                    <div style={{ fontSize: 11, color: "#cbd5e1", marginBottom: 8 }}>
                      <em>{simulation.travel_time_note}</em>
                    </div>
                    <div className="list-stack" style={{ maxHeight: 180, overflowY: "auto" }}>
                      {simulation.routes.slice(0, 10).map((r) => (
                        <div
                          key={`${r.team_id}-${r.incident_id}`}
                          className="item-row"
                          style={{
                            cursor: "pointer",
                            borderColor:
                              activeRoute?.team_id === r.team_id &&
                              activeRoute?.incident_id === r.incident_id
                                ? "#38bdf8"
                                : undefined,
                          }}
                          onClick={() => setActiveRoute(r)}
                        >
                          <div className="item-header">
                            <strong>
                              {r.team_name.split(" ")[0]} → {r.incident_id.toUpperCase()}
                            </strong>
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
                          <div style={{ color: "#94a3b8" }}>
                            {r.reachable
                              ? `${r.current_travel_time_sec}s (base ${r.baseline_travel_time_sec}s${
                                  r.delta_sec && r.delta_sec > 0 ? `, +${r.delta_sec}s` : ""
                                })`
                              : r.note}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section className="card">
                <h2>Map Layers</h2>
                <div className="filter-row">
                  {(Object.keys(layers) as (keyof typeof layers)[]).map((key) => (
                    <button
                      key={key}
                      className={`chip ${layers[key] ? "active" : ""}`}
                      onClick={() => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
                    >
                      {key}
                    </button>
                  ))}
                </div>
              </section>

              <section className="card">
                <h2>Incidents ({filteredIncidents.length})</h2>
                <div className="filter-row" style={{ marginBottom: 8 }}>
                  {(["all", "critical", "high", "medium", "low"] as const).map((u) => (
                    <button
                      key={u}
                      className={`chip ${urgencyFilter === u ? "active" : ""}`}
                      onClick={() => setUrgencyFilter(u)}
                    >
                      {u}
                    </button>
                  ))}
                </div>
                <div className="list-stack">
                  {filteredIncidents.map((inc) => (
                    <div className="item-row" key={inc.id}>
                      <div className="item-header">
                        <strong>{inc.id.toUpperCase()}</strong>
                        <span className={`badge badge-${inc.urgency}`}>{inc.urgency}</span>
                      </div>
                      <div style={{ marginBottom: 4 }}>{inc.location_hint}</div>
                      <div style={{ color: "#94a3b8", display: "flex", justifyContent: "space-between" }}>
                        <span>Need: {inc.need_type}</span>
                        <span
                          className={`badge ${
                            inc.verification === "verified" ? "badge-ok" : "badge-warn"
                          }`}
                        >
                          {inc.verification === "verified" ? "verified" : "unverified location"}
                        </span>
                      </div>
                      {inc.verification !== "verified" && (
                        <button
                          className="btn"
                          style={{ marginTop: 6, width: "100%", justifyContent: "center" }}
                          onClick={() =>
                            setPickingLocationFor((prev) => (prev === inc.id ? null : inc.id))
                          }
                        >
                          {pickingLocationFor === inc.id
                            ? "Click Map to Pin Location..."
                            : "Verify & Pin Location on Map"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </aside>

        <MapView
          bbox={metadata.bbox}
          roads={roads}
          incidents={filteredIncidents}
          teams={teams}
          shelters={shelters}
          zones={zones}
          zoneGaps={gaps?.zones ?? []}
          allocationAssignments={allocation?.optimised.assignments ?? []}
          activeRoute={activeRoute}
          selectedRoadId={selectedRoad?.id ?? null}
          onSelectRoad={(edge) => setSelectedRoad(edge)}
          pickingLocation={pickingLocationFor !== null}
          onPickLocation={handleMapPickLocation}
          layers={layers}
        />
      </main>
    </div>
  );
}
