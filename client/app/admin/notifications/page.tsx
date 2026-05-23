"use client";

import { useDeferredValue, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Filter,
  RefreshCw,
  Search,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NotificationListItem } from "@/components/admin/notifications/NotificationListItem";
import { Button } from "@/components/ui/button";
import type {
  AdminNotification,
  NotificationSeverity,
  NotificationQueryParams,
  NotificationStatus,
  NotificationType,
} from "@/lib/adminNotifications";
import {
  NOTIFICATION_SEVERITY_OPTIONS,
  NOTIFICATION_STATUS_OPTIONS,
  NOTIFICATION_TYPE_OPTIONS,
  getNotificationPrimaryRoute,
} from "@/lib/adminNotifications";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";
import {
  useBulkMarkAdminNotificationsAsAcknowledgedMutation,
  useBulkMarkAdminNotificationsAsReadMutation,
  useDeleteAdminNotificationMutation,
  useGetAdminNotificationCountsQuery,
  useGetAdminNotificationsQuery,
  useMarkAdminNotificationAsAcknowledgedMutation,
  useMarkAdminNotificationAsReadMutation,
  useMarkAdminNotificationAsResolvedMutation,
} from "@/redux/api/adminNotificationsApi";
import { getApiErrorMessage } from "@/utils/apiError";

const PAGE_SIZE = 20;

type FiltersState = {
  organizationId: string;
  type: NotificationType | "";
  severity: NotificationSeverity | "";
  status: NotificationStatus | "";
  dateFrom: string;
  dateTo: string;
};

const DEFAULT_FILTERS: FiltersState = {
  organizationId: "",
  type: "",
  severity: "",
  status: "",
  dateFrom: "",
  dateTo: "",
};

const buildQuery = (filters: Partial<NotificationQueryParams>) =>
  Object.fromEntries(
    Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );

const CountCard = ({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: string;
}) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
    <div className={`mt-2 text-2xl font-black ${accent}`}>{value}</div>
  </div>
);

