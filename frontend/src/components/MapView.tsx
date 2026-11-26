import { useEffect, useRef } from "react";
import L from "leaflet";
import type {
  AllocationAssignment,
  Coordinates,
  Incident,
  RescueTeam,
  RoadEdge,
  RouteComparison,
  Shelter,
  ZoneDefinition,
  ZoneGapAssessment,
} from "../types/domain";

interface MapViewProps {
  bbox: { north: number; south: number; east: number; west: number };
  roads: RoadEdge[];
  incidents: Incident[];
  teams: RescueTeam[];
  shelters: Shelter[];
  zones: ZoneDefinition[];
  zoneGaps: ZoneGapAssessment[];
  allocationAssignments: AllocationAssignment[];
  activeRoute: RouteComparison | null;
  selectedRoadId: string | null;
  onSelectRoad: (edge: RoadEdge) => void;
  pickingLocation: boolean;
  onPickLocation: (coords: Coordinates) => void;
  layers: {
    roads: boolean;
    incidents: boolean;
    teams: boolean;
    shelters: boolean;
    zones: boolean;
    routes: boolean;
  };
}

const URGENCY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
};

export default function MapView({
  bbox,
  roads,
  incidents,
  teams,
  shelters,
  zones,
  zoneGaps,
  allocationAssignments,
  activeRoute,
  selectedRoadId,
  onSelectRoad,
  pickingLocation,
  onPickLocation,
  layers,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupsRef = useRef<{
    zones: L.LayerGroup;
    roads: L.LayerGroup;
    routes: L.LayerGroup;
    shelters: L.LayerGroup;
    teams: L.LayerGroup;
    incidents: L.LayerGroup;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const centerLat = (bbox.north + bbox.south) / 2;
    const centerLon = (bbox.east + bbox.west) / 2;

    const map = L.map(containerRef.current, {
      center: [centerLat, centerLon],
      zoom: 15,
      zoomControl: false,
    });

    // Compact vertical map controls in the top-right corner
    const zoomControl = L.control.zoom({
      position: "topright",
      zoomInTitle: "Zoom in",
      zoomOutTitle: "Zoom out",
    });
    zoomControl.addTo(map);

    // Re-center / reset view button in the same vertical control stack
    const zoomContainer = zoomControl.getContainer();
    if (zoomContainer) {
      const resetBtn = L.DomUtil.create(
        "a",
        "leaflet-control-zoom-reset leaflet-bar-part",
        zoomContainer
      );
      resetBtn.href = "#";
      resetBtn.title = "Reset map view";
      resetBtn.setAttribute("role", "button");
      resetBtn.setAttribute("aria-label", "Reset map view");
      resetBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M3 12h3m12 0h3M12 3v3m0 12v3"/></svg>`;

      L.DomEvent.on(resetBtn, "click", (e) => {
        L.DomEvent.preventDefault(e);
        L.DomEvent.stopPropagation(e);
        map.setView([centerLat, centerLon], 15);
      });
    }

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Single outside blue box covering the entire operational area
    L.rectangle(
      [
        [bbox.south, bbox.west],
        [bbox.north, bbox.east],
      ],
      {
        color: "#2563eb",
        weight: 2,
        fill: false,
      }
    ).addTo(map);

    layerGroupsRef.current = {
      zones: L.layerGroup().addTo(map),
      roads: L.layerGroup().addTo(map),
      routes: L.layerGroup().addTo(map),
      shelters: L.layerGroup().addTo(map),
      teams: L.layerGroup().addTo(map),
      incidents: L.layerGroup().addTo(map),
    };

    mapRef.current = map;

    // Invalidate size immediately and when container resizes
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
    });
    observer.observe(containerRef.current);
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      observer.disconnect();
      clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      layerGroupsRef.current = null;
    };
  }, [bbox.east, bbox.north, bbox.south, bbox.west]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const container = map.getContainer();
    container.style.cursor = pickingLocation ? "crosshair" : "";

    const handleClick = (e: L.LeafletMouseEvent) => {
      if (!pickingLocation) return;
      onPickLocation({
        lat: Number(e.latlng.lat.toFixed(6)),
        lon: Number(e.latlng.lng.toFixed(6)),
      });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [pickingLocation, onPickLocation]);

  // Zones layer: cleared to prevent multiple inner boxes (retaining only the 1 outside blue boundary box)
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups) return;
    groups.zones.clearLayers();
  }, [zones, zoneGaps, layers.zones]);

  // Render Roads
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups) return;
    groups.roads.clearLayers();
    if (!layers.roads) return;

    for (const edge of roads) {
      const isSelected = edge.id === selectedRoadId;
      const color = isSelected
        ? "#e879f9"
        : edge.status === "blocked"
        ? "#ef4444"
        : edge.status === "degraded"
        ? "#f59e0b"
        : "#38bdf8";
      const weight = isSelected ? 6 : edge.status === "open" ? 2.5 : 4.5;
      const opacity = isSelected ? 1.0 : edge.status === "open" ? 0.5 : 0.9;

      const poly = L.polyline(edge.coords, {
        color,
        weight,
        opacity,
        dashArray: edge.status === "blocked" ? "6 6" : undefined,
      });

      poly.on("click", () => {
        onSelectRoad(edge);
      });

      poly
        .bindPopup(
          `<strong>${edge.name}</strong><br/>` +
            `Class: ${edge.road_type} | Length: ${edge.length_m} m<br/>` +
            `Modelled time: ${edge.effective_travel_time_sec}s (${edge.status})`
        )
        .addTo(groups.roads);
    }
  }, [roads, layers.roads, selectedRoadId, onSelectRoad]);

  // Render Active Simulated Route & Allocation Assignment Routes
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups) return;
    groups.routes.clearLayers();
    if (!layers.routes) return;

    for (const a of allocationAssignments) {
      if (a.path_coords.length === 0) continue;
      L.polyline(a.path_coords, {
        color: "#a855f7",
        weight: 4,
        opacity: 0.8,
        dashArray: "8 4",
      })
        .bindPopup(
          `<strong>Proposed: ${a.team_name} → ${a.incident_id.toUpperCase()}</strong><br/>` +
            `Modelled ETA: ${a.travel_time_sec}s<br/><small>${a.rationale}</small>`
        )
        .addTo(groups.routes);
    }

    if (activeRoute && activeRoute.reachable && activeRoute.path_coords.length > 0) {
      L.polyline(activeRoute.path_coords, {
        color: activeRoute.route_status === "detoured_or_delayed" ? "#facc15" : "#22c55e",
        weight: 5.5,
        opacity: 0.95,
      })
        .bindPopup(
          `<strong>${activeRoute.team_name} → ${activeRoute.incident_label}</strong><br/>` +
            `Modelled: ${activeRoute.current_travel_time_sec}s (Baseline: ${activeRoute.baseline_travel_time_sec}s)`
        )
        .addTo(groups.routes);
    }
  }, [activeRoute, allocationAssignments, layers.routes]);

  // Render Shelters
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups) return;
    groups.shelters.clearLayers();
    if (!layers.shelters) return;

    for (const sh of shelters) {
      L.circleMarker([sh.coordinates.lat, sh.coordinates.lon], {
        radius: 7,
        color: "#064e3b",
        weight: 2,
        fillColor: "#10b981",
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<strong>${sh.name}</strong><br/>Occupancy: ${sh.simulated_occupancy} / ${sh.capacity} (Simulated)`
        )
        .addTo(groups.shelters);
    }
  }, [shelters, layers.shelters]);

  // Render Teams
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups) return;
    groups.teams.clearLayers();
    if (!layers.teams) return;

    for (const team of teams) {
      L.circleMarker([team.coordinates.lat, team.coordinates.lon], {
        radius: 8,
        color: "#eff6ff",
        weight: 2,
        fillColor: team.availability === "available" ? "#3b82f6" : "#64748b",
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<strong>${team.name}</strong><br/>` +
            `Status: ${team.availability} | Capacity: ${team.capacity}<br/>` +
            `Capabilities: ${team.capabilities.join(", ")}`
        )
        .addTo(groups.teams);
    }
  }, [teams, layers.teams]);

  // Render Incidents
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups) return;
    groups.incidents.clearLayers();
    if (!layers.incidents) return;

    for (const inc of incidents) {
      if (!inc.coordinates) continue;
      const color = URGENCY_COLORS[inc.urgency] ?? "#ef4444";
      L.circleMarker([inc.coordinates.lat, inc.coordinates.lon], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.95,
      })
        .bindPopup(
          `<strong>${inc.id.toUpperCase()} (${inc.urgency.toUpperCase()})</strong><br/>` +
            `${inc.location_hint}<br/>` +
            `Need: ${inc.need_type} | Verification: ${inc.verification}<br/>` +
            `<small>${inc.original_message}</small>`
        )
        .addTo(groups.incidents);
    }
  }, [incidents, layers.incidents]);

  return (
    <div className="map-container">
      <style>{`
        .map-container .leaflet-top.leaflet-right {
          top: 16px;
          right: 16px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        .map-container .leaflet-control-zoom.leaflet-bar {
          background: rgba(15, 23, 42, 0.88);
          backdrop-filter: blur(16px) saturate(180%);
          -webkit-backdrop-filter: blur(16px) saturate(180%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 3px;
          display: flex;
          flex-direction: column;
          gap: 3px;
          box-shadow: 0 12px 30px -4px rgba(0, 0, 0, 0.45), 0 4px 12px -2px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.08);
          overflow: hidden;
          margin: 0;
        }

        .map-container .leaflet-control-zoom.leaflet-bar a {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          line-height: 34px;
          background: rgba(30, 41, 59, 0.45);
          color: #cbd5e1;
          font-size: 16px;
          font-weight: 500;
          text-decoration: none;
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
          user-select: none;
        }

        .map-container .leaflet-control-zoom.leaflet-bar a:hover {
          background: rgba(51, 65, 85, 0.7);
          border-color: rgba(255, 255, 255, 0.18);
          color: #38bdf8;
          transform: translateY(-1px);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.25);
        }

        .map-container .leaflet-control-zoom.leaflet-bar a:active {
          background: rgba(15, 23, 42, 0.95);
          transform: translateY(0);
          color: #ffffff;
        }

        .map-container .leaflet-control-zoom.leaflet-bar a.leaflet-disabled {
          background: rgba(15, 23, 42, 0.4);
          color: #475569;
          cursor: not-allowed;
          border-color: rgba(255, 255, 255, 0.03);
          transform: none;
          box-shadow: none;
        }

        .map-container .leaflet-control-zoom.leaflet-bar a svg {
          display: block;
          stroke: currentColor;
          transition: stroke 0.15s ease;
        }
      `}</style>
      <div ref={containerRef} style={{ height: "100%", width: "100%" }} />
      <div className="map-legend">
        <strong>Map Legend (Synthetic Overlay)</strong>
        <div className="legend-item">
          <span className="dot" style={{ background: "#ef4444" }} /> Critical / High Incident
        </div>
        <div className="legend-item">
          <span className="dot" style={{ background: "#3b82f6" }} /> Rescue Team
        </div>
        <div className="legend-item">
          <span className="dot" style={{ background: "#10b981" }} /> Shelter (Simulated)
        </div>
        <div className="legend-item">
          <span className="dot" style={{ background: "#38bdf8" }} /> OSM Road Segment
        </div>
      </div>
    </div>
  );
}
