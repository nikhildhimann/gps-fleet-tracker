"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Table from "@/components/ui/Table";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { Trash2, Loader2, UserPlus, Filter, Car, User, ArrowRight, X, Briefcase } from "lucide-react";
import { toast } from "sonner";
import {
    useGetVehicleDriverMappingsQuery,
    useAssignDriverMutation,
    useUnassignDriverMutation
} from "@/redux/api/vehicleDriverMappingApi";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";
import { useGetDriversQuery } from "@/redux/api/driversApi";
import { useGetGpsDevicesQuery } from "@/redux/api/gpsDeviceApi";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";
import ImportExportButton from "@/components/admin/import-export/ImportExportButton";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";
import SearchableEntitySelect from "@/components/admin/UI/SearchableEntitySelect";
import { getApiErrorMessage } from "@/utils/apiError";
// 🔐 ORG CONTEXT UPDATE
import { useOrgContext } from "@/hooks/useOrgContext";
// 🔧 ACTIVE STATUS FILTERING
import { isActiveStatus, filterExcludedIds } from "@/utils/mappingHelpers";

type EntityId = string | { toString: () => string };

type OrganizationRef = string | {
    _id: string;
    name?: string;
};

type GpsDeviceRef = {
    _id: EntityId;
    imei?: string;
};

type VehicleRef = {
    _id: EntityId;
    organizationId?: OrganizationRef;
    vehicleNumber?: string;
    model?: string;
    deviceId?: EntityId | GpsDeviceRef;
    status?: string;
};

type DriverRef = {
    _id: EntityId;
    organizationId?: OrganizationRef;
    firstName?: string;
    lastName?: string;
    phone?: string;
    status?: string;
};

type DriverMappingRow = {
    vehicleId?: EntityId | VehicleRef;
    driverId?: EntityId | DriverRef;
    deviceId?: EntityId | GpsDeviceRef;
    organizationId?: OrganizationRef;
    assignedAt?: string;
    createdAt?: string;
};

