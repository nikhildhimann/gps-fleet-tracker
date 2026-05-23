export type NotificationType =
  | "alert"
  | "device_health"
  | "mapping"
  | "import"
  | "admin"
  | "system";

export type NotificationSeverity = "critical" | "warning" | "info" | "success";
export type NotificationStatus = "new" | "acknowledged" | "resolved";

type OrganizationRef = {
  _id?: string;
  name?: string;
  organizationType?: string;
  status?: string;
};

type VehicleRef = {
  _id?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  model?: string;
  status?: string;
  runningStatus?: string;
};

type DeviceRef = {
  _id?: string;
  imei?: string;
  deviceModel?: string;
  simNumber?: string;
  status?: string;
  connectionStatus?: string;
};

type DriverRef = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  status?: string;
};

type UserRef = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
};

type AlertRef = {
  _id?: string;
  alertName?: string;
  alertId?: string;
  severity?: string;
  vehicleRegistrationNumber?: string;
  acknowledged?: boolean;
};

export type NotificationRef<T> = string | T | null | undefined;

export interface AdminNotification {
  _id: string;
  title: string;
  message: string;
  type: NotificationType;
  severity: NotificationSeverity;
  status: NotificationStatus;
  isRead: boolean;
  actionUrl?: string | null;
  occurredAt?: string | null;
  createdAt?: string | null;
  readAt?: string | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  importJobId?: string | null;
  mappingId?: string | null;
  metadata?: Record<string, unknown> | null;
  organizationId?: NotificationRef<OrganizationRef>;
  vehicleId?: NotificationRef<VehicleRef>;
  deviceId?: NotificationRef<DeviceRef>;
  driverId?: NotificationRef<DriverRef>;
  userId?: NotificationRef<UserRef>;
  alertId?: NotificationRef<AlertRef>;
}

export interface AdminNotificationCounts {
  total: number;
  unread: number;
  new: number;
  acknowledged: number;
  resolved: number;
  bySeverity?: Record<string, number>;
  byType?: Record<string, number>;
}

export interface NotificationPagination {
  totalrecords: number;
  currentPage: number;
  totalPages: number;
  limit: number;
}

export interface NotificationListResponse {
  status: boolean;
  message: string;
  data: AdminNotification[];
  pagination: NotificationPagination;
}

export interface NotificationCountsResponse {
  status: boolean;
  message: string;
  data: AdminNotificationCounts;
}

export interface NotificationMutationResponse {
  status: boolean;
  message: string;
  data?: AdminNotification;
}

export interface NotificationBulkMutationResponse {
  status: boolean;
  message: string;
  data: {
    matchedCount: number;
    modifiedCount: number;
  };
}

export interface NotificationQueryParams {
  page?: number;
  limit?: number;
  organizationId?: string;
  type?: NotificationType | "";
  severity?: NotificationSeverity | "";
  status?: NotificationStatus | "";
  isRead?: "true" | "false" | "";
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  vehicleId?: string;
  deviceId?: string;
  driverId?: string;
  userId?: string;
  alertId?: string;
  entityType?: string;
  entityId?: string;
  importJobId?: string;
  mappingId?: string;
}

export const NOTIFICATION_TYPE_OPTIONS: Array<{ value: NotificationType; label: string }> = [
  { value: "alert", label: "Alerts" },
  { value: "device_health", label: "Device Health" },
  { value: "mapping", label: "Mappings" },
  { value: "import", label: "Imports" },
  { value: "admin", label: "Admin" },
  { value: "system", label: "System" },
];

export const NOTIFICATION_SEVERITY_OPTIONS: Array<{ value: NotificationSeverity; label: string }> = [
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
  { value: "success", label: "Success" },
];

export const NOTIFICATION_STATUS_OPTIONS: Array<{ value: NotificationStatus; label: string }> = [
  { value: "new", label: "New" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "resolved", label: "Resolved" },
];

const VALID_ADMIN_ROUTES = new Set([
  "/admin/notifications",
  "/admin/organizations",
  "/admin/vehicles",
  "/admin/gps-devices",
  "/admin/device-mapping",
  "/admin/driver-mapping",
  "/admin/drivers",
  "/admin/users",
  "/admin/live-tracking",
  "/admin/history",
]);

const IMPORT_ENTITY_ROUTE_MAP: Record<string, string> = {
  organizations: "/admin/organizations",
  users: "/admin/users",
  devices: "/admin/gps-devices",
  drivers: "/admin/drivers",
  vehicles: "/admin/vehicles",
  devicemapping: "/admin/device-mapping",
  drivermapping: "/admin/driver-mapping",
};

