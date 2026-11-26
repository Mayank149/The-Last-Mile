import { useEffect, useMemo, useState } from "react";
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
import Header from "./components/Header";
import Navigation from "./components/Navigation";
import CoverageAllocationWorkspace from "./components/workspaces/CoverageAllocationWorkspace";
import IntakeWorkspace from "./components/workspaces/IntakeWorkspace";
import MapWorkspace from "./components/workspaces/MapWorkspace";
import OperationsWorkspace from "./components/workspaces/OperationsWorkspace";
import OverviewWorkspace from "./components/workspaces/OverviewWorkspace";
import type {
  AllocationResponse,
  Coordinates,
  CoverageGapsResponse,
  Incident,
  RoadEdge,
  RoadStatus,
  RouteComparison,
  ScenarioResponse,
  SimulationResult,
  UrgencyLevel,
  WorkspaceId,
} from "./types/domain";

function getInitialWorkspace(): WorkspaceId {
  const hash = window.location.hash.replace("#", "") as WorkspaceId;
  const validWorkspaces: WorkspaceId[] = [
    "overview",
    "operations",
    "intake",
    "coverage-allocation",
    "map",
  ];
  return validWorkspaces.includes(hash) ? hash : "overview";
}

export default function App() {
  const [scenario, setScenario] = useState<ScenarioResponse | null>(null);
  const [roads, setRoads] = useState<RoadEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Active Workspace Navigation (Hash synced)
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceId>(getInitialWorkspace);
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Operational State
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyLevel | "all">("all");
  const [selectedRoad, setSelectedRoad] = useState<RoadEdge | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [activeRoute, setActiveRoute] = useState<RouteComparison | null>(null);
  const [gaps, setGaps] = useState<CoverageGapsResponse | null>(null);
  const [allocation, setAllocation] = useState<AllocationResponse | null>(null);
  const [busy, setBusy] = useState(false);

  // Location Pinning State
  const [pickingLocationFor, setPickingLocationFor] = useState<"draft" | string | null>(null);
  const [pickedDraftCoords, setPickedDraftCoords] = useState<Coordinates | null>(null);

  // Map Layer Visibility
  const [layers, setLayers] = useState({
    roads: true,
    routes: true,
    incidents: true,
    teams: true,
    shelters: true,
    zones: true,
  });

  // Sync workspace with URL hash
  function handleSelectWorkspace(id: WorkspaceId) {
    setActiveWorkspace(id);
    window.location.hash = id;
  }

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "") as WorkspaceId;
      const validWorkspaces: WorkspaceId[] = [
        "overview",
        "operations",
        "intake",
        "coverage-allocation",
        "map",
      ];
      if (validWorkspaces.includes(hash)) {
        setActiveWorkspace(hash);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  async function loadAll() {
    try {
      setLoading(true);
      setError(null);
      const [scen, roadRes] = await Promise.all([fetchScenario(), fetchMapRoads()]);
      setScenario(scen);
      setRoads(roadRes.edges);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scenario from backend");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function handleReset() {
    setBusy(true);
    try {
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
    } finally {
      setBusy(false);
    }
  }

  async function handleMapPickLocation(coords: Coordinates) {
    if (pickingLocationFor === "draft") {
      setPickedDraftCoords(coords);
      setPickingLocationFor(null);
      // Switch back to intake workspace so operator sees confirmed pin
      handleSelectWorkspace("intake");
      return;
    }

    if (pickingLocationFor) {
      setBusy(true);
      try {
        await verifyIncidentLocation(pickingLocationFor, coords);
        const scen = await fetchScenario();
        setScenario(scen);
        setPickingLocationFor(null);
      } finally {
        setBusy(false);
      }
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

  function handleIncidentCreated(newIncident: Incident) {
    setScenario((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        incidents: [newIncident, ...prev.incidents.filter((i) => i.id !== newIncident.id)],
      };
    });
  }

  const unverifiedIncidentCount = useMemo(() => {
    if (!scenario) return 0;
    return scenario.incidents.filter((i) => i.verification !== "verified").length;
  }, [scenario]);

  if (loading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-spinner" />
        <h2 className="loading-title">Loading THE LAST MILE Emergency Environment</h2>
        <p className="loading-desc">
          Mounting OpenStreetMap road network &amp; scenario state for Koramangala &amp; Ejipura...
        </p>
      </div>
    );
  }

  if (error || !scenario) {
    return (
      <div className="app-error-screen">
        <div className="error-card">
          <h2>Failed to Connect to Emergency Monolith API</h2>
          <p>{error ?? "Backend scenario state is unavailable."}</p>
          <button className="btn btn-primary" onClick={() => void loadAll()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { metadata, teams, shelters, incidents, zones } = scenario;

  return (
    <div className="app-shell">
      {/* Top Header */}
      <Header
        metadata={metadata}
        busy={busy}
        onRunSimulation={handleRunSimulation}
        onResetScenario={handleReset}
        mobileNavOpen={mobileNavOpen}
        onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)}
      />

      {/* Main Body Shell: Left Navigation + Main Content Area */}
      <div className="app-body">
        {/* Left Navigation */}
        <Navigation
          activeWorkspace={activeWorkspace}
          onSelectWorkspace={handleSelectWorkspace}
          collapsed={navCollapsed}
          onToggleCollapse={() => setNavCollapsed((prev) => !prev)}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
          disruptedRoadCount={metadata.disrupted_edge_count}
          unverifiedIncidentCount={unverifiedIncidentCount}
          totalIncidentCount={incidents.length}
        />

        {/* Main Content Area */}
        <main
          className={`app-main-content ${
            activeWorkspace === "map" ? "main-content-map-mode" : ""
          }`}
        >
          {activeWorkspace === "overview" && (
            <OverviewWorkspace
              scenario={scenario}
              simulation={simulation}
              gaps={gaps}
              allocation={allocation}
              onNavigate={handleSelectWorkspace}
              onSelectUrgencyFilter={(u) => setUrgencyFilter(u)}
              onRunSimulation={handleRunSimulation}
              onAnalyzeGaps={handleRefreshGaps}
              onRunAllocation={handleRunAllocation}
              busy={busy}
            />
          )}

          {activeWorkspace === "operations" && (
            <OperationsWorkspace
              roads={roads}
              incidents={incidents}
              teams={teams}
              selectedRoad={selectedRoad}
              onSelectRoad={setSelectedRoad}
              onDisruptRoad={handleDisruptRoad}
              simulation={simulation}
              activeRoute={activeRoute}
              onSelectActiveRoute={setActiveRoute}
              onRunSimulation={handleRunSimulation}
              urgencyFilter={urgencyFilter}
              onSetUrgencyFilter={setUrgencyFilter}
              onStartPinLocation={(incidentId) => {
                setPickingLocationFor(incidentId);
                handleSelectWorkspace("map");
              }}
              onNavigate={handleSelectWorkspace}
              busy={busy}
            />
          )}

          {activeWorkspace === "intake" && (
            <IntakeWorkspace
              incidents={incidents}
              onIncidentCreated={handleIncidentCreated}
              pickedDraftCoords={pickedDraftCoords}
              onClearPickedDraftCoords={() => setPickedDraftCoords(null)}
              onStartPinLocationForDraft={() => {
                setPickingLocationFor("draft");
                handleSelectWorkspace("map");
              }}
              onNavigate={handleSelectWorkspace}
              onStartPinLocationForIncident={(incidentId) => {
                setPickingLocationFor(incidentId);
                handleSelectWorkspace("map");
              }}
            />
          )}

          {activeWorkspace === "coverage-allocation" && (
            <CoverageAllocationWorkspace
              gaps={gaps}
              allocation={allocation}
              busy={busy}
              onRefreshGaps={handleRefreshGaps}
              onRunAllocation={handleRunAllocation}
              onNavigate={handleSelectWorkspace}
              onSelectActiveRoute={setActiveRoute}
            />
          )}

          {activeWorkspace === "map" && (
            <MapWorkspace
              bbox={metadata.bbox}
              roads={roads}
              incidents={incidents}
              teams={teams}
              shelters={shelters}
              zones={zones}
              zoneGaps={gaps?.zones ?? []}
              allocationAssignments={allocation?.optimised.assignments ?? []}
              activeRoute={activeRoute}
              onClearActiveRoute={() => setActiveRoute(null)}
              selectedRoad={selectedRoad}
              onSelectRoad={setSelectedRoad}
              onDisruptRoad={handleDisruptRoad}
              pickingLocationFor={pickingLocationFor}
              onCancelPickLocation={() => setPickingLocationFor(null)}
              onMapPickLocation={handleMapPickLocation}
              layers={layers}
              onToggleLayer={(key) => setLayers((prev) => ({ ...prev, [key]: !prev[key] }))}
              busy={busy}
            />
          )}
        </main>
      </div>
    </div>
  );
}
