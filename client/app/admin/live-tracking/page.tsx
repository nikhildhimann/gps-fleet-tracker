"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dynamic from "next/dynamic";
import { useGetLiveVehiclesQuery } from "@/redux/api/gpsLiveApi";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { useSocket } from "@/hooks/useSocket";
import AdminLoadingState from "@/components/admin/UI/AdminLoadingState";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";

const LiveMap = dynamic(() => import("@/components/admin/Map/LeafletLiveMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[calc(100vh-120px)] w-full animate-pulse rounded-2xl bg-slate-100" />
  ),
});

interface Vehicle {
  id: string;
  vehicleNumber: string;
  lat: number | null;
  lng: number | null;
  speed: number;
  heading?: number;
  status: string;
  lastUpdated: string;
  organizationId?: string;
}

interface ApiGpsItem {
  _id: string;
  vehicleId?: {
    _id: string;
    vehicleNumber: string;
  };
  imei?: string;
  gpsDeviceId?: string | { _id: string };
  organizationId?: string | { _id: string };
  latitude?: number;
  longitude?: number;
  currentSpeed?: number;
  heading?: number;
  movementStatus?: string;
  updatedAt?: string;
}

// 🔐 ORG CONTEXT UPDATE
import { useOrgContext } from "@/hooks/useOrgContext";