const refObject = <T extends object>(value: NotificationRef<T>): T | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as T;
};

const normalizeRoute = (route?: string | null) => {
  if (!route || typeof route !== "string") {
    return null;
  }

  const trimmed = route.trim();
  if (!trimmed.startsWith("/admin/")) {
    return null;
  }

  const [basePath] = trimmed.split(/[?#]/);
  return VALID_ADMIN_ROUTES.has(basePath) ? trimmed : null;
};

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

export const getNotificationOccurredAt = (notification: AdminNotification) =>
  notification.occurredAt || notification.createdAt || null;

export const formatNotificationRelativeTime = (value?: string | null) => {
  if (!value) return "Just now";

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Just now";

  const diffMs = Date.now() - timestamp.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return timestamp.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export const formatNotificationTimestamp = (value?: string | null) => {
  if (!value) return "Unknown time";

  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return "Unknown time";

  return timestamp.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getNotificationSeverityVariant = (severity: NotificationSeverity) => {
  switch (severity) {
    case "critical":
      return "destructive";
    case "warning":
      return "warning";
    case "success":
      return "success";
    default:
      return "secondary";
  }
};

export const getNotificationStatusVariant = (status: NotificationStatus) => {
  switch (status) {
    case "resolved":
      return "success";
    case "acknowledged":
      return "warning";
    default:
      return "secondary";
  }
};

export const getNotificationStatusLabel = (notification: AdminNotification) => {
  if (notification.status === "resolved") return "Resolved";
  if (notification.status === "acknowledged") return "Acknowledged";
  return "New";
};

export const getNotificationEntitySummary = (notification: AdminNotification) => {
  const organization = refObject(notification.organizationId);
  const vehicle = refObject(notification.vehicleId);
  const device = refObject(notification.deviceId);
  const driver = refObject(notification.driverId);
  const user = refObject(notification.userId);

  const driverName = [driver?.firstName, driver?.lastName].filter(Boolean).join(" ").trim();
  const userName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  const parts = [
    vehicle?.vehicleNumber ? `Vehicle ${vehicle.vehicleNumber}` : "",
    device?.imei ? `IMEI ${device.imei}` : "",
    driverName ? `Driver ${driverName}` : "",
    organization?.name ? organization.name : "",
    userName ? userName : "",
  ].filter(Boolean);

  if (parts.length) {
    return parts.join(" • ");
  }

  const metadataEntity = normalizeText(notification.metadata?.entity);
  const metadataDriver = normalizeText(notification.metadata?.driverName);
  const metadataVehicle = normalizeText(notification.metadata?.vehicleNumber);
  const metadataImei = normalizeText(notification.metadata?.imei);

  return [metadataVehicle, metadataImei, metadataDriver, metadataEntity]
    .filter(Boolean)
    .join(" • ");
};

export const getNotificationPrimaryRoute = (notification: AdminNotification) => {
  const explicitRoute = normalizeRoute(notification.actionUrl);
  if (explicitRoute) {
    return explicitRoute;
  }

  const metadataEntity = normalizeText(notification.metadata?.entity).toLowerCase();
  const normalizedEntityType = normalizeText(notification.entityType).toLowerCase();

  if (notification.type === "mapping" || normalizedEntityType === "device_mapping") {
    return "/admin/device-mapping";
  }

  if (normalizedEntityType === "driver_mapping") {
    return "/admin/driver-mapping";
  }

  if (notification.type === "import") {
    return IMPORT_ENTITY_ROUTE_MAP[metadataEntity] || "/admin/notifications";
  }

  if (
    normalizedEntityType === "organization" ||
    metadataEntity === "organizations"
  ) {
    return "/admin/organizations";
  }

  if (
    normalizedEntityType === "vehicle" ||
    metadataEntity === "vehicles"
  ) {
    return "/admin/vehicles";
  }

  if (
    normalizedEntityType === "gps_device" ||
    normalizedEntityType === "device" ||
    metadataEntity === "devices"
  ) {
    return "/admin/gps-devices";
  }

  if (
    normalizedEntityType === "driver" ||
    metadataEntity === "drivers"
  ) {
    return "/admin/drivers";
  }

  if (
    normalizedEntityType === "user" ||
    metadataEntity === "users"
  ) {
    return "/admin/users";
  }

  if (notification.type === "alert" || notification.type === "device_health") {
    return "/admin/history";
  }

  return null;
};

export const canAcknowledgeNotification = (notification: AdminNotification) =>
  notification.status === "new";

export const canResolveNotification = (notification: AdminNotification) =>
  notification.status !== "resolved";

export const hasUnreadIndicator = (notification: AdminNotification) =>
  !notification.isRead;
