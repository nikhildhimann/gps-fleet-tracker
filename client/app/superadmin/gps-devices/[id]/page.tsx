"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import SinglePointMap from "@/components/admin/Map/SinglePointMap";
import { useGetGpsDeviceQuery } from "@/redux/api/gpsDeviceApi";
import { formatDateTime, formatStatus } from "@/components/superadmin/superadmin-data";

type Coordinates = { lat: number; lng: number };

export default function DeviceDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const deviceId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const { data, isLoading, isError } = useGetGpsDeviceQuery(deviceId || "", {
    skip: !deviceId,
    refetchOnMountOrArgChange: true,
  });

  const device = useMemo(() => {
    if (!data || typeof data !== "object") return null;
    if ("data" in data && data.data && typeof data.data === "object") return data.data as Record<string, unknown>;
    return data as Record<string, unknown>;
  }, [data]);

  const position = useMemo(() => getCoordinates(device), [device]);

  if (isLoading) {
    return <StateCard text="Loading GPS device details..." />;
  }

  if (isError || !device) {
    return <StateCard text="GPS device details are unavailable." danger />;
  }

  const imei = readString(device.imei) || "GPS Device";
  const status = formatStatus(readString(device.status) || readString(device.inventoryStatus) || "unknown");

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">GPS Device Detail</p>
          <h1 className="text-2xl font-black text-slate-100 sm:text-3xl">{imei}</h1>
          <p className="max-w-2xl text-sm text-slate-400">
            Superadmin view of device identity, inventory context, and live coordinate availability.
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
              <InfoItem label="IMEI" value={imei} />
              <InfoItem label="Status" value={status} />
              <InfoItem label="Device Model" value={readString(device.deviceModel) || readString(device.model) || "Unavailable"} />
              <InfoItem label="SIM Number" value={readString(device.simNumber) || "Unavailable"} />
              <InfoItem label="Manufacturer" value={readString(device.manufacturer) || "Unavailable"} />
              <InfoItem label="Last Updated" value={formatDateTime(readString(device.updatedAt)) || "Unavailable"} />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)]">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Operational Notes</p>
            <div className="mt-4 grid gap-3">
              <InfoItem label="Assigned Vehicle" value={getAssignedVehicle(device) || "Not assigned"} />
              <InfoItem label="Installed On" value={formatDateTime(readString(device.installedAt)) || "Unavailable"} />
              <InfoItem label="Supplier" value={readString(device.supplierName) || "Unavailable"} />
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.8)]">
          <div className="mb-4">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Map</p>
            <p className="mt-1 text-sm text-slate-400">
              Device position is shown only when valid coordinates exist in the current response.
            </p>
          </div>

          {position ? (
            <div className="h-[420px] overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60">
              <SinglePointMap position={position} label={imei} />
            </div>
          ) : (
            <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-center text-sm font-medium leading-6 text-slate-400">
              No device coordinates are available right now, so the map has been hidden instead of showing placeholder data.
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

function getAssignedVehicle(device: Record<string, unknown> | null) {
  if (!device) return "";

  const assignedVehicle = device.vehicleId;
  if (assignedVehicle && typeof assignedVehicle === "object") {
    const vehicle = assignedVehicle as Record<string, unknown>;
    return readString(vehicle.vehicleNumber) || readString(vehicle.registrationNumber) || readString(vehicle.name);
  }

  return readString(device.vehicleNumber);
}

function getCoordinates(source: Record<string, unknown> | null): Coordinates | null {
  if (!source) return null;

  const candidates: Array<Record<string, unknown>> = [];
  if (source.location && typeof source.location === "object") {
    candidates.push(source.location as Record<string, unknown>);
  }
  if (source.currentLocation && typeof source.currentLocation === "object") {
    candidates.push(source.currentLocation as Record<string, unknown>);
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

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
