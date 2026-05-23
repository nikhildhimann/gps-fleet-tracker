"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import {
  Building2,
  Edit,
  Eye,
  Filter,
  Lock,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  Users,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import { DynamicModal } from "@/components/common";
import { FormField } from "@/lib/formTypes";
import {
  useCreateOrganizationMutation,
  useGetOrganizationsQuery,
  useUpdateOrganizationMutation,
} from "@/redux/api/organizationApi";
import { usePopups } from "../Helpers/PopupContext";
import {
  formatDateTime,
  matchesSearch,
  normalizeSearchValue,
  sortByCreatedAtDesc,
  sortByName,
} from "@/components/superadmin/superadmin-data";
import {
  MetricCard,
  SectionCard,
  StateBlock,
  StatusBadge,
} from "@/components/superadmin/superadmin-ui";

export interface Organization {
  _id: string;
  name: string;
  organizationType?: string;
  email: string;
  phone: string;
  address?: {
    addressLine?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  } | string;
  status: "active" | "inactive";
  adminUser?: string;
  parentOrganizationId?: string | null;
  createdAt?: string;
}

type Filters = {
  search: string;
  status: string;
  city: string;
  sort: "newest" | "name-asc" | "name-desc" | "status";
};

const ORGANIZATION_TYPE_OPTIONS = [
  { label: "Logistics", value: "logistics" },
  { label: "Public Transport", value: "transport" },
  { label: "Taxi / Rental", value: "taxi" },
  { label: "School / Campus", value: "school" },
  { label: "Enterprise Fleet", value: "fleet" },
];

const DEFAULT_FILTERS: Filters = {
  search: "",
  status: "",
  city: "",
  sort: "newest",
};

