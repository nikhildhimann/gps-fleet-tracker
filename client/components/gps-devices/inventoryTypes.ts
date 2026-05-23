export type InventoryStatus =
  | "in_stock"
  | "assigned"
  | "installed"
  | "faulty"
  | "repair"
  | "retired";

export type EntityRef = string | { _id: string; name?: string } | null | undefined;

export interface DeviceInventory {
  status?: InventoryStatus;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  supplierName?: string;
  invoiceNumber?: string;
  stockLocation?: string;
  rackNumber?: string;
  faultReason?: string;
  repairStatus?: string;
  lastAuditAt?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | { _id: string; firstName?: string; lastName?: string; name?: string } | null;
}

export interface DeviceInventoryHistoryEntry {
  _id: string;
  deviceId: string;
  organizationId: string;
  previousStatus: InventoryStatus;
  newStatus: InventoryStatus;
  reason?: string;
  changedBy?: string | { _id: string; firstName?: string; lastName?: string; email?: string } | null;
  changedAt?: string | null;
}

export interface GpsDeviceRecord {
  _id: string;
  organizationId?: EntityRef;
  vehicleId?: string | { _id: string; vehicleNumber?: string } | null;
  vehicleNumber?: string;
  imei: string;
  deviceModel?: string;
  manufacturer?: string;
  simNumber?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  softwareVersion?: string;
  hardwareVersion?: string;
  connectionStatus?: "online" | "offline";
  isOnline?: boolean;
  warrantyExpiry?: string | null;
  status: "active" | "inactive" | "suspended";
  inventory?: DeviceInventory;
}

export interface InventoryFilters {
  inventoryStatus: "" | InventoryStatus;
  manufacturer: string;
  supplierName: string;
  warrantyExpiry: string;
}

export interface InventoryUpdatePayload {
  status?: InventoryStatus;
  purchaseDate?: string | null;
  purchasePrice?: number | null;
  supplierName?: string;
  invoiceNumber?: string;
  stockLocation?: string;
  rackNumber?: string;
  faultReason?: string;
  repairStatus?: string;
  lastAuditAt?: string | null;
}

export const INVENTORY_STATUS_OPTIONS: InventoryStatus[] = [
  "in_stock",
  "assigned",
  "installed",
  "faulty",
  "repair",
  "retired",
];

export const deriveInventoryStatus = (device: Partial<GpsDeviceRecord>): InventoryStatus => {
  const explicitStatus = device.inventory?.status;
  if (explicitStatus) {
    return explicitStatus;
  }

  if (device.connectionStatus === "online" || device.isOnline) {
    return "installed";
  }

  if (device.vehicleId) {
    return "assigned";
  }

  return "in_stock";
};

export const formatInventoryStatus = (status: InventoryStatus) =>
  status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const formatDateValue = (value?: string | null, withTime = false) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return withTime
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(date);
};

export const toDateInputValue = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

export const formatCurrencyValue = (value?: number | null) => {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
};

export const formatUpdatedBy = (value?: DeviceInventory["updatedBy"]) => {
  if (!value) return "-";
  if (typeof value === "string") return value;
  const fullName = [value.firstName, value.lastName].filter(Boolean).join(" ").trim();
  return fullName || value.name || value._id || "-";
};
