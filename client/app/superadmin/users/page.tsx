"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import {
  Building2,
  Edit,
  Eye,
  Filter,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  ToggleRight,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetUsersQuery,
  useUpdateUserMutation,
} from "@/redux/api/usersApi";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";
import { usePopups } from "../Helpers/PopupContext";
import { DynamicModal } from "@/components/common";
import { FormField } from "@/lib/formTypes";
import {
  formatDateTime,
  matchesSearch,
  sortByCreatedAtDesc,
  sortByName,
} from "@/components/superadmin/superadmin-data";
import {
  DisabledFeaturePill,
  MetricCard,
  SectionCard,
  StateBlock,
  StatusBadge,
} from "@/components/superadmin/superadmin-ui";

type OrganizationRef = string | { _id: string; name: string };

export interface User {
  _id: string;
  firstName: string;
  lastName?: string;
  email: string;
  mobile: string;
  role: "admin" | "driver" | "superadmin";
  organizationId?: OrganizationRef;
  status: "active" | "inactive";
  createdAt?: string;
}

type Filters = {
  search: string;
  status: string;
  organizationId: string;
  sort: "newest" | "name-asc" | "name-desc" | "status";
};

const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "",
  organizationId: "",
  sort: "newest",
};

export default function UsersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(false);
  const { openPopup, closePopup, isPopupOpen, getPopupData } = usePopups();

  const [page, setPage] = useState(() => {
    const value = Number(searchParams.get("page") || 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  });
  const [filters, setFilters] = useState<Filters>(() => ({
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    organizationId: searchParams.get("organizationId") || "",
    sort: (searchParams.get("sort") as Filters["sort"]) || "newest",
  }));
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<User | null>(null);

  const LIMIT = 10;

  const {
    data: usersData,
    isLoading: isUsersLoading,
    isError: isUsersError,
    refetch: refetchUsers,
  } = useGetUsersQuery({ page: 0, limit: 1000, role: "admin" }, { refetchOnMountOrArgChange: true });
  const {
    data: orgData,
    isLoading: isOrganizationsLoading,
    isError: isOrganizationsError,
  } = useGetOrganizationsQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });

  const [createUser] = useCreateUserMutation();
  const [updateUser] = useUpdateUserMutation();
  const [deleteUser] = useDeleteUserMutation();

  const users = useMemo(
    () => (usersData?.users || usersData?.data || usersData?.docs || []) as User[],
    [usersData],
  );
  const organizations = useMemo(
    () =>
      (orgData?.organizations || orgData?.data || orgData?.docs || []) as Array<{
        _id: string;
        name: string;
      }>,
    [orgData],
  );

  const filteredUsers = useMemo(() => {
    const filtered = users.filter((user) => {
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
      const organizationName = getOrganizationName(user.organizationId, organizations);

      return (
        matchesSearch(filters.search, [fullName, user.email, user.mobile, organizationName]) &&
        (!filters.status || user.status === filters.status) &&
        (!filters.organizationId || getOrganizationId(user.organizationId) === filters.organizationId)
      );
    });

    if (filters.sort === "name-asc") {
      return sortByName(filtered, (item) => getUserName(item), "asc");
    }
    if (filters.sort === "name-desc") {
      return sortByName(filtered, (item) => getUserName(item), "desc");
    }
    if (filters.sort === "status") {
      return [...filtered].sort((left, right) => left.status.localeCompare(right.status) || getUserName(left).localeCompare(getUserName(right)));
    }

    return sortByCreatedAtDesc(filtered);
  }, [filters.organizationId, filters.search, filters.sort, filters.status, organizations, users]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / LIMIT));
  const paginatedUsers = filteredUsers.slice((page - 1) * LIMIT, page * LIMIT);
  const activeUsers = users.filter((user) => user.status === "active").length;
  const inactiveUsers = Math.max(users.length - activeUsers, 0);
  const isLoading = isUsersLoading || isOrganizationsLoading;
  const hasError = isUsersError || isOrganizationsError;

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.organizationId) params.set("organizationId", filters.organizationId);
    if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
    if (page > 1) params.set("page", String(page));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, page, pathname, router]);

  const userFormFields = useMemo<FormField[]>(() => {
    if (editingUser) {
      return [
        {
          name: "firstName",
          label: "First Name",
          type: "text",
          placeholder: "Enter first name",
          required: true,
          icon: <UserIcon size={16} />,
        },
        {
          name: "lastName",
          label: "Last Name",
          type: "text",
          placeholder: "Enter last name",
          icon: <UserIcon size={16} />,
        },
        {
          name: "email",
          label: "Email Address",
          type: "email",
          placeholder: "Enter email address",
          required: true,
          icon: <Mail size={16} />,
        },
        {
          name: "mobile",
          label: "Mobile Number",
          type: "tel",
          placeholder: "Enter mobile number",
          required: true,
          icon: <Phone size={16} />,
        },
        {
          name: "status",
          label: "Status",
          type: "select",
          required: true,
          icon: <ToggleRight size={16} />,
          options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ],
          helperText: "Role and organization assignment are fixed by the current backend update flow.",
        },
      ];
    }

    return [
      {
        name: "firstName",
        label: "First Name",
        type: "text",
        placeholder: "Enter first name",
        required: true,
        icon: <UserIcon size={16} />,
      },
      {
        name: "lastName",
        label: "Last Name",
        type: "text",
        placeholder: "Enter last name",
        icon: <UserIcon size={16} />,
      },
      {
        name: "email",
        label: "Email Address",
        type: "email",
        placeholder: "Enter email address",
        required: true,
        icon: <Mail size={16} />,
      },
      {
        name: "mobile",
        label: "Mobile Number",
        type: "tel",
        placeholder: "Enter mobile number",
        required: true,
        icon: <Phone size={16} />,
      },
      {
        name: "organizationId",
        label: "Organization",
        type: "select",
        required: true,
        icon: <Building2 size={16} />,
        options: organizations.map((org) => ({
          label: org.name,
          value: org._id,
        })),
      },
      {
        name: "password",
        label: "Initial Password",
        type: "password",
        placeholder: "Enter temporary password",
        required: true,
      },
    ];
  }, [editingUser, organizations]);

  const userSchema = useMemo(() => {
    if (editingUser) {
      return z.object({
        firstName: z.string().min(1, "First name is required"),
        lastName: z.string().optional(),
        email: z.string().email("Valid email is required"),
        mobile: z.string().min(1, "Mobile number is required"),
        status: z.enum(["active", "inactive"]),
      });
    }

    return z.object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().optional(),
      email: z.string().email("Valid email is required"),
      mobile: z.string().min(1, "Mobile number is required"),
      organizationId: z.string().min(1, "Organization is required"),
      password: z.string().min(6, "Password must be at least 6 characters"),
    });
  }, [editingUser]);

  const handleUserSubmit = async (data: Record<string, any>) => {
    try {
      if (editingUser) {
        await updateUser({
          id: editingUser._id,
          firstName: data.firstName,
          lastName: data.lastName || "",
          email: data.email,
          mobile: data.mobile,
          status: data.status,
        }).unwrap();
        toast.success("Organization admin updated successfully");
      } else {
        await createUser({
          firstName: data.firstName,
          lastName: data.lastName || "",
          email: data.email,
          mobile: data.mobile,
          password: data.password,
          organizationId: data.organizationId,
          role: "admin",
        }).unwrap();
        toast.success("Organization admin created successfully");
      }

      closePopup("userModal");
      refetchUsers();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "data" in error &&
        typeof (error as { data?: { message?: string } }).data?.message === "string"
          ? (error as { data: { message: string } }).data.message
          : "Failed to save organization admin";
      toast.error(message);
    }
  };

  const handleDeleteConfirmed = async () => {
    if (!deleteCandidate) return;

    try {
      await deleteUser(deleteCandidate._id).unwrap();
      toast.success("Organization admin deleted successfully");
      setDeleteCandidate(null);
      if (selectedUser?._id === deleteCandidate._id) {
        setSelectedUser(null);
      }
      refetchUsers();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "data" in error &&
        typeof (error as { data?: { message?: string } }).data?.message === "string"
          ? (error as { data: { message: string } }).data.message
          : "Failed to delete organization admin";
      toast.error(message);
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    openPopup("userModal");
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    openPopup("userModal", {
      firstName: user.firstName,
      lastName: user.lastName || "",
      email: user.email,
      mobile: user.mobile,
      status: user.status,
    });
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const columns = [
    {
      header: "Name",
      accessor: (row: User) => getUserName(row),
    },
    { header: "Email", accessor: (row: User) => row.email },
    { header: "Mobile", accessor: (row: User) => row.mobile },
    {
      header: "Organization",
      accessor: (row: User) => getOrganizationName(row.organizationId, organizations),
    },
    {
      header: "Status",
      accessor: (row: User) => <StatusBadge value={row.status} />,
    },
    {
      header: "Created",
      accessor: (row: User) => formatDateTime(row.createdAt) || "Unavailable",
    },
    {
      header: "Actions",
      accessor: (row: User) => (
        <div className="flex gap-3">
          <button
            onClick={() => setSelectedUser(row)}
            className="text-emerald-200 transition-colors hover:text-emerald-100"
            title="View organization admin"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => openEditModal(row)}
            className="text-slate-200 transition-colors hover:text-white"
            title="Edit organization admin"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => setDeleteCandidate(row)}
            className="text-rose-300 transition-colors hover:text-rose-200"
            title="Delete organization admin"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <ApiErrorBoundary hasError={false}>
      <div className="space-y-6 pb-8 sm:space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">
              Administrative Personnel
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-100">Organization Admins</h1>
            <p className="text-sm font-medium text-slate-400">
              Manage the administrative accounts that operate client organizations.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => refetchUsers()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-100 transition hover:bg-slate-900"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2 text-xs font-black uppercase tracking-[0.18em] transition ${
                showFilters
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                  : "border-slate-800 bg-slate-950/70 text-slate-100 hover:bg-slate-900"
              }`}
            >
              <Filter size={14} />
              Filter
            </button>
            <button
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-5 py-2.5 text-[11px] font-black uppercase tracking-widest text-emerald-100 transition hover:bg-emerald-500/30"
            >
              <Plus size={16} />
              Create Org Admin
            </button>
          </div>
        </div>

        {hasError ? (
          <StateBlock
            title="Organization admin data is unavailable"
            description="The org-admin list could not be loaded from the backend. Refresh after checking API connectivity."
            tone="danger"
          />
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard label="Total Org Admins" value={users.length} helper="Real client admin accounts" />
          <MetricCard label="Active" value={activeUsers} helper="Currently active org-admin accounts" />
          <MetricCard label="Inactive" value={inactiveUsers} helper="Accounts requiring review" />
        </section>

        {showFilters && (
          <SectionCard
            title="Filters and Sorting"
            description="Filter and sort the real org-admin dataset returned from the backend."
            action={
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-black uppercase tracking-[0.18em] text-slate-300 transition hover:text-white"
              >
                Reset Filters
              </button>
            }
          >
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_200px_240px_180px]">
              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search by name, email, mobile, or organization..."
                  value={filters.search}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, search: event.target.value }));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm font-medium text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Status
                </label>
                <select
                  value={filters.status}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, status: event.target.value }));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm font-medium text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Organization
                </label>
                <select
                  value={filters.organizationId}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, organizationId: event.target.value }));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm font-medium text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Sort
                </label>
                <select
                  value={filters.sort}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, sort: event.target.value as Filters["sort"] }));
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2.5 text-sm font-medium text-slate-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="newest">Newest First</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
              Showing <span className="font-black text-slate-100">{filteredUsers.length}</span> matching
              org-admins out of <span className="font-black text-slate-100">{users.length}</span> total.
            </div>
          </SectionCard>
        )}

        <div className="space-y-3 md:hidden">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-800/80 bg-slate-900/65 p-4">
                <div className="h-4 w-36 animate-pulse rounded bg-slate-800" />
                <div className="mt-3 h-3 w-28 animate-pulse rounded bg-slate-800" />
                <div className="mt-4 h-3 w-40 animate-pulse rounded bg-slate-800" />
              </div>
            ))
          ) : paginatedUsers.length > 0 ? (
            paginatedUsers.map((user) => (
              <article
                key={user._id}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/65 p-4 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-slate-100">{getUserName(user)}</h2>
                    <p className="mt-1 text-xs text-slate-400">{getOrganizationName(user.organizationId, organizations)}</p>
                  </div>
                  <StatusBadge value={user.status} />
                </div>

                <dl className="mt-4 space-y-3 text-sm text-slate-300">
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Email</dt>
                    <dd className="mt-1 break-all">{user.email}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Mobile</dt>
                    <dd className="mt-1">{user.mobile || "Not provided"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Created</dt>
                    <dd className="mt-1">{formatDateTime(user.createdAt) || "Unavailable"}</dd>
                  </div>
                </dl>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedUser(user)}
                    className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-100 transition hover:border-slate-600"
                  >
                    View
                  </button>
                  <button
                    onClick={() => openEditModal(user)}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteCandidate(user)}
                    className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-rose-200 transition hover:bg-rose-500/20"
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))
          ) : (
            <StateBlock
              title="No matching org-admins"
              description="No organization admin records match the current filters. Reset filters or broaden the search."
            />
          )}
        </div>

        <div className="hidden rounded-[24px] border border-slate-800/80 bg-slate-900/65 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)] md:block">
          <Table columns={columns} data={paginatedUsers} loading={isLoading} variant="dark" />
          {totalPages > 1 ? (
            <div className="border-t border-slate-800 p-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          ) : null}
        </div>

        <DynamicModal
          isOpen={isPopupOpen("userModal")}
          onClose={() => closePopup("userModal")}
          title={editingUser ? "Edit Organization Admin" : "Create Organization Admin"}
          description={
            editingUser
              ? "Update backend-supported contact fields and account status for this org-admin record."
              : "Create the admin account that will operate a client organization. Superadmin and unsupported roles are intentionally excluded."
          }
          fields={userFormFields}
          initialData={isPopupOpen("userModal") ? getPopupData("userModal") || {} : {}}
          schema={userSchema}
          onSubmit={handleUserSubmit as any}
          submitLabel={editingUser ? "Update Organization Admin" : "Create Organization Admin"}
          variant="dark"
        />

        <OrganizationAdminDrawer
          user={selectedUser}
          organizations={organizations}
          onClose={() => setSelectedUser(null)}
          onEdit={(user) => openEditModal(user)}
          onDelete={(user) => setDeleteCandidate(user)}
        />

        <ConfirmDeleteModal
          isOpen={Boolean(deleteCandidate)}
          title="Delete Organization Admin"
          description={
            deleteCandidate
              ? `Delete ${getUserName(deleteCandidate)}? This action will remove the account from the backend.`
              : ""
          }
          onCancel={() => setDeleteCandidate(null)}
          onConfirm={handleDeleteConfirmed}
        />
      </div>
    </ApiErrorBoundary>
  );
}

function OrganizationAdminDrawer({
  user,
  organizations,
  onClose,
  onEdit,
  onDelete,
}: {
  user: User | null;
  organizations: Array<{ _id: string; name: string }>;
  onClose: () => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}) {
  if (!user || typeof document === "undefined") return null;

  const organizationId = getOrganizationId(user.organizationId);
  const organizationName = getOrganizationName(user.organizationId, organizations);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-md" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-slate-800 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 px-5 py-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-emerald-400/70">
              Org Admin Detail
            </p>
            <h2 className="mt-1 text-xl font-black text-slate-50">{getUserName(user)}</h2>
            <p className="mt-1 text-sm text-slate-400">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close drawer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 p-5">
          <div className="flex flex-wrap gap-3">
            <StatusBadge value={user.status} />
            <div className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
              Role: admin
            </div>
          </div>

          <SectionCard title="Account Profile" description="Backend-backed org-admin account fields.">
            <div className="grid gap-3 sm:grid-cols-2">
              <DrawerInfo label="First Name" value={user.firstName || "Unavailable"} />
              <DrawerInfo label="Last Name" value={user.lastName || "Unavailable"} />
              <DrawerInfo label="Email" value={user.email || "Unavailable"} />
              <DrawerInfo label="Mobile" value={user.mobile || "Unavailable"} />
              <DrawerInfo label="Organization" value={organizationName} />
              <DrawerInfo label="Created" value={formatDateTime(user.createdAt) || "Unavailable"} />
            </div>
          </SectionCard>

          <SectionCard title="Available Actions" description="Only actions backed by the current backend are exposed.">
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => onEdit(user)}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25"
              >
                Edit Org Admin
              </button>
              {organizationId ? (
                <Link
                  href={`/superadmin/organizations/${organizationId}`}
                  className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-slate-100 transition hover:border-slate-600"
                >
                  Open Organization Detail
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => onDelete(user)}
                className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.18em] text-rose-200 transition hover:bg-rose-500/20"
              >
                Delete Org Admin
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Support and Credentials" description="Phase 2 foundation only. No fake support actions are exposed.">
            <div className="space-y-4">
              <DisabledFeaturePill
                label="Reset Password Unavailable"
                helper="There is no backend password-reset flow for org-admins yet."
              />
              <DisabledFeaturePill
                label="Support Access Unavailable"
                helper="There is no secure backend impersonation or support-session API yet."
              />
              <p className="text-sm leading-6 text-slate-400">
                This drawer is intentionally honest about backend limits. It does not pretend to resend
                credentials, reset passwords, or open support mode without secure server support.
              </p>
            </div>
          </SectionCard>
        </div>
      </aside>
    </div>,
    document.body,
  );
}

function DrawerInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-100">{value}</p>
    </div>
  );
}

function ConfirmDeleteModal({
  isOpen,
  title,
  description,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-2 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-slate-950/45 backdrop-blur-md" onClick={onCancel} />
      <div className="relative w-full max-w-md overflow-hidden rounded-[24px] border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-800 bg-slate-950/40 p-4">
          <div>
            <h2 className="text-base font-black text-slate-100">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close confirmation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-2 p-4 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-300 transition hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl border border-rose-500/20 bg-rose-500 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-white transition hover:bg-rose-400"
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function getUserName(user: User) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || "Organization Admin";
}

function getOrganizationId(organizationId?: OrganizationRef) {
  if (!organizationId) return "";
  return typeof organizationId === "object" ? organizationId._id || "" : organizationId;
}

function getOrganizationName(
  organizationId: OrganizationRef | undefined,
  organizations: Array<{ _id: string; name: string }>,
) {
  if (!organizationId) return "Not assigned";
  if (typeof organizationId === "object") return organizationId.name || "Not assigned";
  return organizations.find((org) => org._id === organizationId)?.name || "Not assigned";
}
