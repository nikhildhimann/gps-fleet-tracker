"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  ArrowRight,
  Building2,
  Car,
  Radio,
  Settings,
  ShieldAlert,
  Users,
  UserRoundCog,
  type LucideIcon,
} from "lucide-react";
import { useGetMeQuery, useGetUsersQuery } from "@/redux/api/usersApi";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";
import { useGetGpsDevicesQuery } from "@/redux/api/gpsDeviceApi";
import { useGetAdminNotificationsQuery } from "@/redux/api/adminNotificationsApi";
import {
  formatDateTime,
  formatStatus,
  getCollection,
  getDisplayName,
  getInitials,
  sortByCreatedAtDesc,
} from "@/components/superadmin/superadmin-data";
import {
  ActionLink,
  MetricCard,
  SectionCard,
  StateBlock,
  StatusBadge,
} from "@/components/superadmin/superadmin-ui";

type OrganizationRecord = {
  _id: string;
  name?: string;
  email?: string;
  status?: string;
  createdAt?: string;
  adminUser?: unknown;
};

type UserRecord = {
  _id: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  status?: string;
  createdAt?: string;
  organizationId?: string | { _id?: string; name?: string };
};

type VehicleRecord = {
  _id: string;
};

type DeviceRecord = {
  _id: string;
};

