"use client";

import { useMemo, useState } from "react";

import {
  Loader2,
  AlertTriangle,
  Calendar,
  Car,
  Filter,
  TrendingUp,
  Clock3,
  Zap,
  Activity,
  Gauge,
  AlertOctagon,
  ShieldOff,
  History,
  Copy,
  MapPin,
  Search,
  RefreshCw,
} from "lucide-react";

import { toast, Toaster } from "sonner";

import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";

import {
  useGetVehicleDailyStatsQuery,
  useGetVehicleDailyStatsByVehicleQuery,
  useGetVehicleDailyStatsByDateQuery,
} from "@/redux/api/vehicleDailyStatsApi";

import { useGetVehicleHistoryQuery } from "@/redux/api/gpsHistoryApi";

import dynamic from "next/dynamic";

import { Badge } from "@/components/ui/badge";

import { Button } from "@/components/ui/button";

const DailyRouteMap = dynamic(
  () => import("@/components/admin/Map/DailyRouteMap"),
  {
    ssr: false,

    loading: () => (
      <div className="h-[500px] w-full animate-pulse rounded-2xl bg-slate-900/40" />
    ),
  },
);

type DailyStat = {
  vehicleId?: { vehicleNumber?: string; _id?: string } | string;

  date?: string;

  totalDistance?: number;

  runningTime?: number;

  idleTime?: number;

  stoppedTime?: number;

  maxSpeed?: number;

  avgSpeed?: number;

  totalTrips?: number;

  ignitionOnCount?: number;

  overspeedCount?: number;

  harshBrakingCount?: number;

  emergencyCount?: number;

  lastCalculatedAt?: string;

  currentDistance?: number;
};

