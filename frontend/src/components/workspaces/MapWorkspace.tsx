import type { CSSProperties } from "react";
import {
  Layers,
  MapPin,
  X,
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Route,
  Navigation,
  AlertTriangle,
  Users,
  Building2,
  Square,
} from "lucide-react";
import MapView from "../MapView";
import type { AnimationRoute } from "../MapView";
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
  animationRoutes: AnimationRoute[];
  animationPlaying: boolean;
  animationSpeed: number;
  animationProgress: number;
  onTogglePlay: () => void;
  onSetSpeed: (speed: number) => void;
  onResetAnimation: () => void;
  onAnimationProgress: (progress: number) => void;
}

const LAYER_ITEMS: {
  key: keyof MapWorkspaceProps["layers"];
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
  animationRoutes,
  animationPlaying,
  animationSpeed,
  animationProgress,
  onTogglePlay,
  onSetSpeed,
  onResetAnimation,
  onAnimationProgress,
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
        <div className="map-layer-toggles" role="toolbar" aria-label="Map layer toggles">
          <style>{`
            .map-floating-bar .map-layer-toggles {
              background: rgba(15, 23, 42, 0.88);
              backdrop-filter: blur(16px) saturate(180%);
              -webkit-backdrop-filter: blur(16px) saturate(180%);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 12px;
              padding: 4px 6px;
              display: inline-flex;
              align-items: center;
              gap: 4px;
              box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.45), 0 4px 12px -2px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
            }

            .map-floating-bar .layer-bar-label {
              display: inline-flex;
              align-items: center;
              gap: 5px;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: 0.06em;
              text-transform: uppercase;
              color: #94a3b8;
              padding: 0 4px 0 6px;
              user-select: none;
            }

            .map-floating-bar .layer-bar-icon {
              color: #38bdf8;
              opacity: 0.9;
            }

            .map-floating-bar .layer-bar-divider {
              display: inline-block;
              width: 1px;
              height: 16px;
              background: rgba(255, 255, 255, 0.12);
              margin: 0 3px 0 1px;
            }

            .map-floating-bar .layer-chip-btn {
              display: inline-flex;
              align-items: center;
              gap: 6px;
              padding: 5px 10px;
              font-size: 11.5px;
              font-weight: 500;
              border-radius: 8px;
              border: 1px solid rgba(255, 255, 255, 0.07);
              background: rgba(30, 41, 59, 0.45);
              color: #94a3b8;
              cursor: pointer;
              transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
              line-height: 1;
              white-space: nowrap;
              user-select: none;
            }

            .map-floating-bar .layer-chip-btn:hover {
              background: rgba(51, 65, 85, 0.7);
              border-color: rgba(255, 255, 255, 0.16);
              color: #f8fafc;
              transform: translateY(-1px);
              box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
            }

            .map-floating-bar .layer-chip-btn:active {
              transform: translateY(0);
            }

            .map-floating-bar .layer-chip-btn.active {
              background: rgba(15, 23, 42, 0.95);
              border-color: rgba(255, 255, 255, 0.18);
              color: #ffffff;
              font-weight: 600;
              box-shadow: 0 2px 8px -1px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.12);
            }

            .map-floating-bar .layer-chip-btn .layer-chip-icon {
              color: #64748b;
              transition: color 0.15s ease, transform 0.15s ease;
              flex-shrink: 0;
            }

            .map-floating-bar .layer-chip-btn:hover .layer-chip-icon {
              color: #cbd5e1;
            }

            .map-floating-bar .layer-chip-btn.active .layer-chip-icon {
              color: var(--layer-color, #38bdf8);
            }

            .map-floating-bar .layer-chip-btn .layer-chip-dot {
              width: 5px;
              height: 5px;
              border-radius: 50%;
              background: rgba(148, 163, 184, 0.35);
              transition: all 0.15s ease;
              flex-shrink: 0;
            }

            .map-floating-bar .layer-chip-btn.active .layer-chip-dot {
              background: var(--layer-color, #38bdf8);
              box-shadow: 0 0 6px var(--layer-color, #38bdf8);
            }
          `}</style>
          <span className="layer-bar-label">
            <Layers size={13} className="layer-bar-icon" />
            <span>Layers</span>
          </span>
          <span className="layer-bar-divider" aria-hidden="true" />
          {LAYER_ITEMS.map(({ key, label, icon: Icon, activeColor }) => {
            const isActive = layers[key];
            return (
              <button
                key={key}
                type="button"
                className={`layer-chip-btn ${isActive ? "active" : ""}`}
                style={{ "--layer-color": activeColor } as CSSProperties}
                onClick={() => onToggleLayer(key)}
                aria-pressed={isActive}
                title={`Toggle ${label} layer (${isActive ? "Visible" : "Hidden"})`}
              >
                <Icon size={12} className="layer-chip-icon" />
                <span className="layer-chip-label">{label}</span>
                <span className="layer-chip-dot" />
              </button>
            );
          })}
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

      {/* Floating Animation Controls */}
      {animationRoutes.length > 0 && (
        <div className="map-animation-controls">
          <div className="anim-controls-inner">
            <button
              className={`btn btn-xs ${animationPlaying ? "btn-warn" : "btn-ok"}`}
              onClick={onTogglePlay}
              title={animationPlaying ? "Pause animation" : "Play animation"}
            >
              {animationPlaying ? <Pause size={13} /> : <Play size={13} />}
              <span>{animationPlaying ? "Pause" : "Play"}</span>
            </button>

            <button
              className="btn btn-xs btn-secondary"
              onClick={onResetAnimation}
              title="Reset to start"
            >
              <RotateCcw size={12} />
            </button>

            <div className="anim-speed-controls">
              <Gauge size={12} className="text-muted" />
              {[0.5, 1, 2, 3].map((s) => (
                <button
                  key={s}
                  className={`chip chip-speed ${animationSpeed === s ? "active" : ""}`}
                  onClick={() => onSetSpeed(s)}
                >
                  {s}x
                </button>
              ))}
            </div>

            <div className="anim-progress-wrap">
              <div className="anim-progress-bar">
                <div
                  className="anim-progress-fill"
                  style={{ width: `${Math.min(animationProgress * 100, 100)}%` }}
                />
              </div>
              <span className="anim-progress-label">
                {Math.round(animationProgress * 100)}%
              </span>
            </div>

            <span className="anim-route-count">
              {animationRoutes.length} team{animationRoutes.length !== 1 ? "s" : ""} en route
            </span>
          </div>
        </div>
      )}

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
          animationRoutes={animationRoutes}
          animationPlaying={animationPlaying}
          animationSpeed={animationSpeed}
          animationProgress={animationProgress}
          onAnimationProgress={onAnimationProgress}
        />
      </div>
    </div>
  );
}
