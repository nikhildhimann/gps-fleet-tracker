"use client";

import { useMemo, useEffect } from "react";

import { DivIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, useMap, Popup } from "react-leaflet";
import { MapTileLayer } from "../admin/Map/MapTileLayer";
import { TelemetryGrid } from "./telemetry-grid";
import { useDashboardContext } from "./DashboardContext";
import { useGetLiveVehicleByDeviceIdQuery } from "@/redux/api/gpsLiveApi";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";


function FitBounds({
  points,
}: {
  points: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length) {
      map.fitBounds(latLngBounds(points.map((p) => [p.lat, p.lng])), {
        padding: [60, 60],
      });
    }
  }, [map, points]);
  return null;
}

const markerIcon = (color: string, size = 14) =>
  new DivIcon({
    className: "dashboard-vehicle-marker",
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid #0f172a;border-radius:9999px;box-shadow: 0 0 10px ${color}80;"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

export function MapView() {
  const { selectedVehicle } = useDashboardContext();
  const deviceId = selectedVehicle?.deviceId || selectedVehicle?.gpsDeviceId?._id || selectedVehicle?.gpsDeviceId;

  const { data: liveDataRes } = useGetLiveVehicleByDeviceIdQuery(deviceId, {
    skip: !deviceId,
    pollingInterval: 5000,
  });

  const liveNode = liveDataRes?.data as {
    latitude?: number
    longitude?: number
    status?: string
    poi?: string
    poiId?: string | null
  } | undefined;

  const currentPos = useMemo(() => {
    if (!liveNode || !Number.isFinite(liveNode.latitude) || !Number.isFinite(liveNode.longitude)) return null;
    return { lat: liveNode.latitude as number, lng: liveNode.longitude as number, status: liveNode.status || selectedVehicle?.status || "running" };
  }, [liveNode, selectedVehicle]);

  // Use freshest poi from 5s poll, fall back to context vehicle poi
  const livePoi = liveNode?.poi !== undefined
    ? (liveNode.poi || "-")
    : (selectedVehicle?.poi || "-");

  const pointsForBounds = useMemo(() => {
    const points: Array<{ lat: number; lng: number }> = [];
    if (currentPos) points.push(currentPos);
    if (selectedVehicle?.route) {
      selectedVehicle.route.forEach((routePoint: any) => points.push(routePoint));
    }
    return points;
  }, [currentPos, selectedVehicle]);
  if (!selectedVehicle) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-400">
        <span>Select vehicle to view tracking</span>
      </div>
    );
  }

  const statusColor = (status: string) => {
    if (status === "running") return "#34d399";
    if (status === "idle") return "#fbbf24";
    if (status === "inactive") return "#22d3ee";
    if (status === "nodata") return "#64748b";
    return "#ef4444";
  };

  const center = currentPos || selectedVehicle?.route?.[0] || { lat: 20.5937, lng: 78.9629 };

  return (
    <div className="relative h-full w-full bg-slate-950">
      <MapContainer center={center} zoom={12} className="h-full w-full">
        <MapTileLayer />
        <FitBounds points={pointsForBounds} />

        {currentPos && (
          <Marker
            position={currentPos}
            icon={markerIcon(statusColor(currentPos.status), 18)}
          >
            <Popup className="dark-leaflet-popup">
              <div className="min-w-[300px] bg-slate-900 p-2">
                <TelemetryGrid vehicle={selectedVehicle} compact />
                <div className="mt-2 border-t border-white/5 pt-2 space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">POI</span>
                    <span className="text-slate-200 font-semibold">{livePoi}</span>
                  </div>
                  <div className="text-[8px] text-slate-500 italic">
                    Last update: {new Date().toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Live dashboard map should show only current points.
            Route polylines are intentionally reserved for history views. */}
      </MapContainer>

      <div className="absolute left-4 top-4 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-[10px] text-slate-200 shadow-lg">
        <div className="font-semibold tracking-wide text-slate-100">Vehicle Status</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Moving</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-400" />
          <span>Idle</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span>Stopped</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-400" />
          <span>Inactive</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-slate-400" />
          <span>No Data</span>
        </div>
      </div>
    </div>
  );
}
