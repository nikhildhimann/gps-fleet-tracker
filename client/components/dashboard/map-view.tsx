"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DivIcon, latLng } from "leaflet";
import { MapContainer, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import { Fuel, Gauge, Navigation, Thermometer } from "lucide-react";
import { TelemetryGrid } from "./telemetry-grid";
import { useDashboardContext } from "./DashboardContext";
import { useGetLiveVehicleByDeviceIdQuery } from "@/redux/api/gpsLiveApi";
import { MapTileLayer } from "../admin/Map/MapTileLayer";
import { animatePosition, calculateAnimationDuration } from "@/lib/positionInterpolation";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import type { Vehicle } from "@/lib/vehicles";
import type { VehiclePositions } from "@/lib/use-vehicle-positions";

type LiveVehicleNode = {
  latitude?: number | string
  longitude?: number | string
  status?: string
  currentLocation?: string | Record<string, unknown>
  poi?: string
  poiId?: string | null
  gpsTimestamp?: string
  updatedAt?: string
}

function SmoothFocus({
  point,
  selectedId,
  focusKey,
  isFollowMode = true,
}: {
  point: { lat: number; lng: number } | null;
  selectedId?: string | null;
  focusKey: number;
  isFollowMode?: boolean;
}) {
  const map = useMap();
  const lastIdRef = useRef<string | null>(null);
  const lastKeyRef = useRef<number>(0);
  const manualLockRef = useRef(false);
  const lockTimer = useRef<NodeJS.Timeout | null>(null);

  useMapEvents({
    dragstart() {
      manualLockRef.current = true;
      if (lockTimer.current) clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => {
        manualLockRef.current = false;
      }, 8000);
    },
    zoomstart() {
      manualLockRef.current = true;
      if (lockTimer.current) clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => {
        manualLockRef.current = false;
      }, 8000);
    },
  });

  useEffect(() => {
    if (!point) return;
    const isNewSelection = lastIdRef.current !== (selectedId || null);
    const isForced = focusKey !== lastKeyRef.current;
    const zoom = map.getZoom();
    const targetZoom = isNewSelection || isForced ? Math.max(zoom, 16) : zoom;
    if (!manualLockRef.current || isNewSelection || isForced || isFollowMode) {
      if (isFollowMode) {
        const pointLatLng = latLng(point.lat, point.lng);
        const isNearViewportEdge = !map.getBounds().pad(-0.35).contains(pointLatLng);
        if (isNewSelection || isForced) {
          map.setView(point, targetZoom);
        } else if (isNearViewportEdge) {
          map.panTo(point, {
            animate: true,
            duration: 0.35,
            easeLinearity: 0.25,
            noMoveStart: true,
          });
        }
      } else {
        map.flyTo(point, targetZoom, {
          duration: isNewSelection || isForced ? 0.6 : 0.35,
          easeLinearity: 0.3,
          noMoveStart: true,
        });
      }
      lastIdRef.current = selectedId || null;
      lastKeyRef.current = focusKey;
    }
  }, [map, point, point?.lat, point?.lng, selectedId, focusKey, isFollowMode]);

  return null;
}

const markerIcon = (color: string, size = 15) =>
  new DivIcon({
    className: "dashboard-vehicle-marker",
    html: `<div style="width:${size * 2.2}px;height:${size * 2.2}px;background:white;border:3px solid ${color};border-radius:9999px;display:flex;align-items:center;justify-content:center;box-shadow:0 10px 24px rgba(0,0,0,0.18);"><div style="width:${size}px;height:${size}px;background:${color};border-radius:9999px;"></div></div>`,
    iconSize: [size * 2.2, size * 2.2],
    iconAnchor: [size * 1.1, size * 1.1],
  });

const MIN_STABLE_MOVEMENT_METERS = 3;
// Increased from 15 → 200 so backward jumps from stale enrichment
// coords (which can be 30s×speed = 458m at 55km/h) are caught and rejected
const REVERSE_JITTER_MAX_METERS = 200;
const LARGE_JUMP_SNAP_METERS = 2000;


function getDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  return latLng(from.lat, from.lng).distanceTo(latLng(to.lat, to.lng));
}

function getMovementVectorMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const origin = latLng(from.lat, from.lng);
  const eastWestPoint = latLng(from.lat, to.lng);
  const northSouthPoint = latLng(to.lat, from.lng);

  return {
    x:
      origin.distanceTo(eastWestPoint) * (to.lng >= from.lng ? 1 : -1),
    y:
      origin.distanceTo(northSouthPoint) * (to.lat >= from.lat ? 1 : -1),
  };
}



interface MapViewProps {
  selectedVehicleId?: string | null;
  positions?: VehiclePositions;
  vehicles?: Vehicle[];
}

