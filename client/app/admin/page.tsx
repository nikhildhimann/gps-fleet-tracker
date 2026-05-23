"use client";

import { Users, Car, Radio, Activity, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import OrganizationMap from "@/components/admin/Map/OrganizationMap";
import { VehicleSidebar } from "@/components/dashboard/vehicle-sidebar";
import { RUNNING_SPEED_THRESHOLD } from "@/lib/vehicleStatusUtils";
import { MapWrapper } from "@/components/dashboard/map-wrapper";
import { DashboardProvider } from "@/components/dashboard/DashboardContext";
import { useVehiclePositions } from "@/lib/use-vehicle-positions";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";
import { useGetGpsDevicesQuery } from "@/redux/api/gpsDeviceApi";
import { useGetLiveVehiclesQuery } from "@/redux/api/gpsLiveApi";
import AdminLoadingState from "@/components/admin/UI/AdminLoadingState";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";
import AdminStatCard from "@/components/admin/UI/AdminStatCard";
import AdminStatusBadge from "@/components/admin/UI/AdminStatusBadge";
import { useOrgContext } from "@/hooks/useOrgContext";

type DashboardVehicle = {
  id: string;
  driver: string;
  date: string;
  speed: number;
  status: "running" | "idle" | "stopped";
  ign: boolean;
  ac: boolean;
  pw: boolean;
  gps: boolean;
  location: string;
  poi: string;
  route: { lat: number; lng: number }[];
};

const defaultCenter = { lat: 28.6139, lng: 77.209 };

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isSuperAdmin, isRootOrgAdmin } = useOrgContext();

  const queryFromSuperadmin = searchParams.get("from") === "superadmin";
  const queryOrgId = searchParams.get("org");

  const [fromSuperadmin, setFromSuperadmin] = useState(false);
  const [targetOrgId, setTargetOrgId] = useState<string | null>(null);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] =
    useState<"all" | "running" | "idle" | "stopped">("all");

  /* =========================
     RTK QUERY (FORCED LOAD)
  ========================= */
  const { data: orgData, isLoading: isLoadingOrgs } =
    useGetOrganizationsQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });

  const { data: vehData, isLoading: isLoadingVehicles } =
    useGetVehiclesQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });

  const { data: devData, isLoading: isLoadingDevices } =
    useGetGpsDevicesQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });

  const { data: liveData, isLoading: isLoadingLive } =
    useGetLiveVehiclesQuery(undefined, {
      pollingInterval: 30000, // Changed from 5000ms to 30000ms (30 seconds) to reduce excessive API calls
      refetchOnMountOrArgChange: true,
    });

  /* =========================
     SAFE RESPONSE MAPPING
  ========================= */
  const displayOrgs = orgData?.organizations || orgData?.data || [];
  const displayVehicles = vehData?.vehicles || vehData?.data || [];
  const displayDevices = devData?.devices || devData?.data || [];
  const orgTotal = (orgData as any)?.pagination?.totalrecords ?? displayOrgs.length;
  const vehicleTotal = (vehData as any)?.pagination?.totalrecords ?? displayVehicles.length;
  const deviceTotal = (devData as any)?.pagination?.totalrecords ?? displayDevices.length;
  const displayLiveData = liveData?.vehicles || liveData?.data || [];

  const isLoading =
    isLoadingOrgs || isLoadingVehicles || isLoadingDevices || isLoadingLive;
  const showOrganizationsCard = isSuperAdmin || isRootOrgAdmin;

  /* =========================
     URL + SESSION HANDLING
  ========================= */
  useEffect(() => {
    let selectedOrg = queryOrgId;
    let fromSuper = queryFromSuperadmin;

    setTargetOrgId(selectedOrg);
    setFromSuperadmin(fromSuper);
  }, [queryOrgId, queryFromSuperadmin]);

  useEffect(() => {
    if (targetOrgId) setSelectedOrgId(targetOrgId);
  }, [targetOrgId]);

  /* =========================
     ONLINE / OFFLINE FIX
  ========================= */
  const onlineVehicleIds = useMemo(() => {
    return new Set(
      displayLiveData.map((d: any) =>
        String(d.vehicleId?._id || d.vehicleId)
      )
    );
  }, [displayLiveData]);

  const onlineVehicles = displayVehicles.filter((v: any) =>
    onlineVehicleIds.has(String(v._id))
  ).length;

  const offlineVehicles = displayVehicles.length - onlineVehicles;

  /* =========================
     ORG POSITIONS
  ========================= */
  const orgPositions = useMemo(() => {
    return displayOrgs.map((org: any) => {
      const orgLive = displayLiveData.filter((l: any) => {
        const oid = l.organizationId?._id || l.organizationId;
        return oid === org._id && l.latitude && l.longitude;
      });

      if (!orgLive.length) {
        return {
          id: org._id,
          name: org.name || "Organization",
          position: org.geo?.lat
            ? { lat: org.geo.lat, lng: org.geo.lng }
            : defaultCenter,
        };
      }

      const avg = orgLive.reduce(
        (a: any, c: any) => ({
          lat: a.lat + c.latitude,
          lng: a.lng + c.longitude,
        }),
        { lat: 0, lng: 0 }
      );

      return {
        id: org._id,
        name: org.name || "Organization",
        position: {
          lat: avg.lat / orgLive.length,
          lng: avg.lng / orgLive.length,
        },
      };
    });
  }, [displayOrgs, displayLiveData]);

  const orgPositionMap = useMemo(() => {
    const map: Record<string, { lat: number; lng: number }> = {};
    orgPositions.forEach((o: any) => (map[o.id] = o.position));
    return map;
  }, [orgPositions]);

  /* =========================
     VEHICLE UI DATA
  ========================= */
  const uiVehicles: DashboardVehicle[] = useMemo(() => {
    return displayVehicles.map((vehicle: any) => {
      const live: any = displayLiveData.find(
        (l: any) =>
          String(l.vehicleId?._id || l.vehicleId) === String(vehicle._id)
      );

      let status: DashboardVehicle["status"] = "stopped";
      if (live) {
        if ((live.speed ?? 0) >= RUNNING_SPEED_THRESHOLD) status = "running";
        else if (live.ignition) status = "idle";
      }

      const fallback =
        orgPositionMap[vehicle.organizationId?._id || vehicle.organizationId] ||
        defaultCenter;

      const position =
        live?.latitude && live?.longitude
          ? { lat: live.latitude, lng: live.longitude }
          : fallback;

      return {
        id: vehicle._id,
        driver: vehicle.driverName || "Unassigned",
        date: live?.lastUpdated
          ? new Date(live.lastUpdated).toLocaleString("en-GB")
          : new Date().toLocaleString("en-GB"),
        speed: live?.speed || 0,
        status,
        ign: !!live?.ignition,
        ac: !!live?.ac,
        pw: true,
        gps: !!(live?.latitude && live?.longitude),
        location: live?.address || "Unknown",
        poi: "-",
        route: [position],
      };
    });
  }, [displayVehicles, displayLiveData, orgPositionMap]);

  /* =========================
     FILTERING (REMOVED - TRUST BACKEND)
     ========================= */
  const visibleVehicles = useMemo(() => {
    // 🔐 ORG CONTEXT UPDATE
    // No longer filtering by selectedOrgId in frontend.
    // Backend already scopes displayVehicles based on user hierarchy.
    if (statusFilter === "all") return uiVehicles;
    return uiVehicles.filter((v) => v.status === statusFilter);
  }, [uiVehicles, statusFilter]);

  const positions = useVehiclePositions(visibleVehicles);

  /* =========================
     LOADER
  ========================= */
  if (isLoading) {
    return <AdminLoadingState fullHeight title="Loading operations dashboard" description="Fetching fleet metrics, organizations, and live tracking status." />;
  }

  /* =========================
     JSX (UNCHANGED)
  ========================= */
  return (
    <AdminPageShell contentClassName="space-y-8">
      <AdminPageHeader
        eyebrow="Operations Overview"
        title="GPS Admin Dashboard"
        description="Real-time visibility into organizations, fleet status, connected hardware, and active vehicles."
        actions={
          <>
            {fromSuperadmin && (
              <button
                onClick={() => router.push("/superadmin")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to SuperAdmin
              </button>
            )}
            <AdminStatusBadge tone="success">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />
              System Live
            </AdminStatusBadge>
          </>
        }
      />

      <div className={`grid gap-4 md:grid-cols-2 ${showOrganizationsCard ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
        {showOrganizationsCard && (
          <AdminStatCard label="Organizations" value={orgTotal} icon={<Users size={20} />} tone="blue" meta="Active hierarchy and sub-org visibility" href="/admin/organizations" />
        )}
        <AdminStatCard label="Vehicles" value={vehicleTotal} icon={<Car size={20} />} tone="amber" meta={`${offlineVehicles} currently offline`} href="/admin/vehicles" />
        <AdminStatCard label="GPS Devices" value={deviceTotal} icon={<Radio size={20} />} tone="violet" meta="Provisioned and mapped tracking units" href="/admin/gps-devices" />
        <AdminStatCard label="Online Vehicles" value={onlineVehicles} icon={<Activity size={20} />} tone="green" meta="Live telemetry reporting now" href="/admin/live-tracking" />
      </div>

      {selectedOrgId ? (
        <DashboardProvider>
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <AdminSectionCard
              title="Fleet Activity"
              description="Select a vehicle to review its current live state and focus the operational map."
              className="overflow-hidden"
              bodyClassName="p-0"
            >
              <VehicleSidebar
                vehicles={visibleVehicles}
                selectedId={selectedVehicleId}
                onSelect={(id) => setSelectedVehicleId(id === selectedVehicleId ? null : id)}
                statusFilter={statusFilter === "all" ? "total" : statusFilter}
              />
            </AdminSectionCard>

            <AdminSectionCard
              title="Live Fleet Map"
              description="Geospatial overview of the currently selected organization with live map controls preserved."
              bodyClassName="p-2"
            >
              <div className="h-[640px] overflow-hidden rounded-[20px] border border-slate-200 bg-slate-50">
                <MapWrapper />
              </div>
            </AdminSectionCard>
          </div>
        </DashboardProvider>
      ) : (
        <AdminSectionCard
          title="Organization Overview"
          description="Choose an organization from the map to enter its operational dashboard."
          bodyClassName="p-2"
        >
          <div className="h-[680px] overflow-hidden rounded-[22px] border border-slate-200 bg-slate-50">
            <OrganizationMap
              organizations={orgPositions}
              vehicles={[]}
              selectedOrgId={null}
              selectedVehicleId={null}
              onOrgSelect={(id: string) => setSelectedOrgId(id)}
            />
          </div>
        </AdminSectionCard>
      )}
    </AdminPageShell>
  );
}
