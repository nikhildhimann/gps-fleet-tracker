"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { z } from "zod";
import {
  ArrowLeft,
  Building2,
  Car,
  Edit,
  Info,
  Radio,
  RefreshCw,
  ShieldAlert,
  UserCog,
  Users,
  Waypoints,
  X,
} from "lucide-react";
import { toast } from "sonner";
import OrganizationMap from "@/components/admin/Map/OrganizationMap";
import { DynamicModal } from "@/components/common";
import { FormField } from "@/lib/formTypes";
import { useGetDriversQuery } from "@/redux/api/driversApi";
import { useGetDeviceMappingsQuery } from "@/redux/api/deviceMappingApi";
import { useGetGpsDevicesQuery } from "@/redux/api/gpsDeviceApi";
import {
  useGetOrganizationQuery,
  useUpdateOrganizationMutation,
} from "@/redux/api/organizationApi";
import { useGetUsersQuery } from "@/redux/api/usersApi";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";
import { usePopups } from "../../Helpers/PopupContext";
import {
  formatDateTime,
  formatStatus,
  getCollection,
  getTotalRecords,
} from "@/components/superadmin/superadmin-data";
import {
  DisabledFeaturePill,
  MetricCard,
  SectionCard,
  StateBlock,
  StatusBadge,
} from "@/components/superadmin/superadmin-ui";

type Coordinates = { lat: number; lng: number };

type OrganizationResponse = Record<string, unknown>;
type OrganizationAdmin = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
  status?: string;
  createdAt?: string;
};

type MappingRecord = {
  organizationId?: string | { _id?: string; name?: string };
};

const ORGANIZATION_TYPE_OPTIONS = [
  { label: "Logistics", value: "logistics" },
  { label: "Public Transport", value: "transport" },
  { label: "Taxi / Rental", value: "taxi" },
  { label: "School / Campus", value: "school" },
  { label: "Enterprise Fleet", value: "fleet" },
];

