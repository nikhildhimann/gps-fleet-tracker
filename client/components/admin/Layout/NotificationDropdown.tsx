"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NotificationListItem } from "@/components/admin/notifications/NotificationListItem";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminNotification } from "@/lib/adminNotifications";
import { getNotificationPrimaryRoute } from "@/lib/adminNotifications";
import {
  useBulkMarkAdminNotificationsAsReadMutation,
  useDeleteAdminNotificationMutation,
  useGetAdminNotificationCountsQuery,
  useGetAdminNotificationsQuery,
  useMarkAdminNotificationAsAcknowledgedMutation,
  useMarkAdminNotificationAsReadMutation,
  useMarkAdminNotificationAsResolvedMutation,
} from "@/redux/api/adminNotificationsApi";
import { getApiErrorMessage } from "@/utils/apiError";

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ isOpen, onClose }: NotificationDropdownProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isBulkPending, setIsBulkPending] = useState(false);

  const {
    data: notificationsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetAdminNotificationsQuery(
    { page: 0, limit: 8 },
    {
      skip: !isOpen,
      pollingInterval: isOpen ? 30000 : 0,
      refetchOnMountOrArgChange: true,
    }
  );

  const { data: countsData } = useGetAdminNotificationCountsQuery(undefined, {
    skip: !isOpen,
    pollingInterval: isOpen ? 30000 : 0,
  });

  const [markAsRead] = useMarkAdminNotificationAsReadMutation();
  const [markAsAcknowledged] = useMarkAdminNotificationAsAcknowledgedMutation();
  const [markAsResolved] = useMarkAdminNotificationAsResolvedMutation();
  const [bulkMarkAsRead] = useBulkMarkAdminNotificationsAsReadMutation();
  const [deleteNotification] = useDeleteAdminNotificationMutation();

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const notifications = notificationsData?.data || [];
  const unreadCount = countsData?.data?.unread ?? 0;

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
      toast.error(getApiErrorMessage(actionError, "Notification action failed"));
    } finally {
      setPendingId(null);
    }
  };

  const handleOpenRelated = async (notification: AdminNotification) => {
    const route = getNotificationPrimaryRoute(notification);
    if (!route) {
      return;
    }

    if (!notification.isRead) {
      await runAction(notification, (id) => markAsRead(id).unwrap(), "Notification marked as read");
    }

    onClose();
    router.push(route);
  };

  const handleDelete = async (notification: AdminNotification) => {
    if (!window.confirm("Delete this notification?")) {
      return;
    }

    await runAction(notification, (id) => deleteNotification(id).unwrap(), "Notification deleted");
  };

  const handleMarkAllRead = async () => {
    setIsBulkPending(true);

    try {
      await bulkMarkAsRead(undefined).unwrap();
      toast.success("Unread notifications marked as read");
    } catch (actionError) {
      toast.error(getApiErrorMessage(actionError, "Unable to update notifications right now"));
    } finally {
      setIsBulkPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-start justify-center px-2 pt-24 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:block sm:p-0">
      <div className="w-[min(24rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_45px_rgba(15,23,42,0.16)] sm:mt-2 sm:w-[24rem] sm:max-w-[24rem]">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-slate-600" />
          <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
          {unreadCount > 0 && (
            <Badge className="bg-red-600 text-white">{unreadCount > 99 ? "99+" : unreadCount}</Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={isBulkPending}
              onClick={handleMarkAllRead}
              className="text-xs font-semibold text-slate-800 hover:text-slate-950"
            >
              Mark all read
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[min(32rem,calc(100dvh-9rem))] overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-2xl border border-slate-200 bg-slate-50"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
            <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
            <h4 className="mt-3 text-sm font-semibold text-slate-900">Unable to load notifications</h4>
            <p className="mt-1 text-xs text-slate-600">
              The latest notifications could not be fetched right now.
            </p>
            <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
            <Bell className="mx-auto h-8 w-8 text-slate-300" />
            <h4 className="mt-3 text-sm font-semibold text-slate-900">No notifications yet</h4>
            <p className="mt-1 text-xs text-slate-500">
              New alerts and admin events will appear here when they are created.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <NotificationListItem
                key={notification._id}
                notification={notification}
                compact
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
      </div>

      <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full font-semibold text-slate-800 hover:text-slate-950"
          onClick={() => {
            onClose();
            router.push("/admin/notifications");
          }}
        >
          View all notifications
        </Button>
      </div>
      </div>
    </div>
  );
}