export default function OrganizationsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openPopup, closePopup, isPopupOpen, getPopupData } = usePopups();
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(() => {
    const value = Number(searchParams.get("page") || 1);
    return Number.isFinite(value) && value > 0 ? value : 1;
  });
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [filters, setFilters] = useState<Filters>(() => ({
    search: searchParams.get("search") || "",
    status: searchParams.get("status") || "",
    city: searchParams.get("city") || "",
    sort: (searchParams.get("sort") as Filters["sort"]) || "newest",
  }));

  const LIMIT = 10;

  const {
    data: orgsData,
    isLoading,
    isError,
    refetch: refetchOrganizations,
  } = useGetOrganizationsQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });
  const [createOrganization] = useCreateOrganizationMutation();
  const [updateOrganization] = useUpdateOrganizationMutation();

  const organizations = useMemo(
    () => (orgsData?.organizations || orgsData?.data || orgsData?.docs || []) as Organization[],
    [orgsData],
  );

  const filteredOrganizations = useMemo(() => {
    const filtered = organizations.filter((org) => {
      const city = typeof org.address === "object" ? org.address?.city || "" : "";
      return (
        matchesSearch(filters.search, [org.name, org.email, org.phone, city]) &&
        (!filters.status || org.status === filters.status) &&
        (!normalizeSearchValue(filters.city) || normalizeSearchValue(city).includes(normalizeSearchValue(filters.city)))
      );
    });

    if (filters.sort === "name-asc") {
      return sortByName(filtered, (item) => item.name, "asc");
    }
    if (filters.sort === "name-desc") {
      return sortByName(filtered, (item) => item.name, "desc");
    }
    if (filters.sort === "status") {
      return [...filtered].sort((left, right) => left.status.localeCompare(right.status) || left.name.localeCompare(right.name));
    }

    return sortByCreatedAtDesc(filtered);
  }, [filters.city, filters.search, filters.sort, filters.status, organizations]);

  const totalOrganizations = organizations.length;
  const activeOrganizations = organizations.filter((org) => org.status === "active").length;
  const inactiveOrganizations = Math.max(totalOrganizations - activeOrganizations, 0);
  const totalPages = Math.max(1, Math.ceil(filteredOrganizations.length / LIMIT));
  const paginatedOrganizations = filteredOrganizations.slice((page - 1) * LIMIT, page * LIMIT);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status) params.set("status", filters.status);
    if (filters.city) params.set("city", filters.city);
    if (filters.sort !== DEFAULT_FILTERS.sort) params.set("sort", filters.sort);
    if (page > 1) params.set("page", String(page));

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [filters, page, pathname, router]);

  useEffect(() => {
    if (searchParams.get("action") === "create") {
      openCreateModal();
      // Clean up URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete("action");
      const nextQuery = params.toString();
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
    }
  }, [searchParams, pathname, router]); // openCreateModal is omitted from deps to avoid re-triggering if it changes

  const organizationFormFields = useMemo<FormField[]>(() => {
    const baseFields: FormField[] = [
      {
        name: "name",
        label: "Organization Name",
        type: "text",
        placeholder: "Enter organization name",
        required: true,
        icon: <Building2 size={16} />,
      },
      {
        name: "organizationType",
        label: "Organization Type",
        type: "select",
        required: true,
        options: ORGANIZATION_TYPE_OPTIONS,
      },
      {
        name: "email",
        label: "Organization Email",
        type: "email",
        placeholder: "Enter organization email",
        required: true,
        icon: <Mail size={16} />,
        helperText: editingOrg
          ? undefined
          : "Current backend also uses this as the initial org-admin login email.",
      },
      {
        name: "phone",
        label: "Organization Phone",
        type: "tel",
        placeholder: "Enter organization phone",
        required: true,
        icon: <Phone size={16} />,
        helperText: editingOrg
          ? undefined
          : "Current backend also uses this as the initial org-admin mobile number.",
      },
      {
        name: "addressLine",
        label: "Address Line",
        type: "text",
        placeholder: "Enter street address",
        required: true,
      },
      {
        name: "country",
        label: "Country",
        type: "select",
        required: true,
        options: [],
      },
      {
        name: "state",
        label: "State",
        type: "select",
        required: true,
        options: [],
      },
      {
        name: "city",
        label: "City",
        type: "select",
        required: true,
        options: [],
      },
      {
        name: "pincode",
        label: "Pincode",
        type: "text",
        placeholder: "Enter pincode",
      },
    ];

    if (editingOrg) {
      return [
        ...baseFields,
        {
          name: "status",
          label: "Status",
          type: "select",
          required: true,
          options: [
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ],
        },
      ];
    }

    return [
      ...baseFields,
      {
        name: "adminFirstName",
        label: "Admin First Name",
        type: "text",
        placeholder: "Enter admin first name",
        required: true,
        icon: <UserIcon size={16} />,
      },
      {
        name: "adminLastName",
        label: "Admin Last Name",
        type: "text",
        placeholder: "Enter admin last name",
        required: true,
        icon: <UserIcon size={16} />,
      },
      {
        name: "adminPassword",
        label: "Initial Admin Password",
        type: "password",
        placeholder: "Set initial admin password",
        required: true,
        icon: <Lock size={16} />,
      },
    ];
  }, [editingOrg]);

  const organizationSchema = useMemo(() => {
    const baseSchema = z.object({
      name: z.string().min(1, "Organization name is required"),
      organizationType: z.string().min(1, "Organization type is required"),
      email: z.string().email("Valid email is required"),
      phone: z.string().min(1, "Phone number is required"),
      addressLine: z.string().min(1, "Address line is required"),
      country: z.string().min(1, "Country is required"),
      state: z.string().min(1, "State is required"),
      city: z.string().min(1, "City is required"),
      pincode: z.string().optional(),
    });

    if (editingOrg) {
      return baseSchema.extend({
        status: z.enum(["active", "inactive"]),
      });
    }

    return baseSchema.extend({
      adminFirstName: z.string().min(1, "Admin first name is required"),
      adminLastName: z.string().min(1, "Admin last name is required"),
      adminPassword: z.string().min(6, "Password must be at least 6 characters"),
    });
  }, [editingOrg]);

  const openCreateModal = () => {
    setEditingOrg(null);
    openPopup("orgModal");
  };

  const openEditModal = (organization: Organization) => {
    setEditingOrg(organization);
    const normalizedAddress =
      typeof organization.address === "string"
        ? {
            addressLine: organization.address,
            city: "",
            state: "",
            country: "",
            pincode: "",
          }
        : organization.address || {
            addressLine: "",
            city: "",
            state: "",
            country: "",
            pincode: "",
          };

    openPopup("orgModal", {
      name: organization.name,
      organizationType: organization.organizationType || "",
      email: organization.email,
      phone: organization.phone,
      addressLine: normalizedAddress.addressLine || "",
      country: normalizedAddress.country || "",
      state: normalizedAddress.state || "",
      city: normalizedAddress.city || "",
      pincode: normalizedAddress.pincode || "",
      status: organization.status,
    });
  };

  const handleOrganizationSubmit = async (data: Record<string, string>) => {
    try {
      const payload = {
        name: data.name,
        organizationType: data.organizationType,
        email: data.email,
        phone: data.phone,
        address: {
          addressLine: data.addressLine,
          city: data.city,
          state: data.state,
          country: data.country,
          pincode: data.pincode || undefined,
        },
      };

      if (editingOrg) {
        await updateOrganization({
          id: editingOrg._id,
          body: {
            ...payload,
            status: data.status,
          },
        }).unwrap();
        toast.success("Organization updated successfully");
      } else {
        await createOrganization({
          ...payload,
          firstName: data.adminFirstName,
          lastName: data.adminLastName,
          password: data.adminPassword,
        }).unwrap();
        toast.success("Organization and org admin created successfully");
      }

      closePopup("orgModal");
      refetchOrganizations();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "data" in error &&
        typeof (error as { data?: { message?: string } }).data?.message === "string"
          ? (error as { data: { message: string } }).data.message
          : "Failed to save organization";
      toast.error(message);
    }
  };

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  const columns = [
    { header: "Name", accessor: (row: Organization) => row.name },
    {
      header: "Type",
      accessor: (row: Organization) =>
        ORGANIZATION_TYPE_OPTIONS.find((option) => option.value === row.organizationType)?.label || "Not set",
    },
    { header: "Email", accessor: (row: Organization) => row.email },
    { header: "Phone", accessor: (row: Organization) => row.phone },
    {
      header: "Status",
      accessor: (row: Organization) => <StatusBadge value={row.status} />,
    },
    {
      header: "Created",
      accessor: (row: Organization) => formatDateTime(row.createdAt) || "Unavailable",
    },
    {
      header: "Actions",
      accessor: (row: Organization) => (
        <div className="flex gap-3">
          <button
            onClick={() => router.push(`/superadmin/organizations/${row._id}`)}
            className="text-emerald-200 transition-colors hover:text-emerald-100"
            title="View organization details"
          >
            <Eye size={16} />
          </button>
          <button
            onClick={() => router.push(`/superadmin/users?organizationId=${row._id}`)}
            className="text-sky-200 transition-colors hover:text-sky-100"
            title="Open organization admins"
          >
            <Users size={16} />
          </button>
          <button
            onClick={() => openEditModal(row)}
            className="text-slate-200 transition-colors hover:text-white"
            title="Edit organization"
          >
            <Edit size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <ApiErrorBoundary hasError={false}>
      <div className="space-y-8 pb-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">
              Organization Lifecycle
            </p>
            <h1 className="text-3xl font-black tracking-tight text-slate-100">Organizations</h1>
            <p className="mt-1 max-w-3xl font-bold text-slate-400">
              Create client organizations, maintain lifecycle state, and drill into each organization's
              operational detail view. Root organization deletion remains hidden because the current backend
              does not support it.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              onClick={() => refetchOrganizations()}
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
              Add Organization
            </button>
          </div>
        </div>

        {isError ? (
          <StateBlock
            title="Organizations are unavailable"
            description="The organizations list could not be loaded from the backend. Please refresh after checking connectivity."
            tone="danger"
          />
        ) : null}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <MetricCard label="Total Organizations" value={totalOrganizations} helper="Real organizations in platform scope" />
          <MetricCard label="Active" value={activeOrganizations} helper="Currently active organizations" />
          <MetricCard label="Inactive" value={inactiveOrganizations} helper="Require lifecycle review" />
        </section>

        {showFilters && (
          <SectionCard
            title="Filters and Sorting"
            description="Client-side filtering over the real organization dataset returned by the backend."
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
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_180px_180px_180px]">
              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  Search
                </label>
                <input
                  type="text"
                  placeholder="Search by name, email, phone, or city..."
                  value={filters.search}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, search: event.target.value }));
                  }}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm font-semibold text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30"
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
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm font-semibold text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.22em] text-slate-400">
                  City
                </label>
                <input
                  type="text"
                  placeholder="Filter by city"
                  value={filters.city}
                  onChange={(event) => {
                    setPage(1);
                    setFilters((prev) => ({ ...prev, city: event.target.value }));
                  }}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm font-semibold text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
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
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5 text-sm font-semibold text-slate-200 outline-none focus:ring-2 focus:ring-emerald-500/30"
                >
                  <option value="newest">Newest First</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="status">Status</option>
                </select>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/50 px-4 py-3 text-sm text-slate-400">
              Showing <span className="font-black text-slate-100">{filteredOrganizations.length}</span> matching
              organizations out of <span className="font-black text-slate-100">{organizations.length}</span> total.
            </div>
          </SectionCard>
        )}

        <div className="space-y-3 md:hidden">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-slate-800/80 bg-slate-900/65 p-4">
                <div className="h-4 w-32 animate-pulse rounded bg-slate-800" />
                <div className="mt-3 h-3 w-24 animate-pulse rounded bg-slate-800" />
                <div className="mt-4 h-3 w-40 animate-pulse rounded bg-slate-800" />
              </div>
            ))
          ) : paginatedOrganizations.length > 0 ? (
            paginatedOrganizations.map((organization) => (
              <article
                key={organization._id}
                className="rounded-2xl border border-slate-800/80 bg-slate-900/65 p-4 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-black text-slate-100">{organization.name}</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {ORGANIZATION_TYPE_OPTIONS.find((option) => option.value === organization.organizationType)?.label || "Organization"}
                    </p>
                  </div>
                  <StatusBadge value={organization.status} />
                </div>

                <dl className="mt-4 space-y-3 text-sm text-slate-300">
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Email</dt>
                    <dd className="mt-1 break-all">{organization.email}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Phone</dt>
                    <dd className="mt-1">{organization.phone}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Created</dt>
                    <dd className="mt-1">{formatDateTime(organization.createdAt) || "Unavailable"}</dd>
                  </div>
                </dl>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  <button
                    onClick={() => router.push(`/superadmin/organizations/${organization._id}`)}
                    className="rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-100 transition hover:border-slate-600"
                  >
                    View
                  </button>
                  <button
                    onClick={() => router.push(`/superadmin/users?organizationId=${organization._id}`)}
                    className="rounded-xl border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-sky-200 transition hover:bg-sky-500/20"
                  >
                    Admins
                  </button>
                  <button
                    onClick={() => openEditModal(organization)}
                    className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    Edit
                  </button>
                </div>
              </article>
            ))
          ) : (
            <StateBlock
              title="No matching organizations"
              description="No organizations match the current filters. Reset filters or broaden the search."
            />
          )}
        </div>

        <div className="hidden rounded-[24px] border border-slate-800/80 bg-slate-900/65 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)] md:block">
          <Table columns={columns} data={paginatedOrganizations} loading={isLoading} variant="dark" />
          {totalPages > 1 ? (
            <div className="border-t border-slate-800/80 p-4">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          ) : null}
        </div>

        <DynamicModal
          isOpen={isPopupOpen("orgModal")}
          onClose={() => closePopup("orgModal")}
          title={editingOrg ? "Edit Organization" : "Create Organization"}
          description={
            editingOrg
              ? "Update backend-supported organization profile fields and live status."
              : "Create a new client organization plus its initial org-admin account. The current backend uses the organization email and phone as the admin login identity."
          }
          fields={organizationFormFields}
          initialData={isPopupOpen("orgModal") ? getPopupData("orgModal") || {} : {}}
          schema={organizationSchema}
          onSubmit={handleOrganizationSubmit as any}
          submitLabel={editingOrg ? "Update Organization" : "Create Organization"}
          variant="dark"
        />
      </div>
    </ApiErrorBoundary>
  );
}
