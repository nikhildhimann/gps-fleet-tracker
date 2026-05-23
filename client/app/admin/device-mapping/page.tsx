"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Table from "@/components/ui/Table";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { Link2, Trash2, Loader2, Filter, Car, Cpu, ArrowRight, X, Briefcase } from "lucide-react";
import { toast } from "sonner";
import {
    useGetDeviceMappingsQuery,
    useAssignDeviceMutation,
    useUnassignDeviceMutation
} from "@/redux/api/deviceMappingApi";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";
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

interface Organization {
    _id: string;
    name: string;
    orgPath?: string;
}

interface Vehicle {
    _id: string;
    vehicleNumber: string;
    model?: string;
    vehicleType?: string;
    status?: string;
    organizationId: string | Organization;
}

interface Device {
    _id: string;
    imei: string;
    deviceModel?: string;
    simNumber?: string;
    connectionStatus?: string;
    status?: string;
    organizationId: string | Organization;
}

interface Mapping {
    _id: string;
    vehicleId: string | Vehicle;
    gpsDeviceId: string | Device;
    organizationId?: string | Organization;
    createdAt?: string;
    assignedAt?: string;
}

export default function DeviceMappingPage() {
    // 🔐 ORG CONTEXT UPDATE
  const { role, isSuperAdmin, isRootOrgAdmin } = useOrgContext();

    // API Hooks
    const { data: mappingData, isLoading: isMappingLoading, refetch: refetchMappings } = useGetDeviceMappingsQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });
    const { data: vehData, isLoading: isVehLoading, refetch: refetchVehicles } = useGetVehiclesQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });
    const { data: devData, isLoading: isDevLoading, refetch: refetchDevices } = useGetGpsDevicesQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });

    const canFilterOrg = isSuperAdmin || isRootOrgAdmin;

    // 🔐 Superadmin + root admin can see scoped org list
    const { data: orgData, isLoading: isOrgLoading } = useGetOrganizationsQuery(undefined, {
        skip: !canFilterOrg,
        refetchOnMountOrArgChange: true
    });

    // Mutations
    const [assignDevice, { isLoading: isAssigning }] = useAssignDeviceMutation();
    const [unassignDevice, { isLoading: isUnassigning }] = useUnassignDeviceMutation();

    const mappings = useMemo(() => (Array.isArray(mappingData?.data) ? (mappingData.data as Mapping[]) : []), [mappingData]);
    const vehicles = useMemo(() => (Array.isArray(vehData?.data) ? (vehData.data as Vehicle[]) : []), [vehData]);
    const devices = useMemo(() => (Array.isArray(devData?.data) ? (devData.data as Device[]) : []), [devData]);
    const organizations = useMemo(() => (orgData?.data as Organization[]) || [], [orgData]);

    const isAdminUser = role === "admin";

    // 🔐 ORG CONTEXT UPDATE
    const canAssign = isSuperAdmin || isAdminUser;
    const canUnassign = isSuperAdmin || isAdminUser;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showFilters, setShowFilters] = useState(false);
    const [formData, setFormData] = useState({ vehicleId: "", deviceId: "" });
    const [fieldErrors, setFieldErrors] = useState({ vehicleId: "", deviceId: "" });
    const [modalOrgFilter, setModalOrgFilter] = useState(""); // 🔐 Organization filter for modal
    const [filters, setFilters] = useState({
        vehicleNumber: "",
        imei: "",
        organizationId: "",
        assignedDate: "",
    });

    const getEntityId = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === "object") return value._id?.toString?.() || null;
        return value.toString?.() || null;
    };

    const assignedVehicleIds = useMemo(() => new Set<string>(
        mappings.map((m) => getEntityId(m.vehicleId)).filter((id): id is string => Boolean(id)),
    ), [mappings]);
    
    const assignedDeviceIds = useMemo(() => new Set<string>(
        mappings.map((m) => getEntityId(m.gpsDeviceId)).filter((id): id is string => Boolean(id)),
    ), [mappings]);

    const availableVehicles = useMemo(
        () => {
            const unassignedVehicles = filterExcludedIds(vehicles || [], assignedVehicleIds);
            return unassignedVehicles.filter((v: any) => isActiveStatus(v.status));
        },
        [vehicles, assignedVehicleIds],
    );
    const availableDevices = useMemo(
        () => {
            const unassignedDevices = filterExcludedIds(devices || [], assignedDeviceIds);
            return unassignedDevices.filter((d: any) => isActiveStatus(d.status));
        },
        [devices, assignedDeviceIds],
    );

    // 🔐 Filter vehicles by selected organization in modal (for superadmin/rootOrgAdmin)
    const vehiclesByModalOrg = useMemo(() => {
        if (!modalOrgFilter) return availableVehicles;
        return availableVehicles.filter((v: any) => {
            const vehicleOrgId = typeof v.organizationId === 'object'
                ? v.organizationId._id
                : v.organizationId;
            return vehicleOrgId === modalOrgFilter;
        });
    }, [availableVehicles, modalOrgFilter]);

    const selectedVehicle = useMemo(
        () => (vehiclesByModalOrg.find((v: any) => v._id === formData.vehicleId) as any) || null,
        [vehiclesByModalOrg, formData.vehicleId],
    );

    // 🔐 Filter devices to only show those in the SAME organization as selected vehicle
    const devicesBySelectedVehicleOrg = useMemo(() => {
        if (!selectedVehicle) return availableDevices;
        const vSelected = selectedVehicle as any;
        const vehicleOrgId = typeof vSelected.organizationId === 'object'
            ? vSelected.organizationId._id
            : vSelected.organizationId;

        return availableDevices.filter((d: any) => {
            const deviceOrgId = typeof d.organizationId === 'object'
                ? d.organizationId._id
                : d.organizationId;
            return deviceOrgId === vehicleOrgId;
        });
    }, [selectedVehicle, availableDevices]);

    const selectedDevice = useMemo(
        () => (devicesBySelectedVehicleOrg.find((d: any) => d._id === formData.deviceId) as any) || null,
        [devicesBySelectedVehicleOrg, formData.deviceId],
    );

    const selectedVehicleOrgName = useMemo(() => {
        if (!selectedVehicle) return "";

        if (typeof selectedVehicle.organizationId === "object" && selectedVehicle.organizationId?.name) {
            return selectedVehicle.organizationId.name;
        }

        const org = organizations.find((item: any) => item._id === selectedVehicle.organizationId);
        return org?.name || "";
    }, [organizations, selectedVehicle]);

    const vehiclePickerOptions = useMemo(
        () =>
            vehiclesByModalOrg.map((vehicle: any) => {
                const orgName =
                    typeof vehicle.organizationId === "object"
                        ? vehicle.organizationId?.name
                        : organizations.find((item: any) => item._id === vehicle.organizationId)?.name;

                return {
                    value: String(vehicle._id),
                    label: vehicle.vehicleNumber,
                    description: vehicle.model || vehicle.vehicleType || "Vehicle",
                    meta: [orgName, vehicle.status].filter(Boolean).join(" | "),
                    keywords: [
                        vehicle.vehicleNumber,
                        vehicle.model || "",
                        vehicle.vehicleType || "",
                        orgName || "",
                    ],
                    badge: vehicle.status,
                };
            }),
        [organizations, vehiclesByModalOrg],
    );

    const devicePickerOptions = useMemo(
        () =>
            devicesBySelectedVehicleOrg.map((device: any) => ({
                value: String(device._id),
                label: device.imei,
                description: device.deviceModel || "GPS Device",
                meta: [device.simNumber ? `SIM ${device.simNumber}` : "", device.connectionStatus, device.status]
                    .filter(Boolean)
                    .join(" | "),
                keywords: [
                    device.imei,
                    device.deviceModel || "",
                    device.simNumber || "",
                    device.connectionStatus || "",
                ],
                badge: device.connectionStatus || device.status,
            })),
        [devicesBySelectedVehicleOrg],
    );

    const getMappedVehicle = (row: any) => {
        const vehicle = row.vehicleId;
        if (vehicle && typeof vehicle === "object") return vehicle;
        return vehicles.find((item: any) => item._id === vehicle) || null;
    };

    const getMappedDevice = (row: any) => {
        const device = row.gpsDeviceId;
        if (device && typeof device === "object") return device;
        return devices.find((item: any) => item._id === device) || null;
    };

    const getVehicleNumber = (row: any) => {
        const vehicle = getMappedVehicle(row);
        return vehicle?.vehicleNumber || "";
    };

    const getDeviceImei = (row: any) => {
        const device = getMappedDevice(row);
        return device?.imei || "";
    };

    const getOrganizationId = (row: any) => {
        const directOrg = row.organizationId;
        if (directOrg && typeof directOrg === "object") return directOrg._id || "";
        if (typeof directOrg === "string") return directOrg;

        const vehicleOrg = getMappedVehicle(row)?.organizationId;
        if (vehicleOrg && typeof vehicleOrg === "object") return vehicleOrg._id || "";
        if (typeof vehicleOrg === "string") return vehicleOrg;

        const deviceOrg = getMappedDevice(row)?.organizationId;
        if (deviceOrg && typeof deviceOrg === "object") return deviceOrg._id || "";
        if (typeof deviceOrg === "string") return deviceOrg;

        return "";
    };

    const getOrganizationName = (row: any) => {
        const directOrg = row.organizationId;
        if (directOrg && typeof directOrg === "object" && directOrg.name) return directOrg.name;

        const vehicleOrg = getMappedVehicle(row)?.organizationId;
        if (vehicleOrg && typeof vehicleOrg === "object" && vehicleOrg.name) return vehicleOrg.name;

        const deviceOrg = getMappedDevice(row)?.organizationId;
        if (deviceOrg && typeof deviceOrg === "object" && deviceOrg.name) return deviceOrg.name;

        const orgId = getOrganizationId(row);
        const org = organizations.find((item: any) => item._id === orgId);
        return org?.name || "N/A";
    };

    const getAssignedDate = (row: any) => {
        const date = row.createdAt || row.assignedAt;
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

        if (filters.imei) {
            filtered = filtered.filter((row: any) =>
                getDeviceImei(row)
                    .toLowerCase()
                    .includes(filters.imei.toLowerCase()),
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
    }, [mappings, filters, vehicles, devices, organizations]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // 1. Duplicate click prevention is already handled by button disabling via isAssigning
        if (!formData.vehicleId || !formData.deviceId) {
            setFieldErrors({
                vehicleId: formData.vehicleId ? "" : "Vehicle selection is required.",
                deviceId: formData.deviceId ? "" : "Device selection is required.",
            });
            toast.error("Select both vehicle and device");
            return;
        }

        try {
            // 🔐 Include organization context from vehicle to ensure backend parity
            const response = await assignDevice({
                vehicleId: formData.vehicleId,
                gpsDeviceId: formData.deviceId,
                organizationId: selectedVehicle?.organizationId && typeof selectedVehicle.organizationId === "object" 
                    ? selectedVehicle.organizationId._id 
                    : selectedVehicle?.organizationId
            }).unwrap();

            // 1. Show success feedback
            toast.success(response?.message || "Device assigned successfully");
            
            // 2. CLOSE MODAL IMMEDIATELY
            closeModal();

            // 3. SECURE DATA REFRESH
            void refetchMappings();
            void refetchVehicles();
            void refetchDevices();
            
        } catch (err: unknown) {
            // 🔧 Log the raw error — never destructure to individual fields as RTK Query
            // error shapes vary (FetchBaseQueryError vs SerializedError vs plain Error)
            console.error("Device Mapping Submit Error:", err);

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

    const handleUnassign = async (id: string) => {
        if (!canUnassign) {
            toast.error("You do not have permission to unassign devices.");
            return;
        }
        if (confirm("Are you sure you want to unassign this device?")) {
            try {
                await unassignDevice(id).unwrap();
                toast.success("Device unassigned");
            } catch (err: any) {
                toast.error(err?.data?.message || "Unassignment failed");
            }
        }
    }

    const openCreateModal = () => {
        setFormData({ vehicleId: "", deviceId: "" });
        setFieldErrors({ vehicleId: "", deviceId: "" });
        setModalOrgFilter(""); // 🔐 Reset org filter when opening modal
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setFieldErrors({ vehicleId: "", deviceId: "" });
        setModalOrgFilter(""); // 🔐 Reset org filter when closing modal
    };

    const clearFilters = () => {
        setFilters({
            vehicleNumber: "",
            imei: "",
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
            header: "Organization",
            accessor: (row: any) => getOrganizationName(row),
        },
        {
            header: "Device IMEI",
            accessor: (row: any) => getDeviceImei(row) || "Unknown",
        },
        {
            header: "Assigned Date",
            accessor: (row: any) => {
                const date = row.createdAt || row.assignedAt;
                return date ? new Date(date).toLocaleDateString() : "-";
            },
        },
        {
            header: "Actions", accessor: (row: any) => (
                <button
                    onClick={() => handleUnassign(row._id)}
                    disabled={!canUnassign || isUnassigning}
                    className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-rose-600 hover:text-rose-700 disabled:opacity-50"
                >
                    <Trash2 size={14} /> Unassign
                </button>
            )
        }
    ];

    const isLoading = isMappingLoading || isVehLoading || isDevLoading || isOrgLoading;

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
                    title="Device Mapping"
                    description="Associate GPS devices with vehicles using responsive searchable selectors and a safer mobile flow."
                    actions={<div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
                        <ImportExportButton
                            moduleName="deviceMapping"
                            importUrl="/importexport/import/devicemapping"
                            exportUrl="/importexport/export/devicemapping"
                            allowedFields={["vehicleNumber", "imei"]}
                            requiredFields={["vehicleNumber", "imei"]}
                            filters={{
                                vehicleNumber: filters.vehicleNumber,
                                imei: filters.imei,
                                organizationId: filters.organizationId,
                                assignedDate: filters.assignedDate,
                            }}
                            onCompleted={() => {
                                void refetchMappings();
                                void refetchVehicles();
                                void refetchDevices();
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
                            <span className="inline-flex items-center gap-2"><Link2 size={16} /> Assign Device</span>
                        </button>
                    </div>}
                />

                {showFilters && (
                    <AdminSectionCard title="Filter Mappings" description="Refine mapped pairs by vehicle, device, organization, and date." bodyClassName="p-4">
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
                                    Device IMEI
                                </label>
                                <input
                                    className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                                    value={filters.imei}
                                    onChange={(e) => setFilters({ ...filters, imei: e.target.value })}
                                    placeholder="Search IMEI"
                                />
                            </div>
                            {/* 🔐 ORG CONTEXT UPDATE */}
                            {isSuperAdmin && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                        Organization
                                    </label>
                                    <select
                                        className="admin-select-readable w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
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
                            <div className="sm:col-span-2 lg:col-span-4">
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
                    title="Mapped Assets"
                    description="Operational table of current device-to-vehicle associations."
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
                                                setFormData({ vehicleId: "", deviceId: "" });
                                                setFieldErrors({ vehicleId: "", deviceId: "" });
                                            }}
                                        >
                                            <option value="">All organizations (scoped)</option>
                                            {organizations.map((org: any) => (
                                                <option key={org._id} value={org._id}>
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
                                                setFormData({ vehicleId: value, deviceId: "" });
                                                setFieldErrors({ vehicleId: "", deviceId: "" });
                                            }}
                                            options={vehiclePickerOptions}
                                            placeholder="Search vehicle by plate or model"
                                            searchPlaceholder="Search plate, model, or organization"
                                            emptyMessage="No available vehicles found for mapping."
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
                                            <span className="inline-flex items-center gap-2"><Cpu size={12} className="text-indigo-500" /> Select Device</span>
                                        </label>
                                        <SearchableEntitySelect
                                            value={formData.deviceId}
                                            onChange={(value) => {
                                                setFormData({ ...formData, deviceId: value });
                                                setFieldErrors((prev) => ({ ...prev, deviceId: "" }));
                                            }}
                                            options={devicePickerOptions}
                                            placeholder="Search device by IMEI or model"
                                            searchPlaceholder="Search IMEI, model, or SIM"
                                            emptyMessage={
                                                selectedVehicle
                                                    ? "No available devices found in this vehicle's organization."
                                                    : "Select a vehicle first to load available devices."
                                            }
                                            disabled={!selectedVehicle}
                                            invalid={Boolean(fieldErrors.deviceId)}
                                        />
                                        {fieldErrors.deviceId && (
                                            <p className="mt-1 text-[11px] font-semibold text-rose-600">
                                                {fieldErrors.deviceId}
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
                                                {selectedVehicle?.model || selectedVehicle?.vehicleType || "Awaiting selection"}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Device</p>
                                            <p className="mt-1 text-sm font-bold text-slate-900">
                                                {selectedDevice ? selectedDevice.imei : "Select Device"}
                                            </p>
                                            <p className="mt-1 text-[11px] font-medium text-slate-500">
                                                {selectedDevice?.deviceModel || selectedDevice?.connectionStatus || "Awaiting selection"}
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

                                {(availableVehicles.length === 0 || (selectedVehicle && devicesBySelectedVehicleOrg.length === 0)) && (
                                    <div className="mt-4 text-[11px] font-semibold text-rose-500">
                                        {availableVehicles.length === 0 ? "No available vehicles found. " : ""}
                                        {selectedVehicle && devicesBySelectedVehicleOrg.length === 0 ? "No available devices found in this vehicle's organization." : ""}
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
                                        disabled={!canAssign || !formData.vehicleId || !formData.deviceId || isAssigning}
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
