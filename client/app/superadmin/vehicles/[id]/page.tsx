"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import OrganizationMap from "@/components/admin/Map/OrganizationMap";
import { useGetVehicleQuery } from "@/redux/api/vehicleApi";
import { useGetLiveVehiclesQuery } from "@/redux/api/gpsLiveApi";
import { formatDateTime, formatStatus } from "@/components/superadmin/superadmin-data";

type Coordinates = { lat: number; lng: number };

const normalizeMapVehicleStatus = (value?: string) => {
  const status = (value || "").toLowerCase();
  if (status === "running") return "running" as const;
  if (status === "idle") return "idle" as const;
  return "stopped" as const;
};

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const vehicleId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { data, isLoading, isError } = useGetVehicleQuery(vehicleId || "", {
    skip: !vehicleId,
    refetchOnMountOrArgChange: true,
  });
  const { data: liveData } = useGetLiveVehiclesQuery(undefined);

  const vehicle = useMemo(() => {
    if (!data || typeof data !== "object") return null;
    if ("data" in data && data.data && typeof data.data === "object") return data.data as Record<string, unknown>;
    return data as Record<string, unknown>;
  }, [data]);

  const liveRecord = useMemo(() => {
    if (!vehicleId || !liveData || typeof liveData !== "object") return null;
    const rows = "data" in liveData && Array.isArray(liveData.data) ? liveData.data : [];

    return rows.find((row) => {
      if (!row || typeof row !== "object") return false;
      const source = row as Record<string, unknown>;
      const nestedVehicle = source.vehicleId;
      if (typeof nestedVehicle === "string") return nestedVehicle === vehicleId;
      if (nestedVehicle && typeof nestedVehicle === "object") {
        return readString((nestedVehicle as Record<string, unknown>)._id) === vehicleId;
      }
      return false;
    }) as Record<string, unknown> | null;
  }, [liveData, vehicleId]);

  const position = useMemo(
    () => getCoordinates(liveRecord) || getCoordinates(vehicle),
    [liveRecord, vehicle],
  );

  const organizationPoint = useMemo(() => {
    const org = vehicle?.organizationId;
    if (!org || typeof org !== "object") return [];

    const organization = org as Record<string, unknown>;
    const orgPosition = getCoordinates(organization);
    if (!orgPosition) return [];

    return [
      {
        id: readString(organization._id) || "organization",
        name: readString(organization.name) || "Organization",
        position: orgPosition,
      },
    ];
  }, [vehicle]);

  const vehiclePoint = useMemo(() => {
    if (!vehicleId || !position) return [];

    return [
      {
        id: vehicleId,
        label: getVehicleName(vehicle),
        position,
        status: normalizeMapVehicleStatus(
          readString(liveRecord?.movementStatus) ||
            readString(liveRecord?.status) ||
            readString(vehicle?.status) ||
            "unknown",
        ),
        driverName: getDriverName(vehicle),
        speed: readNumber(liveRecord?.currentSpeed) || 0,
        lastUpdated: formatDateTime(readString(liveRecord?.updatedAt) || readString(vehicle?.updatedAt)) || "Unavailable",
        location: readString(liveRecord?.currentLocation) || "Location unavailable",
      },
    ];
  }, [liveRecord, position, vehicle, vehicleId]);

  if (isLoading) {
    return <StateCard text="Loading vehicle details..." />;
  }

  if (isError || !vehicle) {
    return <StateCard text="Vehicle details are unavailable." danger />;
  }

  const organizationName = getOrganizationName(vehicle);
  const driverName = getDriverName(vehicle);
  const vehicleName = getVehicleName(vehicle);
  const telemetryStatus = formatStatus(readString(liveRecord?.movementStatus) || readString(liveRecord?.status) || readString(vehicle.status) || "unknown");
  const speedValue = readNumber(liveRecord?.currentSpeed);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">Vehicle Detail</p>
          <h1 className="text-2xl font-black text-slate-100 sm:text-3xl">{vehicleName}</h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Superadmin visibility into vehicle identity, assignment context, and live telemetry when available.
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-200 transition hover:bg-slate-900"
        >
          Back
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-4">
          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Identity</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoItem label="Vehicle" value={vehicleName} />
              <InfoItem label="Status" value={formatStatus(readString(vehicle.status) || "unknown")} />
              <InfoItem label="Organization" value={organizationName || "Unavailable"} />
              <InfoItem label="Driver" value={driverName || "Unavailable"} />
              <InfoItem label="Model" value={readString(vehicle.model) || "Unavailable"} />
              <InfoItem label="Updated" value={formatDateTime(readString(vehicle.updatedAt)) || "Unavailable"} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Live Telemetry</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <InfoItem label="Movement" value={telemetryStatus} />
              <InfoItem label="Current Speed" value={speedValue !== null ? `${speedValue} km/h` : "Unavailable"} />
              <InfoItem label="Last Ping" value={formatDateTime(readString(liveRecord?.updatedAt)) || "Unavailable"} />
              <InfoItem label="Location" value={readString(liveRecord?.currentLocation) || "Unavailable"} />
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)]">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Map</p>
            <p className="mt-1 text-sm text-slate-400">
              Live map visibility is shown only when valid position data exists for this vehicle.
            </p>
          </div>

          {position ? (
            <div className="h-[420px] overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <OrganizationMap
                organizations={organizationPoint}
                vehicles={vehiclePoint}
                selectedOrgId={organizationPoint[0]?.id}
                selectedVehicleId={vehicleId}
              />
            </div>
          ) : (
            <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center text-sm font-medium leading-6 text-slate-400">
              Current coordinates are not available for this vehicle, so the map has been hidden instead of rendering demo telemetry.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function StateCard({ text, danger = false }: { text: string; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-8 text-sm font-semibold ${danger ? "border-rose-500/30 bg-rose-500/10 text-rose-100" : "border-slate-800/80 bg-slate-900/60 text-slate-300"}`}>
      {text}
    </div>
  );
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getVehicleName(vehicle: Record<string, unknown> | null) {
  if (!vehicle) return "Vehicle";
  return readString(vehicle.vehicleNumber) || readString(vehicle.registrationNumber) || readString(vehicle.name) || "Vehicle";
}

function getOrganizationName(vehicle: Record<string, unknown> | null) {
  if (!vehicle) return "";
  const org = vehicle.organizationId;
  if (org && typeof org === "object") {
    const record = org as Record<string, unknown>;
    return readString(record.name) || readString(record.email);
  }
  return readString(vehicle.organizationName);
}

function getDriverName(vehicle: Record<string, unknown> | null) {
  if (!vehicle) return "";
  const directDriver = vehicle.driverId;
  if (directDriver && typeof directDriver === "object") {
    const record = directDriver as Record<string, unknown>;
    const name = [readString(record.firstName), readString(record.lastName)].filter(Boolean).join(" ").trim();
    return name || readString(record.name);
  }
  return readString(vehicle.driverName);
}

function getCoordinates(source: Record<string, unknown> | null): Coordinates | null {
  if (!source) return null;

  const candidates: Array<Record<string, unknown>> = [];
  if (source.currentLocation && typeof source.currentLocation === "object") {
    candidates.push(source.currentLocation as Record<string, unknown>);
  }
  if (source.location && typeof source.location === "object") {
    candidates.push(source.location as Record<string, unknown>);
  }
  candidates.push(source);

  for (const candidate of candidates) {
    const lat = readNumber(candidate.lat ?? candidate.latitude);
    const lng = readNumber(candidate.lng ?? candidate.longitude ?? candidate.lon);

    if (lat !== null && lng !== null) {
      return { lat, lng };
    }
  }

  return null;
}
