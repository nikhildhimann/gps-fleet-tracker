"use client";

import { useMemo } from "react";
import { DivIcon, LatLngExpression, latLngBounds } from "leaflet";
import { MapContainer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css";
import "leaflet-defaulticon-compatibility";
import MapTileLayer from "./MapTileLayer";

type MapPoint = {
  id: string;
  name: string;
  position: { lat: number; lng: number };
};

type VehiclePoint = {
  id: string;
  label?: string;
  status: "running" | "idle" | "stopped";
  position: { lat: number; lng: number };
  driverName?: string;
  speed?: number;
  lastUpdated?: string;
  location?: string;
};

type OrganizationMapProps = {
  organizations: MapPoint[];
  secondaryOrganizations?: MapPoint[];
  vehicles: VehiclePoint[];
  selectedOrgId?: string | null;
  selectedVehicleId?: string | null;
  onOrgSelect?: (orgId: string) => void;
  onVehicleSelect?: (vehicleId: string) => void;
};

function FitBounds({
  points,
}: {
  points: Array<{ lat: number; lng: number }>;
}) {
  const map = useMap();
  const valid = points.filter(
    (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng),
  );

  if (valid.length) {
    const bounds = latLngBounds(valid.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [70, 70] });
  }

  return null;
}

const statusColor = (status: VehiclePoint["status"]) => {
  if (status === "running") return "#34d399";
  if (status === "idle") return "#fbbf24";
  return "#ef4444";
};

const markerIcon = (color: string, size = 14) =>
  new DivIcon({
    className: "org-map-marker",
    html: `<div style="width:${size}px;height:${size}px;background:${color};border:2px solid #fff;border-radius:9999px;box-shadow:0 0 0 2px rgba(15,23,42,.18)"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });

export default function OrganizationMap({
  organizations,
  secondaryOrganizations = [],
  vehicles,
  selectedOrgId,
  selectedVehicleId,
  onOrgSelect,
  onVehicleSelect,
}: OrganizationMapProps) {
  const visibleOrgPoints = useMemo(() => {
    if (selectedOrgId) {
      return organizations.filter((org) => org.id === selectedOrgId);
    }
    return organizations;
  }, [organizations, selectedOrgId]);

  const extraOrgPoints = useMemo(
    () => secondaryOrganizations.filter((org) => org.id !== selectedOrgId),
    [secondaryOrganizations, selectedOrgId],
  );

  const visibleVehicles = useMemo(() => {
    if (!selectedOrgId) return [];
    const scoped = vehicles.filter((vehicle) =>
      vehicle.id.startsWith(`${selectedOrgId}:`),
    );
    if (selectedVehicleId) {
      return scoped.filter((vehicle) => vehicle.id === selectedVehicleId);
    }
    return scoped;
  }, [vehicles, selectedOrgId, selectedVehicleId]);

  const activeOrg = selectedOrgId
    ? organizations.find((org) => org.id === selectedOrgId)
    : null;
  const selectedVehicle = selectedVehicleId
    ? visibleVehicles.find((vehicle) => vehicle.id === selectedVehicleId)
    : null;

  const pointsForBounds = selectedOrgId
    ? [
        ...(activeOrg ? [activeOrg.position] : []),
        ...extraOrgPoints.map((p) => p.position),
        ...visibleVehicles.map((v) => v.position),
      ]
    : visibleOrgPoints.map((p) => p.position);

  const center = (visibleOrgPoints[0]?.position || {
    lat: 28.6139,
    lng: 77.209,
  }) as LatLngExpression;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl bg-slate-50">
      <MapContainer center={center} zoom={6} className="h-full w-full" attributionControl={false}>
        <MapTileLayer satellite={false} />
        <FitBounds points={pointsForBounds} />

        {activeOrg && (
          <Marker
            position={activeOrg.position}
            icon={markerIcon("#38bdf8", 16)}
            eventHandlers={{ click: () => onOrgSelect?.(activeOrg.id) }}
          >
            <Popup>
              <p className="font-semibold">{activeOrg.name}</p>
            </Popup>
          </Marker>
        )}

        {extraOrgPoints.map((org) => (
          <Marker
            key={org.id}
            position={org.position}
            icon={markerIcon("#22d3ee")}
            eventHandlers={{ click: () => onOrgSelect?.(org.id) }}
          >
            <Popup>
              <p className="font-semibold">{org.name}</p>
            </Popup>
          </Marker>
        ))}

        {selectedOrgId
          ? visibleVehicles.map((vehicle) => (
              <Marker
                key={vehicle.id}
                position={vehicle.position}
                icon={markerIcon(
                  statusColor(vehicle.status),
                  selectedVehicleId ? 16 : 13,
                )}
                eventHandlers={{ click: () => onVehicleSelect?.(vehicle.id) }}
              >
                <Popup>
                  <p className="font-semibold">{vehicle.label || "Vehicle"}</p>
                  <p className="text-xs text-slate-600">
                    Driver: {vehicle.driverName || "Unassigned"}
                  </p>
                </Popup>
              </Marker>
            ))
          : visibleOrgPoints.map((org) => (
              <Marker
                key={org.id}
                position={org.position}
                icon={markerIcon("#38bdf8")}
                eventHandlers={{ click: () => onOrgSelect?.(org.id) }}
              >
                <Popup>
                  <p className="font-semibold">{org.name}</p>
                </Popup>
              </Marker>
            ))}

        {selectedVehicle && (
          <Marker
            position={selectedVehicle.position}
            icon={markerIcon(statusColor(selectedVehicle.status), 17)}
          >
            <Popup>
              <p className="font-semibold">
                {selectedVehicle.label || "Vehicle"}
              </p>
              <p className="text-xs text-slate-600">
                Speed: {selectedVehicle.speed ?? 0} km/h
              </p>
              <p className="text-xs text-slate-600">
                Last: {selectedVehicle.lastUpdated || "Just now"}
              </p>
              <p className="text-xs text-slate-600">
                Location: {selectedVehicle.location || "Unknown"}
              </p>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
}
