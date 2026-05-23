"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { Plus, Edit, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  useGetUsersQuery,
  useGetManagerByOrganizationQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} from "@/redux/api/usersApi";

import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";

import { usePopups } from "../Helpers/PopupContext";
// 🔐 ORG CONTEXT UPDATE
import { useOrgContext } from "@/hooks/useOrgContext";
import { capitalizeFirstLetter } from "../Helpers/CapitalizeFirstLetter";
import { DynamicModal } from "@/components/common";
import { FormField } from "@/lib/formTypes";
import AdminLoadingState from "@/components/admin/UI/AdminLoadingState";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";

import ImportExportButton from "@/components/admin/import-export/ImportExportButton";
import {
  User as UserIcon,
  Mail,
  Phone,
  Lock,
  ShieldCheck,
  ToggleRight,
  Building2,
} from "lucide-react";

export interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  role: "admin" | "superadmin" | "driver";
  organizationId?: string | { _id: string; name: string };
  status: "active" | "inactive";
}

type UserRoleOption = {
  label: string;
  value: "admin" | "driver";
};

type UserFormValues = Record<string, string | number | boolean | File>;

export default function UsersPage() {
  const { openPopup, closePopup, isPopupOpen } = usePopups();

  // 🔐 ORG CONTEXT UPDATE
  const { user, orgId, orgName, isSuperAdmin, isRootOrgAdmin, isSubOrgAdmin } = useOrgContext();
  const searchParams = useSearchParams();
  const searchQueryParam = searchParams.get("search");

  const [showFilters, setShowFilters] = useState(!!searchQueryParam);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  // 🔐 ORG CONTEXT UPDATE
  const canCreateUser = isSuperAdmin || isRootOrgAdmin || isSubOrgAdmin;
  const canEditUser = isSuperAdmin || isRootOrgAdmin || isSubOrgAdmin;
  const canDeleteUser = isSuperAdmin || isRootOrgAdmin;

  const [filters, setFilters] = useState({
    name: searchQueryParam || "",
    email: "",
    mobile: "",
    role: "",
    status: "",
    organizationId: "",
    organizationName: "",
    startDate: "",
    endDate: "",
  });

  const [editingUser, setEditingUser] = useState<User | null>(null);

  // API Hooks - Conditionally fetch users
  // If organizationId filter is set, use the dedicated endpoint
  // Otherwise, fetch all users (for superadmin)
  const usersQueryParams = useMemo(
    () => ({
      page: page - 1,
      limit: LIMIT,
      name: filters.name || undefined,
      email: filters.email || undefined,
      mobile: filters.mobile || undefined,
      role: filters.role || undefined,
      status: filters.status || undefined,
      organizationId: filters.organizationId || undefined,
      organizationName: filters.organizationName || undefined,
      from: filters.startDate || undefined,
      to: filters.endDate || undefined,
      roles: isRootOrgAdmin ? "admin,driver" : undefined,
      excludeUserId: isRootOrgAdmin ? user?._id : undefined,
    }),
    [LIMIT, page, filters, isRootOrgAdmin, user?._id],
  );

  const { data: usersData, isLoading: isUsersLoading, refetch: refetchUsers } = useGetUsersQuery(
    usersQueryParams,
    {
      skip: !!filters.organizationId, // Skip if filtering by org
      refetchOnMountOrArgChange: true,
    },
  );

  const { data: orgUsersData, isLoading: isOrgUsersLoading, refetch: refetchOrgUsers } =
    useGetManagerByOrganizationQuery(usersQueryParams, {
      skip: !filters.organizationId, // Skip if NOT filtering by org
      refetchOnMountOrArgChange: true,
    });

  const { data: orgData, isLoading: isOrgLoading } =
    useGetOrganizationsQuery({ page: 0, limit: 1000 }, {
      refetchOnMountOrArgChange: true,
    });

  const [createUser, { isLoading: isCreating }] = useCreateUserMutation();
  const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteUserMutation();

  // Use organization-specific data if filtering, otherwise use all users
  const users = useMemo(
    () =>
      filters.organizationId
        ? (orgUsersData?.data as User[]) || []
        : (usersData?.data as User[]) || [],
    [usersData, orgUsersData, filters.organizationId],
  );

  const organizations = useMemo(
    () => (orgData?.data as { _id: string; name: string }[]) || [],
    [orgData],
  );

  const organizationAdmin = useMemo(
    () => users.find((u) => u.role === "admin"),
    [users],
  );

  const availableRoleOptions = useMemo<UserRoleOption[]>(() => {
    if (isSuperAdmin || isRootOrgAdmin) {
      return [
        { label: "Admin", value: "admin" },
        { label: "Driver", value: "driver" },
      ];
    }

    return [{ label: "Driver", value: "driver" }];
  }, [isRootOrgAdmin, isSuperAdmin]);

  useEffect(() => {
    setPage(1);
  }, [
    filters.name,
    filters.email,
    filters.mobile,
    filters.role,
    filters.status,
    filters.organizationId,
    filters.organizationName,
    filters.startDate,
    filters.endDate,
  ]);


  const handleSubmit = async (data: UserFormValues) => {
    try {
      if (editingUser) {
        // For update, only send allowed fields: firstName, lastName, email, mobile, status
        const updatePayload = {
          id: editingUser._id,
          firstName: data.firstName?.toString().trim(),
          lastName: data.lastName?.toString().trim(),
          email: data.email?.toString().trim().toLowerCase(),
          mobile: data.mobile?.toString().trim(),
          status: data.status
        };
        
        await updateUser(updatePayload).unwrap();
        toast.success("User updated successfully");
      } else {
        const createPayload = {
          firstName: data.firstName?.toString().trim(),
          lastName: data.lastName?.toString().trim(),
          email: data.email?.toString().trim().toLowerCase(),
          mobile: data.mobile?.toString().trim(),
          role: data.role,
          organizationId: data.organizationId,
          status: data.status,
          password: data.password,
        };
        
        if (!isSuperAdmin) {
          createPayload.organizationId = orgId || "";
        }
        
        await createUser(createPayload).unwrap();
        toast.success("User created successfully");
      }
    } catch (err: unknown) {
      const error = err as { data?: { message?: string } };
      toast.error(error?.data?.message || "Operation failed");
      throw err; // re-throw so DynamicModal keeps the form open and shows inline error
    }
  };

  const userFormFields: FormField[] = useMemo(() => [
    ...(!editingUser
      ? [
          {
            name: "organizationId",
            label: "Organization",
            type: "select" as const,
            required: true,
            options: isSuperAdmin
              ? organizations.map((org) => ({
                  label: org.name,
                  value: org._id,
                }))
              : orgId
                ? [{ label: orgName || "Current Organization", value: orgId }]
                : [],
            helperText: isSuperAdmin
              ? "Select the organization that this user should belong to."
              : "This user will be created inside your current organization.",
            disabled: !isSuperAdmin,
            icon: <Building2 size={14} className="text-slate-500" />,
          },
        ]
      : []),
    {
      name: "firstName",
      label: "First Name",
      type: "text",
      required: true,
      placeholder: "John",
      icon: <UserIcon size={14} className="text-slate-500" />,
    },
    {
      name: "lastName",
      label: "Last Name",
      type: "text",
      required: true,
      placeholder: "Doe",
      icon: <UserIcon size={14} className="text-slate-500" />,
    },
    {
      name: "email",
      label: "Email Address",
      type: "email",
      required: true,
      placeholder: "john@example.com",
      icon: <Mail size={14} className="text-slate-500" />,
    },
    {
      name: "mobile",
      label: "Mobile Number",
      type: "tel",
      required: true,
      placeholder: "+1 234 567 890",
      helperText: "Include country code",
      icon: <Phone size={14} className="text-slate-500" />,
    },
    // Password only on creation
    ...(!editingUser
      ? [
        {
          name: "password",
          label: "Password",
          type: "password" as const,
          required: true,
          placeholder: "********",
          icon: <Lock size={14} className="text-slate-500" />,
        },
        {
          name: "confirmPassword",
          label: "Confirm Password",
          type: "password" as const,
          required: true,
          placeholder: "Re-enter password",
          helperText: "Must match the password above",
          icon: <Lock size={14} className="text-slate-500" />,
        },
      ]
      : []),
    ...(!editingUser
      ? [
          {
            name: "role",
            label: "Role",
            type: "select" as const,
            required: true,
            options: availableRoleOptions,
            icon: <ShieldCheck size={14} className="text-slate-500" />,
          },
          {
            name: "status",
            label: "Status",
            type: "select" as const,
            required: true,
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
            icon: <ToggleRight size={14} className="text-slate-500" />,
          },
        ]
      : [
          {
            name: "status",
            label: "Status",
            type: "select" as const,
            required: true,
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
            icon: <ToggleRight size={14} className="text-slate-500" />,
          },
        ]),
  ], [availableRoleOptions, editingUser, isSuperAdmin, orgId, orgName, organizations]);

  const userSchema = useMemo(() => {
    const base = z.object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required"),
      email: z.string().email("Valid email is required"),
      mobile: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Enter valid mobile with country code"),
      role: z.enum(["admin", "driver"]).optional(),
      status: z.enum(["active", "inactive"]).optional(),
      organizationId: z.string().optional(),
      password: z.string().optional(),
      confirmPassword: z.string().optional(),
    });

    if (!editingUser) {
      return base.extend({
        role: z.enum(
          availableRoleOptions.map((option) => option.value) as ["admin" | "driver", ...("admin" | "driver")[]],
        ),
        status: z.enum(["active", "inactive"]),
        password: z.string().min(6, "Password must be at least 6 characters"),
        confirmPassword: z.string().min(6, "Confirm password is required"),
      }).superRefine((val, ctx) => {
        if (isSuperAdmin && !val.organizationId) {
          ctx.addIssue({ code: "custom", path: ["organizationId"], message: "Organization is required" });
        }

        if (val.password !== val.confirmPassword) {
          ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
        }
      });
    }

    return base.superRefine((val, ctx) => {
      if (!val.status) {
        ctx.addIssue({ code: "custom", path: ["status"], message: "Status is required" });
      }
    });
  }, [availableRoleOptions, editingUser, isSuperAdmin]);

  const openCreateModal = () => {
    setEditingUser(null);
    openPopup("userModal");
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    openPopup("userModal");
  };

  const closeModal = () => {
    closePopup("userModal");
    setEditingUser(null);
  };

  const handleDelete = async (id: string) => {
    const user = users.find((u) => u._id === id);
    if (user?.role === "superadmin") {
      toast.error("Cannot delete SuperAdmin user");
      return;
    }
    if (confirm("Are you sure you want to delete this user?")) {
      try {
        await deleteUser(id).unwrap();
        toast.success("User deleted");
      } catch (err: unknown) {
        const error = err as { data?: { message?: string } };
        toast.error(error?.data?.message || "Delete failed");
      }
    }
  };

  const clearFilters = () => {
    setFilters({
      name: "",
      email: "",
      mobile: "",
      role: "",
      status: "",
      organizationId: "",
      organizationName: "",
      startDate: "",
      endDate: "",
    });
  };

  const columns = [
    {
      header: "Name",
      accessor: (row: any) => `${row.firstName} ${row.lastName}`,
    },
    { header: "Email", accessor: "email" },
    { header: "Mobile", accessor: "mobile" },
    {
      header: "Role",
      accessor: (row: any) => (
        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-slate-700">
          {capitalizeFirstLetter(row.role)}
        </span>
      ),
    },
    {
      header: "Organization",
      accessor: (row: any) => {
        if (!row.organizationId) return "Global";
        if (typeof row.organizationId === "object")
          return row.organizationId.name;
        const org = organizations.find((o) => o._id === row.organizationId);
        return org?.name || "Unknown";
      },
    },
    {
      header: "Status",
      accessor: (row: any) => (
        <span
          className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${row.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
        >
          {capitalizeFirstLetter(row.status || "active")}
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: (row: any) => (
        <div className="flex gap-2">
          {canEditUser && (
            <button
              onClick={() => openEditModal(row)}
              className="text-slate-700 hover:text-slate-900"
            >
              <Edit size={16} />
            </button>
          )}
          {canDeleteUser &&
            !isCreating &&
            !isUpdating &&
            !isDeleting &&
            row.role !== "superadmin" && (
              <button
                onClick={() => handleDelete(row._id)}
                className="text-rose-600 hover:text-rose-700"
              >
                <Trash2 size={16} />
              </button>
            )}
        </div>
      ),
    },
  ];

  const isLoading = isUsersLoading || isOrgUsersLoading || isOrgLoading;
  const activeData = filters.organizationId ? orgUsersData : usersData;
  const totalRecords =
    (activeData as any)?.pagination?.totalrecords ??
    (activeData as any)?.total ??
    users.length;
  const totalPages =
    (activeData as any)?.pagination?.totalPages ??
    Math.max(1, Math.ceil(totalRecords / LIMIT));

  if (isLoading) {
    return <AdminLoadingState title="Loading users" description="Preparing role, organization, and access records." />;
  }

  return (
    <ApiErrorBoundary hasError={false}>
      <AdminPageShell contentClassName="space-y-6">
        <AdminPageHeader
          eyebrow="Access Control"
          title="Users"
          description="Manage admin and driver access across organizations."
          actions={<div className="flex flex-col gap-3 sm:flex-row">
            <ImportExportButton
              moduleName="users"
              importUrl="/importexport/import/users"
              exportUrl="/importexport/export/users"
              allowImport={false}
              allowExport={true}
              allowedFields={[
                "organizationName",
                "firstName",
                "lastName",
                "email",
                "mobile",
                "role",
                "status",
                "password",
              ]}
              requiredFields={[
                "firstName",
                "email",
                "mobile",
                "role",
                "password",
              ]}
              filters={{
                name: filters.name,
                email: filters.email,
                mobile: filters.mobile,
                role: filters.role,
                status: filters.status,
                organizationId: filters.organizationId,
                from: filters.startDate,
                to: filters.endDate,
              }}
              onCompleted={() => {
                void refetchUsers();
                void refetchOrgUsers();
              }}
            />
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <span className="inline-flex items-center gap-2">
                <Filter size={16} /> Filter Users
              </span>
            </button>
            {canCreateUser && (
              <button
                onClick={openCreateModal}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-white shadow-sm transition hover:bg-blue-700"
              >
                <span className="inline-flex items-center gap-2">
                  <Plus size={16} /> Add User
                </span>
              </button>
            )}
          </div>}
        />

        {showFilters && (
          <AdminSectionCard title="Filter Users" description="Refine user records by identity, organization, role, status, and dates." bodyClassName="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Name
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                  value={filters.name}
                  onChange={(e) =>
                    setFilters({ ...filters, name: e.target.value })
                  }
                  placeholder="Search name"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Email
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                  value={filters.email}
                  onChange={(e) =>
                    setFilters({ ...filters, email: e.target.value })
                  }
                  placeholder="Search email"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Mobile
                </label>
                <input
                  className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                  value={filters.mobile}
                  onChange={(e) =>
                    setFilters({ ...filters, mobile: e.target.value })
                  }
                  placeholder="Search mobile"
                />
              </div>
              {/* 🔐 ORG CONTEXT UPDATE */}
              {/* Organization Name Text Search - visible for all admins */}
              {(isSuperAdmin || isRootOrgAdmin) && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Organization Name
                  </label>
                  <input
                    className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                    value={filters.organizationName}
                    onChange={(e) =>
                      setFilters({ ...filters, organizationName: e.target.value })
                    }
                    placeholder="Search by organization"
                  />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Role
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                  value={filters.role}
                  onChange={(e) =>
                    setFilters({ ...filters, role: e.target.value })
                  }
                >
                  <option value="">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="driver">Driver</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Status
                </label>
                <select
                  className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                >
                  <option value="">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
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
                  className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                  value={filters.endDate}
                  onChange={(e) =>
                    setFilters({ ...filters, endDate: e.target.value })
                  }
                />
              </div>
              {/* Organization select dropdown - SuperAdmin only */}
              {isSuperAdmin && (
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                    Organization
                  </label>
                  <select
                    className="w-full rounded-xl border border-slate-200 p-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10"
                    value={filters.organizationId}
                    onChange={(e) =>
                      setFilters({ ...filters, organizationId: e.target.value })
                    }
                  >
                    <option value="">All Organizations</option>
                    {organizations.map((org) => (
                      <option key={org._id} value={org._id}>
                        {org.name}
                      </option>
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

        {filters.organizationId && organizationAdmin && (
          <AdminSectionCard className="border-emerald-200 bg-emerald-50/70" bodyClassName="p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 font-black text-white">
                {organizationAdmin.firstName[0]}
                {organizationAdmin.lastName[0]}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-600">
                  Organization Admin
                </p>
                <h3 className="text-sm font-bold text-slate-900">
                  {organizationAdmin.firstName} {organizationAdmin.lastName}
                </h3>
                <p className="text-xs text-slate-500">
                  {organizationAdmin.email} • {organizationAdmin.mobile}
                </p>
              </div>
            </div>
            <div className="hidden text-right md:block">
              <p className="text-xs font-semibold text-slate-600">
                Primary Contact
              </p>
              <p className="text-[10px] text-slate-400">
                Directly responsible for sub-org operations
              </p>
            </div>
          </div>
          </AdminSectionCard>
        )}

        <AdminSectionCard
          title="User Directory"
          description="Consistent table view for user management, actions, and pagination."
          className="min-h-[420px]"
          bodyClassName="flex min-h-[340px] flex-col justify-between gap-4 p-4"
        >
          <Table columns={columns} data={users} loading={isLoading} />
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalRecords}
            onPageChange={setPage}
            disabled={isUsersLoading || isOrgUsersLoading}
          />
        </AdminSectionCard>

        {canCreateUser && (
          <DynamicModal
            isOpen={isPopupOpen("userModal")}
            onClose={closeModal}
            title={editingUser ? "Edit User" : "Add User"}
            description={
              editingUser
                ? "Update user identity, mobile, and account status."
                : "Create a new user with role, status, password, and organization assignment."
            }
            fields={userFormFields}
            schema={userSchema}
            initialData={
              editingUser
                ? {
                  firstName: editingUser.firstName,
                  lastName: editingUser.lastName,
                  email: editingUser.email,
                  mobile: editingUser.mobile,
                  status: editingUser.status,
                }
                : {
                    organizationId: isSuperAdmin ? "" : orgId || "",
                    firstName: "",
                    lastName: "",
                    email: "",
                    mobile: "",
                    password: "",
                    confirmPassword: "",
                    role: "",
                    status: "active",
                  }
            }
            onSubmit={handleSubmit}
            submitLabel={editingUser ? "Update User" : "Create User"}
          />
        )}
      </AdminPageShell>
    </ApiErrorBoundary>
  );
}