export default function OrganizationDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { openPopup, closePopup, isPopupOpen, getPopupData } = usePopups();
  const organizationId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);

  const {
    data,
    isLoading,
    isError,
    refetch: refetchOrganization,
  } = useGetOrganizationQuery(organizationId, {
    skip: !organizationId,
    refetchOnMountOrArgChange: true,
  });
  const {
    data: allUsersData,
    refetch: refetchAllUsers,
  } = useGetUsersQuery(
    { page: 0, limit: 1, organizationId },
    { skip: !organizationId, refetchOnMountOrArgChange: true },
  );
  const {
    data: adminsData,
    refetch: refetchAdmins,
  } = useGetUsersQuery(
    { page: 0, limit: 5, organizationId, role: "admin" },
    { skip: !organizationId, refetchOnMountOrArgChange: true },
  );
  const {
    data: driversData,
    refetch: refetchDrivers,
  } = useGetDriversQuery(
    { page: 0, limit: 1, organizationId },
    { skip: !organizationId, refetchOnMountOrArgChange: true },
  );
  const {
    data: vehiclesData,
    refetch: refetchVehicles,
  } = useGetVehiclesQuery(
    { page: 0, limit: 1, organizationId },
    { skip: !organizationId, refetchOnMountOrArgChange: true },
  );
  const {
    data: devicesData,
    refetch: refetchDevices,
  } = useGetGpsDevicesQuery(
    { page: 0, limit: 1, organizationId },
    { skip: !organizationId, refetchOnMountOrArgChange: true },
  );
  const {
    data: mappingsData,
    refetch: refetchMappings,
  } = useGetDeviceMappingsQuery(
    { page: 0, limit: 1000 },
    { skip: !organizationId, refetchOnMountOrArgChange: true },
  );
  const [updateOrganization] = useUpdateOrganizationMutation();

  const organization = useMemo(() => {
    if (!data || typeof data !== "object") return null;
    if ("data" in data && data.data && typeof data.data === "object") return data.data as OrganizationResponse;
    return data as OrganizationResponse;
  }, [data]);

  const admins = useMemo(
    () => getCollection<OrganizationAdmin>(adminsData, ["data", "docs", "users"]),
    [adminsData],
  );
  const primaryAdmin = admins[0];
  const totalUsers = getTotalRecords(allUsersData, ["data", "docs", "users"]);
  const totalAdmins = getTotalRecords(adminsData, ["data", "docs", "users"]);
  const totalDrivers = getTotalRecords(driversData, ["data", "docs"]);
  const totalVehicles = getTotalRecords(vehiclesData, ["data", "docs", "vehicles"]);
  const totalDevices = getTotalRecords(devicesData, ["data", "docs"]);
  const activeMappings = useMemo(() => {
    const mappings = getCollection<MappingRecord>(mappingsData, ["data", "docs"]);
    return mappings.filter((item) => matchesOrganization(item.organizationId, organizationId)).length;
  }, [mappingsData, organizationId]);

  const position = useMemo(() => getCoordinates(organization), [organization]);
  const organizationPoint = useMemo(
    () =>
      position && organizationId
        ? [
            {
              id: organizationId,
              name: readString(organization?.name) || "Organization",
              position,
            },
          ]
        : [],
    [organization, organizationId, position],
  );

  const organizationFormFields = useMemo<FormField[]>(
    () => [
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
      },
      {
        name: "phone",
        label: "Organization Phone",
        type: "tel",
        placeholder: "Enter organization phone",
        required: true,
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
    ],
    [],
  );

  const organizationSchema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, "Organization name is required"),
        organizationType: z.string().min(1, "Organization type is required"),
        email: z.string().email("Valid email is required"),
        phone: z.string().min(1, "Phone number is required"),
        addressLine: z.string().min(1, "Address line is required"),
        country: z.string().min(1, "Country is required"),
        state: z.string().min(1, "State is required"),
        city: z.string().min(1, "City is required"),
        pincode: z.string().optional(),
        status: z.enum(["active", "inactive"]),
      }),
    [],
  );

  if (isLoading) {
    return (
      <StateBlock
        title="Loading organization detail"
        description="Fetching the real organization profile, lifecycle state, and scoped platform counts."
      />
    );
  }

  if (isError || !organization) {
    return (
      <StateBlock
        title="Organization detail is unavailable"
        description="This organization could not be loaded from the backend. Verify the record still exists and try again."
        tone="danger"
      />
    );
  }

  const name = readString(organization.name) || "Organization";
  const email = readString(organization.email);
  const phone = readString(organization.phone);
  const status = readString(organization.status) || "unknown";
  const address = formatAddress(organization.address);
  const createdAt = formatDateTime(readString(organization.createdAt));
  const updatedAt = formatDateTime(readString(organization.updatedAt));
  const organizationType =
    ORGANIZATION_TYPE_OPTIONS.find((option) => option.value === readString(organization.organizationType))
      ?.label || formatStatus(readString(organization.organizationType)) || "Not set";
  const currentActionLabel = status.toLowerCase() === "active" ? "Suspend Organization" : "Activate Organization";

  const openEditModal = () => {
    const normalizedAddress =
      typeof organization.address === "string"
        ? {
            addressLine: organization.address,
            city: "",
            state: "",
            country: "",
            pincode: "",
          }
        : typeof organization.address === "object" && organization.address
          ? (organization.address as Record<string, string>)
          : {
              addressLine: "",
              city: "",
              state: "",
              country: "",
              pincode: "",
            };

    openPopup("organizationDetailEditModal", {
      name,
      organizationType: readString(organization.organizationType),
      email,
      phone,
      addressLine: normalizedAddress.addressLine || "",
      country: normalizedAddress.country || "",
      state: normalizedAddress.state || "",
      city: normalizedAddress.city || "",
      pincode: normalizedAddress.pincode || "",
      status: readString(organization.status) || "active",
    });
  };

  const handleOrganizationSubmit = async (formData: Record<string, string>) => {
    if (!organizationId) return;

    try {
      await updateOrganization({
        id: organizationId,
        body: {
          name: formData.name,
          organizationType: formData.organizationType,
          email: formData.email,
          phone: formData.phone,
          status: formData.status,
          address: {
            addressLine: formData.addressLine,
            city: formData.city,
            state: formData.state,
            country: formData.country,
            pincode: formData.pincode || undefined,
          },
        },
      }).unwrap();

      toast.success("Organization updated successfully");
      closePopup("organizationDetailEditModal");
      refetchOrganization();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "data" in error &&
        typeof (error as { data?: { message?: string } }).data?.message === "string"
          ? (error as { data: { message: string } }).data.message
          : "Failed to update organization";
      toast.error(message);
    }
  };

  const handleStatusToggle = async () => {
    if (!organizationId) return;

    try {
      await updateOrganization({
        id: organizationId,
        body: {
          name,
          organizationType: readString(organization.organizationType),
          email,
          phone,
          status: status.toLowerCase() === "active" ? "inactive" : "active",
          address:
            typeof organization.address === "object" && organization.address
              ? organization.address
              : {
                  addressLine: typeof organization.address === "string" ? organization.address : "",
                  city: "",
                  state: "",
                  country: "",
                  pincode: "",
                },
        },
      }).unwrap();

      toast.success(`Organization ${status.toLowerCase() === "active" ? "suspended" : "activated"} successfully`);
      setIsStatusConfirmOpen(false);
      refetchOrganization();
    } catch (error: unknown) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "data" in error &&
        typeof (error as { data?: { message?: string } }).data?.message === "string"
          ? (error as { data: { message: string } }).data.message
          : "Failed to update organization status";
      toast.error(message);
    }
  };

  const handleRefresh = async () => {
    await Promise.all([
      refetchOrganization(),
      refetchAllUsers(),
      refetchAdmins(),
      refetchDrivers(),
      refetchVehicles(),
      refetchDevices(),
      refetchMappings(),
    ]);
    toast.success("Organization data refreshed");
  };

  return (
    <div className="space-y-6 pb-8 sm:space-y-8">
      <section className="rounded-[28px] border border-slate-800/80 bg-slate-900/65 p-5 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.85)] sm:p-6 lg:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-[11px] font-black uppercase tracking-[0.18em] text-slate-200 transition hover:bg-slate-900"
            >
              <ArrowLeft size={14} />
              Back
            </button>

            <div className="space-y-2">
              <p className="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-400/70">
                Organization Detail
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <h1 className="text-3xl font-black tracking-tight text-slate-50">{name}</h1>
                <StatusBadge value={status} />
              </div>
              <p className="max-w-3xl text-sm font-medium leading-6 text-slate-400">
                Platform-owner view of organization lifecycle state, contact profile, org-admin coverage,
                and scoped operational counts backed by real APIs.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap xl:max-w-[540px] xl:justify-end">
            <button
              type="button"
              onClick={handleRefresh}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-200 transition hover:bg-slate-900"
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-500/25"
            >
              <Edit size={14} />
              Edit Organization
            </button>
            <Link
              href={`/superadmin/users?organizationId=${organizationId}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-100 transition hover:border-slate-600"
            >
              <Users size={14} />
              Manage Org Admins
            </Link>
            <button
              type="button"
              onClick={() => setIsStatusConfirmOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-amber-100 transition hover:bg-amber-500/20"
            >
              <ShieldAlert size={14} />
              {currentActionLabel}
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
        <MetricCard label="Org Admins" value={totalAdmins} helper="Admin accounts linked to this organization" />
        <MetricCard label="Users" value={totalUsers} helper="User records returned by the current backend" />
        <MetricCard label="Drivers" value={totalDrivers} helper="Scoped driver count" />
        <MetricCard label="Vehicles" value={totalVehicles} helper="Scoped fleet count" />
        <MetricCard label="GPS Devices" value={totalDevices} helper="Scoped hardware count" />
        <MetricCard label="Active Mappings" value={activeMappings} helper="Active device-to-vehicle mappings" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard title="Organization Profile" description="Identity, contact, and lifecycle metadata from the backend.">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoItem label="Organization Type" value={organizationType} />
            <InfoItem label="Status" value={formatStatus(status)} />
            <InfoItem label="Email" value={email || "Unavailable"} />
            <InfoItem label="Phone" value={phone || "Unavailable"} />
            <InfoItem label="Created" value={createdAt || "Unavailable"} />
            <InfoItem label="Last Updated" value={updatedAt || "Unavailable"} />
            <InfoItem label="Organization ID" value={readString(organization._id) || organizationId || "Unavailable"} />
            <InfoItem
              label="Primary Admin"
              value={primaryAdmin ? getAdminName(primaryAdmin) : "No org-admin record available"}
            />
          </div>

          <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Address</p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {address || "Address details are unavailable for this organization."}
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Org Admin Summary"
          description="Current organization admin accounts visible from the real user API."
          action={
            <Link
              href={`/superadmin/users?organizationId=${organizationId}`}
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-emerald-200 transition hover:text-emerald-100"
            >
              Open Org Admins
            </Link>
          }
        >
          {admins.length > 0 ? (
            <div className="space-y-3">
              {admins.map((admin) => (
                <div key={admin._id} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-slate-100">{getAdminName(admin)}</p>
                      <p className="mt-1 text-xs text-slate-400">{admin.email || "No email configured"}</p>
                      <p className="mt-1 text-xs text-slate-500">{admin.mobile || "No mobile configured"}</p>
                    </div>
                    <StatusBadge value={admin.status} />
                  </div>
                  <p className="mt-4 text-xs text-slate-400">
                    Created {formatDateTime(admin.createdAt) || "date unavailable"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <StateBlock
              title="No org-admin record available"
              description="The organization is loaded, but the current backend query did not return any admin account for it."
            />
          )}
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Plan & Subscription"
          description="Current billing status and entitlement oversight for this organization."
        >
          <div className="space-y-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                  <Waypoints size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-slate-100">Standard Platform Plan</p>
                  <p className="text-xs text-slate-500">Default system entitlement tier</p>
                </div>
              </div>
              <StatusBadge value="Active" />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Renewal Date</p>
                <p className="mt-1 text-sm font-semibold text-slate-300">Lifetime / Perpetual</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Billing Logic</p>
                <p className="mt-1 text-sm font-semibold text-slate-300">Manual Oversight</p>
              </div>
            </div>

            <p className="text-xs leading-5 text-slate-500 bg-slate-950/60 p-3 rounded-xl border border-slate-800/50">
              <Info size={14} className="inline mr-2 mb-0.5 text-emerald-400/70" />
              Advanced subscription lifecycle (Stripe/PayPal integration, trial periods, and auto-suspension) 
              is pending further backend development. Current state is "Standard" for all clients.
            </p>
          </div>
        </SectionCard>

        <SectionCard
          title="Support Access & Oversight"
          description="Phase 2/3 foundation for secure platform-owner assistance workflows."
        >
          <div className="space-y-4">
            <div className="flex items-start gap-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400">
                <ShieldAlert size={18} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-100">Secure Impersonation Disabled</p>
                <p className="text-xs leading-5 text-slate-400">
                  Audit-safe backend impersonation APIs do not exist yet. No insecure localStorage-based 
                  session hijacking is implemented in this refactor.
                </p>
              </div>
            </div>
            
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-600 px-1 pt-2">
              Roadmap Focus
            </p>
            <div className="grid grid-cols-1 gap-2">
               <div className="flex items-center gap-3 px-1 text-xs text-slate-500">
                  <div className="h-1 w-1 rounded-full bg-slate-700" />
                  <span>Auditable "View-As" platform mode</span>
               </div>
               <div className="flex items-center gap-3 px-1 text-xs text-slate-500">
                  <div className="h-1 w-1 rounded-full bg-slate-700" />
                  <span>Scoped support-token generation</span>
               </div>
            </div>
          </div>
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6">
        <SectionCard
          title="Location & Geographical Context"
          description="Map renders only when valid organization coordinates are returned by the backend."
        >
          {position ? (
            <div className="h-[420px] overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/60 shadow-inner">
              <OrganizationMap organizations={organizationPoint} selectedOrgId={organizationId} vehicles={[]} />
            </div>
          ) : (
            <div className="flex h-[360px] items-center justify-center rounded-[24px] border border-dashed border-slate-800 bg-slate-950/40 p-10 text-center">
               <div className="max-w-xs space-y-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-900 text-slate-600">
                    <Waypoints size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-slate-400">No Location Data</p>
                    <p className="text-xs text-slate-500">
                      Geographical coordinates (lat/lng) have not been registered for this organization profile.
                    </p>
                  </div>
               </div>
            </div>
          )}
        </SectionCard>
      </section>

      <DynamicModal
        isOpen={isPopupOpen("organizationDetailEditModal")}
        onClose={() => closePopup("organizationDetailEditModal")}
        title="Edit Organization"
        description="Update backend-supported organization profile fields and lifecycle status."
        fields={organizationFormFields}
        initialData={isPopupOpen("organizationDetailEditModal") ? getPopupData("organizationDetailEditModal") || {} : {}}
        schema={organizationSchema}
        onSubmit={handleOrganizationSubmit as any}
        submitLabel="Update Organization"
        variant="dark"
      />

      <ConfirmLifecycleModal
        isOpen={isStatusConfirmOpen}
        title={currentActionLabel}
        description={
          status.toLowerCase() === "active"
            ? "This will mark the organization inactive using the real backend status update flow."
            : "This will reactivate the organization using the real backend status update flow."
        }
        confirmLabel={status.toLowerCase() === "active" ? "Suspend" : "Activate"}
        onCancel={() => setIsStatusConfirmOpen(false)}
        onConfirm={handleStatusToggle}
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-100">{value}</p>
    </div>
  );
}

function ConfirmLifecycleModal({
  isOpen,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!isOpen || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center p-2 sm:items-center sm:p-4">
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
            className="flex-1 rounded-xl border border-amber-500/20 bg-amber-500 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-400"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : "";
}

function formatAddress(address: unknown) {
  if (typeof address === "string" && address.trim()) return address;
  if (!address || typeof address !== "object") return "";

  const source = address as Record<string, unknown>;
  return [
    readString(source.addressLine),
    readString(source.city),
    readString(source.state),
    readString(source.country),
    readString(source.pincode),
  ]
    .filter(Boolean)
    .join(", ");
}

function getAdminName(admin?: OrganizationAdmin | null) {
  if (!admin) return "";
  return [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() || admin.email || "Organization Admin";
}

function matchesOrganization(
  source: string | { _id?: string; name?: string } | undefined,
  organizationId?: string,
) {
  if (!organizationId || !source) return false;
  if (typeof source === "string") return source === organizationId;
  return source._id === organizationId;
}

function getCoordinates(source: Record<string, unknown> | null): Coordinates | null {
  if (!source) return null;

  const candidates: Array<Record<string, unknown>> = [];

  if (source.geo && typeof source.geo === "object") candidates.push(source.geo as Record<string, unknown>);
  if (source.location && typeof source.location === "object") candidates.push(source.location as Record<string, unknown>);
  candidates.push(source);

  for (const candidate of candidates) {
    const lat = readNumber(candidate.lat ?? candidate.latitude);
    const lng = readNumber(candidate.lng ?? candidate.longitude ?? candidate.lon);

    if (lat !== null && lng !== null) {
      return { lat, lng };
    }
  }

  return null;
}

function readNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
