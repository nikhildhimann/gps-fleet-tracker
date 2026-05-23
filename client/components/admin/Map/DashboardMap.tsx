"use client";

import { DivIcon } from "leaflet";
import { MapContainer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import MapTileLayer from "./MapTileLayer";

type Props = {
  center?: [number, number];
  zoom?: number;
};

const markerIcon = new DivIcon({
  className: "dashboard-map-marker",
  html: `<div style="width:16px;height:16px;background:#22c55e;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 0 2px rgba(15,23,42,.18)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function DashboardMap({ center, zoom = 12 }: Props) {
  const markerPosition = center
    ? { lat: center[1], lng: center[0] }
    : { lat: 28.6139, lng: 77.209 };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50">
      <MapContainer center={markerPosition} zoom={zoom} className="h-full w-full" attributionControl={false}>
        <MapTileLayer satellite={false} />
        <Marker position={markerPosition} icon={markerIcon}>
          <Popup>
            <div className="text-sm font-semibold text-slate-900">
              <p className="font-black text-slate-900">KA-01-AB-1234</p>
              <p className="text-xs text-slate-600">Location marker</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}
