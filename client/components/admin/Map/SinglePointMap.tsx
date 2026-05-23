"use client";

import { DivIcon, LatLngExpression } from "leaflet";
import { MapContainer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import MapTileLayer from "./MapTileLayer";

type SinglePointMapProps = {
  position: { lat: number; lng: number };
  label?: string;
};

const markerIcon = new DivIcon({
  className: "single-point-marker",
  html: `<div style="width:16px;height:16px;background:#0ea5e9;border:2px solid #fff;border-radius:9999px;box-shadow:0 0 0 2px rgba(15,23,42,.18)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function SinglePointMap({ position, label }: SinglePointMapProps) {
  const center = position as LatLngExpression;
  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-50">
      <MapContainer center={center} zoom={12} className="h-full w-full" attributionControl={false}>
        <MapTileLayer satellite={false} />
        <Marker position={position} icon={markerIcon}>
          {label ? (
            <Popup>
              <p className="font-semibold">{label}</p>
            </Popup>
          ) : null}
        </Marker>
      </MapContainer>
    </div>
  );
}
