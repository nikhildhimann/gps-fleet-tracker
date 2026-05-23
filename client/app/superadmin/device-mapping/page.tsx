"use client";

import { useState } from "react";
import Table from "@/components/ui/Table";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { Link2, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  useGetDeviceMappingsQuery,
  useAssignDeviceMutation,
  useUnassignDeviceMutation,
} from "@/redux/api/deviceMappingApi";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";
import { useGetGpsDevicesQuery } from "@/redux/api/gpsDeviceApi";

interface VehicleMapping {
  _id: string;
  vehicleId: { _id: string; vehicleNumber: string; organizationId?: { name: string } } | null;
  gpsDeviceId: { _id: string; imei: string } | null;
  createdAt: string;
}

// Helper to filter items locally if API doesn't support 'available' filter
const isAvailable = (id: string, mappings: VehicleMapping[], field: 'vehicleId' | 'gpsDeviceId') => {
    return !mappings.some(m => m[field]?._id === id);
};

export default function DeviceMappingPage() {
    const { data: mappingsData, isLoading: isMappingsLoading } = useGetDeviceMappingsQuery({});
    const { data: vehiclesData, isLoading: isVehiclesLoading } = useGetVehiclesQuery({});
    const { data: devicesData, isLoading: isDevicesLoading } = useGetGpsDevicesQuery({});

    const [assignDevice] = useAssignDeviceMutation();
    const [unassignDevice] = useUnassignDeviceMutation();

    const mappings: VehicleMapping[] = mappingsData?.docs || [];
    const allVehicles = vehiclesData?.docs || [];
    const allDevices = devicesData?.docs || [];

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({ vehicleId: "", deviceId: "" });

    // Client-side filtering for available dropdowns
    // Note: Ideally backend should provide endpoints for /vehicles/available and /gps-devices/available
    // But for now we might need to rely on what lists we have.
    // Assuming GET /vehicles and GET /gps-devices return ALL items, we filter out those in mappings.
    const assignedVehicleIds = new Set(mappings.map(m => m.vehicleId?._id));
    const assignedDeviceIds = new Set(mappings.map(m => m.gpsDeviceId?._id));

    const availableVehicles = allVehicles.filter((v: any) => !assignedVehicleIds.has(v._id));
    // GPS devices usually have a 'status' or 'vehicleId' field we could check, 
    // but strictly checking against active mappings is safest here if we lack a specific "available" API param.
    // Also, the backend for GET /gps-devices might already support filtering, but let's do safe client-side filter
    const availableDevices = allDevices.filter((d: any) => !assignedDeviceIds.has(d._id)); // && d.status === 'active'

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.vehicleId || !formData.deviceId) {
            toast.error("Select both vehicle and device");
            return;
        }

        try {
            const vehicle = allVehicles.find((v: any) => v._id === formData.vehicleId);
            if (!vehicle) {
                 toast.error("Vehicle not found");
                 return;
            }

            const response = await assignDevice({
                vehicleId: formData.vehicleId,
                gpsDeviceId: formData.deviceId,
                organizationId: vehicle.organizationId // Required by backend
            }).unwrap();

            // 1. Show success feedback
            toast.success(response?.message || "Device assigned successfully");
            
            // 2. Immediate close
            closeModal();
            
        } catch (error: any) {
            // 🔧 Robust error extraction
            const errorMessage = 
                error?.message || 
                error?.data?.message || 
                (error?.status === "FETCH_ERROR" ? "Network error. Check server connection." : null) ||
                "Failed to assign device. Please check inputs.";

            console.error("Superadmin Mapping Error Info:", {
                message: error?.message,
                status: error?.status,
                data: error?.data,
                fullError: error
            });

            // 🚀 UX FIX: If it's a conflict (already assigned), close the modal
            if (error?.status === 409 || error?.data?.status === 409 || errorMessage.toLowerCase().includes("already assigned")) {
                toast.info(errorMessage);
                closeModal();
                // Note: Superadmin page might have its own refetch logic or dependencies
                return;
            }

            toast.error(errorMessage);
        }
    };

    const handleUnassign = async (mapping: VehicleMapping) => {
        if (confirm("Are you sure you want to unassign this device?")) {
            try {
                // Backend expects body with IDs
                 await unassignDevice({
                    vehicleId: mapping.vehicleId?._id,
                    gpsDeviceId: mapping.gpsDeviceId?._id,
                    organizationId: (mapping.vehicleId?.organizationId as any)?._id || (mapping.vehicleId as any)?.organizationId // Handling populated structure nuances
                 }).unwrap();
                toast.success("Device unassigned");
            } catch (error: any) {
                toast.error(error.data?.message || "Failed to unassign device");
            }
        }
    }

    const openCreateModal = () => {
        setFormData({ vehicleId: "", deviceId: "" });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
    };

    const columns = [
        { header: "Vehicle", accessor: (row: VehicleMapping) => row.vehicleId?.vehicleNumber || "Unknown" },
        { header: "Organization", accessor: (row: VehicleMapping) => (row.vehicleId?.organizationId as any)?.name || "N/A" },
        { header: "Device IMEI", accessor: (row: VehicleMapping) => row.gpsDeviceId?.imei || "Unknown" },
        { header: "Assigned Date", accessor: (row: VehicleMapping) => new Date(row.createdAt).toLocaleDateString() },
        {
            header: "Actions", accessor: (row: VehicleMapping) => (
                <button onClick={() => handleUnassign(row)} className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-widest text-rose-300 hover:text-rose-200">
                    <Trash2 size={14} /> Unassign
                </button>
            )
        }
    ];

    return (
        <ApiErrorBoundary hasError={false}>
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">Operations</p>
                        <h1 className="text-2xl font-black text-slate-100">Device Mapping</h1>
                        <p className="text-sm text-slate-400">Associate GPS devices with vehicles.</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-200 transition hover:bg-emerald-500/30"
                    >
                        <span className="inline-flex items-center gap-2"><Link2 size={16} /> Assign Device</span>
                    </button>
                </div>

            <Table columns={columns} data={mappings} loading={isMappingsLoading} variant="dark" />

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-900/90 p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.9)]">
                        <h2 className="text-xl font-black text-slate-100">Assign Device to Vehicle</h2>
                        <p className="text-xs text-slate-400">Link devices to vehicles in the fleet.</p>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Select Vehicle</label>
                                <select required className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    value={formData.vehicleId} onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}>
                                    <option value="">Select available vehicle...</option>
                                    {availableVehicles?.map((v: any) => (
                                        <option key={v._id} value={v._id}>{v.vehicleNumber} ({v.model})</option>
                                    ))}
                                </select>
                                {availableVehicles?.length === 0 && <p className="mt-1 text-xs font-semibold text-rose-300">No available vehicles found</p>}
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Select Device</label>
                                <select required className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                    value={formData.deviceId} onChange={e => setFormData({ ...formData, deviceId: e.target.value })}>
                                    <option value="">Select available device...</option>
                                    {availableDevices?.map((d: any) => (
                                        <option key={d._id} value={d._id}>{d.imei}</option>
                                    ))}
                                </select>
                                {availableDevices?.length === 0 && <p className="mt-1 text-xs font-semibold text-rose-300">No available devices found</p>}
                            </div>

                            <div className="flex gap-3 mt-6">
                                <button type="button" onClick={closeModal} className="flex-1 rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 text-[11px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-900">Cancel</button>
                                <button type="submit" disabled={!formData.vehicleId || !formData.deviceId} className="flex-1 rounded-xl bg-emerald-500/30 py-2.5 text-[11px] font-black uppercase tracking-widest text-emerald-100 hover:bg-emerald-500/40 disabled:opacity-50 disabled:cursor-not-allowed">Assign</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </ApiErrorBoundary>
    );
}
