"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Bell, 
  ArrowLeft, 
  Trash2, 
  Clock3, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  RefreshCw, 
  Loader2,
  Check,
  MapPin,
  Radio,
  ExternalLink
} from "lucide-react";
import { Header } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  useGetNotificationsQuery, 
  useMarkAsReadMutation, 
  useMarkAllAsReadMutation, 
  useClearAllNotificationsMutation, 
  useDeleteNotificationMutation 
} from "@/redux/api/notificationsApi";
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper";
import { toast } from "sonner";

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

export default function NotificationsPage() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isBulkPending, setIsBulkPending] = useState(false);

  const { 
    data: notificationsData, 
    isLoading, 
    isFetching, 
    error, 
    refetch 
  } = useGetNotificationsQuery(undefined, {
    refetchOnMountOrArgChange: true,
  });

  const [markAsRead] = useMarkAsReadMutation();
  const [markAllAsRead] = useMarkAllAsReadMutation();
  const [clearAllNotifications] = useClearAllNotificationsMutation();
  const [deleteNotification] = useDeleteNotificationMutation();

  const notifications = notificationsData?.data || notificationsData || [];
  const unreadCount = notifications.filter((n: DashboardNotification) => !n.isRead).length;

  // Auth guard
  useEffect(() => {
    const token = getSecureItem("token");
    const role = getSecureItem("userRole");
    if (!token) {
      router.replace("/");
      return;
    }
    if (role && ["admin", "manager", "driver"].includes(role)) {
      setIsAuthed(true);
    } else {
      router.replace("/");
    }
  }, [router]);

  const handleMarkAsRead = async (id: string) => {
    setPendingId(id);
    try {
      await markAsRead(id).unwrap();
      toast.success("Notification marked as read");
    } catch (err) {
      toast.error("Failed to mark as read");
    } finally {
      setPendingId(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    setIsBulkPending(true);
    try {
      await markAllAsRead(undefined).unwrap();
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error("Failed to mark all as read");
    } finally {
      setIsBulkPending(false);
    }
  };

  const handleDelete = async (id: string) => {
    setPendingId(id);
    try {
      await deleteNotification(id).unwrap();
      toast.success("Notification deleted");
    } catch (err) {
      toast.error("Failed to delete notification");
    } finally {
      setPendingId(null);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Are you sure you want to clear all notifications?")) return;
    setIsBulkPending(true);
    try {
      await clearAllNotifications(undefined).unwrap();
      toast.success("All notifications cleared");
    } catch (err) {
      toast.error("Failed to clear notifications");
    } finally {
      setIsBulkPending(false);
    }
  };

  const getNotificationIcon = (notification: DashboardNotification) => {
    const type = notification.type?.toLowerCase();
    const severity = notification.severity?.toLowerCase();
    
    if (type === "geofence" || type === "location") {
      return <MapPin className="h-5 w-5 text-blue-400" />;
    }
    if (type === "device" || type === "device_health") {
      return <Radio className="h-5 w-5 text-amber-400" />;
    }
    if (severity === "error" || severity === "high") {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    if (severity === "warning" || severity === "medium") {
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    }
    if (severity === "success") {
      return <CheckCircle className="h-5 w-5 text-emerald-500" />;
    }
    return <Bell className="h-5 w-5 text-slate-400" />;
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

  const formatNotificationTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getNotificationTitle = (notification: DashboardNotification) => {
    return notification.title || 
           notification.message?.split('.')[0] || 
           `${notification.type || 'Alert'} Notification`;
  };

  if (!isAuthed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-slate-500 font-sans">
        Checking session…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900 font-sans">
      <Header vehicleSummary={{ label: "Notifications", speed: 0 }} />

      <main className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
        <div className="mx-auto max-w-5xl">
          {/* Breadcrumb & Top Actions */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-sm font-medium text-slate-500 hover:text-[#2f8d35] transition-colors"
              >
                Dashboard
              </button>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-sm font-bold text-slate-900">Notifications</span>
            </div>

            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleMarkAllAsRead}
                  disabled={isBulkPending}
                  className="border-slate-200 bg-white text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Mark all read
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleClearAll}
                  disabled={isBulkPending}
                  className="border-red-100 bg-red-50 text-xs font-semibold text-red-600 hover:bg-red-100/50"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  Clear all
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetch()}
                disabled={isFetching}
                className="text-slate-400 hover:text-slate-900"
              >
                <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Title Section */}
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">Notifications</h1>
              {unreadCount > 0 && (
                <Badge className="bg-[#38a63c] text-white font-bold px-2 py-0.5 rounded-md">
                  {unreadCount}
                </Badge>
              )}
            </div>
            <p className="mt-2 text-base text-slate-500 font-medium">Keep track of your vehicle alerts and system activities</p>
          </div>

          {/* Notifications List */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-32 w-full animate-pulse rounded-2xl border border-slate-200 bg-white shadow-sm" />
                ))}
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-12 text-center shadow-sm">
                <AlertCircle className="mx-auto h-12 w-12 text-red-500/50" />
                <h3 className="mt-4 text-lg font-bold text-slate-900">Oops! Something went wrong</h3>
                <p className="mt-2 text-slate-600">We couldn't load your notifications at this time.</p>
                <Button onClick={() => refetch()} className="mt-6 bg-[#38a63c] text-white hover:bg-[#2f8d35]">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-20 text-center shadow-sm">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 border border-slate-100">
                  <Bell className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="mt-6 text-xl font-bold text-slate-900">All caught up!</h3>
                <p className="mt-2 text-slate-600">You have no new notifications right now.</p>
                <Button 
                  variant="outline" 
                  className="mt-8 border-slate-200 font-semibold text-slate-800 hover:bg-slate-50"
                  onClick={() => router.push("/dashboard")}
                >
                  Return to Dashboard
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {notifications.map((notification: DashboardNotification) => (
                  <div
                    key={notification._id}
                    className={`group relative overflow-hidden rounded-2xl border transition-all duration-200 hover:shadow-md 
                      ${!notification.isRead 
                        ? 'border-[#38a63c]/30 bg-[#38a63c]/[0.02] shadow-[0_4px_12px_rgba(56,166,60,0.08)]' 
                        : 'border-slate-200 bg-white shadow-sm'
                      }`}
                  >
                    {!notification.isRead && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#38a63c]" />
                    )}
                    
                    <div className="flex flex-col p-5 sm:flex-row sm:items-start sm:gap-4">
                      {/* Icon */}
                      <div className={`mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border sm:mt-0 
                        ${!notification.isRead 
                          ? 'border-[#38a63c]/20 bg-[#38a63c]/10' 
                          : 'border-slate-100 bg-slate-50'
                        }`}
                      >
                        {getNotificationIcon(notification)}
                      </div>

                      {/* Content */}
                      <div className="mt-4 flex-1 space-y-1 sm:mt-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h4 className="text-base font-bold text-slate-900">
                            {getNotificationTitle(notification)}
                          </h4>
                          {notification.severity && (
                            <Badge variant={getSeverityVariant(notification.severity)} className="h-5 text-[10px] font-black uppercase tracking-wider">
                              {notification.severity}
                            </Badge>
                          )}
                          {!notification.isRead && (
                            <span className="h-2 w-2 rounded-full bg-[#38a63c] animate-pulse" />
                          )}
                        </div>

                        <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
                          {notification.message || notification.description || "No details provided."}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5" />
                            {formatNotificationTimestamp(notification.createdAt)}
                          </div>
                          {notification.vehicleNumber && (
                            <div className="flex items-center gap-1.5 rounded-full bg-slate-50 px-2 py-0.5 border border-slate-100">
                              <span className="font-bold text-slate-500 uppercase tracking-tight">Vehicle:</span>
                              <span className="text-[#2f8d35] font-semibold">{notification.vehicleNumber}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex items-center justify-end gap-2 sm:mt-0">
                        {!notification.isRead && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkAsRead(notification._id)}
                            disabled={pendingId === notification._id}
                            className="h-9 border-[#38a63c]/30 bg-white px-4 text-xs font-bold text-[#2f8d35] hover:bg-[#38a63c] hover:text-white transition-all shadow-sm"
                          >
                            {pendingId === notification._id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                                "Mark Read"
                            )}
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(notification._id)}
                          disabled={pendingId === notification._id}
                          className="h-9 w-9 text-slate-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </Button>
                        {notification.vehicleId && (
                           <Button
                           size="icon"
                           variant="ghost"
                           onClick={() => router.push(`/dashboard?vehicle=${notification.vehicleId}`)}
                           className="h-9 w-9 text-slate-400 hover:bg-blue-50 hover:text-blue-500"
                           title="View on Map"
                         >
                           <ExternalLink className="h-4.5 w-4.5" />
                         </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-12 border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-slate-500">
              * Showing the most recent notifications. Some older alerts may be pruned automatically.
            </p>
            <Button 
                variant="link" 
                className="text-slate-400 hover:text-[#2f8d35] p-0 h-auto text-xs flex items-center gap-1"
                onClick={() => router.push("/dashboard")}
            >
                <ArrowLeft className="h-3 w-3" />
                Back to Tracking Map
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
