import { useEffect, useRef, useCallback } from "react";
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

export interface AnimationRoute {
  teamId: string;
  teamName: string;
  incidentId: string;
  incidentLabel: string;
  pathCoords: [number, number][];
  color: string;
  type: "simulation" | "allocation";
}

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
  animationRoutes: AnimationRoute[];
  animationPlaying: boolean;
  animationSpeed: number;
  animationProgress: number;
  onAnimationProgress: (progress: number) => void;
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
  animationRoutes,
  animationPlaying,
  animationSpeed,
  animationProgress,
  onAnimationProgress,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const animMarkersRef = useRef<Map<string, { marker: L.Marker; trail: L.Polyline }>>(new Map());
  const animLayerRef = useRef<L.LayerGroup | null>(null);
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

    animLayerRef.current = L.layerGroup().addTo(map);

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
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapRef.current = null;
      layerGroupsRef.current = null;
      animLayerRef.current = null;
      animMarkersRef.current.clear();
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

  // ======== Rescue Team Motion Animation ========
  // Helper: interpolate position along a polyline path at a given fraction [0,1]
  const interpolateAlongPath = useCallback(
    (pathCoords: [number, number][], fraction: number): [number, number] => {
      if (pathCoords.length === 0) return [0, 0];
      if (pathCoords.length === 1 || fraction <= 0) return pathCoords[0];
      if (fraction >= 1) return pathCoords[pathCoords.length - 1];

      // Compute cumulative distances
      const distances: number[] = [0];
      for (let i = 1; i < pathCoords.length; i++) {
        const [lat1, lon1] = pathCoords[i - 1];
        const [lat2, lon2] = pathCoords[i];
        const d = Math.sqrt((lat2 - lat1) ** 2 + (lon2 - lon1) ** 2);
        distances.push(distances[i - 1] + d);
      }
      const totalDist = distances[distances.length - 1];
      if (totalDist === 0) return pathCoords[0];

      const targetDist = fraction * totalDist;

      // Find the two points we're between
      for (let i = 1; i < distances.length; i++) {
        if (distances[i] >= targetDist) {
          const segStart = distances[i - 1];
          const segEnd = distances[i];
          const segFraction = segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;
          const [lat1, lon1] = pathCoords[i - 1];
          const [lat2, lon2] = pathCoords[i];
          return [
            lat1 + (lat2 - lat1) * segFraction,
            lon1 + (lon2 - lon1) * segFraction,
          ];
        }
      }
      return pathCoords[pathCoords.length - 1];
    },
    []
  );

  // Create the team icon for animation markers
  const createTeamIcon = useCallback((color: string, teamLabel: string) => {
    return L.divIcon({
      className: "rescue-team-motion-icon",
      html: `<div class="motion-marker-outer" style="--team-color: ${color}">
        <div class="motion-marker-ping"></div>
        <div class="motion-marker-dot">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="motion-marker-label">${teamLabel}</div>
      </div>`,
      iconSize: [40, 54],
      iconAnchor: [20, 44],
    });
  }, []);

  // Animation effect: render and animate team markers along routes
  useEffect(() => {
    const map = mapRef.current;
    const animLayer = animLayerRef.current;
    if (!map || !animLayer) return;

    // Clean up previous animation markers
    animLayer.clearLayers();
    animMarkersRef.current.clear();
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (animationRoutes.length === 0) return;

    // Create markers and trail polylines for each route
    for (const route of animationRoutes) {
      if (route.pathCoords.length < 2) continue;

      const startPos = route.pathCoords[0];
      const shortName = route.teamName.split(" ")[0];
      const icon = createTeamIcon(route.color, shortName);

      const marker = L.marker([startPos[0], startPos[1]], {
        icon,
        zIndexOffset: 1000,
        interactive: true,
      })
        .bindPopup(
          `<strong>${route.teamName}</strong><br/>` +
            `En route → <strong>${route.incidentLabel || route.incidentId.toUpperCase()}</strong><br/>` +
            `<small>Type: ${route.type === "allocation" ? "Allocated Route" : "Simulated Route"}</small>`
        )
        .addTo(animLayer);

      // Trail polyline showing the path already traversed
      const trail = L.polyline([], {
        color: route.color,
        weight: 4,
        opacity: 0.9,
        dashArray: undefined,
      }).addTo(animLayer);

      // Ghost path showing the full planned route (faded)
      L.polyline(route.pathCoords, {
        color: route.color,
        weight: 2,
        opacity: 0.25,
        dashArray: "6 4",
      }).addTo(animLayer);

      animMarkersRef.current.set(route.teamId + "-" + route.incidentId, {
        marker,
        trail,
      });
    }

    // Position all markers at the current progress
    for (const route of animationRoutes) {
      if (route.pathCoords.length < 2) continue;
      const key = route.teamId + "-" + route.incidentId;
      const entry = animMarkersRef.current.get(key);
      if (!entry) continue;
      const pos = interpolateAlongPath(route.pathCoords, animationProgress);
      entry.marker.setLatLng([pos[0], pos[1]]);

      // Build trail up to the current progress
      const trailCoords: [number, number][] = [];
      const distances: number[] = [0];
      for (let i = 1; i < route.pathCoords.length; i++) {
        const [lat1, lon1] = route.pathCoords[i - 1];
        const [lat2, lon2] = route.pathCoords[i];
        distances.push(distances[i - 1] + Math.sqrt((lat2 - lat1) ** 2 + (lon2 - lon1) ** 2));
      }
      const totalDist = distances[distances.length - 1];
      const targetDist = animationProgress * totalDist;
      for (let i = 0; i < route.pathCoords.length; i++) {
        if (distances[i] <= targetDist) {
          trailCoords.push(route.pathCoords[i]);
        } else {
          break;
        }
      }
      trailCoords.push(pos);
      entry.trail.setLatLngs(trailCoords);
    }
  }, [animationRoutes, animationProgress, createTeamIcon, interpolateAlongPath]);

  // Animation loop: smoothly advance progress when playing
  useEffect(() => {
    if (!animationPlaying || animationRoutes.length === 0) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    let lastTime: number | null = null;
    const TOTAL_DURATION_MS = 15000; // base duration for one full cycle

    const tick = (now: number) => {
      if (lastTime !== null) {
        const dt = now - lastTime;
        const increment = (dt / TOTAL_DURATION_MS) * animationSpeed;
        const newProgress = animationProgress + increment;
        if (newProgress >= 1) {
          onAnimationProgress(0); // Loop
        } else {
          onAnimationProgress(newProgress);
        }
      }
      lastTime = now;
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
    };
  }, [animationPlaying, animationSpeed, animationRoutes.length, animationProgress, onAnimationProgress]);

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
        {animationRoutes.length > 0 && (
          <>
            <div className="legend-divider" />
            <div className="legend-item">
              <span className="dot dot-animated" style={{ background: "#22c55e" }} /> Team In Motion (Sim)
            </div>
            <div className="legend-item">
              <span className="dot dot-animated" style={{ background: "#a855f7" }} /> Team In Motion (Alloc)
            </div>
          </>
        )}
      </div>
    </div>
  );
}
