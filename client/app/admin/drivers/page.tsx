"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { Plus, Edit, Trash2, Filter, User, Phone, Mail, IdCard, Calendar, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
    useGetDriversQuery,
    useCreateDriverWithUserMutation,
    useUpdateDriverMutation,
    useDeleteDriverMutation,
} from "@/redux/api/driversApi";

import { useGetOrganizationsQuery, useGetSubOrganizationsQuery } from "@/redux/api/organizationApi";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";

import { usePopups } from "@/app/admin/Helpers/PopupContext";
import { capitalizeFirstLetter } from "@/app/admin/Helpers/CapitalizeFirstLetter";
import { DynamicModal } from "@/components/common";
import { FormField } from "@/lib/formTypes";
import AdminLoadingState from "@/components/admin/UI/AdminLoadingState";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";
// 🔐 ORG CONTEXT UPDATE
import { useOrgContext } from "@/hooks/useOrgContext";
import ImportExportButton from "@/components/admin/import-export/ImportExportButton";

export default function DriversPage() {
    const { openPopup, closePopup, isPopupOpen } = usePopups();
    const searchParams = useSearchParams();
    const searchQueryParam = searchParams.get("search");

    // 🔐 ORG CONTEXT UPDATE
    const { orgId, role, user, isSuperAdmin, isRootOrgAdmin, isSubOrgAdmin } = useOrgContext();
    const canUseImportExport = role === "admin" || role === "superadmin";
    const canSelectImportOrganization = isSuperAdmin || (role === "admin" && !user?.parentOrganizationId);

    const [showFilters, setShowFilters] = useState(!!searchQueryParam);
    const [page, setPage] = useState(1);
    const LIMIT = 10;

    // 🔐 ORG CONTEXT UPDATE
    const canCreateDriver = isSuperAdmin || isRootOrgAdmin || isSubOrgAdmin;
    const canEditDriver = isSuperAdmin || isRootOrgAdmin || isSubOrgAdmin;
    const canDeleteDriver = isSuperAdmin || isRootOrgAdmin;

    const [filters, setFilters] = useState({
        name: searchQueryParam || "",
        phone: "",
        licenseNumber: "",
        vehicleNumber: "",
        status: "",
        organizationId: "",
        startDate: "",
        endDate: "",
    });

    const [editingDriver, setEditingDriver] = useState<any>(null);

    const driverQueryParams = useMemo(() => ({
        page: page - 1,
        limit: LIMIT,
        name: filters.name || undefined,
        phone: filters.phone || undefined,
        licenseNumber: filters.licenseNumber || undefined,
        vehicleNumber: filters.vehicleNumber || undefined,
        status: filters.status || undefined,
        organizationId: filters.organizationId || undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
    }), [page, LIMIT, filters]);

    // API Hooks
    const { data: driversData, isLoading: isDriversLoading, refetch: refetchDrivers } = useGetDriversQuery(
        driverQueryParams,
        { refetchOnMountOrArgChange: true }
    );

    const { data: orgData, isLoading: isOrgLoading } = useGetOrganizationsQuery({ page: 0, limit: 1000 }, {
        skip: !(isSuperAdmin || isRootOrgAdmin),
        refetchOnMountOrArgChange: true
    });
    const { data: subOrgData, isLoading: isSubOrgLoading } = useGetSubOrganizationsQuery({ page: 0, limit: 1000 }, {
        skip: !((isSuperAdmin || isRootOrgAdmin) || isRootOrgAdmin),
        refetchOnMountOrArgChange: true
    });

    const { data: vehData, isLoading: isVehLoading } = useGetVehiclesQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });

    const [createDriver, { isLoading: isCreating }] = useCreateDriverWithUserMutation();
    const [updateDriver, { isLoading: isUpdating }] = useUpdateDriverMutation();
    const [deleteDriver, { isLoading: isDeleting }] = useDeleteDriverMutation();

    const drivers = useMemo(() => (driversData?.data as any[]) || [], [driversData]);
    const organizations = useMemo(() => {
        const rootOrgs = (orgData?.data as any[]) || [];
        const subOrgs = (subOrgData?.data as any[]) || [];
        const merged = new Map<string, any>();
        [...rootOrgs, ...subOrgs].forEach((org: any) => {
            if (org?._id) merged.set(org._id, org);
        });
        return Array.from(merged.values());
    }, [orgData, subOrgData]);
    const vehicles = useMemo(() => (vehData?.data as any[]) || [], [vehData]);

    useEffect(() => {
        setPage(1);
    }, [
        filters.name,
        filters.phone,
        filters.licenseNumber,
        filters.vehicleNumber,
        filters.status,
        filters.organizationId,
        filters.startDate,
        filters.endDate,
    ]);

    const handleSubmit = async (data: Record<string, string | number | boolean | File>) => {
        try {
            const payload: any = { ...data };
            // Vehicle assignment is managed only from Driver Mapping page for now.
            delete payload.assignedVehicleId;

            if (editingDriver) {
                // Exclude passwordHash on update
                delete payload.passwordHash;
                await updateDriver({ id: editingDriver._id, ...payload }).unwrap();
                toast.success("Driver updated successfully");
            } else {
                // 🔐 ORG CONTEXT UPDATE
                if (!(isSuperAdmin || isRootOrgAdmin)) {
                    payload.organizationId = orgId || "";
                }
                await createDriver(payload).unwrap();
                toast.success("Driver and user created successfully");
            }
            closeModal();
        } catch (err: unknown) {
            const error = err as { data?: { message?: string } };
            toast.error(error?.data?.message || "Operation failed");
            throw err;
        }
    };

    const driverFormFields: FormField[] = useMemo(() => [
        {
            name: "firstName",
            label: "First Name",
            type: "text" as const,
            required: true,
            placeholder: "John",
            icon: <User size={14} className="text-slate-500" />,
        },
        {
            name: "lastName",
            label: "Last Name",
            type: "text" as const,
            required: true,
            placeholder: "Doe",
            icon: <User size={14} className="text-slate-500" />,
        },
        {
            name: "email",
            label: "Email Address",
            type: "email" as const,
            required: true,
            placeholder: "driver@example.com",
            icon: <Mail size={14} className="text-slate-500" />,
        },
        {
            name: "phone",
            label: "Phone Number",
            type: "tel" as const,
            required: true,
            placeholder: "+1 234 567 890",
            helperText: "Include country code",
            icon: <Phone size={14} className="text-slate-500" />,
        },
        {
            name: "licenseNumber",
            label: "License Number",
            type: "text" as const,
            required: true,
            placeholder: "DL12345678",
            helperText: "Required",
            icon: <IdCard size={14} className="text-slate-500" />,
        },
        // Password only on creation
        ...(!editingDriver
            ? [
                {
                    name: "passwordHash",
                    label: "Password",
                    type: "password" as const,
                    required: true,
                    placeholder: "********",
                    icon: <CheckCircle size={14} className="text-slate-500" />,
                },
            ]
            : []),
        // 🔐 ORG CONTEXT UPDATE
        ...((isSuperAdmin || isRootOrgAdmin) && !editingDriver ? [
            {
                name: "organizationId",
                label: "Organization",
                type: "select" as const,
                required: true,
                groups: [
                    {
                        label: "Organizations",
                        options: organizations
                            .filter((org: any) => !org.parentOrganizationId)
                            .map((org: any) => ({
                                label: org.name,
                                value: org._id,
                            })),
                    },
                    {
                        label: "Sub-Organizations",
                        options: organizations
                            .filter((org: any) => org.parentOrganizationId)
                            .map((org: any) => ({
                                label: org.name,
                                value: org._id,
                            })),
                    },
                ],
                icon: <User size={14} className="text-slate-500" />,
            }
        ] : []),
        ...(editingDriver
            ? [
                {
                    name: "licenseExpiry",
                    label: "License Expiry",
                    type: "date" as const,
                    icon: <Calendar size={14} className="text-slate-500" />,
                },
                {
                    name: "status",
                    label: "Status",
                    type: "select" as const,
                    required: true,
                    options: [
                        { label: "Active", value: "active" },
                        { label: "Inactive", value: "inactive" },
                        { label: "Blocked", value: "blocked" },
                    ],
                    icon: <CheckCircle size={14} className="text-slate-500" />,
                },
            ]
            : []),
    ], [editingDriver, organizations, isSuperAdmin, isRootOrgAdmin]);

    const driverSchema = useMemo(() => {
        const base = z.object({
            firstName: z.string().min(1, "First name is required"),
            lastName: z.string().min(1, "Last name is required"),
            email: z.string().email("Valid email is required"),
            phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Enter valid phone with country code"),
            licenseNumber: z.string().min(1, "License number is required"),
            licenseExpiry: z.string().optional(),
            status: z.enum(["active", "inactive", "blocked"]).optional(),
            organizationId: z.string().optional(),
            passwordHash: z.string().optional(),
        });

        if (!editingDriver) {
            return base.extend({
                passwordHash: z.string().min(6, "Password is required (min 6)"),
            }).superRefine((val, ctx) => {
                if ((isSuperAdmin || isRootOrgAdmin) && !val.organizationId) {
                    ctx.addIssue({ code: "custom", path: ["organizationId"], message: "Organization is required" });
                }
            });
        }

        return base.superRefine((val, ctx) => {
            if (!val.status) {
                ctx.addIssue({ code: "custom", path: ["status"], message: "Status is required" });
            }
        });
    }, [editingDriver, isRootOrgAdmin, isSuperAdmin]);

    const openCreateModal = () => {
        setEditingDriver(null);
        openPopup("driverModal");
    };

    const openEditModal = (driver: any) => {
        setEditingDriver(driver);
        openPopup("driverModal");
    };

    const closeModal = () => {
        closePopup("driverModal");
        setEditingDriver(null);
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this driver?")) {
            try {
                await deleteDriver(id).unwrap();
                toast.success("Driver deleted");
            } catch (err: any) {
                toast.error(err?.data?.message || "Delete failed");
            }
        }
    };

    const clearFilters = () => {
        setFilters({
            name: "",
            phone: "",
            licenseNumber: "",
            vehicleNumber: "",
            status: "",
            organizationId: "",
            startDate: "",
            endDate: "",
        });
    };

    const columns = [
        {
            header: "Name",
            accessor: (row: any) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                        {row.firstName[0]}{row.lastName[0]}
                    </div>
                    <div>
                        <div className="font-semibold text-slate-900">{row.firstName} {row.lastName}</div>
                        <div className="text-[10px] text-slate-500">{row.email}</div>
                    </div>
                </div>
            ),
        },
        {
            header: "Contact",
            accessor: (row: any) => (
                <div className="flex flex-col">
                    <span className="text-xs font-medium text-slate-700">{row.phone}</span>
                    <span className="text-[10px] text-slate-500 font-mono">{row.licenseNumber}</span>
                </div>
            )
        },
        {
            header: "Organization",
            accessor: (row: any) => {
                if (typeof row.organizationId === "object" && row.organizationId?.name) {
                    return row.organizationId.name;
                }
                const orgId = typeof row.organizationId === 'object' ? row.organizationId?._id : row.organizationId;
                const org = organizations.find((o) => o._id === orgId);
                return org ? org.name : "N/A";
            },
        },
        {
            header: "Vehicle",
            accessor: (row: any) => {
                const vehicle = row.assignedVehicleId;
                if (!vehicle) return <span className="text-slate-400 text-xs font-medium italic">Unassigned</span>;
                if (typeof vehicle === 'object') return <span className="text-slate-700 text-xs font-bold">{vehicle.vehicleNumber}</span>;
                const v = vehicles.find((item: any) => item._id === vehicle);
                return <span className="text-slate-700 text-xs font-bold">{v?.vehicleNumber || "Unknown"}</span>;
            }
        },
        {
            header: "Status",
            accessor: (row: any) => (
                <span
                    className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${row.status === "active"
                        ? "bg-green-100 text-green-700"
                        : row.status === "blocked"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-700"
                        }`}
                >
                    {capitalizeFirstLetter(row.status || "active")}
                </span>
            ),
        },
        {
            header: "Actions",
            accessor: (row: any) => (
                <div className="flex gap-2">
                    {canEditDriver && (
                        <button
                            onClick={() => openEditModal(row)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                        >
                            <Edit size={16} />
                        </button>
                    )}
                    {canDeleteDriver && (
                        <button
                            onClick={() => handleDelete(row._id)}
                            className="text-red-500 hover:text-red-700 p-1"
                            disabled={isDeleting}
                        >
                            <Trash2 size={16} />
                        </button>
                    )}
                </div>
            ),
        },
    ];

    const isLoading = isDriversLoading || isOrgLoading || isSubOrgLoading || isVehLoading;
    const totalRecords =
        (driversData as any)?.pagination?.totalrecords ??
        (driversData as any)?.total ??
        drivers.length;
    const totalPages =
        (driversData as any)?.pagination?.totalPages ??
        Math.max(1, Math.ceil(totalRecords / LIMIT));

    if (isLoading) {
        return <AdminLoadingState title="Loading drivers" description="Preparing driver records, organization data, and filters." />;
    }

    return (
        <ApiErrorBoundary hasError={false}>
            <AdminPageShell contentClassName="space-y-6">
                <AdminPageHeader
                    eyebrow="Driver Operations"
                    title="Drivers"
                    description="Manage operators and driver profiles in your platform."
                    actions={<div className="flex flex-col gap-3 sm:flex-row">
                        {canUseImportExport && (
                            <ImportExportButton
                                moduleName="drivers"
                                importUrl="/importexport/import/drivers"
                                exportUrl="/importexport/export/drivers"
                                allowedFields={[
                                    "organizationName",
                                    "firstName",
                                    "lastName",
                                    "email",
                                    "phone",
                                    "licenseNumber",
                                    "licenseExpiry",
                                    "status",
                                    "password",
                                ]}
                                requiredFields={[
                                    "firstName",
                                    "lastName",
                                    "email",
                                    "phone",
                                    "licenseNumber",
                                    "password",
                                ]}
                                filters={{
                                    name: filters.name,
                                    phone: filters.phone,
                                    licenseNumber: filters.licenseNumber,
                                    status: filters.status,
                                    organizationId: filters.organizationId,
                                    from: filters.startDate,
                                    to: filters.endDate,
                                }}
                                onCompleted={() => {
                                    void refetchDrivers();
                                }}
                            />
                        )}
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                            <Filter size={16} /> Filtered Views
                        </button>
                        {canCreateDriver && (
                            <button
                                onClick={openCreateModal}
                                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
                            >
                                <Plus size={16} /> Add Driver
                            </button>
                        )}
                    </div>}
                />

                {showFilters && (
                    <AdminSectionCard title="Filter Drivers" description="Refine driver records by identity, dates, organization, and license data." bodyClassName="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Driver Name
                                </label>
                                <input
                                    className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    value={filters.name}
                                    onChange={(e) =>
                                        setFilters({ ...filters, name: e.target.value })
                                    }
                                    placeholder="Search name"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Phone
                                </label>
                                <input
                                    className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    value={filters.phone}
                                    onChange={(e) =>
                                        setFilters({ ...filters, phone: e.target.value })
                                    }
                                    placeholder="Search phone"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    License Number
                                </label>
                                <input
                                    className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    value={filters.licenseNumber}
                                    onChange={(e) =>
                                        setFilters({ ...filters, licenseNumber: e.target.value })
                                    }
                                    placeholder="Search license"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Vehicle Number
                                </label>
                                <input
                                    className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    value={filters.vehicleNumber}
                                    onChange={(e) =>
                                        setFilters({ ...filters, vehicleNumber: e.target.value })
                                    }
                                    placeholder="Search vehicle"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Status
                                </label>
                                <select
                                    className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    value={filters.status}
                                    onChange={(e) =>
                                        setFilters({ ...filters, status: e.target.value })
                                    }
                                >
                                    <option value="">All Status</option>
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                    <option value="blocked">Blocked</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    value={filters.startDate}
                                    onChange={(e) =>
                                        setFilters({ ...filters, startDate: e.target.value })
                                    }
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                                    value={filters.endDate}
                                    onChange={(e) =>
                                        setFilters({ ...filters, endDate: e.target.value })
                                    }
                                />
                            </div>

                            {(isSuperAdmin || isRootOrgAdmin) && (
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                                        Organization
                                    </label>
                                    <select
                                        className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold focus:ring-2 focus:ring-blue-500/20 outline-none"
                                        value={filters.organizationId}
                                        onChange={(e) =>
                                            setFilters({ ...filters, organizationId: e.target.value })
                                        }
                                    >
                                        <option value="">All Organizations</option>
                                        {organizations.map((org: any) => (
                                            <option key={org._id} value={org._id}>{org.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="flex items-end">
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
                    title="Driver Directory"
                    description="Operational list of drivers with actions, statuses, and pagination."
                    className="min-h-[420px]"
                    bodyClassName="flex min-h-[340px] flex-col justify-between gap-4 p-4"
                >
                    <Table columns={columns} data={drivers} loading={isLoading} />
                    <Pagination
                        page={page}
                        totalPages={totalPages}
                        totalItems={totalRecords}
                        onPageChange={setPage}
                        disabled={isDriversLoading}
                    />
                </AdminSectionCard>

                {canCreateDriver && (
                    <DynamicModal
                        isOpen={isPopupOpen("driverModal")}
                        onClose={closeModal}
                        title={editingDriver ? "Edit Driver" : "New Driver"}
                        description={editingDriver ? "Update driver information." : undefined}
                        fields={driverFormFields}
                        schema={driverSchema}
                        initialData={
                            editingDriver
                                ? {
                                    firstName: editingDriver.firstName,
                                    lastName: editingDriver.lastName,
                                    email: editingDriver.email,
                                    phone: editingDriver.phone,
                                    licenseNumber: editingDriver.licenseNumber,
                                    licenseExpiry: editingDriver.licenseExpiry
                                        ? new Date(editingDriver.licenseExpiry).toISOString().split('T')[0]
                                        : "",
                                    status: editingDriver.status,
                                }
                                : {
                                    organizationId: orgId || "",
                                }
                        }
                        onSubmit={handleSubmit}
                        submitLabel={editingDriver ? "Update Driver" : "Create Driver"}
                    />
                )}
            </AdminPageShell>
        </ApiErrorBoundary>
    );
}
