"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Navigation, ShieldCheck, Car, Calendar, User as UserIcon } from "lucide-react";
import { useGetMeQuery } from "@/redux/api/usersApi";
import { useGetVehicleQuery } from "@/redux/api/vehicleApi";
import { useGetLiveVehiclesQuery } from "@/redux/api/gpsLiveApi";
import { useGetVehicleHistoryQuery } from "@/redux/api/gpsHistoryApi";
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper";
import SinglePointMap from "@/components/admin/Map/SinglePointMap";
import HistoryMap from "@/components/admin/Map/HistoryMap";
import DriverTelemetryPanel from "@/components/driver/DriverTelemetryPanel";

/* ================= HELPERS ================= */

const roleToDashboard = (role?: string | null) => {
  if (role === "admin") return "/admin";
  if (role === "manager") return "/admin";
  if (role === "driver") return "/driver";
  return "/dashboard";
};

export default function DriverPage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState("my-vehicle");
  const { data: meData } = useGetMeQuery(undefined);
  const user = meData?.data;
  const assignedVehicleId =
    user?.assignedVehicleId?._id || user?.assignedVehicleId || "";

  const { data: vehicleData } = useGetVehicleQuery(assignedVehicleId, {
    skip: !assignedVehicleId,
  });
  const vehicle = vehicleData?.data;

  const { data: liveDataRes } = useGetLiveVehiclesQuery(undefined, {
    pollingInterval: 5000,
  });
  const liveVehicles = liveDataRes?.data || [];
  const liveMatch = liveVehicles.find(
    (item: any) => item.vehicleId?._id === assignedVehicleId || item._id === assignedVehicleId,
  );

  const now = new Date();
  const fromDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const toDate = now.toISOString();
  const { data: historyRes } = useGetVehicleHistoryQuery(
    { vehicleId: assignedVehicleId, from: fromDate, to: toDate },
    { skip: !assignedVehicleId },
  );
  const historyData = (historyRes?.data || []).map((point: any) => ({
    lat: point.latitude ?? point.lat,
    lng: point.longitude ?? point.lng,
    timestamp: point.timestamp || point.createdAt,
    speed: point.speed || 0,
    location: point.location || "",
  }));

  const livePosition = useMemo(() => {
    if (!liveMatch) return null;
    const lMatch = liveMatch as any;
    const lat = lMatch.latitude ?? lMatch.lat;
    const lng = lMatch.longitude ?? lMatch.lng;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [liveMatch]);

  useEffect(() => {
    const token = getSecureItem("token");
    const role = getSecureItem("userRole");
    if (!token) {
      router.replace("/");
      return;
    }
    if (role && role !== "driver") {
      router.replace(roleToDashboard(role));
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0a1428] text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0b1630]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-white font-black">
              DR
            </div>
            <div>
              <p className="text-sm font-black tracking-widest">DRIVER CONSOLE</p>
              <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
                Live Vehicle Profile
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[240px_1fr]">
          <aside className="h-full rounded-[28px] border border-white/10 bg-[#0b1630] p-4 shadow-[0_20px_60px_rgba(2,6,23,0.55)]">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
                <UserIcon size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                  Driver
                </p>
                <p className="text-sm font-bold text-white">
                  {user?.firstName || "Driver"} {user?.lastName || ""}
                </p>
              </div>
            </div>

            <button
              onClick={() => setActiveSection("my-vehicle")}
              className={`w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${activeSection === "my-vehicle"
                ? "bg-gradient-to-r from-purple-500/30 to-pink-500/20 text-white shadow-[0_12px_30px_rgba(168,85,247,0.35)]"
                : "bg-white/5 text-slate-300 hover:bg-white/10"
                }`}
            >
              My Vehicle
            </button>

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-300">
              <p className="uppercase tracking-[0.2em] text-[10px] text-slate-400">
                Assigned
              </p>
              <p className="mt-2 text-sm font-semibold text-white">
                {vehicle?.vehicleNumber || "No vehicle"}
              </p>
              <p className="text-[11px] text-slate-400">
                {vehicle?.vehicleType || "-"} · {vehicle?.model || "-"}
              </p>
            </div>
          </aside>

          <section className="space-y-6">
            {activeSection === "my-vehicle" && (
              <>
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/10 bg-[#0b1630] p-6 shadow-[0_15px_50px_rgba(2,6,23,0.55)]">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-white">
                          <UserIcon size={24} />
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-400">
                            Driver Profile
                          </p>
                          <h1 className="text-2xl font-black text-white">
                            {user?.firstName || "Driver"} {user?.lastName || ""}
                          </h1>
                          <p className="text-sm text-slate-400">{user?.email || "-"}</p>
                        </div>
                      </div>
                      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Role
                          </p>
                          <p className="text-sm font-bold text-white">Driver</p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Organization
                          </p>
                          <p className="text-sm font-bold text-white">
                            {user?.organizationId?.name || "Unassigned"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Status
                          </p>
                          <p className="text-sm font-bold text-emerald-300">
                            {user?.status || "active"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-[#0b1630] p-6 shadow-[0_15px_50px_rgba(2,6,23,0.55)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Assigned Vehicle
                          </p>
                          <h2 className="text-xl font-black text-white">
                            {vehicle?.vehicleNumber || "No vehicle assigned"}
                          </h2>
                        </div>
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-white">
                          <Car size={20} />
                        </div>
                      </div>
                      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Type
                          </p>
                          <p className="text-sm font-bold text-white capitalize">
                            {vehicle?.vehicleType || "-"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Model
                          </p>
                          <p className="text-sm font-bold text-white">
                            {vehicle?.model || "-"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Running Status
                          </p>
                          <p className="text-sm font-bold text-white capitalize">
                            {vehicle?.runningStatus || "inactive"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="rounded-3xl border border-white/10 bg-[#0b1630] p-6 shadow-[0_15px_50px_rgba(2,6,23,0.55)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Live Location
                          </p>
                          <h3 className="text-lg font-black text-white">Current Position</h3>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                          <Navigation size={18} />
                        </div>
                      </div>
                      <div className="mt-4 h-56 overflow-hidden rounded-2xl border border-white/10">
                        {livePosition ? (
                          <SinglePointMap position={livePosition} label="Driver" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                            Waiting for live coordinates...
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-[#0b1630] p-6 shadow-[0_15px_50px_rgba(2,6,23,0.55)]">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Journey History
                          </p>
                          <h3 className="text-lg font-black text-white">Last 3 Days</h3>
                        </div>
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                          <Calendar size={18} />
                        </div>
                      </div>
                      <div className="mt-4 h-56 overflow-hidden rounded-2xl border border-white/10">
                        {historyData.length > 0 ? (
                          <HistoryMap routes={[historyData]} selectedRouteIndex={0} />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-sm text-slate-400">
                            No journey history available yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-3xl border border-white/10 bg-[#0b1630] p-6 shadow-[0_15px_50px_rgba(2,6,23,0.55)]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                          <ShieldCheck size={18} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Assigned Admin
                          </p>
                          <p className="text-sm font-bold text-white">
                            {user?.organizationId?.email || "admin@company.com"}
                          </p>
                          <p className="text-xs text-slate-400">
                            Organization support for dispatch & compliance
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <DriverTelemetryPanel />
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
