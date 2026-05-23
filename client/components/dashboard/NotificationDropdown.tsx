"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bell, RefreshCw, X, Clock3, CheckCircle, AlertCircle, Info, MapPin, Radio, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  useGetNotificationsQuery,
  useGetNotificationCountsQuery,
  useMarkAsReadMutation,
  useMarkAllAsReadMutation,
  useClearAllNotificationsMutation,
  useDeleteNotificationMutation,
} from "@/redux/api/notificationsApi";

interface DashboardNotification {
  _id: string;
  type?: string;
  message?: string;
  title?: string;
  description?: string;
  vehicleId?: string;
  vehicleNumber?: string;
  severity?: "low" | "medium" | "high" | "info" | "warning" | "error" | "success";
  isRead?: boolean;
  createdAt: string;
  updatedAt: string;
}

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
  } = useGetNotificationsQuery(
    undefined,
    {
      skip: !isOpen,
      pollingInterval: isOpen ? 30000 : 0,
      refetchOnMountOrArgChange: true,
    }
  );

  const { data: countsData } = useGetNotificationCountsQuery(undefined, {
    skip: !isOpen,
    pollingInterval: isOpen ? 30000 : 0,
    refetchOnMountOrArgChange: true,
  });

  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();
  const [clearAllNotifications] = useClearAllNotificationsMutation();
  const [deleteNotification] = useDeleteNotificationMutation();

  // Handle different data structures
  const notifications = notificationsData?.data || notificationsData || [];
  const unreadCount = countsData?.unread || countsData?.data?.unread || 0;

  useEffect(() => {
    if (isOpen) {
      refetch();
    }
  }, [isOpen, refetch]);

  const handleMarkAsRead = async (notification: DashboardNotification) => {
    setPendingId(notification._id);
    try {
      await markAsRead(notification._id).unwrap();
    } catch (error) {
      // Silent fail for UI smoothness
    } finally {
      setPendingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsBulkPending(true);
    try {
      await markAllAsRead(undefined).unwrap();
    } catch (error) {
      // Silent fail for UI smoothness
    } finally {
      setIsBulkPending(false);
    }
  };

  const handleClearAll = async () => {
    setIsBulkPending(true);
    try {
      await clearAllNotifications(undefined).unwrap();
    } catch (error) {
      // Silent fail for UI smoothness
    } finally {
      setIsBulkPending(false);
    }
  };

  const handleDelete = async (notification: DashboardNotification) => {
    setPendingId(notification._id);
    try {
      await deleteNotification(notification._id).unwrap();
    } catch (error) {
      // Silent fail for UI smoothness
    } finally {
      setPendingId(null);
    }
  };

  const getNotificationIcon = (notification: DashboardNotification) => {
    const type = notification.type?.toLowerCase();
    const severity = notification.severity?.toLowerCase();
    
    if (type === "geofence" || type === "location") {
      return <MapPin className="h-4 w-4 text-blue-600" />;
    }
    if (type === "device" || type === "device_health") {
      return <Radio className="h-4 w-4 text-amber-600" />;
    }
    if (severity === "error" || severity === "high") {
      return <AlertCircle className="h-4 w-4 text-red-600" />;
    }
    if (severity === "warning" || severity === "medium") {
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
    if (severity === "success") {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    }
    return <Bell className="h-4 w-4 text-slate-600" />;
  };

  const getSeverityVariant = (severity?: string) => {
    switch (severity?.toLowerCase()) {
      case "high":
      case "error":
        return "destructive";
      case "medium":
      case "warning":
        return "secondary";
      case "low":
      case "info":
        return "outline";
      default:
        return "outline";
    }
  };

  const formatNotificationRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const formatNotificationTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getNotificationTitle = (notification: DashboardNotification) => {
    return notification.title || 
           notification.message?.split('.')[0] || 
           `${notification.type || 'Alert'} Notification` ||
           "Notification";
  };

  const getNotificationMessage = (notification: DashboardNotification) => {
    return notification.message || 
           notification.description || 
           "No details available.";
  };

  if (!isOpen) return null;

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
                onClick={handleMarkAllAsRead}
                className="text-xs font-semibold text-slate-800 hover:text-slate-950"
              >
                Mark all read
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isBulkPending}
                onClick={handleClearAll}
                className="text-xs font-semibold text-red-600 hover:text-red-700"
              >
                Clear all
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
                Vehicle alerts and tracking events will appear here when they are created.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification: DashboardNotification) => (
                <div
                  key={notification._id}
                  className={`rounded-2xl border ${!notification.isRead ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'} p-3 transition-colors hover:bg-slate-50`}
                >
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="min-w-0 flex-1 text-sm font-semibold text-slate-900">
                          {getNotificationTitle(notification)}
                        </h4>
                        {!notification.isRead && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true" />}
                        {notification.severity && (
                          <Badge variant={getSeverityVariant(notification.severity)} className="uppercase">
                            {notification.severity}
                          </Badge>
                        )}
                      </div>

                      <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">
                        {getNotificationMessage(notification)}
                      </p>

                      {notification.vehicleNumber && (
                        <p className="mt-1 text-xs text-slate-500">
                          Vehicle: {notification.vehicleNumber}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock3 className="h-3.5 w-3.5" />
                          {formatNotificationRelativeTime(notification.createdAt)}
                        </span>
                        <span title={formatNotificationTimestamp(notification.createdAt)}>
                          {formatNotificationTimestamp(notification.createdAt)}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {!notification.isRead && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="font-semibold text-slate-800 hover:text-slate-950"
                            disabled={pendingId === notification._id || isFetching}
                            onClick={() => handleMarkAsRead(notification)}
                          >
                            Mark Read
                          </Button>
                        )}

                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-slate-600 hover:text-red-600"
                          disabled={pendingId === notification._id || isFetching}
                          onClick={() => handleDelete(notification)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
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
              router.push("/dashboard/notifications");
            }}
          >
            View all notifications
          </Button>
        </div>
      </div>
    </div>
  );
}
