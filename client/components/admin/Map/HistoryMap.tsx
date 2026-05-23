"use client";

import { DivIcon, latLngBounds } from "leaflet";
import { MapContainer, Marker, Polyline, useMap } from "react-leaflet";
import { Fragment, useMemo } from "react";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import MapTileLayer from "./MapTileLayer";

type RoutePoint = {
  lat: number;
  lng: number;
  timestamp: string;
  speed: number;
};

interface HistoryMapProps {
  routes: RoutePoint[][];
  selectedRouteIndex: number;
}

function FitPathBounds({
  points,
}: {
  points: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();
  if (points.length) {
    map.fitBounds(latLngBounds(points.map((p) => [p.lat, p.lng])), {
      padding: [70, 70],
    });
  }
  return null;
}

const startIcon = new DivIcon({
  className: "history-start",
  html: `<div style="width:16px;height:16px;background:#22c55e;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 0 2px rgba(15,23,42,.18)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const endIcon = new DivIcon({
  className: "history-end",
  html: `<div style="width:16px;height:16px;background:#0ea5e9;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 0 2px rgba(15,23,42,.18)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function HistoryMap({ routes, selectedRouteIndex }: HistoryMapProps) {
  const pathPoints = useMemo(() => {
    const selected = routes[selectedRouteIndex] || [];
    return selected.filter(
      (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng),
    );
  }, [routes, selectedRouteIndex]);

  const center = pathPoints[0] || { lat: 20.5937, lng: 78.9629 };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-50">
      <MapContainer center={center} zoom={12} className="h-full w-full" attributionControl={false}>
        <MapTileLayer satellite={false} />
        <FitPathBounds points={pathPoints} />
        {routes.map((route, idx) => {
          if (!route?.length) return null;

          const isSelected = idx === selectedRouteIndex;
          const startPoint = route[0];
          const endPoint = route[route.length - 1];

          return (
            <Fragment key={`route-${idx}`}>
              <Polyline
                positions={route.map((p) => [p.lat, p.lng])}
                pathOptions={{
                  color: isSelected ? "#0ea5e9" : "#94a3b8",
                  opacity: isSelected ? 0.95 : 0.5,
                  weight: isSelected ? 4 : 2,
                }}
              />
              {isSelected ? (
                <>
                  <Marker position={startPoint} icon={startIcon} />
                  <Marker position={endPoint} icon={endIcon} />
                </>
              ) : null}
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
