"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, Polyline, Marker, Popup, CircleMarker, useMap } from "react-leaflet";
import { DivIcon, latLngBounds } from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import MapTileLayer from "./MapTileLayer";

type Point = {
  lat: number;
  lng: number;
  timestamp?: string;
  speed?: number;
  ignition?: boolean;
  alertType?: string;
};

function FitBounds({ points }: { points: Point[] }) {
  const map = useMap();
  useEffect(() => {
    if (!points.length) return;
    const bounds = latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [map, points]);
  return null;
}

const makeIcon = (color: string) =>
  new DivIcon({
    className: "route-marker",
    html: `<div style="background:${color};width:16px;height:16px;border-radius:9999px;border:2px solid #0f172a;box-shadow:0 0 8px ${color}99;"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });

export default function RoutePath({
  points,
  height = 320,
  showStops = false,
}: {
  points: Point[];
  height?: number;
  showStops?: boolean;
}) {
  const path = useMemo(() => points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)), [points]);
  const start = path[0];
  const end = path[path.length - 1];

  // stop markers when >=3 consecutive zero speed
  const stops = useMemo(() => {
    if (!showStops || path.length < 3) return [];
    const result: Point[] = [];
    let streak: Point[] = [];
    path.forEach((p) => {
      if ((p.speed || 0) <= 0.1) {
        streak.push(p);
      } else {
        if (streak.length >= 3) result.push(streak[Math.floor(streak.length / 2)]);
        streak = [];
      }
    });
    if (streak.length >= 3) result.push(streak[Math.floor(streak.length / 2)]);
    return result;
  }, [path, showStops]);

  if (!path.length) {
    return (
      <div
        className="flex h-full w-full items-center justify-center rounded-2xl border border-white/10 bg-slate-900/60 text-slate-400"
        style={{ height }}
      >
        No route data
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl border border-white/10 bg-slate-900/70 shadow-lg shadow-black/25 overflow-hidden" style={{ height }}>
      <MapContainer center={[path[0].lat, path[0].lng]} zoom={13} style={{ height: "100%", width: "100%" }} attributionControl={false}>
        <MapTileLayer satellite={false} />
        <FitBounds points={path} />
        <Polyline positions={path.map((p) => [p.lat, p.lng])} color="#22d3ee" weight={4} opacity={0.8} />

        {path.map((p, idx) =>
          idx % 5 === 0 ? (
            <CircleMarker key={`${p.lat}-${p.lng}-${idx}`} center={[p.lat, p.lng]} radius={3} pathOptions={{ color: "#a5f3fc", weight: 1, fillOpacity: 0.7 }} />
          ) : null,
        )}

        {start && (
          <Marker position={[start.lat, start.lng]} icon={makeIcon("#34d399")}>
            <Popup>
              <div className="text-xs">
                <div>Start</div>
                {start.timestamp && <div>{new Date(start.timestamp).toLocaleString()}</div>}
              </div>
            </Popup>
          </Marker>
        )}
        {end && (
          <Marker position={[end.lat, end.lng]} icon={makeIcon("#f87171")}>
            <Popup>
              <div className="text-xs">
                <div>End</div>
                {end.timestamp && <div>{new Date(end.timestamp).toLocaleString()}</div>}
              </div>
            </Popup>
          </Marker>
        )}

        {stops.map((p, idx) => (
          <Marker key={`stop-${idx}`} position={[p.lat, p.lng]} icon={makeIcon("#facc15")}>
            <Popup>
              <div className="text-xs">
                <div>Stop detected</div>
                {p.timestamp && <div>{new Date(p.timestamp).toLocaleString()}</div>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