export default function LiveTrackingPage() {
  // 🔐 ORG CONTEXT UPDATE
  const { isSuperAdmin, orgId } = useOrgContext();

  const { data: liveDataRes, isLoading } = useGetLiveVehiclesQuery(undefined, {
    refetchOnMountOrArgChange: true,
    refetchOnFocus: false,
    refetchOnReconnect: true,
    pollingInterval: 10000,
  });

  const [vehiclesMap, setVehiclesMap] = useState<Record<string, Vehicle>>({});
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  // Update current time every minute for "online" calculation
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Handle real-time updates
  const handleGpsUpdate = useCallback(
    (update: {
      vehicleId?: string | { _id?: string };
      imei?: string;
      gpsDeviceId?: string | { _id?: string };
      vehicleNumber?: string;
      organizationId?: string | { _id?: string };
      latitude?: number;
      lat?: number;
      longitude?: number;
      lng?: number;
      speed?: number;
      currentSpeed?: number;
      heading?: number;
      movementStatus?: string;
      status?: string;
      updatedAt?: string;
      lastUpdated?: string;
    }) => {
      const normalizedVehicleId =
        (typeof update.vehicleId === "string"
          ? update.vehicleId
          : update.vehicleId?._id) ||
        (typeof update.gpsDeviceId === "string"
          ? update.gpsDeviceId
          : update.gpsDeviceId?._id) ||
        update.imei;

      if (!normalizedVehicleId) return;

      const orgId =
        typeof update.organizationId === "string"
          ? update.organizationId
          : update.organizationId?._id;
      const lat = update.lat ?? update.latitude;
      const lng = update.lng ?? update.longitude;
      const speed = update.speed ?? update.currentSpeed ?? 0;
      const status = update.status ?? update.movementStatus ?? "offline";
      const lastUpdated =
        update.lastUpdated ?? update.updatedAt ?? new Date().toISOString();

      setVehiclesMap((prev) => {
        const existing = prev[normalizedVehicleId];
        const next: Vehicle = existing
          ? {
            ...existing,
            lat: lat ?? existing.lat,
            lng: lng ?? existing.lng,
            speed,
            heading: update.heading ?? existing.heading,
            status,
            lastUpdated,
          }
          : {
            id: normalizedVehicleId,
            vehicleNumber: update.vehicleNumber || update.imei || "Unknown",
            lat: lat ?? null,
            lng: lng ?? null,
            speed,
            heading: update.heading ?? 0,
            status,
            lastUpdated,
            organizationId: orgId,
          };

        return {
          ...prev,
          [normalizedVehicleId]: next,
        };
      });
    },
    [],
  );

  const { isConnected, socket } = useSocket("gps_update", handleGpsUpdate);

  // Handle socket rooms subscription
  useEffect(() => {
    if (socket) {
      // 🔐 ORG CONTEXT UPDATE
      // If superadmin, join all rooms from data
      // If sub-org admin/manager, join only their org room
      const orgIds = new Set<string>();
      if (isSuperAdmin && liveDataRes?.data) {
        liveDataRes.data.forEach((item: any) => {
          const orgId =
            typeof item.organizationId === "string"
              ? item.organizationId
              : item.organizationId?._id;
          if (orgId) orgIds.add(orgId);
        });
      } else if (orgId) {
        orgIds.add(orgId);
      }


const joinRooms = () => {
        orgIds.forEach((id) => {
          socket.emit("join_organization", id);
        });
      };

      joinRooms();
      socket.on("connect", joinRooms);

      return () => {
        socket.off("connect", joinRooms);
        orgIds.forEach((id) => {
          socket.emit("leave_organization", id);
        });
      };
    }
  }, [liveDataRes?.data, socket, isSuperAdmin, orgId]);

  // Initialize/Sync vehicles from API data
  useEffect(() => {
    if (liveDataRes?.data) {
      setVehiclesMap((prev) => {
        const nextMap = { ...prev };
        liveDataRes.data?.forEach((item: any) => {
          const id =
            item.vehicleId?._id ||
            (typeof item.gpsDeviceId === "string"
              ? item.gpsDeviceId
              : item.gpsDeviceId?._id) ||
            item.imei ||
            item._id;
          const orgId =
            typeof item.organizationId === "string"
              ? item.organizationId
              : item.organizationId?._id;
          const existing = nextMap[id];

          nextMap[id] = {
            id,
            vehicleNumber:
              item.vehicleId?.vehicleNumber ||
              existing?.vehicleNumber ||
              item.imei ||
              "Unknown",
            lat: item.latitude ?? existing?.lat ?? null,
            lng: item.longitude ?? existing?.lng ?? null,
            speed: item.currentSpeed ?? existing?.speed ?? 0,
            heading: item.heading ?? existing?.heading ?? 0,
            status: item.movementStatus ?? existing?.status ?? "offline",
            lastUpdated:
              item.updatedAt ?? existing?.lastUpdated ?? new Date().toISOString(),
            organizationId: orgId ?? existing?.organizationId,
          };
        });
        return nextMap;
      });
    }
  }, [liveDataRes]);

  const vehicles = useMemo(() => Object.values(vehiclesMap), [vehiclesMap]);

  const onlineCount = useMemo(() => {
    return vehicles.filter((v) => {
      const diff = currentTime - new Date(v.lastUpdated).getTime();
      return diff < 5 * 60 * 1000;
    }).length;
  }, [vehicles, currentTime]);

  if (isLoading && vehicles.length === 0) {
    return <AdminLoadingState fullHeight title="Loading live tracking" description="Connecting to live telemetry and preparing fleet map controls." />;
  }

  return (
    <ApiErrorBoundary hasError={false}>
      <AdminPageShell contentClassName="flex min-h-[calc(100vh-132px)] flex-col space-y-6">
        <AdminPageHeader
          eyebrow="Live Ops"
          title="Live Tracking"
          description="Real-time GPS tracking of your fleet."
          actions={<div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-700">
              Online Vehicles:{" "}
              <span className="text-emerald-600">{onlineCount}</span> /{" "}
              {vehicles.length}
            </div>
            <div
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-[10px] font-black uppercase tracking-widest ${isConnected
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}
              ></span>
              {isConnected ? "Live Updates Active" : "Connecting..."}
            </div>
          </div>}
        />

        <AdminSectionCard
          title="Fleet Map"
          description="Map interactions and live-update behavior remain unchanged, with a cleaner admin surface."
          className="flex-1"
          bodyClassName="p-2"
        >
          <div className="relative h-[calc(100vh-320px)] min-h-[360px] overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50 sm:min-h-[420px] lg:min-h-[460px]">
            <LiveMap vehicles={vehicles.filter((v): v is Vehicle & { lat: number; lng: number } => v.lat != null && v.lng != null)} />
          </div>
        </AdminSectionCard>
      </AdminPageShell>
    </ApiErrorBoundary>
  );
}