export default function SuperAdminDashboardPage() {
  const { data: meData } = useGetMeQuery(undefined);
  const {
    data: orgData,
    isLoading: isOrganizationsLoading,
    isError: organizationsError,
  } = useGetOrganizationsQuery({ page: 0, limit: 1000 });
  const {
    data: usersData,
    isLoading: isUsersLoading,
    isError: usersError,
  } = useGetUsersQuery({ page: 0, limit: 1000, role: "admin" });
  const {
    data: vehiclesData,
    isLoading: isVehiclesLoading,
    isError: vehiclesError,
  } = useGetVehiclesQuery({ page: 0, limit: 1000 });
  const {
    data: devicesData,
    isLoading: isDevicesLoading,
    isError: devicesError,
  } = useGetGpsDevicesQuery({ page: 0, limit: 1000 });
  
  // Real platform activity pull
  const {
    data: activityData,
    isLoading: isActivityLoading,
  } = useGetAdminNotificationsQuery({ limit: 5 });

  const me = meData?.data;
  const displayName = getDisplayName(me);
  const initials = getInitials(displayName);

  const organizations = useMemo(
    () => sortByCreatedAtDesc(getCollection<OrganizationRecord>(orgData, ["data", "docs", "organizations"])),
    [orgData],
  );
  const orgAdmins = useMemo(
    () => sortByCreatedAtDesc(getCollection<UserRecord>(usersData, ["data", "docs", "users"])),
    [usersData],
  );
  const vehicles = useMemo(
    () => getCollection<VehicleRecord>(vehiclesData, ["data", "docs", "vehicles"]),
    [vehiclesData],
  );
  const devices = useMemo(
    () => getCollection<DeviceRecord>(devicesData, ["data", "docs"]),
    [devicesData],
  );
  
  const activities = useMemo(() => {
    // Backend returns { status: true, data: [...], total: ... } based on adminNotificationsApi
    return activityData?.data || [];
  }, [activityData]);

  const activeOrganizations = useMemo(
    () => organizations.filter((item) => (item.status || "").toLowerCase() === "active").length,
    [organizations],
  );
  const inactiveOrganizations = useMemo(
    () => organizations.filter((item) => (item.status || "").toLowerCase() !== "active"),
    [organizations],
  );
  const organizationsWithoutAdmin = useMemo(
    () => organizations.filter((item) => !item.adminUser),
    [organizations],
  );
  const activeOrgAdmins = useMemo(
    () => orgAdmins.filter((item) => (item.status || "").toLowerCase() === "active").length,
    [orgAdmins],
  );
  
  const recentOrganizations = organizations.slice(0, 5);
  const needsAttention = inactiveOrganizations.slice(0, 3);
  const missingAdminAttention = organizationsWithoutAdmin.slice(0, 3);

  const isLoading =
    isOrganizationsLoading || isUsersLoading || isVehiclesLoading || isDevicesLoading;
  const hasError = organizationsError || usersError || vehiclesError || devicesError;

  return (
    <div className="space-y-6 pb-8 sm:space-y-8">
      <section className="rounded-[28px] border border-slate-800/80 bg-slate-900/65 p-5 shadow-[0_30px_80px_-50px_rgba(15,23,42,0.85)] sm:p-6 lg:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <p className="text-[11px] font-black uppercase tracking-[0.34em] text-emerald-400/70">
              Platform Owner Panel
            </p>
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-50 sm:text-4xl">
                Superadmin Console
              </h1>
              <p className="max-w-3xl text-sm font-medium leading-6 text-slate-400">
                Operate the platform at organization level: onboard clients, monitor org admin coverage,
                and review platform-wide counts without mixing in day-to-day organization operations.
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-4 rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400 text-lg font-black text-slate-950">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-50">{displayName}</p>
              <p className="truncate text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">
                {formatStatus(me?.role || "superadmin")}
              </p>
              <p className="truncate text-xs text-slate-400">{me?.email || "Global platform access"}</p>
            </div>
          </div>
        </div>
      </section>

      {hasError ? (
        <StateBlock
          title="Platform metrics are temporarily unavailable"
          description="The dashboard could not load one or more backend-backed superadmin datasets. Refresh the page after verifying the APIs are reachable."
          tone="danger"
        />
      ) : null}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <MetricCard label="Organizations" value={organizations.length} helper={`${activeOrganizations} active organizations`} />
            <MetricCard label="Inactive Orgs" value={inactiveOrganizations.length} helper="Require platform owner follow-up" />
            <MetricCard label="Org Admins" value={orgAdmins.length} helper={`${activeOrgAdmins} active org-admin accounts`} />
            <MetricCard label="Vehicles" value={vehicles.length} helper="Global read-only fleet count" />
            <MetricCard label="GPS Devices" value={devices.length} helper="Global read-only device count" />
          </>
        )}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title="Recent Platform Activity"
          description="Critical backend-backed events from across the ecosystem."
          action={<ActionLink href="/superadmin/history" label="View Full Log" />}
        >
          {isActivityLoading ? (
            <ListSkeleton />
          ) : (
            <div className="space-y-3">
              {activities.length > 0 ? (
                activities.map((item: any) => (
                  <div
                    key={item._id}
                    className="group flex items-start gap-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-emerald-500/25"
                  >
                    <div className={`mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${
                      item.severity === "critical" 
                        ? "border-rose-500/30 bg-rose-500/10 text-rose-400" 
                        : item.severity === "warning"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    }`}>
                      <Radio size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-sm font-black text-slate-100">{item.title || "Platform Event"}</p>
                        <span className="shrink-0 text-[10px] font-medium text-slate-500">
                          {formatDateTime(item.occurredAt || item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">{item.message}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                          Type: {item.type || "System"}
                        </span>
                        {item.organizationId && (
                          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500/60">
                            Org Linked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-4 text-center text-sm font-medium text-slate-500">No recent activities found.</p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Attention Needed"
          description="Real platform follow-up items that need superadmin visibility."
          action={<ActionLink href="/superadmin/organizations?status=inactive" label="Review Inactive Orgs" />}
        >
          {isLoading ? (
            <ListSkeleton />
          ) : needsAttention.length > 0 || missingAdminAttention.length > 0 ? (
            <div className="space-y-3">
              {needsAttention.map((item) => (
                <AttentionCard
                  key={`inactive-${item._id}`}
                  icon={ShieldAlert}
                  title={item.name || "Organization"}
                  description="Organization is inactive and may need subscription revival or cleanup."
                  href={`/superadmin/organizations/${item._id}`}
                />
              ))}
              {missingAdminAttention.map((item) => (
                <AttentionCard
                  key={`missing-admin-${item._id}`}
                  icon={UserRoundCog}
                  title={item.name || "Organization"}
                  description="No primary admin is linked to this organization record. Onboarding possibly incomplete."
                  href={`/superadmin/organizations/${item._id}`}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-800 text-slate-500">
                <ShieldAlert size={24} />
              </div>
              <p className="mt-4 text-sm font-black text-slate-400">All clear</p>
              <p className="mt-1 text-xs text-slate-500">No organizations require immediate attention right now.</p>
            </div>
          )}
        </SectionCard>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_1fr]">
        <SectionCard
          title="Recent Organizations"
          description="Newest client organizations created on the platform."
          action={<ActionLink href="/superadmin/organizations" label="Open Organizations" />}
        >
          {isLoading ? (
            <ListSkeleton />
          ) : (
            <div className="space-y-3">
              {recentOrganizations.length > 0 ? (
                recentOrganizations.map((item) => (
                  <Link
                    key={item._id}
                    href={`/superadmin/organizations/${item._id}`}
                    className="block rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-emerald-500/25"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-sm font-black text-slate-100">{item.name || "Organization"}</p>
                        <p className="mt-1 text-xs font-medium text-slate-400">{item.email || "No email configured"}</p>
                      </div>
                      <StatusBadge value={item.status} />
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
                      <span>{formatDateTime(item.createdAt) || "Recently created"}</span>
                      <span className="inline-flex items-center gap-1 font-black uppercase tracking-[0.18em] text-emerald-200">
                        Open
                        <ArrowRight size={13} />
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="text-sm font-medium text-slate-400">No organizations available yet.</p>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Quick Actions"
          description="The fastest backend-backed platform owner workflows."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <QuickActionCard
              icon={Building2}
              title="Onboard Client"
              description="Start a new organization creation and admin provisioning flow."
              href="/superadmin/organizations?action=create"
            />
            <QuickActionCard
              icon={Radio}
              title="Inventory Oversight"
              description="Review global GPS device stock and organization allocation."
              href="/superadmin/gps-devices"
            />
            <QuickActionCard
              icon={Users}
              title="Audit Personnel"
              description="Review and maintain organization-admin accounts across the platform."
              href="/superadmin/users"
            />
            <QuickActionCard
              icon={Settings}
              title="Platform Scope"
              description="Review current platform context and environment-backed settings."
              href="/superadmin/settings"
            />
          </div>
        </SectionCard>
      </section>
    </div>
  );
}


function AttentionCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-emerald-500/25"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-200">
          <Icon size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-100">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
    </Link>
  );
}

function QuickActionCard({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-emerald-500/25 hover:bg-slate-950"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-200">
        <Icon size={18} />
      </div>
      <p className="mt-3 text-sm font-black text-slate-100">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-200">
        Open
        <ArrowRight size={14} />
      </span>
    </Link>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-[24px] border border-slate-800/80 bg-slate-900/65 p-5 shadow-[0_24px_60px_-45px_rgba(15,23,42,0.85)]">
      <div className="h-3 w-28 animate-pulse rounded bg-slate-800" />
      <div className="mt-4 h-8 w-20 animate-pulse rounded bg-slate-800" />
      <div className="mt-2 h-3 w-36 animate-pulse rounded bg-slate-800" />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
          <div className="h-4 w-40 animate-pulse rounded bg-slate-800" />
          <div className="mt-3 h-3 w-32 animate-pulse rounded bg-slate-800" />
          <div className="mt-4 h-3 w-24 animate-pulse rounded bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

function getUserName(user: UserRecord) {
  return [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.email || "Organization Admin";
}

function getOrganizationName(value?: UserRecord["organizationId"]) {
  if (!value) return "Organization not available";
  if (typeof value === "object") return value.name || "Organization";
  return "Organization linked";
}
