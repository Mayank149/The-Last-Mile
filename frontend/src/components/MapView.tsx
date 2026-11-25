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
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    L.rectangle(
      [
        [bbox.south, bbox.west],
        [bbox.north, bbox.east],
      ],
      {
        color: "#38bdf8",
        weight: 1.5,
        dashArray: "6 4",
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

    return () => {
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

  // Render Zones (colored by gap_level when gap assessment is available)
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups) return;
    groups.zones.clearLayers();
    if (!layers.zones) return;

    const gapById = new Map(zoneGaps.map((g) => [g.id, g]));

    for (const zone of zones) {
      const gap = gapById.get(zone.id);
      const fillColor =
        gap?.gap_level === "high"
          ? "#ef4444"
          : gap?.gap_level === "moderate"
          ? "#f59e0b"
          : "#38bdf8";
      const fillOpacity = gap?.gap_level === "high" ? 0.22 : gap?.gap_level === "moderate" ? 0.14 : 0.06;

      const popupHtml = gap
        ? `<strong>${zone.name}</strong><br/>` +
          `Gap Score: <strong>${gap.gap_score}</strong> (${gap.gap_level.toUpperCase()})<br/>` +
          `<small>${gap.contributing_factors.join("<br/>")}</small>`
        : `<strong>${zone.name}</strong><br/><small>${zone.description}</small>`;

      L.polygon(zone.polygon, {
        color: fillColor,
        weight: 1.5,
        dashArray: "4 4",
        fillColor,
        fillOpacity,
      })
        .bindPopup(popupHtml)
        .addTo(groups.zones);
    }
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
