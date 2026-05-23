"use client";

import {
  AlertCircle,
  AlertTriangle,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock3,
  ExternalLink,
  MapPin,
  Radio,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AdminNotification } from "@/lib/adminNotifications";
import {
  canAcknowledgeNotification,
  canResolveNotification,
  formatNotificationRelativeTime,
  formatNotificationTimestamp,
  getNotificationEntitySummary,
  getNotificationOccurredAt,
  getNotificationPrimaryRoute,
  getNotificationSeverityVariant,
  getNotificationStatusLabel,
  getNotificationStatusVariant,
  hasUnreadIndicator,
} from "@/lib/adminNotifications";

type NotificationListItemProps = {
  notification: AdminNotification;
  compact?: boolean;
  actionPending?: boolean;
  onMarkRead?: (notification: AdminNotification) => void | Promise<void>;
  onAcknowledge?: (notification: AdminNotification) => void | Promise<void>;
  onResolve?: (notification: AdminNotification) => void | Promise<void>;
  onDelete?: (notification: AdminNotification) => void | Promise<void>;
  onOpenRelated?: (notification: AdminNotification) => void | Promise<void>;
};

const getNotificationIcon = (notification: AdminNotification) => {
  if (notification.type === "mapping") {
    return <MapPin className="h-4 w-4 text-blue-600" />;
  }

  if (notification.type === "device_health") {
    return <Radio className="h-4 w-4 text-amber-600" />;
  }

  if (notification.severity === "critical") {
    return <AlertTriangle className="h-4 w-4 text-red-600" />;
  }

  if (notification.severity === "warning") {
    return <AlertTriangle className="h-4 w-4 text-amber-500" />;
  }

  if (notification.severity === "success") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  }

  if (notification.type === "import" || notification.type === "admin") {
    return <Bell className="h-4 w-4 text-slate-500" />;
  }

  return <AlertCircle className="h-4 w-4 text-slate-500" />;
};

export function NotificationListItem({
  notification,
  compact = false,
  actionPending = false,
  onMarkRead,
  onAcknowledge,
  onResolve,
  onDelete,
  onOpenRelated,
}: NotificationListItemProps) {
  const occurredAt = getNotificationOccurredAt(notification);
  const contextSummary = getNotificationEntitySummary(notification);
  const route = getNotificationPrimaryRoute(notification);
  const showUnreadDot = hasUnreadIndicator(notification);
  const canAck = canAcknowledgeNotification(notification);
  const canResolve = canResolveNotification(notification);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white ${
        compact ? "p-3" : "p-4"
      } shadow-sm transition-colors ${showUnreadDot ? "border-blue-200 bg-blue-50/30" : ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
          {getNotificationIcon(notification)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className={`min-w-0 flex-1 text-slate-900 ${compact ? "text-sm" : "text-base"} font-semibold`}>
              {notification.title || "Notification"}
            </h4>
            {showUnreadDot && <span className="h-2.5 w-2.5 rounded-full bg-blue-600" aria-hidden="true" />}
            <Badge
              variant={getNotificationSeverityVariant(notification.severity)}
              className="uppercase"
            >
              {notification.severity}
            </Badge>
            <Badge
              variant={getNotificationStatusVariant(notification.status)}
              className="uppercase"
            >
              {getNotificationStatusLabel(notification)}
            </Badge>
          </div>

          <p className={`mt-1 whitespace-pre-wrap break-words text-slate-600 ${compact ? "text-xs" : "text-sm"}`}>
            {notification.message || "No details available."}
          </p>

          <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500 ${compact ? "text-[11px]" : "text-xs"}`}>
            <span className="flex items-center gap-1">
              <Clock3 className="h-3.5 w-3.5" />
              {formatNotificationRelativeTime(occurredAt)}
            </span>
            <span title={formatNotificationTimestamp(occurredAt)}>
              {formatNotificationTimestamp(occurredAt)}
            </span>
            {contextSummary && <span>{contextSummary}</span>}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {!notification.isRead && onMarkRead && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="font-semibold text-slate-800 hover:text-slate-950"
                disabled={actionPending}
                onClick={() => onMarkRead(notification)}
              >
                Mark Read
              </Button>
            )}

            {canAck && onAcknowledge && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="font-semibold text-slate-800 hover:text-slate-950"
                disabled={actionPending}
                onClick={() => onAcknowledge(notification)}
              >
                Acknowledge
              </Button>
            )}

            {canResolve && onResolve && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="font-semibold text-slate-800 hover:text-slate-950"
                disabled={actionPending}
                onClick={() => onResolve(notification)}
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                Resolve
              </Button>
            )}

            {route && onOpenRelated && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-950"
                disabled={actionPending}
                onClick={() => onOpenRelated(notification)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Open
              </Button>
            )}

            {onDelete && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={actionPending}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => onDelete(notification)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
