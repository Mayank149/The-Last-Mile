import {
  Layers,
  MapPin,
  X,
} from "lucide-react";
import MapView from "../MapView";
import type {
  AllocationAssignment,
  Coordinates,
  Incident,
  RescueTeam,
  RoadEdge,
  RoadStatus,
  RouteComparison,
  Shelter,
  ZoneDefinition,
  ZoneGapAssessment,
} from "../../types/domain";

interface MapWorkspaceProps {
  bbox: { north: number; south: number; east: number; west: number };
  roads: RoadEdge[];
  incidents: Incident[];
  teams: RescueTeam[];
  shelters: Shelter[];
  zones: ZoneDefinition[];
  zoneGaps: ZoneGapAssessment[];
  allocationAssignments: AllocationAssignment[];
  activeRoute: RouteComparison | null;
  onClearActiveRoute: () => void;
  selectedRoad: RoadEdge | null;
  onSelectRoad: (edge: RoadEdge | null) => void;
  onDisruptRoad: (status: RoadStatus) => void;
  pickingLocationFor: "draft" | string | null;
  onCancelPickLocation: () => void;
  onMapPickLocation: (coords: Coordinates) => void;
  layers: {
    roads: boolean;
    routes: boolean;
    incidents: boolean;
    teams: boolean;
    shelters: boolean;
    zones: boolean;
  };
  onToggleLayer: (layerKey: keyof MapWorkspaceProps["layers"]) => void;
  busy: boolean;
}

export default function MapWorkspace({
  bbox,
  roads,
  incidents,
  teams,
  shelters,
  zones,
  zoneGaps,
  allocationAssignments,
  activeRoute,
  onClearActiveRoute,
  selectedRoad,
  onSelectRoad,
  onDisruptRoad,
  pickingLocationFor,
  onCancelPickLocation,
  onMapPickLocation,
  layers,
  onToggleLayer,
  busy,
}: MapWorkspaceProps) {
  const isPicking = pickingLocationFor !== null;

  return (
    <div className="workspace-container map-workspace">
      {/* Location Pinning Alert Bar */}
      {isPicking && (
        <div className="map-pinning-banner">
          <div className="pinning-banner-content">
            <MapPin size={16} className="pinning-icon-pulse" />
            <span className="pinning-banner-text">
              <strong>LOCATION PINNING MODE ACTIVE:</strong> Click anywhere on the map to pin precise coordinates for{" "}
              <strong>
                {pickingLocationFor === "draft" ? "Draft Incident" : `Incident ${pickingLocationFor.toUpperCase()}`}
              </strong>
            </span>
          </div>
          <button className="btn btn-xs btn-ghost-white" onClick={onCancelPickLocation}>
            <X size={13} />
            <span>Cancel</span>
          </button>
        </div>
      )}

      {/* Floating Map Controls Bar */}
      <div className="map-floating-bar">
        {/* Layer Toggles */}
        <div className="map-layer-toggles">
          <span className="layer-bar-label">
            <Layers size={13} />
            <span>Layers:</span>
          </span>
          {(Object.keys(layers) as (keyof typeof layers)[]).map((layerKey) => (
            <button
              key={layerKey}
              className={`chip chip-layer ${layers[layerKey] ? "active" : ""}`}
              onClick={() => onToggleLayer(layerKey)}
            >
              {layerKey}
            </button>
          ))}
        </div>

        {/* Active Route Pill if route selected */}
        {activeRoute && (
          <div className="active-route-pill">
            <span>
              Route: <strong>{activeRoute.team_name.split(" ")[0]}</strong> →{" "}
              <strong>{activeRoute.incident_id.toUpperCase()}</strong> ({activeRoute.current_travel_time_sec}s)
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

      {/* Floating Selected Road Disruption Card */}
      {selectedRoad && (
        <div className="map-floating-road-card">
          <div className="floating-card-header">
            <div>
              <h4 className="floating-road-name">{selectedRoad.name || "Unnamed Segment"}</h4>
              <span className="floating-road-type">{selectedRoad.road_type}</span>
            </div>
            <button
              className="btn btn-xs btn-ghost"
              onClick={() => onSelectRoad(null)}
              title="Close panel"
            >
              <X size={14} />
            </button>
          </div>

          <div className="floating-road-meta">
            Length: <strong>{selectedRoad.length_m}m</strong> · Modelled ETA:{" "}
            <strong>
              {selectedRoad.status === "blocked" ? "BLOCKED" : `${selectedRoad.effective_travel_time_sec}s`}
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

      {/* Map Canvas */}
      <div className="map-canvas-wrapper">
        <MapView
          bbox={bbox}
          roads={roads}
          incidents={incidents}
          teams={teams}
          shelters={shelters}
          zones={zones}
          zoneGaps={zoneGaps}
          allocationAssignments={allocationAssignments}
          activeRoute={activeRoute}
          selectedRoadId={selectedRoad?.id ?? null}
          onSelectRoad={(edge) => onSelectRoad(edge)}
          pickingLocation={isPicking}
          onPickLocation={onMapPickLocation}
          layers={layers}
        />
      </div>
    </div>
  );
}