export function MapView({ selectedVehicleId, positions, vehicles }: MapViewProps) {
  const { selectedVehicle, focusKey } = useDashboardContext();
  const [isFollowMode, setIsFollowMode] = useState(true);

  // Smooth position animation state
  const [animatedPos, setAnimatedPos] = useState<{ lat: number; lng: number } | null>(null);
  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const animatedPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const animationCleanupRef = useRef<(() => void) | null>(null);
  const lastTargetRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastTimestampRef = useRef<number>(0);
  const lastMovementVectorRef = useRef<{ x: number; y: number } | null>(null);
  const selectedVehicleRef = useRef<string | null>(null);

  const deviceId = selectedVehicle?.deviceId || selectedVehicle?.gpsDeviceId?._id || selectedVehicle?.gpsDeviceId;

const { data: liveDataRes } = useGetLiveVehicleByDeviceIdQuery(deviceId, {
    skip: !deviceId,
    pollingInterval: 2000,
  });

  const liveNode = liveDataRes?.data as LiveVehicleNode | undefined;

  const currentPos = useMemo(() => {
    if (!liveNode) return null;
    const liveNodeWithAliases = liveNode as LiveVehicleNode & { lat?: number | string; lng?: number | string; lon?: number | string }
    const latRaw = liveNodeWithAliases.lat ?? liveNode.latitude;
    const lngRaw = liveNodeWithAliases.lng ?? liveNode.longitude ?? liveNodeWithAliases.lon;
    const lat = typeof latRaw === "string" ? parseFloat(latRaw) : latRaw;
    const lng = typeof lngRaw === "string" ? parseFloat(lngRaw) : lngRaw;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const timestampRaw = liveNode.gpsTimestamp || liveNode.updatedAt || null;
    const timestampMs = timestampRaw ? new Date(timestampRaw).getTime() : Date.now();
    return {
      lat: lat as number,
      lng: lng as number,
      status: liveNode.status || selectedVehicle?.status || "running",
      timestampMs: Number.isFinite(timestampMs) ? timestampMs : Date.now(),
    };
  }, [liveNode, selectedVehicle]);

  // WHY: liveNode is polled every 5s and contains the freshest poi from backend enrichment.
  // selectedVehicle.poi comes from context which updates via socket + 10s poll — slightly staler.
  // We prefer liveNode.poi when available, fall back to context poi.
  // Empty string "" from backend means "no POI found" — show "-" not "N/A".
  const livePoi = liveNode?.poi !== undefined
    ? (liveNode.poi || "-")
    : (selectedVehicle?.poi || "-")

  useEffect(() => {
    const selectedId = selectedVehicle?.id || null;
    if (selectedVehicleRef.current === selectedId) return;

    selectedVehicleRef.current = selectedId;
    lastTimestampRef.current = 0;
    lastTargetRef.current = null;
    lastMovementVectorRef.current = null;

    if (animationCleanupRef.current) {
      animationCleanupRef.current();
      animationCleanupRef.current = null;
    }

      if (currentPos) {
      const resetPos = { lat: currentPos.lat, lng: currentPos.lng };
      setAnimatedPos(resetPos);
      animatedPosRef.current = resetPos;
      prevPosRef.current = resetPos;
      lastTargetRef.current = resetPos;
      lastTimestampRef.current = currentPos.timestampMs;
    }
  }, [selectedVehicle?.id, currentPos]);

  // Trigger smooth animation when position updates
  useEffect(() => {
    if (!currentPos) return;

    // Ensure lat and lng are valid numbers
    if (!Number.isFinite(currentPos.lat) || !Number.isFinite(currentPos.lng)) return;

    if (
      lastTimestampRef.current &&
      currentPos.timestampMs <= lastTimestampRef.current
    ) {
      return;
    }

    // Guard: if position jumped backward AND timestamp didn't advance significantly
    // (< 3s), this is a stale enrichment coordinate leaking through — reject it.
    const timestampAdvanceMs = currentPos.timestampMs - lastTimestampRef.current;
    if (
      lastTargetRef.current &&
      timestampAdvanceMs < 3000 &&
      timestampAdvanceMs > 0
    ) {
      const backwardDist = getDistanceMeters(lastTargetRef.current, currentPos);
      const backwardVector = getMovementVectorMeters(lastTargetRef.current, currentPos);
      const dotProduct = lastMovementVectorRef.current
        ? lastMovementVectorRef.current.x * backwardVector.x +
          lastMovementVectorRef.current.y * backwardVector.y
        : null;
      // Reject if: moving in opposite direction AND timestamp barely advanced
      if (dotProduct !== null && dotProduct < 0 && backwardDist > MIN_STABLE_MOVEMENT_METERS) {
        return;
      }
    }

    // Initialize animated position on first load
    if (animatedPosRef.current === null) {
      const initialPos = { lat: currentPos.lat, lng: currentPos.lng };
      setAnimatedPos(initialPos);
      animatedPosRef.current = initialPos;
      prevPosRef.current = initialPos;
      lastTargetRef.current = initialPos;
      lastTimestampRef.current = currentPos.timestampMs;
      return;
    }

    if (
      lastTargetRef.current &&
      getDistanceMeters(lastTargetRef.current, currentPos) < 1
    ) {
      lastTimestampRef.current = currentPos.timestampMs;
      return;
    }

    const fromPos = prevPosRef.current || {
      lat: currentPos.lat,
      lng: currentPos.lng,
    };
    const targetPos = { lat: currentPos.lat, lng: currentPos.lng };
    const distanceDeltaMeters = getDistanceMeters(fromPos, targetPos);

    if (distanceDeltaMeters < MIN_STABLE_MOVEMENT_METERS) {
      return;
    }

    const nextMovementVector = getMovementVectorMeters(fromPos, targetPos);
    const previousMovementVector = lastMovementVectorRef.current;
    const movementDotProduct = previousMovementVector
      ? previousMovementVector.x * nextMovementVector.x +
        previousMovementVector.y * nextMovementVector.y
      : null;

    if (
      previousMovementVector &&
      distanceDeltaMeters < REVERSE_JITTER_MAX_METERS &&
      movementDotProduct !== null &&
      movementDotProduct < 0
    ) {
      return;
    }

    // Cancel any ongoing animation
    if (animationCleanupRef.current) {
      if (animatedPosRef.current) {
        prevPosRef.current = animatedPosRef.current;
      }
      animationCleanupRef.current();
      animationCleanupRef.current = null;
    }

    // Large jumps are usually stale/resync points; snap instead of animating a backward-looking leap.
    if (distanceDeltaMeters > LARGE_JUMP_SNAP_METERS) {
      setAnimatedPos(targetPos);
      animatedPosRef.current = targetPos;
      prevPosRef.current = targetPos;
      lastMovementVectorRef.current = nextMovementVector;
      lastTargetRef.current = targetPos;
      lastTimestampRef.current = currentPos.timestampMs;
      return;
    }

    // Calculate smooth animation duration
    const duration = calculateAnimationDuration(fromPos, targetPos, 250);
    lastTargetRef.current = targetPos;
    lastTimestampRef.current = currentPos.timestampMs;

    // Start smooth interpolation animation
    animationCleanupRef.current = animatePosition(
      fromPos,
      targetPos,
      duration,
      undefined,
      undefined,
      (animPos) => {
        const nextPos = { lat: animPos.lat, lng: animPos.lng };
        animatedPosRef.current = nextPos;
        setAnimatedPos(nextPos);
      },
      () => {
        // Animation complete, snap to final position
        animatedPosRef.current = targetPos;
        setAnimatedPos(targetPos);
        prevPosRef.current = targetPos;
        lastMovementVectorRef.current = nextMovementVector;
        animationCleanupRef.current = null;
      }
    );

    return () => {
      if (animationCleanupRef.current) {
        animationCleanupRef.current();
        animationCleanupRef.current = null;
      }
    };
  }, [currentPos]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationCleanupRef.current) {
        animationCleanupRef.current();
      }
    };
  }, []);

  const statusColor = (status: string) => {
    if (status === "running") return "#38a63c";
    if (status === "idle") return "#f3a338";
    if (status === "inactive") return "#4da2e9";
    if (status === "nodata") return "#8b94a3";
    return "#ef5b4d";
  };

  if (!selectedVehicle) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#f6fbf4] text-slate-500">
        <div className="rounded-2xl border border-dashed border-[#d6e3d0] bg-white px-6 py-8 text-center shadow-sm">
          <Navigation className="mx-auto mb-3 h-6 w-6 text-[#38a63c]" />
          <p className="text-sm font-semibold">Select a vehicle to view live tracking</p>
        </div>
      </div>
    );
  }

  const fallbackRoutePoint = selectedVehicle?.route?.[selectedVehicle?.route.length - 1] || selectedVehicle?.route?.[0] || null;
  // Use animated position if available, fall back to current position, then fallback route
  const displayPoint = animatedPos || currentPos || fallbackRoutePoint;
  const center = displayPoint || { lat: 20.5937, lng: 78.9629 };
  const markerStatus = currentPos?.status || selectedVehicle?.status || "running";

  return (
    <div className="relative h-full w-full bg-[#f6fbf4]">
      <MapContainer center={center as any} zoom={13} className="h-full w-full" style={{ zIndex: 1 }}>
        <MapTileLayer />
        <SmoothFocus
          point={displayPoint as any}
          selectedId={(selectedVehicle as any)?.id || (selectedVehicle as any)?._id || null}
          focusKey={focusKey}
          isFollowMode={isFollowMode}
        />

        {displayPoint && (
          <Marker
            position={displayPoint as any}
            icon={markerIcon(statusColor(markerStatus), 16)}
          >
            <Popup>
              <div className="min-w-[320px]">
                <div className="mb-3 rounded-2xl border border-[#dbe7d4] bg-[#f8fcf7] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Selected Vehicle</p>
                      <h4 className="mt-1 text-lg font-black text-slate-900">{selectedVehicle.vehicleNumber || "N/A"}</h4>
                      <p className="mt-1 text-sm font-medium text-slate-500">{selectedVehicle.driver || "Unassigned"}</p>
                    </div>
                    <span className="rounded-full bg-[#ecf8ea] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#2f8d35]">
                      {selectedVehicle.status || "N/A"}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-white p-3">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Speed
                        <Gauge className="h-3.5 w-3.5 text-[#38a63c]" />
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-800">{selectedVehicle.speed || 0} km/h</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Fuel
                        <Fuel className="h-3.5 w-3.5 text-[#38a63c]" />
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-800">{selectedVehicle.fuel != null ? `${selectedVehicle.fuel}%` : "N/A"}</p>
                    </div>
                    <div className="rounded-xl bg-white p-3">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Temp
                        <Thermometer className="h-3.5 w-3.5 text-[#38a63c]" />
                      </div>
                      <p className="mt-2 text-sm font-bold text-slate-800">{selectedVehicle.temperature || "N/A"}</p>
                    </div>
                  </div>
                </div>
                <TelemetryGrid vehicle={selectedVehicle} compact />
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>

      <div className="absolute left-4 top-4 rounded-2xl border border-[#d6e3d0] bg-white/95 px-4 py-3 text-[11px] text-slate-700 shadow-sm backdrop-blur">
        <div className="font-black uppercase tracking-[0.18em] text-[#2f8d35]">Vehicle Status</div>
        <div className="mt-3 space-y-2">
          {[
            ["Running", "#38a63c"],
            ["Idle", "#f3a338"],
            ["Stopped", "#ef5b4d"],
            ["Inactive", "#4da2e9"],
            ["No Data", "#8b94a3"],
          ].map(([label, color]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="font-semibold">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedVehicle && (
        <div className="absolute bottom-4 left-4 right-4 rounded-[22px] border border-[#d6e3d0] bg-white/95 p-4 shadow-sm backdrop-blur md:max-w-md">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Selected Vehicle</p>
              <h3 className="mt-1 text-lg font-black text-slate-900">{selectedVehicle.vehicleNumber || "N/A"}</h3>
              <p className="mt-1 text-sm font-medium text-slate-500">{selectedVehicle.driver || "Unassigned"}</p>
            </div>
            <button
              onClick={() => setIsFollowMode(!isFollowMode)}
              className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] transition-all flex items-center gap-1.5 shadow-sm border ${isFollowMode
                ? "bg-[#ecf8ea] text-[#2f8d35] border-[#38a63c]/30"
                : "bg-white text-slate-400 border-slate-200"
                }`}
            >
              <Navigation size={10} className={isFollowMode ? "fill-[#2f8d35]" : ""} />
              {isFollowMode ? "Following" : "Follow"}
            </button>
            <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${selectedVehicle.status === "running"
              ? "bg-[#ecf8ea] text-[#2f8d35]"
              : selectedVehicle.status === "idle"
                ? "bg-amber-50 text-amber-700"
                : selectedVehicle.status === "inactive"
                  ? "bg-blue-50 text-blue-700"
                  : selectedVehicle.status === "nodata"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-red-50 text-red-700"
              }`}>
              {selectedVehicle.status || "N/A"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-[#f8fcf7] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Speed</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{selectedVehicle.speed || 0} km/h</p>
            </div>
            <div className="rounded-2xl bg-[#f8fcf7] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Location</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900">{selectedVehicle.location || "N/A"}</p>
            </div>
            <div className="rounded-2xl bg-[#f8fcf7] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Fuel</p>
              <p className="mt-1 text-sm font-bold text-slate-900">{selectedVehicle.fuel != null ? `${selectedVehicle.fuel}%` : "N/A"}</p>
            </div>
            <div className="rounded-2xl bg-[#f8fcf7] p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">POI</p>
              <p className="mt-1 truncate text-sm font-bold text-slate-900">{livePoi}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
