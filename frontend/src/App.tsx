import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { fetchMapRoads, fetchScenario, resetScenario } from "./api/client";
import MapView from "./components/MapView";
import type { RoadEdge, ScenarioResponse, UrgencyLevel } from "./types/domain";

export default function App() {
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [roads, setRoads] = useState<RoadEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | "all">("all");
  const [layers, setLayers] = useState({
    roads: true,
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
            {metadata.area_name} · {metadata.node_count} intersections · {metadata.edge_count} road segments
          </div>
        </div>
        <div className="header-actions">
          <button className="btn" onClick={handleReset} title="Restore initial prepared scenario">
            <RotateCcw size={14} />
            Reset Scenario
          </button>
        </div>
      </header>

      <main className="main-layout">
        <aside className="sidebar">
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
                <div className="stat-value">{zones.length}</div>
                <div className="stat-label">Geographic Zones</div>
              </div>
            </div>
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
                </div>
              ))}
            </div>
          </section>
        </aside>

        <MapView
          bbox={metadata.bbox}
          roads={roads}
          incidents={filteredIncidents}
          teams={teams}
          shelters={shelters}
          zones={zones}
          layers={layers}
        />
      </main>
    </div>
  );
}