export default function NotificationsPage() {
  const router = useRouter();
  const [filters, setFilters] = useState<FiltersState>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearch = useDeferredValue(searchQuery);
  const [page, setPage] = useState(0);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState<"read" | "acknowledge" | null>(null);

  const listParams = useMemo(
    () =>
      buildQuery({
        ...filters,
        page,
        limit: PAGE_SIZE,
        search: deferredSearch.trim(),
      }),
    [filters, page, deferredSearch]
  );

  const countsParams = useMemo(
    () =>
      buildQuery({
        organizationId: filters.organizationId,
        type: filters.type,
        severity: filters.severity,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      }),
    [filters.organizationId, filters.type, filters.severity, filters.dateFrom, filters.dateTo]
  );

  const bulkParams = useMemo(
    () =>
      buildQuery({
        ...filters,
        search: deferredSearch.trim(),
      }),
    [filters, deferredSearch]
  );

  const {
    data: notificationsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetAdminNotificationsQuery(listParams, {
    refetchOnMountOrArgChange: true,
  });
  const { data: countsData } = useGetAdminNotificationCountsQuery(countsParams, {
    refetchOnMountOrArgChange: true,
  });
  const { data: organizationsData } = useGetOrganizationsQuery(undefined);

  const [markAsRead] = useMarkAdminNotificationAsReadMutation();
  const [markAsAcknowledged] = useMarkAdminNotificationAsAcknowledgedMutation();
  const [markAsResolved] = useMarkAdminNotificationAsResolvedMutation();
  const [bulkMarkRead] = useBulkMarkAdminNotificationsAsReadMutation();
  const [bulkMarkAcknowledged] = useBulkMarkAdminNotificationsAsAcknowledgedMutation();
  const [deleteNotification] = useDeleteAdminNotificationMutation();

  const notifications = notificationsData?.data || [];
  const pagination = notificationsData?.pagination;
  const counts = countsData?.data;
  const organizations = organizationsData?.data || [];
  const hasFilters = Boolean(
    searchQuery.trim() ||
      filters.organizationId ||
      filters.type ||
      filters.severity ||
      filters.status ||
      filters.dateFrom ||
      filters.dateTo
  );

  const runAction = async (
    notification: AdminNotification,
    action: (id: string) => Promise<unknown>,
    successMessage: string,
  ) => {
    setPendingId(notification._id);

    try {
      await action(notification._id);
      toast.success(successMessage);
    } catch (actionError) {
      toast.error(getApiErrorMessage(actionError, "Unable to update this notification right now"));
    } finally {
      setPendingId(null);
    }
  };

  const runBulkAction = async (
    kind: "read" | "acknowledge",
    action: () => Promise<unknown>,
    successMessage: string,
  ) => {
    setBulkPending(kind);

    try {
      await action();
      toast.success(successMessage);
    } catch (actionError) {
      toast.error(getApiErrorMessage(actionError, "Unable to update notifications right now"));
    } finally {
      setBulkPending(null);
    }
  };

  const updateFilter = (key: keyof FiltersState, value: string) => {
    setPage(0);
    setFilters((previous) => ({ ...previous, [key]: value }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchQuery("");
    setPage(0);
  };

  const handleOpenRelated = async (notification: AdminNotification) => {
    const route = getNotificationPrimaryRoute(notification);
    if (!route) {
      return;
    }

    if (!notification.isRead) {
      await runAction(notification, (id) => markAsRead(id).unwrap(), "Notification marked as read");
    }

    router.push(route);
  };

  const handleDelete = async (notification: AdminNotification) => {
    if (!window.confirm("Delete this notification?")) {
      return;
    }

    await runAction(notification, (id) => deleteNotification(id).unwrap(), "Notification deleted");
  };

  return (
    <AdminPageShell contentClassName="space-y-6">
      <AdminPageHeader
        eyebrow="Alerts Center"
        title="Notifications"
        description="Review alert, import, mapping, and admin activity in one place."
        actions={<div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap lg:w-auto lg:justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  runBulkAction(
                    "read",
                    () => bulkMarkRead(bulkParams).unwrap(),
                    "Unread notifications marked as read"
                  )
                }
                disabled={(counts?.unread || 0) === 0 || bulkPending !== null}
                className="font-semibold text-slate-800 hover:text-slate-950"
              >
                Mark all read
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  runBulkAction(
                    "acknowledge",
                    () => bulkMarkAcknowledged(bulkParams).unwrap(),
                    "New notifications acknowledged"
                  )
                }
                disabled={(counts?.new || 0) === 0 || bulkPending !== null}
                className="font-semibold text-slate-800 hover:text-slate-950"
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Bulk acknowledge
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="font-semibold text-slate-800 hover:text-slate-950"
                onClick={() => refetch()}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>}
      />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <CountCard label="Total" value={counts?.total || 0} accent="text-slate-900" />
          <CountCard label="Unread" value={counts?.unread || 0} accent="text-blue-600" />
          <CountCard label="New" value={counts?.new || 0} accent="text-amber-600" />
          <CountCard label="Acknowledged" value={counts?.acknowledged || 0} accent="text-orange-600" />
          <CountCard label="Resolved" value={counts?.resolved || 0} accent="text-emerald-600" />
        </div>

        <AdminSectionCard title="Filters" description="Search and narrow notifications by organization, severity, workflow status, and date." bodyClassName="p-4">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-900">Filters</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Search
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={searchQuery}
                  onChange={(event) => {
                    setPage(0);
                    setSearchQuery(event.target.value);
                  }}
                  placeholder="Search title or message"
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Organization
              </label>
              <select
                value={filters.organizationId}
                onChange={(event) => updateFilter("organizationId", event.target.value)}
                className="admin-select w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="">All organizations</option>
                {organizations.map((organization: { _id: string; name?: string }) => (
                  <option key={organization._id} value={organization._id}>
                    {organization.name || "Unnamed organization"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Type
              </label>
              <select
                value={filters.type}
                onChange={(event) => updateFilter("type", event.target.value)}
                className="admin-select w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="">All types</option>
                {NOTIFICATION_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Severity
              </label>
              <select
                value={filters.severity}
                onChange={(event) => updateFilter("severity", event.target.value)}
                className="admin-select w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="">All severities</option>
                {NOTIFICATION_SEVERITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                Workflow Status
              </label>
              <select
                value={filters.status}
                onChange={(event) => updateFilter("status", event.target.value)}
                className="admin-select w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              >
                <option value="">All statuses</option>
                {NOTIFICATION_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                From date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(event) => updateFilter("dateFrom", event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                To date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(event) => updateFilter("dateTo", event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={clearFilters} disabled={!hasFilters}>
                Clear filters
              </Button>
            </div>
          </div>
        </AdminSectionCard>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
            <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
            <h3 className="mt-3 text-lg font-semibold text-slate-900">Unable to load notifications</h3>
            <p className="mt-2 text-sm text-slate-600">
              The notifications service could not be reached. You can retry without losing your filters.
            </p>
            <Button type="button" variant="outline" className="mt-4" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm"
              />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <Bell className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              {hasFilters ? "No notifications match these filters" : "No notifications yet"}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              {hasFilters
                ? "Try clearing one or more filters to widen the result set."
                : "Alert, mapping, import, and admin events will appear here as they happen."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => (
              <NotificationListItem
                key={notification._id}
                notification={notification}
                actionPending={pendingId === notification._id || isFetching}
                onMarkRead={(item) =>
                  runAction(item, (id) => markAsRead(id).unwrap(), "Notification marked as read")
                }
                onAcknowledge={(item) =>
                  runAction(item, (id) => markAsAcknowledged(id).unwrap(), "Notification acknowledged")
                }
                onResolve={(item) =>
                  runAction(item, (id) => markAsResolved(id).unwrap(), "Notification resolved")
                }
                onDelete={handleDelete}
                onOpenRelated={handleOpenRelated}
              />
            ))}
          </div>
        )}

        {!error && pagination && pagination.totalPages > 1 && (
          <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row">
            <p className="text-sm text-slate-600">
              Showing page {pagination.currentPage + 1} of {Math.max(pagination.totalPages, 1)} with{" "}
              {pagination.totalrecords} notification{pagination.totalrecords === 1 ? "" : "s"}.
            </p>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((previous) => Math.max(previous - 1, 0))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages - 1}
                onClick={() => setPage((previous) => previous + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-500 shadow-sm">
          Related notification links route to the closest verified admin page. Alert and device-health
          notifications currently open the history view because that route exists and is the safest place
          to investigate recent event context.
        </div>
    </AdminPageShell>
  );
}
