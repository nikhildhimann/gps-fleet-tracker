"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { Plus, Edit, Trash2, Eye, Filter } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
// 🔐 ORG CONTEXT UPDATE
import { useOrgContext } from "@/hooks/useOrgContext";

import {
  useGetSubOrganizationsQuery,
  useGetOrganizationsQuery,
  useCreateSubOrganizationWithManagerMutation,
  useUpdateOrganizationMutation,
  useDeleteOrganizationMutation,
} from "@/redux/api/organizationApi";

import { DynamicModal } from "@/components/common";
import { FormField } from "@/lib/formTypes";
import ImportExportButton from "@/components/admin/import-export/ImportExportButton";
import AdminLoadingState from "@/components/admin/UI/AdminLoadingState";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";

/* ================= TYPES ================= */

interface Organization extends Record<string, unknown> {
  _id: string;
  name: string;
  organizationType: string;
  email: string;
  phone: string;
  address?: {
    addressLine?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };
  parentOrganizationId: string | null;
  status: "active" | "inactive";
}

type OrganizationTableColumn = {
  header: string;
  accessor: Extract<keyof Organization, string> | ((row: Organization) => ReactNode);
  headerClassName?: string;
  cellClassName?: string;
};

/* ================= PAGE ================= */

export default function OrganizationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQueryParam = searchParams.get("search");

  // 🔐 ORG CONTEXT UPDATE
  const { role, orgId, orgName, isSuperAdmin, isRootOrgAdmin } = useOrgContext();
  const canUseImportExport = role === "admin" || role === "superadmin";

  /* ---------------------------------------
     1️⃣ Fetch sub-organizations (NO parentId param)
  ---------------------------------------- */
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const { data: allOrgsResponse } = useGetOrganizationsQuery(
    { page: 0, limit: 1000 },
    { skip: !isSuperAdmin && !isRootOrgAdmin }
  );

  /* ---------------------------------------
     Mutations
  ---------------------------------------- */
  const [createSubOrganizationWithManager] =
    useCreateSubOrganizationWithManagerMutation();
  const [updateOrganization] = useUpdateOrganizationMutation();
  const [deleteOrganization] = useDeleteOrganizationMutation();

  /* ---------------------------------------
     UI State
  ---------------------------------------- */
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(!!searchQueryParam);
  const [filters, setFilters] = useState({
    name: searchQueryParam || "",
    type: "",
    status: "",
  });

  const organizationQueryParams = useMemo(
    () => ({
      page: page - 1,
      limit: LIMIT,
      name: filters.name || undefined,
      organizationType: filters.type || undefined,
      status: filters.status || undefined,
    }),
    [LIMIT, page, filters]
  );

  const { data: subOrgResponse, isLoading, error, refetch: refetchSubOrgs } =
    useGetSubOrganizationsQuery(organizationQueryParams);

  const organizations: Organization[] = useMemo(
    () => subOrgResponse?.data || [],
    [subOrgResponse]
  );

  const allOrganizations = useMemo(
    () => allOrgsResponse?.data || [],
    [allOrgsResponse]
  );

  // 🔐 ORG CONTEXT UPDATE
  const canCreateOrg = isSuperAdmin || isRootOrgAdmin;
  const canEditOrg = isSuperAdmin || isRootOrgAdmin;
  const canDeleteOrg = isSuperAdmin || isRootOrgAdmin;

  useEffect(() => {
    setPage(1);
  }, [filters.name, filters.type, filters.status]);

  const formFields = useMemo(() => getFormFields(!!editingOrg, isSuperAdmin || isRootOrgAdmin, orgName), [editingOrg, isSuperAdmin, isRootOrgAdmin, orgName]);

  const organizationSchema = useMemo(() => {
    const base = z.object({
      name: z.string().min(1, "Organization name is required"),
      organizationType: z.enum(["logistics", "transport", "school", "taxi", "fleet"]),
      email: z.string().email("Valid email is required"),
      phone: z.string().regex(/^\+?[1-9]\d{7,14}$/, "Enter valid phone with country code"),
      addressLine: z.string().min(1, "Address line is required"),
      city: z.string().optional(),
      state: z.string().min(1, "State is required"),
      country: z.string().min(1, "Country is required"),
      pincode: z.string().regex(/^\d{4,10}$/, "Pincode must be numeric"),
      status: z.enum(["active", "inactive"]).optional(),
      parentOrganizationId: z.string().optional(),
      managerFirstName: z.string().optional(),
      managerLastName: z.string().optional(),
      managerPassword: z.string().optional(),
    });

    return base.superRefine((val, ctx) => {
      if (!editingOrg) {
        if (!val.managerFirstName) ctx.addIssue({ code: "custom", path: ["managerFirstName"], message: "Admin first name is required" });
        if (!val.managerLastName) ctx.addIssue({ code: "custom", path: ["managerLastName"], message: "Admin last name is required" });
        if (!val.managerPassword || val.managerPassword.length < 6) ctx.addIssue({ code: "custom", path: ["managerPassword"], message: "Admin password is required (min 6)" });
      }
    });
  }, [editingOrg, isSuperAdmin, isRootOrgAdmin]);

  /* ---------------------------------------
     Modal handlers
    ---------------------------------------- */
  const openCreateModal = () => {
    setEditingOrg(null);
    setIsModalOpen(true);
  };

  const openEditModal = (org: Organization) => {
    setEditingOrg(org);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setEditingOrg(null);
    setIsModalOpen(false);
  };

  /* ---------------------------------------
     Submit handler
  ---------------------------------------- */
  const handleSubmit = async (form: Record<string, any>) => {
    try {
      const address = {
        addressLine: form.addressLine,
        city: form.city,
        state: form.state,
        country: form.country,
        pincode: form.pincode,
      };

      if (editingOrg) {
        await updateOrganization({
          id: editingOrg._id,
          body: {
            name: form.name,
            organizationType: form.organizationType,
            email: form.email,
            phone: form.phone,
            address,
            status: form.status,
          }
        }).unwrap();

        toast.success("Organization updated successfully");
      } else {
        // 🔐 ORG CONTEXT UPDATE
        await createSubOrganizationWithManager({
          parentOrganizationId: form.parentOrganizationId || orgId, // use selected parent or current org
          organizationData: {
            name: form.name,
            organizationType: form.organizationType,
            email: form.email,
            phone: form.phone,
            address,
            geo: {
              timezone: "Asia/Kolkata",
            },
            settings: {},
          },
          managerData: {
            firstName: form.managerFirstName,
            lastName: form.managerLastName,
            email: form.email,
            mobile: form.phone,
            password: form.managerPassword,
          },
        }).unwrap();

        toast.success("Sub-organization and admin created successfully");
      }
    } catch (err: any) {
      toast.error(err?.data?.message || "Operation failed");
      throw err; // re-throw so DynamicModal keeps the form open and shows inline error
    }
  };

  /* ---------------------------------------
     Delete
  ---------------------------------------- */
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this organization?")) return;
    try {
      await deleteOrganization(id).unwrap();
      toast.success("Organization deleted");
    } catch (err: any) {
      toast.error(err?.data?.message || "Delete failed");
    }
  };

  /* ---------------------------------------
     Table columns
  ---------------------------------------- */
  const columns: OrganizationTableColumn[] = [
    { header: "Name", accessor: "name" },
    { header: "Type", accessor: "organizationType" },
    { header: "Email", accessor: "email" },
    { header: "Phone", accessor: "phone" },
    {
      header: "Status",
      accessor: (row: Organization) => (
        <span
          className={`px-2 py-1 rounded text-xs font-bold ${row.status === "active"
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
            }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      header: "Actions",
      accessor: (row: Organization) => (
        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/admin?organizationId=${row._id}`)}
          >
            <Eye size={16} />
          </button>
          {canEditOrg && (
            <button onClick={() => openEditModal(row)}>
              <Edit size={16} />
            </button>
          )}
          {canDeleteOrg && (
            <button onClick={() => handleDelete(row._id)}>
              <Trash2 size={16} className="text-red-500" />
            </button>
          )}
        </div>
      ),
    },
  ];

  /* ---------------------------------------
     Loading / Error
  ---------------------------------------- */
  if (isLoading) {
    return <AdminLoadingState title="Loading organizations" description="Preparing organization hierarchy and workspace controls." />;
  }

  if (error) {
    return <div className="p-6 text-red-500">Failed to load data</div>;
  }

  /* ---------------------------------------
     UI
  ---------------------------------------- */
  return (
    <ApiErrorBoundary hasError={false}>
      <AdminPageShell contentClassName="space-y-6">
        <AdminPageHeader
          eyebrow="Hierarchy Management"
          title="Organizations"
          description="Manage your fleet organizations here."
          actions={<div className="flex flex-col gap-3 sm:flex-row">
            {canUseImportExport && (
              <ImportExportButton
                moduleName="organizations"
                importUrl="/importexport/import/organizations"
                exportUrl="/importexport/export/organizations"
                allowImport={false}
                allowExport={true}
                allowedFields={[
                  "name",
                  "organizationType",
                  "email",
                  "phone",
                  "addressLine",
                  "city",
                  "state",
                  "country",
                  "pincode",
                  "status",
                ]}
                requiredFields={["name", "organizationType", "email", "phone"]}
                filters={{
            name: filters.name,
            organizationType: filters.type,
            status: filters.status,
                }}
                organizationSelectionMode="disabled"
                onCompleted={() => {
                  void refetchSubOrgs();
                }}
              />
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Filter size={16} /> Filtered Organizations
            </button>
            {canCreateOrg && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
              >
                <Plus size={16} /> Add Organization
              </button>
            )}
          </div>}
        />

      {showFilters && (
        <AdminSectionCard title="Filter Organizations" description="Narrow the organization list by name, type, and status." bodyClassName="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Name
              </label>
              <input
                className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={filters.name}
                onChange={(e) => setFilters({ ...filters, name: e.target.value })}
                placeholder="Search name"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Type
              </label>
              <select
                className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={filters.type}
                onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              >
                <option value="">All Types</option>
                <option value="logistics">Logistics</option>
                <option value="transport">Transport</option>
                <option value="school">School</option>
                <option value="taxi">Taxi</option>
                <option value="fleet">Fleet</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Status
              </label>
              <select
                className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={() => setFilters({ name: "", type: "", status: "" })}
                className="w-full bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </AdminSectionCard>
      )}

      <AdminSectionCard
        title="Organization Directory"
        description="A clean operational view of all organizations under your access scope."
        className="min-h-[420px]"
        bodyClassName="flex min-h-[340px] flex-col justify-between gap-4 p-4"
      >
        <Table<Organization> columns={columns} data={organizations} />
        <Pagination
          page={page}
          totalPages={(subOrgResponse as any)?.pagination?.totalPages ?? Math.max(1, Math.ceil(((subOrgResponse as any)?.pagination?.totalrecords ?? organizations.length) / LIMIT))}
          totalItems={(subOrgResponse as any)?.pagination?.totalrecords ?? organizations.length}
          onPageChange={setPage}
          disabled={isLoading}
        />
      </AdminSectionCard>

      <DynamicModal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={
          editingOrg
            ? "Edit Organization"
            : "Create Organization & Admin"
        }
        fields={formFields}
        schema={organizationSchema}
        initialData={

          editingOrg
            ? {
              name: editingOrg.name,
              organizationType: editingOrg.organizationType,
              email: editingOrg.email,
              phone: editingOrg.phone,
              addressLine: editingOrg.address?.addressLine || "",
              city: editingOrg.address?.city || "",
              state: editingOrg.address?.state || "",
              country: editingOrg.address?.country || "",
              pincode: editingOrg.address?.pincode || "",
              status: editingOrg.status,
            }
            : {
              parentOrganizationId: orgId || "",
              parentOrganizationDisplay: orgName || "",
            }
        }
        onSubmit={handleSubmit}
        submitLabel={editingOrg ? "Update" : "Create"}
      />
      </AdminPageShell>
    </ApiErrorBoundary >
  );
}

