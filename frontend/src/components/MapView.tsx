import { useEffect, useRef } from "react";
import L from "leaflet";
import type {
  Incident,
  RescueTeam,
  RoadEdge,
  Shelter,
  ZoneDefinition,
} from "../types/domain";

interface MapViewProps {
  bbox: { north: number; south: number; east: number; west: number };
  roads: RoadEdge[];
  incidents: Incident[];
  teams: RescueTeam[];
  shelters: Shelter[];
  zones: ZoneDefinition[];
  layers: {
    roads: boolean;
    incidents: boolean;
    teams: boolean;
    shelters: boolean;
    zones: boolean;
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
  layers,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupsRef = useRef<{
    zones: L.LayerGroup;
    roads: L.LayerGroup;
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

  // Render Zones
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups) return;
    groups.zones.clearLayers();
    if (!layers.zones) return;

    for (const zone of zones) {
      L.polygon(zone.polygon, {
        color: "#64748b",
        weight: 1,
        dashArray: "4 4",
        fillColor: "#38bdf8",
        fillOpacity: 0.06,
      })
        .bindPopup(
          `<strong>${zone.name}</strong><br/><small>${zone.description}</small>`
        )
        .addTo(groups.zones);
    }
  }, [zones, layers.zones]);

  // Render Roads
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups) return;
    groups.roads.clearLayers();
    if (!layers.roads) return;

    for (const edge of roads) {
      const color =
        edge.status === "blocked"
          ? "#ef4444"
          : edge.status === "degraded"
          ? "#f59e0b"
          : "#38bdf8";
      const weight = edge.status === "open" ? 2.5 : 4;
      const opacity = edge.status === "open" ? 0.55 : 0.9;

      L.polyline(edge.coords, {
        color,
        weight,
        opacity,
        dashArray: edge.status === "blocked" ? "6 6" : undefined,
      })
        .bindPopup(
          `<strong>${edge.name}</strong><br/>` +
            `Class: ${edge.road_type} | Length: ${edge.length_m} m<br/>` +
            `Modelled time: ${edge.effective_travel_time_sec}s (${edge.status})`
        )
        .addTo(groups.roads);
    }
  }, [roads, layers.roads]);

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
