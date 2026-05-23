"use client";

import { useMemo, useState } from "react";
import Table from "@/components/ui/Table";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

import {
    useGetGpsDevicesQuery,
    useCreateGpsDeviceMutation,
    useUpdateGpsDeviceMutation,
    useDeleteGpsDeviceMutation,
} from "@/redux/api/gpsDeviceApi";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";
import { InventoryLayer } from "@/components/gps-devices/InventoryLayer";
import { InventoryStatusBadge } from "@/components/gps-devices/InventoryStatusBadge";
import type { GpsDeviceRecord } from "@/components/gps-devices/inventoryTypes";
import { INVENTORY_STATUS_OPTIONS } from "@/components/gps-devices/inventoryTypes";

type OrganizationOption = {
    _id: string;
    name: string;
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
    if (
        typeof error === "object" &&
        error !== null &&
        "data" in error &&
        typeof (error as { data?: { message?: string } }).data?.message === "string"
    ) {
        return (error as { data: { message: string } }).data.message;
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return fallback;
};

export default function GpsDevicesPage() {
    const { data: devicesData, isLoading } = useGetGpsDevicesQuery({});
    const { data: orgsData } = useGetOrganizationsQuery({});
    const [createDevice] = useCreateGpsDeviceMutation();
    const [updateDevice] = useUpdateGpsDeviceMutation();
    const [deleteDevice] = useDeleteGpsDeviceMutation();

    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"overview" | "inventory" | "configuration" | "mapping">("overview");
    const [assignmentFilter, setAssignmentFilter] = useState<"all" | "assigned" | "unassigned">("all");
    const [searchTerm, setSearchTerm] = useState("");

    const devices: GpsDeviceRecord[] = useMemo(() => (devicesData?.data || devicesData?.docs || []), [devicesData]);
    const organizations: OrganizationOption[] = useMemo(() => (orgsData?.data || orgsData?.docs || []), [orgsData]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDevice, setEditingDevice] = useState<GpsDeviceRecord | null>(null);
    const [formData, setFormData] = useState({
        imei: "",
        simNumber: "",
        deviceModel: "",
        organizationId: "",
        status: "active",
        purchaseDate: "",
        purchasePrice: "",
        supplierName: "",
        invoiceNumber: "",
        stockLocation: "",
        rackNumber: "",
        inventoryStatus: "in_stock",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingDevice) {
                const {
                    purchaseDate,
                    purchasePrice,
                    supplierName,
                    invoiceNumber,
                    stockLocation,
                    rackNumber,
                    inventoryStatus,
                    ...technicalData
                } = formData;
                void purchaseDate;
                void purchasePrice;
                void supplierName;
                void invoiceNumber;
                void stockLocation;
                void rackNumber;
                void inventoryStatus;
                await updateDevice({ id: editingDevice._id, ...technicalData }).unwrap();
                toast.success("Device updated successfully");
            } else {
                const {
                    purchaseDate,
                    purchasePrice,
                    supplierName,
                    invoiceNumber,
                    stockLocation,
                    rackNumber,
                    inventoryStatus,
                    ...technicalData
                } = formData;

                await createDevice({
                    ...technicalData,
                    inventory: {
                        status: inventoryStatus || "in_stock",
                        purchaseDate: purchaseDate || null,
                        purchasePrice: purchasePrice ? Number(purchasePrice) : null,
                        supplierName: supplierName || "",
                        invoiceNumber: invoiceNumber || "",
                        stockLocation: stockLocation || "",
                        rackNumber: rackNumber || "",
                    },
                }).unwrap();
                toast.success("Device created successfully");
            }
            closeModal();
        } catch (error: unknown) {
            toast.error(getApiErrorMessage(error, "Failed to save device"));
        }
    };

    const openCreateModal = () => {
        setEditingDevice(null);
        setFormData({
            imei: "",
            simNumber: "",
            deviceModel: "",
            organizationId: "",
            status: "active",
            purchaseDate: "",
            purchasePrice: "",
            supplierName: "",
            invoiceNumber: "",
            stockLocation: "",
            rackNumber: "",
            inventoryStatus: "in_stock",
        });
        setIsModalOpen(true);
    };

    const openEditModal = (device: GpsDeviceRecord) => {
        setEditingDevice(device);
        const orgId = device.organizationId && typeof device.organizationId === 'object' ? device.organizationId._id : device.organizationId;
        setFormData({
            imei: device.imei,
            simNumber: device.simNumber || "",
            deviceModel: device.deviceModel || "",
            organizationId: orgId || "",
            status: device.status,
            purchaseDate: "",
            purchasePrice: "",
            supplierName: "",
            invoiceNumber: "",
            stockLocation: "",
            rackNumber: "",
            inventoryStatus: "in_stock",
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingDevice(null);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this device?")) {
            try {
                await deleteDevice(id).unwrap();
                toast.success("Device deleted");
            } catch (error: unknown) {
                toast.error(getApiErrorMessage(error, "Failed to delete device"));
            }
        }
    }

    const filteredDevices = useMemo(() => {
        const trimmed = searchTerm.trim().toLowerCase();
        return devices.filter((device) => {
            const isAssigned = Boolean(device.vehicleId);
            const matchesAssignment =
                assignmentFilter === "all" ||
                (assignmentFilter === "assigned" && isAssigned) ||
                (assignmentFilter === "unassigned" && !isAssigned);
            const matchesSearch = !trimmed || device.imei.toLowerCase().includes(trimmed);
            return matchesAssignment && matchesSearch;
        });
    }, [devices, assignmentFilter, searchTerm]);

    const columns = [
        {
            header: "IMEI",
            headerClassName: "min-w-[190px]",
            cellClassName: "min-w-[190px] whitespace-nowrap",
            accessor: (row: GpsDeviceRecord) => (
                <span className="block whitespace-nowrap font-mono text-xs text-slate-200">
                    {row.imei}
                </span>
            ),
        },
        {
            header: "SIM Number",
            headerClassName: "min-w-[140px]",
            cellClassName: "min-w-[140px] whitespace-nowrap",
            accessor: (row: GpsDeviceRecord) => row.simNumber || "-",
        },
        {
            header: "Status",
            headerClassName: "min-w-[110px]",
            cellClassName: "min-w-[110px] whitespace-nowrap",
            accessor: (row: GpsDeviceRecord) => (
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${row.vehicleId
                    ? 'border-amber-500/30 bg-amber-500/20 text-amber-200'
                    : 'border-slate-500/30 bg-slate-500/20 text-slate-200'
                    }`}>
                    {row.vehicleId ? 'Assigned' : 'Unassigned'}
                </span>
            )
        },
        {
            header: "Inventory",
            headerClassName: "min-w-[120px]",
            cellClassName: "min-w-[120px]",
            accessor: (row: GpsDeviceRecord) => (
                <InventoryStatusBadge device={row} variant="dark" compact />
            )
        },
        {
          header: "Organization",
          headerClassName: "min-w-[160px]",
          cellClassName: "min-w-[160px]",
          accessor: (row: GpsDeviceRecord) => (
            <span className="block max-w-[160px] break-words leading-5 text-slate-200">
                {row.organizationId && typeof row.organizationId === 'object' ? row.organizationId.name : "N/A"}
            </span>
          )
        },
        {
            header: "Actions",
            headerClassName: "min-w-[96px]",
            cellClassName: "min-w-[96px] whitespace-nowrap",
            accessor: (row: GpsDeviceRecord) => (
                <div className="flex gap-2">
                    <button onClick={() => router.push(`/superadmin/gps-devices/${row._id}`)} className="text-emerald-200 hover:text-emerald-100"><Eye size={16} /></button>
                    <button onClick={() => openEditModal(row)} className="text-slate-200 hover:text-white"><Edit size={16} /></button>
                    <button onClick={() => handleDelete(row._id)} className="text-rose-300 hover:text-rose-200"><Trash2 size={16} /></button>
                </div>
            )
        }
    ];

    return (
        <ApiErrorBoundary hasError={false}>
            <div className="space-y-6 pb-8 sm:space-y-8">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-1">
                        <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">
                            Hardware Oversight
                        </p>
                        <h1 className="text-3xl font-black tracking-tight text-slate-100">GPS Devices</h1>
                        <p className="text-sm font-medium text-slate-400">
                            Manage global GPS hardware inventory and organization allocation.
                        </p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-emerald-100 transition hover:bg-emerald-500/30"
                    >
                        <Plus size={16} />
                        Add New Device
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {([
                        { key: "overview", label: "Overview" },
                        { key: "inventory", label: "Inventory" },
                        { key: "configuration", label: "Configuration" },
                        { key: "mapping", label: "Mapping" },
                    ] as const).map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.22em] transition ${activeTab === tab.key
                                    ? "border border-emerald-500/30 bg-emerald-500/20 text-emerald-100"
                                    : "border border-slate-800/80 bg-slate-950/70 text-slate-400 hover:text-slate-200"
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {activeTab === "inventory" ? (
                    <InventoryLayer variant="dark" />
                ) : activeTab === "configuration" ? (
                    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6">
                            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-500">Configuration</p>
                            <h2 className="mt-2 text-2xl font-black text-slate-100">Device configuration stays in the current device CRUD flow</h2>
                            <p className="mt-3 text-sm text-slate-400">
                                The inventory layer is separate. Existing device create and edit modals still manage technical device fields without mixing inventory payloads.
                            </p>
                            <div className="mt-5 grid gap-3 md:grid-cols-2">
                                <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Overview keeps</p>
                                    <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-200">
                                        <li>IMEI and SIM metadata</li>
                                        <li>Model and organization</li>
                                        <li>Status and technical details</li>
                                        <li>Current create/edit behavior</li>
                                    </ul>
                                </div>
                                <div className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-4">
                                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Inventory adds</p>
                                    <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-200">
                                        <li>Lifecycle status tracking</li>
                                        <li>Supplier and invoice data</li>
                                        <li>Fault and repair notes</li>
                                        <li>Audit metadata</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6">
                            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-500">Quick Action</p>
                            <h3 className="mt-2 text-xl font-black text-slate-100">Return to Overview</h3>
                            <button
                                type="button"
                                onClick={() => setActiveTab("overview")}
                                className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-100 transition hover:bg-emerald-500/30"
                            >
                                Open Overview
                            </button>
                        </div>
                    </div>
                ) : activeTab === "mapping" ? (
                    <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6">
                            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-500">Mapping</p>
                            <h2 className="mt-2 text-2xl font-black text-slate-100">Existing mapping screens remain the source of assignment truth</h2>
                            <p className="mt-3 text-sm text-slate-400">
                                Inventory badges here only reflect backend state. Assignment and installation continue to be driven by mapping and TCP login.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6">
                            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-500">Open Mapping</p>
                            <Link
                                href="/superadmin/device-mapping"
                                className="mt-4 inline-flex rounded-xl border border-emerald-500/30 bg-emerald-500/20 px-4 py-2 text-xs font-black uppercase tracking-widest text-emerald-100 transition hover:bg-emerald-500/30"
                            >
                                Open Device Mapping
                            </Link>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4">
                            <div className="flex flex-wrap gap-2">
                                {(["all", "assigned", "unassigned"] as const).map((status) => (
                                    <button
                                        key={status}
                                        onClick={() => setAssignmentFilter(status)}
                                        className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest transition ${assignmentFilter === status
                                                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                                                : "border-slate-800/80 bg-slate-950/60 text-slate-400 hover:text-slate-200"
                                            }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                            <input
                                type="text"
                                placeholder="Search by IMEI..."
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                className="w-full max-w-xs rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30"
                            />
                        </div>

                        <Table columns={columns} data={filteredDevices} loading={isLoading} variant="dark" />
                    </>
                )}

                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-900/90 p-6 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.9)]">
                            <h2 className="text-xl font-black text-slate-100">{editingDevice ? "Edit Device" : "New Device"}</h2>
                            <p className="text-xs text-slate-400">Register IMEI and SIM details.</p>
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">IMEI</label>
                                    <input type="text" required className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                        value={formData.imei} onChange={e => setFormData({ ...formData, imei: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Organization</label>
                                    <select required className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                        value={formData.organizationId} onChange={e => setFormData({ ...formData, organizationId: e.target.value })}>
                                        <option value="">Select Organization</option>
                                        {organizations.map((org) => (
                                            <option key={org._id} value={org._id}>{org.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Device Model</label>
                                    <input type="text" required className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                        value={formData.deviceModel} onChange={e => setFormData({ ...formData, deviceModel: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">SIM Number</label>
                                    <input type="text" className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                        value={formData.simNumber} onChange={e => setFormData({ ...formData, simNumber: e.target.value })} />
                                </div>

                                {!editingDevice && (
                                    <>
                                        <div className="col-span-full border-t border-slate-800/80 pt-4">
                                            <p className="text-[11px] font-black uppercase tracking-[0.28em] text-slate-300">Inventory Information</p>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Purchase Date</label>
                                            <input type="date" className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                value={formData.purchaseDate} onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Purchase Price</label>
                                            <input type="number" min="0" step="0.01" className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                value={formData.purchasePrice} onChange={e => setFormData({ ...formData, purchasePrice: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Supplier Name</label>
                                            <input type="text" className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                value={formData.supplierName} onChange={e => setFormData({ ...formData, supplierName: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Invoice Number</label>
                                            <input type="text" className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                value={formData.invoiceNumber} onChange={e => setFormData({ ...formData, invoiceNumber: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Stock Location</label>
                                            <input type="text" className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                value={formData.stockLocation} onChange={e => setFormData({ ...formData, stockLocation: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Rack Number</label>
                                            <input type="text" className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                value={formData.rackNumber} onChange={e => setFormData({ ...formData, rackNumber: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Inventory Status</label>
                                            <select className="w-full rounded-xl border border-slate-800 bg-slate-950/60 p-2 text-sm font-semibold text-slate-100 outline-none focus:ring-2 focus:ring-emerald-500/30"
                                                value={formData.inventoryStatus} onChange={e => setFormData({ ...formData, inventoryStatus: e.target.value })}>
                                                {INVENTORY_STATUS_OPTIONS.map((status) => (
                                                    <option key={status} value={status}>
                                                        {status.replace("_", " ").replace(/\b\w/g, (char) => char.toUpperCase())}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </>
                                )}

                                <div className="flex gap-3 mt-6">
                                    <button type="button" onClick={closeModal} className="flex-1 rounded-xl border border-slate-800 bg-slate-950/70 py-2.5 text-[11px] font-black uppercase tracking-widest text-slate-200 hover:bg-slate-900">Cancel</button>
                                    <button type="submit" className="flex-1 rounded-xl bg-emerald-500/30 py-2.5 text-[11px] font-black uppercase tracking-widest text-emerald-100 hover:bg-emerald-500/40">Save</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </ApiErrorBoundary>
    );
}