const todayInput = () => {
  const d = new Date();

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (value?: string) => {
  if (!value) return "N/A";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatSeconds = (sec?: number) => {
  const s = Math.max(0, Math.floor(sec || 0));

  const hh = String(Math.floor(s / 3600)).padStart(2, "0");

  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");

  const ss = String(s % 60).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
};

const toKm = (val?: number) => Number(val || 0).toFixed(2);

const toRad = (v: number) => (v * Math.PI) / 180;

const haversine = (
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) => {
  const R = 6371000;

  const dLat = toRad(b.lat - a.lat);

  const dLng = toRad(b.lng - a.lng);

  const lat1 = toRad(a.lat);

  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
};

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: any;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center ${accent}`}
        >
          <Icon size={18} />
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
            {label}
          </p>

          <p className="text-xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function DailyStatusPage() {
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>("");

  const [selectedDate, setSelectedDate] = useState<string>(todayInput());

  const [appliedVehicleId, setAppliedVehicleId] = useState<string>("");

  const [appliedDate, setAppliedDate] = useState<string>(todayInput());

  const { data: vehiclesRes, isLoading: loadingVehicles } =
    useGetVehiclesQuery(undefined);

  const vehicles = useMemo(
    () => vehiclesRes?.vehicles || vehiclesRes?.data || [],
    [vehiclesRes],
  );

  // Queries

  const statsByVehicleDate = useGetVehicleDailyStatsByDateQuery(
    { vehicleId: appliedVehicleId, date: appliedDate },

    { skip: !appliedVehicleId || !appliedDate },
  );

  const loading = loadingVehicles || statsByVehicleDate.isLoading;

  const error = statsByVehicleDate.error;

  const rawData: any = statsByVehicleDate.data;

  const rows: DailyStat[] = useMemo(() => {
    const list = rawData?.data || rawData?.stats || rawData || [];

    if (Array.isArray(list)) return list;

    if (list) return [list];

    return [];
  }, [rawData]);

  // History for selected day (single vehicle only)

  // Use local-day window (no Z) so packets sent in local time are included

  const dayStart = useMemo(() => `${appliedDate}T00:00:00`, [appliedDate]);

  const dayEnd = useMemo(() => `${appliedDate}T23:59:59`, [appliedDate]);

  const { data: dayHistory, isLoading: historyLoading } =
    useGetVehicleHistoryQuery(
      {
        vehicleId: appliedVehicleId,

        from: dayStart,

        to: dayEnd,

        page: 0,

        limit: 20000,
      },

      { skip: !appliedVehicleId || !appliedDate },
    );

  const routePoints = useMemo(() => {
    const list = dayHistory?.data || [];

    return list

      .map((p: any) => {
        const timestamp = p.gpsTimestamp || p.receivedAt;

        if (
          !timestamp ||
          !Number.isFinite(p.latitude) ||
          !Number.isFinite(p.longitude)
        )
          return null;

        return {
          lat: Number(p.latitude),

          lng: Number(p.longitude),

          timestamp,

          speed: Number(p.speed || 0),

          ignition: Boolean(p.ignitionStatus ?? p.ignition ?? true),

          heading: Number(p.heading || p.course || 0),

          alertType: p.alertType || p.alertIdentifier || p.event,
        };
      })

      .filter(Boolean);
  }, [dayHistory]);

  const routeStats = useMemo(() => {
    if (routePoints.length < 2) return null;

    let distance = 0;

    let driving = 0;

    let idling = 0;

    let stoppage = 0;

    let speedSum = 0;

    let speedCount = 0;

    for (let i = 1; i < routePoints.length; i++) {
      const a = routePoints[i - 1];

      const b = routePoints[i];

      const deltaT = Math.max(
        0,
        (new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) /
          1000,
      );

      distance += haversine(a, b);

      speedSum += b.speed;

      speedCount += 1;

      if (b.speed > 2) driving += deltaT;
      else if (b.speed === 0 && b.ignition) idling += deltaT;
      else if (b.speed === 0) stoppage += deltaT;
    }

    const currentDistance =
      haversine(routePoints[0], routePoints[routePoints.length - 1]) / 1000;

    return {
      travelled: distance / 1000,

      currentDistance,

      avgSpeed: speedCount ? speedSum / speedCount : 0,

      driving,

      idling,

      stoppage,
    };
  }, [routePoints]);

  const routeEvents = useMemo(() => {
    const ev: any[] = [];

    let streak: any[] = [];

    for (let i = 1; i < routePoints.length; i++) {
      const prev = routePoints[i - 1];

      const cur = routePoints[i];

      if (prev.heading != null && cur.heading != null) {
        let delta = cur.heading - prev.heading;

        if (delta > 180) delta -= 360;

        if (delta < -180) delta += 360;

        const abs = Math.abs(delta);

        if (abs >= 15) {
          const label =
            abs > 60
              ? delta > 0
                ? "sharp right"
                : "sharp left"
              : delta > 0
                ? "slight right"
                : "slight left";

          ev.push({ type: "turn", label, timestamp: cur.timestamp });
        }
      }

      if (prev.speed - cur.speed > 30)
        ev.push({
          type: "harsh",
          label: "harsh brake",
          timestamp: cur.timestamp,
        });

      if (cur.speed === 0) streak.push(cur);
      else {
        if (streak.length > 2)
          ev.push({
            type: streak[0].ignition ? "idle" : "stop",
            label: streak[0].ignition ? "idle" : "stop",
            timestamp: streak[streak.length - 1].timestamp,
          });

        streak = [];
      }
    }

    if (streak.length > 2)
      ev.push({
        type: streak[0].ignition ? "idle" : "stop",
        label: streak[0].ignition ? "idle" : "stop",
        timestamp: streak[streak.length - 1].timestamp,
      });

    return {
      turns: ev.filter((e) => e.type === "turn").length,

      stops: ev.filter((e) => e.type === "stop").length,

      idle: ev.filter((e) => e.type === "idle").length,

      harsh: ev.filter((e) => e.type === "harsh").length,
    };
  }, [routePoints]);

  const summaryMetrics = useMemo(() => {
    const base = rows[0];

    const hasHistory = routePoints.length > 0;

    const historyAvgSpeed = hasHistory
      ? routePoints.reduce((acc: number, p: any) => acc + (p.speed || 0), 0) /
        routePoints.length
      : 0;

    const firstPoint = hasHistory ? routePoints[0] : null;

    const lastPoint = hasHistory ? routePoints[routePoints.length - 1] : null;

    const directDistance =
      firstPoint && lastPoint
        ? haversine(
            { lat: firstPoint.lat, lng: firstPoint.lng },
            { lat: lastPoint.lat, lng: lastPoint.lng },
          ) / 1000
        : 0;

    return {
      travelledDistance: Number(
        base?.totalDistance ??
          routeStats?.travelled ??
          (hasHistory ? (routeStats?.travelled ?? 0) : 0),
      ),

      currentDistance: Number(
        base?.currentDistance ?? routeStats?.currentDistance ?? directDistance,
      ),

      averageSpeed: Number(
        base?.avgSpeed ?? routeStats?.avgSpeed ?? historyAvgSpeed,
      ),

      drivingDuration: Number(base?.runningTime ?? routeStats?.driving ?? 0),

      idleDuration: Number(base?.idleTime ?? routeStats?.idling ?? 0),

      stoppageDuration: Number(base?.stoppedTime ?? routeStats?.stoppage ?? 0),

      turns: Number((base as any)?.turns ?? routeEvents.turns ?? 0),

      stops: Number((base as any)?.stops ?? routeEvents.stops ?? 0),

      harshBrakes: Number(base?.harshBrakingCount ?? routeEvents.harsh ?? 0),
    };
  }, [rows, routeStats, routeEvents, routePoints]);

  const handleApply = () => {
    if (!selectedVehicleId) {
      toast.error("Please select a vehicle first");

      return;
    }

    setAppliedVehicleId(selectedVehicleId);

    setAppliedDate(selectedDate);
  };

  const getStatusBadge = (
    runningTime: number,
    idleTime: number,
    stoppedTime: number,
  ) => {
    if (runningTime > 0)
      return { label: "Running", variant: "success" as const };

    if (idleTime > 0) return { label: "Idle", variant: "warning" as const };

    if (stoppedTime > 0)
      return { label: "Stopped", variant: "secondary" as const };

    return { label: "Offline", variant: "destructive" as const };
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);

    toast.success("Copied to clipboard");
  };

  return (
    <>
      <Toaster 
        position="top-center"
        richColors
        closeButton
        expand={false}
        className="z-[9999999]"
        toastOptions={{
          style: {
            zIndex: 9999999,
            position: 'fixed',
            top: '10px',
            left: '50%',
            transform: 'translateX(-50%)',
          }
        }}
      />
      <div className="min-h-screen bg-gray-50">

      {/* STICKY HEADER + FILTERS */}

      <div className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
        <div className="px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900">
                Daily Status
              </h1>

              <p className="text-sm text-gray-600">
                Vehicle Daily Activity Summary
              </p>
            </div>

            <div className="flex items-center gap-2 text-gray-600">
              <Calendar size={14} />

              <span className="text-sm">{formatDate(appliedDate)}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600">
                Date
              </label>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-600">
                Vehicle
              </label>

              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select vehicle...</option>

                {vehicles.map((v: any) => (
                  <option key={v._id} value={v._id}>
                    {v.vehicleNumber || v.registrationNumber || v._id}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleApply}
                variant="default"
                size="default"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold"
              >
                <Filter size={16} className="mr-2" />
                Apply Filters
              </Button>
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleApply}
                variant="outline"
                size="default"
                className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw size={16} className="mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {/* STATUS LEGEND */}

          <div className="mt-4 flex items-center gap-4 text-xs text-gray-600">
            <span className="font-semibold">Status:</span>

            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>

              <span>Running</span>
            </div>

            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500"></div>

              <span>Idle</span>
            </div>

            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-500"></div>

              <span>Stopped</span>
            </div>

            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>

              <span>Offline</span>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}

      <div className="p-6">
        {!appliedVehicleId ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <Car size={32} className="text-gray-400" />
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Vehicle Selected
            </h3>

            <p className="text-sm text-gray-600">
              Select a vehicle and apply filters to view daily status.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-4">
            {/* SKELETON LOADING */}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 bg-white p-4"
                >
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>

                    <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-8">
              <div className="animate-pulse text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-blue-600" />

                <p className="text-gray-600">Loading daily status...</p>
              </div>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <AlertTriangle size={16} className="text-red-600" />

            <div className="text-sm text-red-800">
              <strong>Unable to load daily status.</strong> Please try again.
            </div>

            <Button
              onClick={handleApply}
              variant="outline"
              size="sm"
              className="ml-auto border-red-300 text-red-700 hover:bg-red-50"
            >
              Retry
            </Button>
          </div>
        ) : (
          <>
            {/* SUMMARY CARDS */}

            <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <SummaryCard
                label="Travelled Distance"
                value={`${summaryMetrics.travelledDistance.toFixed(2)} km`}
                icon={TrendingUp}
                accent="bg-green-100 text-green-600"
              />

              <SummaryCard
                label="Current Distance"
                value={`${summaryMetrics.currentDistance.toFixed(2)} km`}
                icon={Gauge}
                accent="bg-blue-100 text-blue-600"
              />

              <SummaryCard
                label="Average Speed"
                value={`${summaryMetrics.averageSpeed.toFixed(1)} km/h`}
                icon={Clock3}
                accent="bg-purple-100 text-purple-600"
              />

              <SummaryCard
                label="Driving Duration"
                value={formatSeconds(summaryMetrics.drivingDuration)}
                icon={Activity}
                accent="bg-green-100 text-green-600"
              />

              <SummaryCard
                label="Idle Duration"
                value={formatSeconds(summaryMetrics.idleDuration)}
                icon={ShieldOff}
                accent="bg-yellow-100 text-yellow-600"
              />

              <SummaryCard
                label="Stoppage Duration"
                value={formatSeconds(summaryMetrics.stoppageDuration)}
                icon={AlertOctagon}
                accent="bg-gray-100 text-gray-600"
              />
            </div>

            {/* ROUTE MAP */}

            {appliedVehicleId && (
              <div className="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-gray-600" />

                    <h3 className="text-sm font-semibold text-gray-900">
                      Route Map
                    </h3>
                  </div>

                  <div className="text-xs text-gray-500">
                    {historyLoading
                      ? "Loading route..."
                      : `${routePoints.length} points`}
                  </div>
                </div>

                {historyLoading ? (
                  <div className="flex h-[500px] items-center justify-center bg-gray-50">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : routePoints.length === 0 ? (
                  <div className="flex h-[500px] items-center justify-center bg-gray-50">
                    <div className="text-center">
                      <MapPin
                        size={48}
                        className="text-gray-300 mx-auto mb-2"
                      />

                      <p className="text-gray-500">
                        No route data for this day.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="h-[500px]">
                    <DailyRouteMap points={routePoints as any} />
                  </div>
                )}
              </div>
            )}

            {/* MAIN DATA TABLE */}

            <div className="rounded border border-gray-200 bg-white shadow-sm overflow-hidden mb-6">
              <div className="px-4 py-2 bg-white">
                <h3 className="text-sm font-semibold text-gray-700">
                  Travel Summary
                </h3>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 border-y border-gray-200 text-xs text-gray-600 bg-white">
                <span>Vehicle = </span>
                <span className="bg-green-600 text-white px-2 py-0.5 rounded shadow-sm text-[10px] font-medium">
                  All
                </span>
                <span className="ml-2">Date Range</span>
                <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded border border-green-200">
                  {formatDate(appliedDate)} 00:00
                </span>
                <span>to</span>
                <span className="text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded border border-green-200">
                  {formatDate(appliedDate)} 23:59
                </span>
              </div>

              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                    <History size={32} className="text-gray-400" />
                  </div>

                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No Data Found
                  </h3>

                  <p className="text-sm text-gray-600">
                    No daily data found for selected vehicle and date.
                  </p>

                  <p className="text-xs text-gray-500 mt-2">
                    Try changing the date or clearing filters.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto pb-4 px-2">
                  <table className="w-full min-w-max divide-y divide-gray-200 border border-gray-200 text-center text-[11px]">
                    <thead className="bg-[#2E7D32] text-white whitespace-nowrap">
                      <tr>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Branch
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Vehicle
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Vehicle Brand
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Vehicle Model
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Driver
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          IMEI No
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Start
                          <br />
                          Location
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Start
                          <br />
                          Odometer
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Distance
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20] min-w-[120px]">
                          Running V/S Stop
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Running
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Idle
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Stop
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Inactive
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Duration
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Max
                          <br />
                          Stoppage
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          No of
                          <br />
                          idle
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Speed
                          <div className="flex justify-center gap-2 text-[9px] bg-[#1B5E20] mt-1 rounded px-1 py-0.5">
                            <span className="text-green-300">AVG</span> |{" "}
                            <span className="text-red-300">MAX</span>
                          </div>
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Over
                          <br />
                          speed
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          Alert(s)
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          End
                          <br />
                          Odometer
                        </th>
                        <th className="px-4 py-3 font-semibold border-r border-[#1B5E20]">
                          End
                          <br />
                          Location
                        </th>
                        <th className="px-4 py-3 font-semibold">Playback</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rows.map((row, idx) => {
                        const vehicleLabel =
                          typeof row.vehicleId === "string"
                            ? row.vehicleId
                            : row.vehicleId?.vehicleNumber ||
                              row.vehicleId?._id ||
                              "Vehicle";
                        const vehicle = vehicles.find(
                          (v: any) =>
                            v._id ===
                            (typeof row.vehicleId === "object"
                              ? row.vehicleId?._id
                              : row.vehicleId),
                        );

                        const branch = vehicle?.organizationId
                          ? typeof vehicle.organizationId === "object"
                            ? vehicle.organizationId.name
                            : "Assigned"
                          : "-";
                        const vehicleBrand = vehicle?.brand || "-";
                        const vehicleModel = vehicle?.vehicleType || "Truck";
                        const driver = vehicle?.driverName || "No Driver Found";
                        const imei = vehicle?.imei || "-";

                        let startLoc = "-";
                        let endLoc = "-";
                        if (routePoints.length > 0) {
                          startLoc = `${routePoints[0].lat.toFixed(4)}, ${routePoints[0].lng.toFixed(4)}`;
                          endLoc = `${routePoints[routePoints.length - 1].lat.toFixed(4)}, ${routePoints[routePoints.length - 1].lng.toFixed(4)}`;
                        }

                        const running = row.runningTime || 0;
                        const idle = row.idleTime || 0;
                        const stop = row.stoppedTime || 0;
                        // 24 hours total - just for simple inactive calc
                        const durationTotal = running + idle + stop;
                        const inactive = Math.max(0, 86400 - durationTotal);

                        const maxStoppage = "-";
                        const noOfIdle = Math.max(
                          0,
                          row.totalTrips ? row.totalTrips - 1 : 0,
                        ); // rough approximation if we don't have accurate idle count

                        const avgSpeed = Number(row.avgSpeed || 0).toFixed(0);
                        const maxSpeed = Number(row.maxSpeed || 0).toFixed(0);
                        const overSpeed = row.overspeedCount || 0;
                        const alertsCount =
                          (row.emergencyCount || 0) +
                          (row.harshBrakingCount || 0) +
                          overSpeed;

                        // For the visual bar
                        const totalActive = running + idle + stop;
                        const pRun = totalActive
                          ? (running / totalActive) * 100
                          : 0;
                        const pIdle = totalActive
                          ? (idle / totalActive) * 100
                          : 0;
                        const pStop = totalActive
                          ? (stop / totalActive) * 100
                          : 0;

                        return (
                          <tr
                            key={idx}
                            className="hover:bg-gray-50 transition-colors text-gray-700 whitespace-nowrap"
                          >
                            <td className="px-4 py-4 border-r border-gray-200">
                              <div className="flex items-center gap-2 justify-center">
                                <span className="bg-green-600 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-sm">
                                  +
                                </span>
                                <span
                                  className="text-green-700 font-semibold truncate max-w-[120px]"
                                  title={branch}
                                >
                                  {branch}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 font-semibold">
                              {vehicleLabel}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200">
                              {vehicleBrand}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200">
                              {vehicleModel}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200">
                              {driver}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 text-gray-500">
                              {imei}
                            </td>
                            <td
                              className="px-4 py-4 border-r border-gray-200 truncate max-w-[120px]"
                              title={startLoc}
                            >
                              {startLoc}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 font-medium">
                              -
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 font-bold">
                              {toKm(row.totalDistance)}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200">
                              <div className="flex w-full h-2 rounded-full overflow-hidden bg-gray-200">
                                <div
                                  style={{ width: `${pRun}%` }}
                                  className="bg-green-500"
                                />
                                <div
                                  style={{ width: `${pIdle}%` }}
                                  className="bg-orange-400"
                                />
                                <div
                                  style={{ width: `${pStop}%` }}
                                  className="bg-red-500"
                                />
                              </div>
                              <div className="text-center font-bold text-[10px] text-gray-400 mt-1 flex justify-between px-1">
                                <span className="text-green-600">
                                  {toKm(row.totalDistance)}
                                </span>
                                <span className="text-gray-400">/</span>
                                <span className="text-red-500">Stop</span>
                              </div>
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 text-green-600 font-semibold">
                              {formatSeconds(running)}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 text-orange-500 font-semibold">
                              {formatSeconds(idle)}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 text-red-500 font-semibold">
                              {formatSeconds(stop)}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 text-blue-500 font-semibold">
                              {formatSeconds(inactive)}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 font-medium">
                              24:00
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 font-medium">
                              {maxStoppage}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 font-medium">
                              {noOfIdle}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 font-medium whitespace-nowrap min-w-[60px]">
                              <span className="text-green-600">{avgSpeed}</span>{" "}
                              <span className="text-gray-300 mx-1">|</span>{" "}
                              <span className="text-red-500">{maxSpeed}</span>
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 font-medium">
                              {overSpeed}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 text-red-500 font-bold">
                              {alertsCount > 0 ? alertsCount : ""}
                            </td>
                            <td className="px-4 py-4 border-r border-gray-200 font-medium">
                              -
                            </td>
                            <td
                              className="px-4 py-4 border-r border-gray-200 truncate max-w-[120px]"
                              title={endLoc}
                            >
                              {endLoc}
                            </td>
                            <td className="px-4 py-4 text-green-600 font-bold hover:text-green-800 transition-colors">
                              <button
                                className="flex items-center justify-center mx-auto"
                                title="Playback"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="currentColor"
                                >
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
    </>
  );
}