/* ================= FORM FIELDS ================= */

function getFormFields(isEdit: boolean, canSelectParent: boolean, currentOrgName?: string): FormField[] {
  const parentFields: FormField[] =
    canSelectParent && !isEdit
      ? [
          {
            name: "parentOrganizationDisplay",
            label: "Parent Organization",
            type: "text",
            disabled: true,
            helperText: "This organization is fixed for the current admin scope.",
            placeholder: currentOrgName || "Current organization",
          },
        ]
      : [];

  const orgFields: FormField[] = [
    ...parentFields,
    { name: "name", label: "Organization Name", type: "text", required: true },
    {
      name: "organizationType",
      label: "Type",
      type: "select",
      required: true,
      options: [
        { label: "Logistics", value: "logistics" },
        { label: "Transport", value: "transport" },
        { label: "School", value: "school" },
        { label: "Taxi", value: "taxi" },
        { label: "Fleet", value: "fleet" },
      ],
    },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "phone", label: "Phone", type: "tel", required: true, helperText: "Include country code" },
    { name: "addressLine", label: "Address Line", type: "text", required: true },
    { name: "country", label: "Country", type: "text", required: true },
    { name: "state", label: "State", type: "text", required: true },
    { name: "city", label: "City", type: "text" },
    { name: "pincode", label: "Pincode", type: "text", required: true, helperText: "Digits only" },
    ...(isEdit
      ? [
          {
            name: "status",
            label: "Status",
            type: "select" as const,
            required: true,
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
          },
        ]
      : []),
  ];

  if (isEdit) return orgFields;

  const managerFields: FormField[] = [
    {
      name: "managerFirstName",
      label: "Admin First Name",
      type: "text",
      required: true,
    },
    {
      name: "managerLastName",
      label: "Admin Last Name",
      type: "text",
      required: true,
    },
    {
      name: "managerPassword",
      label: "Admin Password",
      type: "password",
      required: true,
    },
  ];

  return [...orgFields, ...managerFields];
}
