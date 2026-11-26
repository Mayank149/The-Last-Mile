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
  travelTimeSec: number;
}

interface RouteGeometry {
  pathCoords: [number, number][];
  cumDistances: number[];
  totalDist: number;
}

interface AnimatedRouteEntry {
  geom: RouteGeometry;
  travelTimeSec: number;
  marker: L.Marker | null;
  trail: L.Polyline | null;
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
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const animMarkersRef = useRef<Map<string, AnimatedRouteEntry>>(new Map());
  const animLayerRef = useRef<L.LayerGroup | null>(null);
  const progressRef = useRef<number>(0);
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

  // Render static markers for teams not currently animating
  useEffect(() => {
    const groups = layerGroupsRef.current;
    if (!groups) return;
    groups.teams.clearLayers();
    if (!layers.teams) return;

    const animatingTeamIds = new Set(animationRoutes.map((r) => r.teamId));

    for (const team of teams) {
      if (animatingTeamIds.has(team.id)) continue;
      L.circleMarker([team.coordinates.lat, team.coordinates.lon], {
        radius: 7,
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
  }, [teams, layers.teams, animationRoutes]);

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
  const buildRouteGeometry = useCallback((pathCoords: [number, number][]): RouteGeometry => {
    const cumDistances: number[] = [0];
    for (let i = 1; i < pathCoords.length; i++) {
      const [lat1, lon1] = pathCoords[i - 1];
      const [lat2, lon2] = pathCoords[i];
      const d = Math.hypot(lat2 - lat1, lon2 - lon1);
      cumDistances.push(cumDistances[i - 1] + d);
    }
    return {
      pathCoords,
      cumDistances,
      totalDist: cumDistances[cumDistances.length - 1] || 0,
    };
  }, []);

  const evaluateRouteAtFraction = useCallback(
    (
      geom: RouteGeometry,
      fraction: number
    ): { pos: [number, number]; trailCoords: [number, number][] } => {
      const { pathCoords, cumDistances, totalDist } = geom;
      if (pathCoords.length === 0) return { pos: [0, 0], trailCoords: [] };
      if (pathCoords.length === 1 || fraction <= 0 || totalDist === 0) {
        return { pos: pathCoords[0], trailCoords: [pathCoords[0]] };
      }
      if (fraction >= 1) {
        return {
          pos: pathCoords[pathCoords.length - 1],
          trailCoords: pathCoords,
        };
      }

      const targetDist = fraction * totalDist;
      const trailCoords: [number, number][] = [pathCoords[0]];

      for (let i = 1; i < cumDistances.length; i++) {
        if (cumDistances[i] < targetDist) {
          trailCoords.push(pathCoords[i]);
        } else {
          const segStart = cumDistances[i - 1];
          const segEnd = cumDistances[i];
          const segFraction =
            segEnd > segStart ? (targetDist - segStart) / (segEnd - segStart) : 0;
          const [lat1, lon1] = pathCoords[i - 1];
          const [lat2, lon2] = pathCoords[i];
          const pos: [number, number] = [
            lat1 + (lat2 - lat1) * segFraction,
            lon1 + (lon2 - lon1) * segFraction,
          ];
          trailCoords.push(pos);
          return { pos, trailCoords };
        }
      }

      return {
        pos: pathCoords[pathCoords.length - 1],
        trailCoords: pathCoords,
      };
    },
    []
  );

  // Create the compact team icon for animation markers
  const createTeamIcon = useCallback((color: string, teamLabel: string) => {
    return L.divIcon({
      className: "rescue-team-motion-icon",
      html: `<div class="motion-marker-outer" style="--team-color: ${color}">
        <div class="motion-marker-ping"></div>
        <div class="motion-marker-dot">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        </div>
        <div class="motion-marker-label">${teamLabel}</div>
      </div>`,
      iconSize: [48, 34],
      iconAnchor: [24, 9],
    });
  }, []);

  const applyProgressToMarkers = useCallback(
    (globalProgress: number, maxDurationSec: number) => {
      const elapsedSec = globalProgress * maxDurationSec;
      for (const entry of animMarkersRef.current.values()) {
        const routeDurationSec = Math.max(entry.travelTimeSec || 120, 1);
        const routeFraction = Math.min(Math.max(elapsedSec / routeDurationSec, 0), 1);
        const { pos, trailCoords } = evaluateRouteAtFraction(entry.geom, routeFraction);
        if (entry.marker) {
          entry.marker.setLatLng(pos);
        }
        if (entry.trail) {
          entry.trail.setLatLngs(trailCoords);
        }
      }
    },
    [evaluateRouteAtFraction]
  );

  // Build animation markers and route polylines only when routes or layer toggles change
  useEffect(() => {
    const map = mapRef.current;
    const animLayer = animLayerRef.current;
    if (!map || !animLayer) return;

    animLayer.clearLayers();
    animMarkersRef.current.clear();

    if (animationRoutes.length === 0) return;

    let maxDurationSec = 60;
    for (const route of animationRoutes) {
      if (route.pathCoords.length < 2) continue;
      if (route.travelTimeSec > maxDurationSec) {
        maxDurationSec = route.travelTimeSec;
      }

      const geom = buildRouteGeometry(route.pathCoords);
      const startPos = route.pathCoords[0];
      const shortName = route.teamName.split(" ")[0];

      let trail: L.Polyline | null = null;
      if (layers.routes) {
        // Ghost path showing the full planned route (faded)
        L.polyline(route.pathCoords, {
          color: route.color,
          weight: 2,
          opacity: 0.25,
          dashArray: "6 4",
        }).addTo(animLayer);

        // Trail polyline showing the path already traversed
        trail = L.polyline([startPos], {
          color: route.color,
          weight: 4,
          opacity: 0.9,
        }).addTo(animLayer);
      }

      let marker: L.Marker | null = null;
      if (layers.teams) {
        const icon = createTeamIcon(route.color, shortName);
        marker = L.marker([startPos[0], startPos[1]], {
          icon,
          zIndexOffset: 1000,
          interactive: true,
        })
          .bindPopup(
            `<strong>${route.teamName}</strong><br/>` +
              `En route → <strong>${route.incidentLabel || route.incidentId.toUpperCase()}</strong><br/>` +
              `<small>Modelled ETA: ${Math.round(route.travelTimeSec)}s · ${
                route.type === "allocation" ? "Allocated Route" : "Simulated Route"
              }</small>`
          )
          .addTo(animLayer);
      }

      animMarkersRef.current.set(`${route.teamId}-${route.incidentId}-${route.type}`, {
        geom,
        travelTimeSec: route.travelTimeSec || 120,
        marker,
        trail,
      });
    }

    applyProgressToMarkers(progressRef.current, maxDurationSec);
  }, [
    animationRoutes,
    layers.teams,
    layers.routes,
    buildRouteGeometry,
    createTeamIcon,
    applyProgressToMarkers,
  ]);

  // Animation loop: smoothly advance in 1:1 real-time pace based on modelled travelTimeSec
  useEffect(() => {
    if (animationRoutes.length === 0) {
      progressRef.current = 0;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      return;
    }

    progressRef.current = 0;
    const maxDurationSec = animationRoutes.reduce(
      (max, r) => Math.max(max, r.travelTimeSec || 120),
      60
    );
    const totalDurationMs = maxDurationSec * 1000;
    applyProgressToMarkers(0, maxDurationSec);

    let lastTime: number | null = null;

    const tick = (now: number) => {
      if (lastTime !== null) {
        const dt = now - lastTime;
        const increment = dt / totalDurationMs;
        let next = progressRef.current + increment;
        if (next >= 1) {
          next = 0;
        }
        progressRef.current = next;
        applyProgressToMarkers(next, maxDurationSec);
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
  }, [animationRoutes, applyProgressToMarkers]);

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
