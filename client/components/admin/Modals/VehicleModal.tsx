"use client";
import React, { useEffect, useMemo } from "react";
import { X, Car, Hash, Truck, User, Phone, Image as ImageIcon, Briefcase } from "lucide-react";
import { Vehicle, IApiError } from "@/types";
import { useCreateVehicleMutation, useUpdateVehicleMutation } from "@/redux/api/vehicleApi";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";
import { useGetDriversQuery } from "@/redux/api/driversApi";
import { useGetGpsDevicesQuery } from "@/redux/api/gpsDeviceApi";
import { useAssignDeviceMutation, useUnassignDeviceByDetailsMutation } from "@/redux/api/deviceMappingApi";
import { useAssignDriverMutation, useUnassignDriverMutation } from "@/redux/api/vehicleDriverMappingApi";
import { useOrgContext } from "@/hooks/useOrgContext";
import { toast } from "sonner";
// 🔧 ACTIVE STATUS FILTERING
import { isActiveStatus } from "@/utils/mappingHelpers";
import Select from "react-select";
import { useForm, Controller } from "react-hook-form";

interface VehicleModalProps {
    isOpen: boolean;
    onClose: () => void;
    vehicle?: Vehicle | null;
    onCreated?: (vehicle: Vehicle) => void;
}