type OrganizationOption = {
    _id: EntityId;
    name?: string;
    orgPath?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null;

const isPopulatedVehicle = (value: unknown): value is VehicleRef =>
    isRecord(value) && "vehicleNumber" in value;

const isPopulatedDriver = (value: unknown): value is DriverRef =>
    isRecord(value) && ("firstName" in value || "lastName" in value || "phone" in value);

const isPopulatedDevice = (value: unknown): value is GpsDeviceRef =>
    isRecord(value) && "imei" in value;

export default function DriverMappingPage() {
    // 🔐 ORG CONTEXT UPDATE
  const { role, isSuperAdmin, isRootOrgAdmin } = useOrgContext();

    const canFilterOrg = isSuperAdmin || isRootOrgAdmin;

    // API Hooks
    const { data: mappingData, isLoading: isMappingLoading, refetch: refetchMappings } = useGetVehicleDriverMappingsQuery(undefined, { refetchOnMountOrArgChange: true });
    const { data: vehData, isLoading: isVehLoading, refetch: refetchVehicles } = useGetVehiclesQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });
    const { data: driverData, isLoading: isDriverLoading, refetch: refetchDrivers } = useGetDriversQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });
    const { data: gpsData, isLoading: isGpsLoading } = useGetGpsDevicesQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });

    // 🔐 Superadmin + root admin can see scoped org list
    const { data: orgData, isLoading: isOrgLoading } = useGetOrganizationsQuery(undefined, {
        skip: !canFilterOrg,
        refetchOnMountOrArgChange: true
    });

    // Mutations
    const [assignDriver, { isLoading: isAssigning }] = useAssignDriverMutation();
    const [unassignDriver, { isLoading: isUnassigning }] = useUnassignDriverMutation();

    const mappings: DriverMappingRow[] = Array.isArray(mappingData?.data) ? (mappingData.data as DriverMappingRow[]) : [];
    const vehicles: VehicleRef[] = Array.isArray(vehData?.data) ? (vehData.data as VehicleRef[]) : [];
    const drivers: DriverRef[] = Array.isArray(driverData?.data) ? (driverData.data as DriverRef[]) : [];
    const gpsDevices: GpsDeviceRef[] = Array.isArray(gpsData?.data) ? (gpsData.data as GpsDeviceRef[]) : [];
    const organizations = useMemo(() => (orgData?.data as OrganizationOption[]) || [], [orgData]);

    // 🔐 ORG CONTEXT UPDATE

    const isAdminUser = role === "admin";
    const canAssign = isSuperAdmin || isAdminUser;
    const canUnassign = isSuperAdmin || isAdminUser;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [formData, setFormData] = useState({ vehicleId: "", driverId: "" });
    const [fieldErrors, setFieldErrors] = useState({ vehicleId: "", driverId: "" });
  const [modalOrgFilter, setModalOrgFilter] = useState(""); // 🔐 Organization filter for modal
    const [filters, setFilters] = useState({
        vehicleNumber: "",
        driverName: "",
        driverPhone: "",
        organizationId: "",
        assignedDate: "",
    });

    const getEntityId = (value: any) => {
        if (!value) return null;
        if (typeof value === "object") return value._id?.toString?.() || null;
        return value.toString?.() || null;
    };

    const assignedVehicleIds = new Set<string>(
        mappings
            .map((m) => getEntityId(m.vehicleId))
            .filter((id): id is string => Boolean(id)),
    );
    const assignedDriverIds = new Set<string>(
        mappings
            .map((m) => getEntityId(m.driverId))
            .filter((id): id is string => Boolean(id)),
    );

    const availableVehicles = useMemo(
        () => {
            // ✅ FIXED: Filter by both unassigned AND active status
            const unassignedVehicles = filterExcludedIds(vehicles || [], assignedVehicleIds);
            return unassignedVehicles.filter((v) => isActiveStatus(v.status) && v.deviceId);
        },
        [vehicles, assignedVehicleIds],
    );
    const availableDrivers = useMemo(
        () => {
            // ✅ FIXED: Filter by both unassigned AND active status
            const unassignedDrivers = filterExcludedIds(drivers || [], assignedDriverIds);
            return unassignedDrivers.filter((d) => isActiveStatus(d.status));
        },
        [drivers, assignedDriverIds],
    );

  // 🔐 Filter vehicles by selected organization in modal (for superadmin/rootOrgAdmin)
  const vehiclesByModalOrg = useMemo(() => {
    if (!modalOrgFilter) return availableVehicles;
    return availableVehicles.filter((v) => {
      const vehicleOrgId = typeof v.organizationId === "object"
        ? v.organizationId._id
        : v.organizationId;
      return vehicleOrgId === modalOrgFilter;
    });
  }, [availableVehicles, modalOrgFilter]);

  const selectedVehicle = useMemo(
    () => vehiclesByModalOrg.find((v) => v._id.toString() === formData.vehicleId) || null,
    [vehiclesByModalOrg, formData.vehicleId],
  );

    // 🔐 Filter drivers to only show those in the SAME organization as selected vehicle
    const driversBySelectedVehicleOrg = useMemo(() => {
        if (!selectedVehicle) return availableDrivers;

        const vehicleOrgId = typeof selectedVehicle.organizationId === "object"
            ? selectedVehicle.organizationId._id
            : selectedVehicle.organizationId;

    return availableDrivers.filter((d) => {
      const driverOrgId = typeof d.organizationId === "object"
        ? d.organizationId._id
        : d.organizationId;
      return driverOrgId === vehicleOrgId;
    });
  }, [selectedVehicle, availableDrivers]);

  const selectedDriver = useMemo(
    () => driversBySelectedVehicleOrg.find((d) => d._id.toString() === formData.driverId) || null,
    [driversBySelectedVehicleOrg, formData.driverId],
  );

  const selectedVehicleOrgName = useMemo(() => {
    if (!selectedVehicle) return "";

    if (typeof selectedVehicle.organizationId === "object" && selectedVehicle.organizationId?.name) {
      return selectedVehicle.organizationId.name;
    }

    const org = organizations.find((item) => item._id.toString() === String(selectedVehicle.organizationId || ""));
    return org?.name || "";
  }, [organizations, selectedVehicle]);

  const vehiclePickerOptions = useMemo(
    () =>
      vehiclesByModalOrg.map((vehicle: any) => {
        const orgName =
          typeof vehicle.organizationId === "object"
            ? vehicle.organizationId?.name
            : organizations.find((item) => item._id.toString() === String(vehicle.organizationId || ""))?.name;

        return {
          value: vehicle._id.toString(),
          label: vehicle.vehicleNumber || "Unknown Vehicle",
          description: vehicle.model || "Vehicle ready for driver mapping",
          meta: [orgName, vehicle.status].filter(Boolean).join(" | "),
          keywords: [
            vehicle.vehicleNumber || "",
            vehicle.model || "",
            orgName || "",
          ],
          badge: vehicle.status,
        };
      }),
    [organizations, vehiclesByModalOrg],
  );

  const driverPickerOptions = useMemo(
    () =>
      driversBySelectedVehicleOrg.map((driver: any) => ({
        value: driver._id.toString(),
        label: `${driver.firstName || ""} ${driver.lastName || ""}`.trim() || "Unnamed Driver",
        description: driver.phone || "Driver",
        meta: [driver.status, selectedVehicleOrgName].filter(Boolean).join(" | "),
        keywords: [
          driver.firstName || "",
          driver.lastName || "",
          driver.phone || "",
          driver.status || "",
        ],
        badge: driver.status,
      })),
    [driversBySelectedVehicleOrg, selectedVehicleOrgName],
  );

    const getMappedVehicle = (row: DriverMappingRow) => {
        const vehicle = row.vehicleId;
        if (isPopulatedVehicle(vehicle)) return vehicle;
        return vehicles.find((item) => item._id.toString() === vehicle) || null;
    };

    const getMappedDriver = (row: DriverMappingRow) => {
        const driver = row.driverId;
        if (isPopulatedDriver(driver)) return driver;
        return drivers.find((item) => item._id.toString() === driver) || null;
    };

    const getMappedDevice = (row: DriverMappingRow) => {
        const directDevice = row.deviceId;
        if (isPopulatedDevice(directDevice)) return directDevice;
        if (typeof directDevice === "string") {
            const foundDirect = gpsDevices.find((item) => item._id.toString() === directDevice);
            if (foundDirect) return foundDirect;
        }

        const vehicle = getMappedVehicle(row);
        const vehicleDevice = vehicle?.deviceId;
        if (isPopulatedDevice(vehicleDevice)) return vehicleDevice;
        return gpsDevices.find((item) => item._id.toString() === vehicleDevice) || null;
    };

    const getVehicleNumber = (row: DriverMappingRow) => getMappedVehicle(row)?.vehicleNumber || "";
    const getVehicleImei = (row: DriverMappingRow) => getMappedDevice(row)?.imei || "";

    const getDriverName = (row: DriverMappingRow) => {
        const driver = getMappedDriver(row);
        if (!driver) return "";
        return `${driver.firstName || ""} ${driver.lastName || ""}`.trim();
    };

    const getDriverPhone = (row: DriverMappingRow) => getMappedDriver(row)?.phone || "";

    const getOrganizationId = (row: DriverMappingRow) => {
        const directOrg = row.organizationId;
        if (directOrg && typeof directOrg === "object") return directOrg._id || "";
        if (typeof directOrg === "string") return directOrg;

        const vehicleOrg = getMappedVehicle(row)?.organizationId;
        if (vehicleOrg && typeof vehicleOrg === "object") return vehicleOrg._id || "";
        if (typeof vehicleOrg === "string") return vehicleOrg;

        const driverOrg = getMappedDriver(row)?.organizationId;
        if (driverOrg && typeof driverOrg === "object") return driverOrg._id || "";
        if (typeof driverOrg === "string") return driverOrg;

        return "";
    };

    const getOrganizationName = (row: DriverMappingRow) => {
        const directOrg = row.organizationId;
        if (directOrg && typeof directOrg === "object" && directOrg.name) return directOrg.name;

        const vehicleOrg = getMappedVehicle(row)?.organizationId;
        if (vehicleOrg && typeof vehicleOrg === "object" && vehicleOrg.name) return vehicleOrg.name;

        const driverOrg = getMappedDriver(row)?.organizationId;
        if (driverOrg && typeof driverOrg === "object" && driverOrg.name) return driverOrg.name;

        const orgId = getOrganizationId(row);
        const org = organizations.find((item) => item._id.toString() === orgId);
        return org?.name || "N/A";
    };

    const getAssignedDate = (row: DriverMappingRow) => {
        const date = row.assignedAt || row.createdAt;
        return date ? new Date(date).toISOString().split("T")[0] : "";
    };

    const filteredMappings = useMemo(() => {
        let filtered = mappings;

        if (filters.vehicleNumber) {
            filtered = filtered.filter((row: any) =>
                getVehicleNumber(row)
                    .toLowerCase()
                    .includes(filters.vehicleNumber.toLowerCase()),
            );
        }

        if (filters.driverName) {
            filtered = filtered.filter((row: any) =>
                getDriverName(row)
                    .toLowerCase()
                    .includes(filters.driverName.toLowerCase()),
            );
        }

        if (filters.driverPhone) {
            filtered = filtered.filter((row: any) =>
                getDriverPhone(row)
                    .toLowerCase()
                    .includes(filters.driverPhone.toLowerCase()),
            );
        }

        if (filters.organizationId) {
            filtered = filtered.filter(
                (row: any) => getOrganizationId(row) === filters.organizationId,
            );
        }

        if (filters.assignedDate) {
            filtered = filtered.filter(
                (row: any) => getAssignedDate(row) === filters.assignedDate,
            );
        }

        return filtered;
    }, [mappings, filters, vehicles, drivers, organizations]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 1. Duplicate click prevention is already handled by button disabling via isAssigning
        if (!formData.vehicleId || !formData.driverId) {
            setFieldErrors({
                vehicleId: formData.vehicleId ? "" : "Vehicle selection is required.",
                driverId: formData.driverId ? "" : "Driver selection is required.",
            });
            toast.error("Select both vehicle and driver");
            return;
        }

        try {
            // 🔐 Add organizationId if available for backend parity
            const response = await assignDriver({
                vehicleId: formData.vehicleId,
                driverId: formData.driverId,
                organizationId: selectedVehicle?.organizationId && typeof selectedVehicle.organizationId === "object"
                    ? selectedVehicle.organizationId._id
                    : selectedVehicle?.organizationId
            }).unwrap();

            // 1. Show success feedback
            toast.success(response?.message || "Driver assigned successfully");

            // 2. CLOSE MODAL IMMEDIATELY
            closeModal();

            // 3. SECURE DATA REFRESH
            void refetchMappings();
            void refetchVehicles();
            void refetchDrivers();

        } catch (err: unknown) {
            // 🔧 Log the raw error — never destructure to individual fields as RTK Query
            // error shapes vary (FetchBaseQueryError vs SerializedError vs plain Error)
            console.error("Driver Mapping Submit Error:", err);

            // 🔧 Robust extraction covering ALL RTK Query error shapes:
            //   { status, data: { message } }  — HTTP error
            //   { status: 'FETCH_ERROR', error }  — network error
            //   { status: 'PARSING_ERROR', ... }  — parse error
            //   { message }  — plain JS Error or SerializedError
            const errorMessage = getApiErrorMessage(err, "Assignment failed. Please check inputs.");

            // 🚀 UX FIX: If it's a conflict (already assigned), close modal since intent is satisfied
            const errStatus = (err as any)?.status;
            const errDataStatus = (err as any)?.data?.status;
            if (errStatus === 409 || errDataStatus === 409 || errorMessage.toLowerCase().includes("already assigned")) {
                toast.info(errorMessage);
                closeModal();
                void refetchMappings();
                return;
            }

            // Standard failure flow: keep modal open + show error toast
            toast.error(errorMessage);
        }
    };

    const handleUnassign = async (vehicleId: string) => {
        if (!canUnassign) {
            toast.error("You do not have permission to unassign drivers.");
            return;
        }
        if (confirm("Are you sure you want to unassign this driver?")) {
            try {
                await unassignDriver({ vehicleId }).unwrap();
                toast.success("Driver unassigned");
            } catch (err: any) {
                toast.error(err?.data?.message || "Unassignment failed");
            }
        }
    }

    const openCreateModal = () => {
        setFormData({ vehicleId: "", driverId: "" });
        setFieldErrors({ vehicleId: "", driverId: "" });
    setModalOrgFilter(""); // 🔐 Reset org filter when opening modal
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setFieldErrors({ vehicleId: "", driverId: "" });
    setModalOrgFilter(""); // 🔐 Reset org filter when closing modal
    };

    const clearFilters = () => {
        setFilters({
            vehicleNumber: "",
            driverName: "",
            driverPhone: "",
            organizationId: "",
            assignedDate: "",
        });
    };

    const columns = [
        {
            header: "Vehicle",
            accessor: (row: any) => getVehicleNumber(row) || "Unknown",
        },
        {
            header: "IMEI",
            accessor: (row: any) => getVehicleImei(row) || "N/A",
        },
        {
            header: "Driver",
            accessor: (row: any) => getDriverName(row) || "Unknown",
        },
        {
            header: "Organization",
            accessor: (row: any) => getOrganizationName(row),
        },
        {
            header: "Assigned Date",
            accessor: (row: any) => {
                const date = row.assignedAt || row.createdAt;
                return date ? new Date(date).toLocaleDateString() : "-";
            },
        },
        {
            header: "Actions", accessor: (row: any) => (
                <button
                    onClick={() => handleUnassign(row.vehicleId?._id || row.vehicleId)}
                    disabled={!canUnassign || isUnassigning}
                    className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 disabled:opacity-50"
                >
                    <Trash2 size={14} /> Unassign
                </button>
            )
        }
    ];

    const isLoading = isMappingLoading || isVehLoading || isDriverLoading || isGpsLoading || isOrgLoading;

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-slate-500" size={32} />
            </div>
        )
    }

    return (
        <ApiErrorBoundary hasError={false}>
            <AdminPageShell contentClassName="space-y-6">
                <AdminPageHeader
                    eyebrow="Operations"
                    title="Driver Mapping"
                    description="Associate active drivers with fleet vehicles using a touch-friendly assignment flow."
                    actions={<div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                        <ImportExportButton
                            moduleName="driverMapping"
                            importUrl="/importexport/import/drivermapping"
                            exportUrl="/importexport/export/drivermapping"
                            allowedFields={["vehicleNumber", "driverEmail"]}
                            requiredFields={["vehicleNumber", "driverEmail"]}
                            filters={{
                                vehicleNumber: filters.vehicleNumber,
                                driverName: filters.driverName,
                                driverPhone: filters.driverPhone,
                                organizationId: filters.organizationId,
                                assignedDate: filters.assignedDate,
                            }}
                            onCompleted={() => {
                                void refetchMappings();
                                void refetchVehicles();
                                void refetchDrivers();
                            }}
                        />
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <span className="inline-flex items-center gap-2"><Filter size={16} /> Filters</span>
                        </button>
                        <button
                            onClick={openCreateModal}
                            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-60"
                            disabled={!canAssign}
                        >
                            <span className="inline-flex items-center gap-2"><UserPlus size={16} /> Assign Driver</span>
                        </button>
                    </div>}
                />

                {showFilters && (
                    <AdminSectionCard title="Filter Mappings" description="Refine mapped driver records by vehicle, driver, organization, and date." bodyClassName="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Vehicle Number
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                                    value={filters.vehicleNumber}
                                    onChange={(e) => setFilters({ ...filters, vehicleNumber: e.target.value })}
                                    placeholder="Search vehicle"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Driver Name
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                                    value={filters.driverName}
                                    onChange={(e) => setFilters({ ...filters, driverName: e.target.value })}
                                    placeholder="Search driver"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Driver Phone
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                                    value={filters.driverPhone}
                                    onChange={(e) => setFilters({ ...filters, driverPhone: e.target.value })}
                                    placeholder="Search phone"
                                />
                            </div>
                            {/* 🔐 ORG CONTEXT UPDATE */}
                            {isSuperAdmin && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                        Organization
                                    </label>
                                    <select
                                        className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                                        value={filters.organizationId}
                                        onChange={(e) => setFilters({ ...filters, organizationId: e.target.value })}
                                    >
                                        <option value="">All Organizations</option>
                                        {organizations.map((org: any) => (
                                            <option key={org._id} value={org._id}>{org.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Assigned Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                                    value={filters.assignedDate}
                                    onChange={(e) => setFilters({ ...filters, assignedDate: e.target.value })}
                                />
                            </div>
                            <div className="sm:col-span-2 lg:col-span-3 flex items-end">
                                <button
                                    onClick={clearFilters}
                                    className="w-full bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        </div>
                    </AdminSectionCard>
                )}

                <AdminSectionCard
                    title="Mapped Drivers"
                    description="Operational table of current driver-to-vehicle assignments."
                    bodyClassName="p-0"
                >
                    <div className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                        <Table columns={columns} data={filteredMappings} loading={isLoading} />
                    </div>
                </AdminSectionCard>

                {isModalOpen && typeof document !== "undefined" && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-end justify-center p-2 sm:items-center sm:p-4">
                        <div
                            className="absolute inset-0 bg-slate-950/45 backdrop-blur-md"
                            onClick={closeModal}
                        />
                        <div className="mapping-modal relative flex max-h-[min(100dvh-1rem,80rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_25px_60px_rgba(15,23,42,0.25)] sm:rounded-[32px]">
                            <div className="flex items-start justify-between border-b border-slate-100 px-4 py-4 sm:px-8 sm:py-7">
                                <div>
                                    <h2 className="text-2xl font-black leading-[1.02] tracking-tight text-slate-900 sm:text-[40px]">Establish New Link</h2>
                                    <p className="mt-1 text-sm text-slate-500">Select assets below to create a real-time tracking association.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="mt-1 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="overflow-y-auto px-4 py-4 sm:px-8 sm:py-8">
                {/* 🔐 Optional organization filter for superadmin/root admin */}
                {canFilterOrg && organizations.length > 0 && (
                  <div className="mb-6">
                    <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                      <span className="inline-flex items-center gap-2">
                        <Briefcase size={12} className="text-indigo-500" /> Filter by Organization
                      </span>
                    </label>
                    <select
                      className="admin-select-readable w-full h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20"
                      value={modalOrgFilter}
                      onChange={(e) => {
                        const value = e.target.value;
                        setModalOrgFilter(value);
                        // Reset selections when organization filter changes
                        setFormData({ vehicleId: "", driverId: "" });
                        setFieldErrors({ vehicleId: "", driverId: "" });
                      }}
                    >
                      <option value="">All organizations (scoped)</option>
                      {organizations.map((org) => (
                        <option key={org._id.toString()} value={org._id.toString()}>
                          {org.orgPath ? `${org.orgPath} / ${org.name}` : org.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-11 md:items-end md:gap-5">
                                    <div className="md:col-span-5">
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                                            <span className="inline-flex items-center gap-2"><Car size={12} className="text-blue-500" /> Select Vehicle</span>
                                        </label>
                                        <SearchableEntitySelect
                                            value={formData.vehicleId}
                                            onChange={(value) => {
                                                setFormData({ ...formData, vehicleId: value, driverId: "" });
                                                setFieldErrors({ vehicleId: "", driverId: "" });
                                            }}
                                            options={vehiclePickerOptions}
                                            placeholder="Search vehicle by plate or model"
                                            searchPlaceholder="Search plate, model, or organization"
                                            emptyMessage="No available vehicles found. Vehicles must have a GPS device assigned first."
                                            invalid={Boolean(fieldErrors.vehicleId)}
                                        />
                                        {fieldErrors.vehicleId && (
                                            <p className="mt-1 text-[11px] font-semibold text-rose-600">
                                                {fieldErrors.vehicleId}
                                            </p>
                                        )}
                                    </div>

                                    <div className="hidden md:col-span-1 md:flex items-center justify-center pb-1">
                                        <div className="h-10 w-10 rounded-full border border-slate-200 bg-slate-50 text-slate-300 flex items-center justify-center">
                                            <ArrowRight size={16} />
                                        </div>
                                    </div>

                                    <div className="md:col-span-5">
                                        <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.25em] text-slate-400">
                                            <span className="inline-flex items-center gap-2"><User size={12} className="text-indigo-500" /> Select Driver</span>
                                        </label>
                                        <SearchableEntitySelect
                                            value={formData.driverId}
                                            onChange={(value) => {
                                                setFormData({ ...formData, driverId: value });
                                                setFieldErrors((prev) => ({ ...prev, driverId: "" }));
                                            }}
                                            options={driverPickerOptions}
                                            placeholder="Search driver by name or phone"
                                            searchPlaceholder="Search name, phone, or status"
                                            emptyMessage={
                                                selectedVehicle
                                                    ? "No available drivers found in this vehicle's organization."
                                                    : "Select a vehicle first to load available drivers."
                                            }
                                            disabled={!selectedVehicle}
                                            invalid={Boolean(fieldErrors.driverId)}
                                        />
                                        {fieldErrors.driverId && (
                                            <p className="mt-1 text-[11px] font-semibold text-rose-600">
                                                {fieldErrors.driverId}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-8 rounded-3xl border border-slate-200 bg-slate-50/80 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">
                                        Selected Summary
                                    </p>
                                    <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Vehicle</p>
                                            <p className="mt-1 text-sm font-bold text-slate-900">
                                                {selectedVehicle ? selectedVehicle.vehicleNumber : "Select Vehicle"}
                                            </p>
                                            <p className="mt-1 text-[11px] font-medium text-slate-500">
                                                {selectedVehicle?.model || "Awaiting selection"}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Driver</p>
                                            <p className="mt-1 text-sm font-bold text-slate-900">
                                                {selectedDriver ? `${selectedDriver.firstName || ""} ${selectedDriver.lastName || ""}`.trim() : "Select Driver"}
                                            </p>
                                            <p className="mt-1 text-[11px] font-medium text-slate-500">
                                                {selectedDriver?.phone || selectedDriver?.status || "Awaiting selection"}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Organization</p>
                                            <p className="mt-1 text-sm font-bold text-slate-900">
                                                {selectedVehicleOrgName || "Scoped selection"}
                                            </p>
                                            <p className="mt-1 text-[11px] font-medium text-slate-500">
                                                {modalOrgFilter ? "Filtered by selected organization" : "Uses current admin scope"}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {(availableVehicles.length === 0 || availableDrivers.length === 0) && (
                                    <div className="mt-4 text-[11px] font-semibold text-rose-500">
                                        {availableVehicles.length === 0 ? "No available vehicles found. Vehicles must have a GPS device assigned first. " : ""}
                                        {availableDrivers.length === 0 ? "No available drivers found." : ""}
                                    </div>
                                )}

                                <div className="mt-9 flex flex-col gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        className="px-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        Cancel Request
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={!canAssign || !formData.vehicleId || !formData.driverId || isAssigning}
                                        className="h-11 w-full rounded-2xl bg-slate-300 px-6 text-[11px] font-black uppercase tracking-[0.14em] text-white transition-colors disabled:cursor-not-allowed disabled:opacity-100 enabled:bg-slate-900 enabled:hover:bg-black sm:min-w-[245px] sm:w-auto"
                                    >
                                        {isAssigning ? "Processing..." : "Confirm Mapping Connection"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>,
                    document.body,
                )}
            </AdminPageShell>
        </ApiErrorBoundary>
    );
}
