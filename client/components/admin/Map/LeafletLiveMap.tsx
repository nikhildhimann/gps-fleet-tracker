"use client";

import { useEffect, useRef, useState } from "react";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { RUNNING_SPEED_THRESHOLD } from "@/lib/vehicleStatusUtils";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import MapTileLayer from "./MapTileLayer";

type LiveVehicle = {
  id: string;
  vehicleNumber: string;
  lat: number;
  lng: number;
  speed: number;
  heading?: number;
  lastUpdated: string;
  status?: string;
};

// Component to handle map bounds and auto-panning
function MapController({ vehicles }: { vehicles: LiveVehicle[] }) {
  const map = useMap();
  const firstLoad = useRef(true);

  useEffect(() => {
    if (vehicles.length === 0) return;

    const validVehicles = vehicles.filter(
      (v) => Number.isFinite(v.lat) && Number.isFinite(v.lng),
    );
    if (validVehicles.length === 0) return;

    if (firstLoad.current) {
      const bounds = L.latLngBounds(validVehicles.map((v) => [v.lat, v.lng]));
      map.fitBounds(bounds, { padding: [100, 100] });
      firstLoad.current = false;
    }
  }, [vehicles, map]);

  return null;
}

// Custom Marker with smooth position interpolation (60fps glide)
function SmoothMarker({
  vehicle,
  isActive,
  getIcon,
  onClick,
}: {
  vehicle: LiveVehicle;
  isActive: boolean;
  getIcon: (v: LiveVehicle, active: boolean) => L.DivIcon;
  onClick: () => void;
}) {
  const [renderPos, setRenderPos] = useState<[number, number]>([
    vehicle.lat,
    vehicle.lng,
  ]);
  const animRef = useRef<number | undefined>(undefined);
  const startTime = useRef<number>(0);
  const startPos = useRef<[number, number]>([vehicle.lat, vehicle.lng]);
  const targetPos = useRef<[number, number]>([vehicle.lat, vehicle.lng]);

  useEffect(() => {
    // When target position updates, reset animation
    startPos.current = renderPos;
    targetPos.current = [vehicle.lat, vehicle.lng];
    startTime.current = performance.now();

    const glide = (time: number) => {
      const elapsed = time - startTime.current;
      const progress = Math.min(elapsed / 1000, 1); // Glide over 1 second

      const lat =
        startPos.current[0] +
        (targetPos.current[0] - startPos.current[0]) * progress;
      const lng =
        startPos.current[1] +
        (targetPos.current[1] - startPos.current[1]) * progress;

      setRenderPos([lat, lng]);

      if (progress < 1) {
        animRef.current = requestAnimationFrame(glide);
      }
    };

    animRef.current = requestAnimationFrame(glide);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicle.lat, vehicle.lng]);

  return (
    <Marker
      position={renderPos}
      icon={getIcon(vehicle, isActive)}
      eventHandlers={{ click: onClick }}
    >
      <Popup position={renderPos}>
        <div className="p-1 min-w-[150px]">
          <p className="font-bold text-slate-800 text-sm mb-1">
            {vehicle.vehicleNumber}
          </p>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`h-2 w-2 rounded-full ${vehicle.speed >= RUNNING_SPEED_THRESHOLD ? "bg-emerald-500" : "bg-amber-500"}`}
            ></span>
            <span className="text-xs text-slate-600 font-medium">
              {vehicle.speed >= RUNNING_SPEED_THRESHOLD
                ? `Running - ${vehicle.speed} km/h`
                : "Stopped"}
            </span>
          </div>
          <p className="text-[10px] text-slate-400">
            Updated: {new Date(vehicle.lastUpdated).toLocaleTimeString()}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

export default function LeafletLiveMap({
  vehicles = [],
}: {
  vehicles?: LiveVehicle[];
}) {
  const [activeVehicleId, setActiveVehicleId] = useState<string | null>(null);

  // Custom marker function
  const getMarkerIcon = (vehicle: LiveVehicle, isActive: boolean) => {
    const { speed, heading = 0 } = vehicle;
    const color = speed >= RUNNING_SPEED_THRESHOLD ? "#10b981" : "#f59e0b"; // emerald-500 : amber-500
    const size = isActive ? 24 : 18;

    return L.divIcon({
      className: "custom-marker-container",
      html: `
        <div class="marker-wrapper" style="
          width: ${size}px;
          height: ${size}px;
          transform: rotate(${heading}deg);
          transition: transform 0.8s linear;
          position: relative;
        ">
          <!-- Direction Arrow -->
          <div style="
            position: absolute;
            top: -8px;
            left: 50%;
            transform: translateX(-50%);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 10px solid ${color};
            display: ${speed >= RUNNING_SPEED_THRESHOLD ? "block" : "none"};
          "></div>
          
          <!-- Main Circle -->
          <div style="
            width: 100%;
            height: 100%;
            background-color: ${color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 15px rgba(0,0,0,0.4);
            ${speed >= RUNNING_SPEED_THRESHOLD ? "animation: pulse 2s infinite;" : ""}
          "></div>
        </div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  return (
    <div className="relative h-full w-full rounded-xl overflow-hidden shadow-inner bg-slate-100 border-4 border-white shadow-xl">
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { box-shadow: 0 0 0 15px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .leaflet-container {
          width: 100%;
          height: 100%;
          background: #f1f5f9;
        }
        .marker-wrapper {
          will-change: transform;
        }
      `}</style>

      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        scrollWheelZoom={true}
        className="h-full w-full"
        attributionControl={false}
      >
        <MapTileLayer satellite={false} />

        <MapController vehicles={vehicles} />

        {vehicles.map((vehicle) => (
          <SmoothMarker
            key={vehicle.id}
            vehicle={vehicle}
            isActive={activeVehicleId === vehicle.id}
            getIcon={getMarkerIcon}
            onClick={() => setActiveVehicleId(vehicle.id)}
          />
        ))}
      </MapContainer>

      {/* Map Legend */}
      <div className="absolute bottom-6 right-6 z-[1000] flex flex-col gap-2 rounded-xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-emerald-500 border border-white"></div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Moving
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-amber-500 border border-white"></div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Stopped
          </span>
        </div>
      </div>
    </div>
  );
}