export default function VehicleModal({ isOpen, onClose, vehicle, onCreated }: VehicleModalProps) {
    const [createVehicle, { isLoading: isCreating }] = useCreateVehicleMutation();
    const [updateVehicle, { isLoading: isUpdating }] = useUpdateVehicleMutation();
    const [assignDevice] = useAssignDeviceMutation();
    const [unassignDeviceByDetails] = useUnassignDeviceByDetailsMutation();
    const [assignDriver] = useAssignDriverMutation();
    const [unassignDriver] = useUnassignDriverMutation();

    // Org context (single source of truth for roles/org)
    const { isSuperAdmin, isRootOrgAdmin, isSubOrgAdmin, orgId: contextOrgId, orgName } = useOrgContext();
    const canSelectOrg = isSuperAdmin || isRootOrgAdmin;

    // Organizations (only queried when selection allowed)
    const { data: orgsResponse, isLoading: isLoadingOrgs } = useGetOrganizationsQuery(undefined, {
        skip: !canSelectOrg,
    });
    const organizations = orgsResponse?.data || [];

    // Helper to normalize ID from populated object or plain string
    const getRefId = (value: any): string | null => {
        if (!value) return null;
        if (typeof value === "string") return value;
        if (typeof value === "object") return value._id || null;
        return null;
    };

    // React Hook Form
    const { register, handleSubmit, control, reset, watch } = useForm<any>({
        defaultValues: {
            vehicleType: vehicle?.vehicleType || "car",
            vehicleNumber: vehicle?.vehicleNumber || "",
            registrationNumber: vehicle?.registrationNumber || "",
            model: vehicle?.model || "",
            organizationId: vehicle ? (typeof vehicle.organizationId === "string" ? vehicle.organizationId : (vehicle as any).organizationId?._id || "") : (canSelectOrg ? "" : contextOrgId || ""),
            driverId: (vehicle as any)?.driverId || "",
            deviceId: (vehicle as any)?.deviceId || "",
            driverName: vehicle?.driverName || "",
            driverPhone: vehicle?.driverPhone || "",
            vehicleImage: vehicle?.vehicleImage || "",
            status: vehicle?.status || "active",
        },
    });

    // Watch selected org & device from the form
    const watchedOrgId = watch("organizationId");
    const watchedDeviceId = watch("deviceId");

    // effectiveOrgId used to scope driver/device queries and payload
    const effectiveOrgId = canSelectOrg ? (watchedOrgId || contextOrgId) : contextOrgId;

    // Drivers & Devices queries
    // Per rules: only send organizationId param when user is superadmin or root admin.
    const driversQueryArg = canSelectOrg ? (effectiveOrgId ? { organizationId: effectiveOrgId } : undefined) : undefined;
    const devicesQueryArg = canSelectOrg ? (effectiveOrgId ? { organizationId: effectiveOrgId } : undefined) : undefined;

    const { data: driversResponse, isLoading: isLoadingDrivers } = useGetDriversQuery(driversQueryArg, { skip: canSelectOrg && !effectiveOrgId });
    const { data: devicesResponse, isLoading: isLoadingDevices } = useGetGpsDevicesQuery(devicesQueryArg, { skip: canSelectOrg && !effectiveOrgId });

    const driverOptions = useMemo(() => {
        // ✅ FIXED: Filter drivers by active status only
        const activeDrivers = (driversResponse?.data || []).filter((d: any) => isActiveStatus(d.status));
        return activeDrivers.map((d: any) => ({ value: d._id, label: `${d.firstName} ${d.lastName || ""}`.trim() }));
    }, [driversResponse]);
    const deviceOptions = useMemo(() => {
        // ✅ FIXED: Filter devices by active status only
        const activeDevices = (devicesResponse?.data || []).filter((d: any) => isActiveStatus(d.status));
        return activeDevices.map((d: any) => ({ value: d._id, label: `${d.imei} - ${d.deviceModel}` }));
    }, [devicesResponse]);

    // When org changes (only applicable for selectors), reset driver/device fields
    useEffect(() => {
        // If user can select org and they change it, clear driver/device selections in the form
        if (canSelectOrg) {
            const current = watch();
            reset({ ...current, driverId: "", deviceId: "" });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [watchedOrgId]);

    if (!isOpen) return null;

    const onSubmit = async (data: any) => {
        // Determine organizationId for payload
        const orgForPayload = canSelectOrg ? (data.organizationId || contextOrgId) : contextOrgId;
        if (!orgForPayload) {
            toast.error("Organization is required");
            return;
        }

        const oldDeviceId = vehicle ? getRefId((vehicle as any).deviceId) : null;
        const oldDriverId = vehicle ? getRefId((vehicle as any).driverId) : null;
        const newDeviceId: string = data.deviceId || "";
        const newDriverId: string = data.driverId || "";

        // Business rule: driver can only be assigned if a device is mapped
        if (newDriverId && !(newDeviceId || oldDeviceId)) {
            toast.error("Assign a GPS device before assigning a driver.");
            return;
        }

        try {
            const payload: any = {
                organizationId: orgForPayload,
                vehicleType: data.vehicleType,
                vehicleNumber: data.vehicleNumber || data.registrationNumber,
                model: data.model,
                status: data.status,
            };
            if (data.driverId) payload.driverId = data.driverId;
            if (data.deviceId) payload.deviceId = data.deviceId;

            let vehicleId: string;
            let createdVehicle: any | null = null;

            if (vehicle) {
                await updateVehicle({ id: vehicle._id, ...payload }).unwrap();
                vehicleId = vehicle._id;
                toast.success("Vehicle updated successfully");
            } else {
                const created = await createVehicle(payload).unwrap();
                createdVehicle = created?.data || created;
                vehicleId = createdVehicle._id;
                if (createdVehicle && onCreated) onCreated(createdVehicle);
                toast.success("Vehicle created successfully");
            }

            // === Device Mapping orchestration ===
            if (vehicleId) {
                const effectiveOldDeviceId = oldDeviceId;
                const effectiveNewDeviceId = newDeviceId || "";

                if (effectiveNewDeviceId && effectiveNewDeviceId !== effectiveOldDeviceId) {
                    // Assign / reassign device
                    await assignDevice({ vehicleId, gpsDeviceId: effectiveNewDeviceId }).unwrap();
                } else if (!effectiveNewDeviceId && effectiveOldDeviceId) {
                    // Unassign existing device
                    await unassignDeviceByDetails({
                        vehicleId,
                        gpsDeviceId: effectiveOldDeviceId,
                    }).unwrap();
                }

                const currentDeviceId = effectiveNewDeviceId || effectiveOldDeviceId || "";

                // === Driver Mapping orchestration ===
                if (currentDeviceId) {
                    // Device is present, we can manage driver mapping
                    if (newDriverId && newDriverId !== oldDriverId) {
                        await assignDriver({ vehicleId, driverId: newDriverId }).unwrap();
                    } else if (!newDriverId && oldDriverId) {
                        await unassignDriver({ vehicleId }).unwrap();
                    }
                } else if (!currentDeviceId && oldDriverId && !newDriverId) {
                    // No device anymore: ensure any existing driver mapping is removed
                    await unassignDriver({ vehicleId }).unwrap();
                }
            }

            onClose();
        } catch (error: unknown) {
            const apiError = error as IApiError;
            const message = apiError?.data?.message || apiError?.message || "Failed to save vehicle";
            toast.error(message);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                    <div>
                        <h2 className="text-xl font-black text-gray-900">{vehicle ? "Edit Vehicle" : "Add New Vehicle"}</h2>
                        <p className="text-sm text-gray-500 font-medium tracking-tight">Enter vehicle and driver details</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors border border-transparent hover:border-gray-200 group">
                        <X size={20} className="text-gray-400 group-hover:text-gray-600" />
                    </button>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Vehicle Info */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mb-2">Vehicle Information</h3>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                    <Briefcase size={14} className="text-blue-500" />
                                    Organization
                                </label>
                                {canSelectOrg ? (
                                    isLoadingOrgs ? (
                                        <div className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
                                            Loading organizations...
                                        </div>
                                    ) : (
                                        <Controller
                                            control={control}
                                            name="organizationId"
                                            render={({ field }: any) => (
                                                <Select
                                                    {...field}
                                                    options={organizations.map((org: any) => ({ value: org._id, label: org.orgPath ? `${org.orgPath} / ${org.name}` : org.name }))}
                                                    isClearable={!vehicle}
                                                    placeholder="Select Organization"
                                                    styles={{ menu: (p) => ({ ...p, zIndex: 9999 }) }}
                                                    onChange={(opt: any) => field.onChange(opt ? opt.value : "")}
                                                    value={field.value ? { value: field.value, label: organizations.find((o: any) => o._id === field.value)?.orgPath ? `${organizations.find((o: any) => o._id === field.value)?.orgPath} / ${organizations.find((o: any) => o._id === field.value)?.name}` : organizations.find((o: any) => o._id === field.value)?.name } : null}
                                                />
                                            )}
                                        />
                                    )
                                ) : (
                                    <input
                                        type="text"
                                        readOnly
                                        className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-700 cursor-not-allowed"
                                        value={orgName || "Your Organization"}
                                    />
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                        <Truck size={14} className="text-blue-500" />
                                        Type
                                    </label>
                                    <select
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        {...register("vehicleType")}
                                    >
                                        <option value="car">Car</option>
                                        <option value="bus">Bus</option>
                                        <option value="truck">Truck</option>
                                        <option value="bike">Bike</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                        <Car size={14} className="text-blue-500" />
                                        Model
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                        placeholder="e.g. Camry 2023"
                                        {...register("model")}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                    <Hash size={14} className="text-blue-500" />
                                    Internal Vehicle #
                                </label>
                                <input
                                    required
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="V-001"
                                    {...register("vehicleNumber")}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                    <Hash size={14} className="text-blue-500" />
                                    Registration Number
                                </label>
                                <input
                                    type="text"
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                    placeholder="DL-01-AB-1234"
                                    {...register("registrationNumber")}
                                />
                            </div>
                        </div>

                        {/* Driver & Photo */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-green-600 mb-2">Driver & Appearance</h3>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                    <User size={14} className="text-green-500" />
                                    Assign Driver
                                </label>
                                {!effectiveOrgId ? (
                                    <input type="text" readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 cursor-not-allowed" value="Select organization first" />
                                ) : isLoadingDrivers ? (
                                    <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin" />
                                        Loading drivers...
                                    </div>
                                ) : (driversResponse?.data || []).length === 0 ? (
                                    <input type="text" readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 cursor-not-allowed" value="No drivers found for selected organization" />
                                ) : (
                                    <Controller
                                        control={control}
                                        name="driverId"
                                        render={({ field }: any) => (
                                            <Select
                                                {...field}
                                                options={driverOptions}
                                                onChange={(opt: any) => field.onChange(opt ? opt.value : "")}
                                                value={driverOptions.find((o: any) => o.value === field.value) || null}
                                                isClearable
                                                isDisabled={!(watchedDeviceId || (vehicle && getRefId((vehicle as any).deviceId)))}
                                            />
                                        )}
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                    <Briefcase size={14} className="text-green-500" />
                                    Assign GPS Device
                                </label>
                                {!effectiveOrgId ? (
                                    <input type="text" readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 cursor-not-allowed" value="Select organization first" />
                                ) : isLoadingDevices ? (
                                    <div className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-gray-300 border-t-green-500 rounded-full animate-spin" />
                                        Loading devices...
                                    </div>
                                ) : (devicesResponse?.data || []).length === 0 ? (
                                    <input type="text" readOnly className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-500 cursor-not-allowed" value="No devices found for selected organization" />
                                ) : (
                                    <Controller
                                        control={control}
                                        name="deviceId"
                                        render={({ field }: any) => (
                                            <Select
                                                {...field}
                                                options={deviceOptions}
                                                onChange={(opt: any) => field.onChange(opt ? opt.value : "")}
                                                value={deviceOptions.find((o: any) => o.value === field.value) || null}
                                                isClearable
                                            />
                                        )}
                                    />
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                    <User size={14} className="text-green-500" />
                                    Driver Name
                                </label>
                                <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all" placeholder="Dave Mattew" {...register("driverName")} />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                    <Phone size={14} className="text-green-500" />
                                    Driver Phone
                                </label>
                                <input type="tel" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all" placeholder="+91 98765 43210" {...register("driverPhone")} />
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-2">
                                    <ImageIcon size={14} className="text-green-500" />
                                    Vehicle Image URL
                                </label>
                                <input type="text" className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-gray-900 focus:ring-2 focus:ring-green-500/20 focus:border-green-500 outline-none transition-all" placeholder="https://example.com/car.jpg" {...register("vehicleImage")} />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4 mt-8 border-t border-gray-100 pt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-gray-50 transition-all font-inter"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            onClick={handleSubmit(onSubmit)}
                            disabled={isCreating || isUpdating}
                            className="flex-1 px-6 py-3.5 bg-blue-600 text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {(isCreating || isUpdating) ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : null}
                            {vehicle ? "Update Vehicle" : "Add Vehicle"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
