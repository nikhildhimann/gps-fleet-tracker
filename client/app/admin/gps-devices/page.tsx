"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { Plus, Edit, Trash2, Filter, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import {
  useGetGpsDevicesQuery,
  useCreateGpsDeviceMutation,
  useUpdateGpsDeviceMutation,
  useDeleteGpsDeviceMutation,
} from "@/redux/api/gpsDeviceApi";

import {
  useGetVehiclesQuery,
} from "@/redux/api/vehicleApi";

import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";

import { usePopups } from "../Helpers/PopupContext";
import { capitalizeFirstLetter } from "../Helpers/CapitalizeFirstLetter";
import { DynamicModal } from "@/components/common";
import { FormField } from "@/lib/formTypes";
// 🔐 ORG CONTEXT UPDATE
import { useOrgContext } from "@/hooks/useOrgContext";
import ImportExportButton from "@/components/admin/import-export/ImportExportButton";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import { InventoryLayer } from "@/components/gps-devices/InventoryLayer";
import { InventoryStatusBadge } from "@/components/gps-devices/InventoryStatusBadge";
import type { GpsDeviceRecord } from "@/components/gps-devices/inventoryTypes";
import { DEVICE_IMPORT_FIELDS } from "@/utils/importExport/contracts";
import { getApiErrorMessage } from "@/utils/apiError";

import { Building2 } from "lucide-react";

type ModalFormValues = Record<string, string | number | boolean | File>;

type DeviceFormValues = {
  organizationId?: string | { _id: string };
  imei: string;
  softwareVersion: string;
  simNumber?: string;
  deviceModel: string;
  manufacturer?: string;
  serialNumber?: string;
  firmwareVersion?: string;
  hardwareVersion?: string;
  warrantyExpiry?: string;
  status?: "active" | "inactive" | "suspended";
};

type PaginatedDeviceResponse = {
  pagination?: {
    totalrecords?: number;
    totalPages?: number;
  };
  total?: number;
};

type DeviceTableColumn = {
  header: string;
  accessor: keyof GpsDeviceRecord | ((row: GpsDeviceRecord) => ReactNode);
  headerClassName?: string;
  cellClassName?: string;
};

const EMPTY_VALUE = "—";
const WARRANTY_WARNING_DAYS = 30;

const getEntityId = (value?: string | { _id: string } | null) => {
  if (!value) {
    return undefined;
  }

  return typeof value === "object" ? value._id : value;
};

const getOrganizationValue = (
  organizationId?: string | { _id: string },
) => {
  return getEntityId(organizationId);
};

const toDisplayText = (value: unknown) => {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
};

const formatRelativeTime = (value?: string | Date | null) => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffHours < 48) return "Yesterday";

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const getDeviceLastSeen = (device: GpsDeviceRecord) => {
  const record = device as unknown as Record<string, unknown>;
  const candidate =
    record.lastSeen ||
    record.lastPacketTime ||
    record.lastPacketAt ||
    record.lastLoginTime ||
    record.updatedAt ||
    null;

  if (typeof candidate === "string" || candidate instanceof Date) {
    return candidate;
  }

  return null;
};

const getAssignedVehicleLabel = (
  device: GpsDeviceRecord,
  vehicles: Array<{
    _id: string;
    vehicleNumber: string;
    registrationNumber?: string;
    plateNumber?: string;
  }>,
) => {
  const directVehicle = typeof device.vehicleId === "object" ? device.vehicleId : null;
  const directLabel =
    toDisplayText((directVehicle as { vehicleNumber?: string } | null)?.vehicleNumber) ||
    toDisplayText((device as unknown as Record<string, unknown>).plateNumber) ||
    toDisplayText(device.vehicleNumber) ||
    toDisplayText((device as unknown as Record<string, unknown>).vehicleRegistrationNumber);

  if (directLabel) {
    return directLabel;
  }

  const vehicleId = typeof device.vehicleId === "object" ? device.vehicleId?._id : device.vehicleId;
  const vehicle = vehicles.find((item) => item._id === vehicleId);

  return (
    toDisplayText(vehicle?.plateNumber) ||
    toDisplayText(vehicle?.registrationNumber) ||
    toDisplayText(vehicle?.vehicleNumber) ||
    ""
  );
};

const getConnectionState = (device: GpsDeviceRecord) => {
  if (device.connectionStatus === "online" || device.isOnline) {
    return "Online";
  }

  if (device.connectionStatus === "offline" || device.isOnline === false) {
    return "Offline";
  }

  return "";
};

const formatWarrantyDetails = (value?: string | null) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const startOfExpiry = new Date(date);
  startOfExpiry.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((startOfExpiry.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      date: formattedDate,
      detail: `Expired ${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} ago`,
      tone: "text-red-600",
    };
  }

  if (diffDays <= WARRANTY_WARNING_DAYS) {
    return {
      date: formattedDate,
      detail: diffDays === 0 ? "Expires today" : `Expires in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
      tone: "text-amber-600",
    };
  }

  return {
    date: formattedDate,
    detail: "",
    tone: "text-slate-500",
  };
};

const getStatusBadgeClasses = (status?: string) => {
  switch (status) {
    case "active":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "inactive":
      return "border-slate-200 bg-slate-100 text-slate-700";
    case "blocked":
    case "suspended":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
};

const getDeviceStatusLabel = (status?: string) => {
  if (status === "suspended") {
    return "Blocked";
  }

  return capitalizeFirstLetter(status || "unknown");
};

const buildGpsDevicePayload = (
  data: DeviceFormValues,
  fallbackOrganizationId?: string | null,
) => {
  const payload: Record<string, unknown> = {
    imei: data.imei.trim(),
    softwareVersion: data.softwareVersion.trim(),
  };

  const organizationId =
    getOrganizationValue(data.organizationId) || fallbackOrganizationId || undefined;

  if (organizationId) {
    payload.organizationId = organizationId;
  }

  [
    "simNumber",
    "deviceModel",
    "manufacturer",
    "serialNumber",
    "firmwareVersion",
    "hardwareVersion",
  ].forEach((fieldName) => {
    const value = data[fieldName as keyof DeviceFormValues];
    if (typeof value === "string" && value.trim()) {
      payload[fieldName] = value.trim();
    }
  });

  if (data.warrantyExpiry?.trim()) {
    payload.warrantyExpiry = data.warrantyExpiry;
  }

  if (data.status) {
    payload.status = data.status;
  }

  return payload;
};

const toOptionalString = (value: string | number | boolean | File | undefined) =>
  typeof value === "string" && value.trim() ? value : undefined;

const toDeviceStatus = (
  value: string | number | boolean | File | undefined,
): DeviceFormValues["status"] => {
  if (value === "active" || value === "inactive" || value === "suspended") {
    return value;
  }

  return undefined;
};

const toDeviceFormValues = (formValues: ModalFormValues): DeviceFormValues => ({
  organizationId: typeof formValues.organizationId === "string" ? formValues.organizationId : undefined,
  imei: typeof formValues.imei === "string" ? formValues.imei : "",
  softwareVersion: typeof formValues.softwareVersion === "string" ? formValues.softwareVersion : "",
  simNumber: toOptionalString(formValues.simNumber),
  deviceModel: typeof formValues.deviceModel === "string" ? formValues.deviceModel : "",
  manufacturer: toOptionalString(formValues.manufacturer),
  serialNumber: toOptionalString(formValues.serialNumber),
  firmwareVersion: toOptionalString(formValues.firmwareVersion),
  hardwareVersion: toOptionalString(formValues.hardwareVersion),
  warrantyExpiry: toOptionalString(formValues.warrantyExpiry),
  status: toDeviceStatus(formValues.status),
});

const getDeviceInitialValues = (
  device: GpsDeviceRecord | null,
  fallbackOrganizationId?: string | null,
): ModalFormValues => {
  if (!device) {
    return {
      organizationId: fallbackOrganizationId || "",
      imei: "",
      softwareVersion: "",
      simNumber: "",
      deviceModel: "",
      manufacturer: "",
      serialNumber: "",
      firmwareVersion: "",
      hardwareVersion: "",
      warrantyExpiry: "",
    };
  }

  return {
    organizationId: getEntityId(device.organizationId) || fallbackOrganizationId || "",
    imei: device.imei,
    softwareVersion: device.softwareVersion || device.firmwareVersion || "",
    simNumber: device.simNumber || "",
    deviceModel: device.deviceModel || "",
    manufacturer: device.manufacturer || "",
    serialNumber: device.serialNumber || "",
    firmwareVersion: device.firmwareVersion || "",
    hardwareVersion: device.hardwareVersion || "",
    warrantyExpiry: device.warrantyExpiry
      ? device.warrantyExpiry.split("T")[0]
      : "",
    status: device.status || "",
  };
};

/* ================= PAGE ================= */

export default function GpsDevicesPage() {
  const { openPopup, closePopup, isPopupOpen } = usePopups();
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  // 🔐 ORG CONTEXT UPDATE
  const { orgId, role, user, isSuperAdmin, isRootOrgAdmin, isSubOrgAdmin } = useOrgContext();
  const canUseImportExport = role === "admin" || role === "superadmin";
  const searchParams = useSearchParams();
  const searchQueryParam = searchParams.get("search");
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"overview" | "inventory" | "configuration" | "mapping">("overview");
  const LIMIT = 10;
  const [showFilters, setShowFilters] = useState(!!searchQueryParam);
  const [filters, setFilters] = useState({
    imei: searchQueryParam || "",
    model: "",
    firmware: "",
    simNumber: "",
    connectionStatus: "",
    status: "",
    assigned: "",
    vehicleNumber: "",
    warrantyExpiry: "",
    organizationId: "",
  });


  const deviceQueryParams = useMemo(
    () => ({
      page: page - 1,
      limit: LIMIT,
      imei: filters.imei || undefined,
      model: filters.model || undefined,
      firmware: filters.firmware || undefined,
      simNumber: filters.simNumber || undefined,
      connectionStatus: filters.connectionStatus || undefined,
      status: filters.status || undefined,
      assigned: filters.assigned || undefined,
      vehicleNumber: filters.vehicleNumber || undefined,
      warrantyExpiry: filters.warrantyExpiry || undefined,
      organizationId: filters.organizationId || undefined,
    }),
    [LIMIT, page, filters],
  );

  /* ================= API ================= */

  const { data: devData, isLoading: isDevLoading, refetch: refetchDevices } =
    useGetGpsDevicesQuery(deviceQueryParams, { refetchOnMountOrArgChange: true });

  const { data: vehData, isLoading: isVehLoading } =
    useGetVehiclesQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });

  const { data: orgData, isLoading: isOrgLoading } =
    useGetOrganizationsQuery({ page: 0, limit: 1000 }, {
      skip: !(isSuperAdmin || isRootOrgAdmin), // 🔐 Only superadmin or root-org-admin needs full org list
      refetchOnMountOrArgChange: true,
    });

  const [createGpsDevice] = useCreateGpsDeviceMutation();

  const [updateGpsDevice] = useUpdateGpsDeviceMutation();

  const [deleteGpsDevice] = useDeleteGpsDeviceMutation();

  /* ================= DATA ================= */

  const devices = useMemo(
    () => (devData?.data as GpsDeviceRecord[]) || [],
    [devData],
  );

  const vehiclesData = useMemo(
    () =>
      (vehData?.data as {
        _id: string;
        vehicleNumber: string;
        registrationNumber?: string;
        plateNumber?: string;
        deviceId?: string;
        model?: string;
        vehicleType?: string;
      }[]) || [],
    [vehData],
  );

  const organizations = useMemo(
    () => (orgData?.data as { _id: string; name: string; parentOrganizationId?: string | null }[]) || [],
    [orgData],
  );

  /* ================= STATE ================= */

  // 🔐 ORG CONTEXT UPDATE
  const canCreateDevice = isSuperAdmin || isRootOrgAdmin || isSubOrgAdmin;
  const canEditDevice = isSuperAdmin || isRootOrgAdmin || isSubOrgAdmin;
  const canDeleteDevice = isSuperAdmin || isRootOrgAdmin;

  const currentOrganizationId = useMemo(
    () => getEntityId((user?.organizationId as string | { _id: string } | undefined) || orgId) || null,
    [orgId, user],
  );

  const [editingDevice, setEditingDevice] = useState<GpsDeviceRecord | null>(null);
  /* ================= FILTER ================= */

  useEffect(() => {
    setPage(1);
  }, [
    filters.imei,
    filters.model,
    filters.firmware,
    filters.simNumber,
    filters.connectionStatus,
    filters.status,
    filters.assigned,
    filters.vehicleNumber,
    filters.warrantyExpiry,
    filters.organizationId,
  ]);

  /* ================= SUBMIT ================= */

  const handleSubmit = async (formValues: ModalFormValues) => {
    const data = toDeviceFormValues(formValues);
    try {
      if (editingDevice) {
        const payload = buildGpsDevicePayload(data);
        await updateGpsDevice({
          id: editingDevice._id, // ✅ always string
          ...payload,
        }).unwrap();

        toast.success("Device updated successfully");
      } else {
        // 🔐 ORG CONTEXT UPDATE
        // If user is NOT superadmin or root-org-admin, lock organization from context
        const finalData = buildGpsDevicePayload(data);
        if (!(isSuperAdmin || isRootOrgAdmin)) {
          if (!currentOrganizationId) {
            const missingContextMessage = "Organization context is unavailable. Please sign in again.";
            toast.error(missingContextMessage);
            throw new Error(missingContextMessage);
          }

          finalData.organizationId = currentOrganizationId;
        }
        await createGpsDevice(finalData).unwrap();
        toast.success("Device created successfully");
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Operation failed"));
      throw err;
    }
  };

  /* ================= FORM FIELDS (FIXED) ================= */

  const deviceFormFields: FormField[] = useMemo(() => [
    ...((isSuperAdmin || isRootOrgAdmin) && !editingDevice ? [
      {
        name: "organizationId",
        label: "Organization",
        type: "select" as const,
        required: true,
        groups: [
          {
            label: "Organizations",
            options: organizations
              .filter((org) => !org.parentOrganizationId)
              .map((org) => ({
                label: org.name,
                value: org._id,
              })),
          },
          {
            label: "Sub-Organizations",
            options: organizations
              .filter((org) => org.parentOrganizationId)
              .map((org) => ({
                label: org.name,
                value: org._id,
              })),
          },
        ],
        icon: <Building2 size={14} />,
      }
    ] : []),
    {
      name: "imei",
      label: "IMEI",
      type: "text",
      required: true,
      helperText: "Exactly 15 digits",
      section: "Core Details",
    },
    {
      name: "softwareVersion",
      label: "Software Version",
      type: "text",
      required: true,
      section: "Core Details",
    },
    {
      name: "simNumber",
      label: "SIM Number",
      type: "text",
      section: "Optional Details",
    },
    {
      name: "deviceModel",
      label: "Device Model",
      type: "text",
      section: "Optional Details",
    },
    {
      name: "serialNumber",
      label: "Serial Number",
      type: "text",
      section: "Optional Details",
    },
    {
      name: "manufacturer",
      label: "Manufacturer",
      type: "text",
      section: "Optional Details",
    },
    {
      name: "firmwareVersion",
      label: "Firmware Version",
      type: "text",
      section: "Optional Details",
    },
    {
      name: "hardwareVersion",
      label: "Hardware Version",
      type: "text",
      section: "Optional Details",
    },
    {
      name: "warrantyExpiry",
      label: "Warranty Expiry",
      type: "date",
      section: "Optional Details",
    },
    ...(editingDevice
      ? [
          {
            name: "status",
            label: "Status",
            type: "select" as const,
            required: true,
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
              { label: "Suspended", value: "suspended" },
            ],
            section: "Optional Details",
          },
        ]
      : []),
  ], [editingDevice, isRootOrgAdmin, isSuperAdmin, organizations]);

  const deviceSchema = useMemo(() => {
    const base = z.object({
      organizationId: z.string().optional(),
      imei: z.string().regex(/^\d{15}$/, "IMEI must be exactly 15 digits"),
      softwareVersion: z.string().min(1, "Software version is required"),
      simNumber: z.string().optional(),
      deviceModel: z.string().optional(),
      manufacturer: z.string().optional(),
      serialNumber: z.string().optional(),
      firmwareVersion: z.string().optional(),
      hardwareVersion: z.string().optional(),
      warrantyExpiry: z.string().optional(),
      status: z.enum(["active", "inactive", "suspended"]).optional(),
    });

    return base.superRefine((val, ctx) => {
      if (!editingDevice && (isSuperAdmin || isRootOrgAdmin) && !val.organizationId) {
        ctx.addIssue({ code: "custom", path: ["organizationId"], message: "Organization is required" });
      }
      if (editingDevice && !val.status) {
        ctx.addIssue({ code: "custom", path: ["status"], message: "Status is required" });
      }
    });
  }, [editingDevice, isSuperAdmin, isRootOrgAdmin]);

  const deviceInitialData = useMemo(
    () => getDeviceInitialValues(editingDevice, currentOrganizationId),
    [currentOrganizationId, editingDevice],
  );


  /* ================= MODALS ================= */

  const openCreateModal = () => {
    setEditingDevice(null);
    openPopup("deviceModal");
  };

  const openEditModal = (device: GpsDeviceRecord) => {
    setEditingDevice({
      ...device,
      organizationId: getEntityId(device.organizationId) || "",
    });

    openPopup("deviceModal");
  };

  const closeModal = () => {
    closePopup("deviceModal");
    setEditingDevice(null);
  };

  const clearFilters = () => {
    setFilters({
      imei: "",
      model: "",
      firmware: "",
      simNumber: "",
      connectionStatus: "",
      status: "",
      assigned: "",
      vehicleNumber: "",
      warrantyExpiry: "",
      organizationId: "",
    });
  };

  const scrollDeviceTable = (direction: "left" | "right") => {
    if (!tableScrollRef.current) return;
    tableScrollRef.current.scrollBy({
      left: direction === "left" ? -260 : 260,
      behavior: "smooth",
    });
  };

  /* ================= DELETE ================= */

  const handleDelete = async (id: string) => {
    if (!id || typeof id !== "string") {
      toast.error("Invalid device id");
      return;
    }

    if (!confirm("Delete this device?")) return;

    try {
      await deleteGpsDevice(id).unwrap();
      toast.success("Device deleted");
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Delete failed"));
    }
  };

  /* ================= TABLE ================= */

  const columns: DeviceTableColumn[] = [
    {
      header: "IMEI",
      headerClassName: "min-w-[190px]",
      cellClassName: "min-w-[190px]",
      accessor: (row: GpsDeviceRecord) => (
        <span className="block max-w-[190px] break-all font-mono text-xs text-slate-700">
          {row.imei}
        </span>
      ),
    },
    {
      header: "Model",
      headerClassName: "min-w-[140px]",
      cellClassName: "min-w-[140px]",
      accessor: (row: GpsDeviceRecord) => (
        <span className="block max-w-[140px] truncate text-sm font-semibold text-slate-800">
          {toDisplayText(row.deviceModel) || toDisplayText(row.manufacturer) || EMPTY_VALUE}
        </span>
      ),
    },
    {
      header: "SIM",
      headerClassName: "min-w-[130px]",
      cellClassName: "min-w-[130px]",
      accessor: (row: GpsDeviceRecord) => (
        <span className="block max-w-[130px] truncate text-sm text-slate-700">
          {toDisplayText(row.simNumber) || EMPTY_VALUE}
        </span>
      ),
    },
    {
      header: "Inventory",
      headerClassName: "min-w-[130px]",
      cellClassName: "min-w-[130px]",
      accessor: (row: GpsDeviceRecord) => {
        const inventoryLabel =
          toDisplayText((row as unknown as Record<string, unknown>).inventoryNumber) ||
          toDisplayText(row.inventory?.invoiceNumber) ||
          toDisplayText(row.inventory?.stockLocation) ||
          toDisplayText(row.inventory?.rackNumber);

        if (!inventoryLabel) {
          return <InventoryStatusBadge device={row} compact />;
        }

        return (
          <div className="space-y-1">
            <span className="block max-w-[130px] truncate text-sm font-semibold text-slate-800">
              {inventoryLabel}
            </span>
            <InventoryStatusBadge device={row} compact />
          </div>
        );
      },
    },
    {
      header: "Organization",
      headerClassName: "min-w-[150px]",
      cellClassName: "min-w-[150px]",
      accessor: (row: GpsDeviceRecord) => {
        const org =
          typeof row.organizationId === "object" ? row.organizationId : null;
        return (
          <span className="block max-w-[150px] truncate text-sm text-slate-700">
            {toDisplayText(org?.name) || EMPTY_VALUE}
          </span>
        );
      },
    },
    {
      header: "Assigned Vehicle",
      headerClassName: "min-w-[150px]",
      cellClassName: "min-w-[150px]",
      accessor: (row: GpsDeviceRecord) => (
        <span className="block max-w-[150px] truncate text-sm font-semibold text-slate-800">
          {getAssignedVehicleLabel(row, vehiclesData) || "Unassigned"}
        </span>
      ),
    },
    {
      header: "Connection / Last Seen",
      headerClassName: "min-w-[170px]",
      cellClassName: "min-w-[170px]",
      accessor: (row: GpsDeviceRecord) => {
        const connectionState = getConnectionState(row);
        const lastSeen = formatRelativeTime(getDeviceLastSeen(row));

        if (!connectionState && !lastSeen) {
          return <span className="text-sm text-slate-500">Unknown</span>;
        }

        return (
          <div className="space-y-1">
            <span
              className={`block text-sm font-semibold ${
                connectionState === "Online"
                  ? "text-emerald-600"
                  : connectionState === "Offline"
                    ? "text-rose-600"
                    : "text-slate-700"
              }`}
            >
              {connectionState || "Unknown"}
            </span>
            <span className="block text-xs text-slate-500">
              {lastSeen ? `Last seen ${lastSeen}` : "Last seen —"}
            </span>
          </div>
        );
      },
    },
    {
      header: "Warranty",
      headerClassName: "min-w-[150px]",
      cellClassName: "min-w-[150px]",
      accessor: (row: GpsDeviceRecord) => {
        const warranty = formatWarrantyDetails(row.warrantyExpiry);

        if (!warranty) {
          return <span className="text-sm text-slate-500">{EMPTY_VALUE}</span>;
        }

        return (
          <div className="space-y-1">
            <span className="block text-sm font-semibold text-slate-800">
              {warranty.date}
            </span>
            {warranty.detail ? (
              <span className={`block text-xs font-medium ${warranty.tone}`}>
                {warranty.detail}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      header: "Status",
      headerClassName: "min-w-[110px]",
      cellClassName: "min-w-[110px]",
      accessor: (row: GpsDeviceRecord) => (
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${getStatusBadgeClasses(row.status)}`}
        >
          {getDeviceStatusLabel(row.status)}
        </span>
      ),
    },
    {
      header: "Actions",
      headerClassName: "min-w-[80px]",
      cellClassName: "min-w-[80px] whitespace-nowrap",
      accessor: (row: GpsDeviceRecord) => (
        <div className="flex gap-2">
          {canEditDevice && <Edit onClick={() => openEditModal(row)} size={16} />}
          {canDeleteDevice && <Trash2 onClick={() => handleDelete(row._id)} size={16} />}
        </div>
      ),
    },
  ];

  const isLoading = isDevLoading || isVehLoading || isOrgLoading;
  const paginatedData = devData as PaginatedDeviceResponse | undefined;
  const totalRecords =
    paginatedData?.pagination?.totalrecords ??
    paginatedData?.total ??
    devices.length;
  const totalPages =
    paginatedData?.pagination?.totalPages ??
    Math.max(1, Math.ceil(totalRecords / LIMIT));

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <ApiErrorBoundary hasError={false}>
      <AdminPageShell contentClassName="space-y-6">
        <AdminPageHeader
          eyebrow="Hardware Registry"
          title="GPS Devices"
          description="Manage GPS tracking devices, inventory state, and mapping handoffs."
          actions={<div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto">
            {canUseImportExport && (
              <ImportExportButton
                moduleName="devices"
                importUrl="/importexport/import/devices"
                exportUrl="/importexport/export/devices"
                allowedFields={[...DEVICE_IMPORT_FIELDS]}
                requiredFields={[
                  "imei",
                  "softwareVersion",
                ]}
                filters={{
                  imei: filters.imei,
                  status: filters.status,
                  connectionStatus: filters.connectionStatus,
                  organizationId: filters.organizationId,
                }}
                onCompleted={() => {
                  void refetchDevices();
                }}
              />
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Filter size={16} /> Filters
            </button>
            {canCreateDevice && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-700"
              >
                <Plus size={16} /> Add Device
              </button>
            )}
          </div>}
        />

        <div className="-mx-1 overflow-x-auto px-1 pb-1">
        <div className="flex min-w-max items-center gap-2">
          {([
            { key: "overview", label: "Overview" },
            { key: "inventory", label: "Inventory" },
            { key: "configuration", label: "Configuration" },
            { key: "mapping", label: "Mapping" },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] transition-colors ${activeTab === tab.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        </div>

        {activeTab === "inventory" ? (
          <InventoryLayer variant="light" canEdit={canEditDevice} />
        ) : activeTab === "configuration" ? (
          <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-500">Configuration</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Current device configuration flow stays unchanged</h2>
              <p className="mt-3 text-sm text-slate-600">
                Device configuration continues to live in the existing Add/Edit Device modal. Firmware, hardware version,
                warranty, SIM, and core technical properties remain managed there so current CRUD behavior is not disturbed.
              </p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Managed in Overview</p>
                  <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                    <li>IMEI and SIM details</li>
                    <li>Device model and manufacturer</li>
                    <li>Firmware and hardware versions</li>
                    <li>Warranty expiry and active status</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">Inventory handled separately</p>
                  <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                    <li>Inventory status lifecycle</li>
                    <li>Purchase and supplier metadata</li>
                    <li>Fault and repair notes</li>
                    <li>Audit timestamps and updater</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-500">Quick Actions</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">Jump back to device CRUD</h3>
              <p className="mt-3 text-sm text-slate-600">
                Open the Overview tab to continue using the current device forms without any inventory payload mixed in.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab("overview")}
                className="mt-5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-blue-700"
              >
                Open Overview
              </button>
            </div>
          </div>
        ) : activeTab === "mapping" ? (
          <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-500">Mapping</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">Device mapping stays in the existing mapping module</h2>
              <p className="mt-3 text-sm text-slate-600">
                Inventory status is display-only here. Assignment and installation state continue to come from the backend
                mapping and TCP flows. No frontend inventory sync is performed.
              </p>
              <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-500">What stays untouched</p>
                <ul className="mt-3 space-y-2 text-sm font-semibold text-slate-700">
                  <li>Vehicle-to-device assignment</li>
                  <li>Driver mapping screens</li>
                  <li>Live tracking and packet flow</li>
                  <li>Current mapping backend contracts</li>
                </ul>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-[0.32em] text-slate-500">Open Mapping</p>
              <h3 className="mt-2 text-xl font-black text-slate-900">Go to Device Mapping</h3>
              <p className="mt-3 text-sm text-slate-600">
                Use the existing mapping page for assignment and unassignment. Inventory badges here will reflect backend state automatically.
              </p>
              <Link
                href="/admin/device-mapping"
                className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-xs font-black uppercase tracking-widest text-white transition-colors hover:bg-slate-800"
              >
                Open Device Mapping
              </Link>
            </div>
          </div>
        ) : (
          <>

            {/* Filter Section */}
            {showFilters && (
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      IMEI
                    </label>
                    <input
                      className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.imei}
                      onChange={(e) =>
                        setFilters({ ...filters, imei: e.target.value })
                      }
                      placeholder="Search IMEI"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Model
                    </label>
                    <input
                      className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.model}
                      onChange={(e) =>
                        setFilters({ ...filters, model: e.target.value })
                      }
                      placeholder="Search model"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Firmware
                    </label>
                    <input
                      className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.firmware}
                      onChange={(e) =>
                        setFilters({ ...filters, firmware: e.target.value })
                      }
                      placeholder="Search firmware"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      SIM Number
                    </label>
                    <input
                      className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.simNumber}
                      onChange={(e) =>
                        setFilters({ ...filters, simNumber: e.target.value })
                      }
                      placeholder="Search SIM"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Assignment
                    </label>
                    <select
                      className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.assigned}
                      onChange={(e) =>
                        setFilters({ ...filters, assigned: e.target.value })
                      }
                    >
                      <option value="">All Devices</option>
                      <option value="assigned">Assigned to Vehicle</option>
                      <option value="unassigned">Unassigned</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Status
                    </label>
                    <select
                      className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.status}
                      onChange={(e) =>
                        setFilters({ ...filters, status: e.target.value })
                      }
                    >
                      <option value="">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Connection
                    </label>
                    <select
                      className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.connectionStatus}
                      onChange={(e) =>
                        setFilters({ ...filters, connectionStatus: e.target.value })
                      }
                    >
                      <option value="">All</option>
                      <option value="online">Online</option>
                      <option value="offline">Offline</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Vehicle Number
                    </label>
                    <input
                      className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.vehicleNumber}
                      onChange={(e) =>
                        setFilters({ ...filters, vehicleNumber: e.target.value })
                      }
                      placeholder="Search vehicle"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                      Warranty
                    </label>
                    <input
                      type="date"
                      className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                      value={filters.warrantyExpiry}
                      onChange={(e) =>
                        setFilters({ ...filters, warrantyExpiry: e.target.value })
                      }
                    />
                  </div>
                  {/* 🔐 ORG CONTEXT UPDATE */}
                  {(isSuperAdmin || isRootOrgAdmin) && (
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                        Organization
                      </label>
                      <select
                        className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                        value={filters.organizationId}
                        onChange={(e) =>
                          setFilters({ ...filters, organizationId: e.target.value })
                        }
                      >
                        <option value="">All Organizations</option>
                        <optgroup label="Organizations">
                          {organizations
                            .filter((org) => !org.parentOrganizationId)
                            .map((org) => (
                              <option key={org._id} value={org._id}>
                                {org.name}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="Sub-Organizations">
                          {organizations
                            .filter((org) => org.parentOrganizationId)
                            .map((org) => (
                              <option key={org._id} value={org._id}>
                                {org.name}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </div>
                  )}
                  <div className="flex items-end sm:col-span-2 lg:col-span-1">
                    <button
                      onClick={clearFilters}
                      className="w-full bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Table Section */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-center justify-end gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 sm:px-4">
                <span className="mr-auto text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  Move Table
                </span>
                <button
                  type="button"
                  onClick={() => scrollDeviceTable("left")}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
                >
                  <ChevronLeft size={14} />
                  Left
                </button>
                <button
                  type="button"
                  onClick={() => scrollDeviceTable("right")}
                  className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-wide text-slate-700 transition hover:bg-slate-100"
                >
                  Right
                  <ChevronRight size={14} />
                </button>
              </div>
              <div ref={tableScrollRef} className="overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
                <Table<GpsDeviceRecord>
                  columns={columns}
                  data={devices}
                  horizontalScrollMode="external"
                />
              </div>
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={totalRecords}
                onPageChange={setPage}
                disabled={isDevLoading}
              />
            </div>
          </>
        )}
      </AdminPageShell>

      {canCreateDevice && (
        <DynamicModal
          isOpen={isPopupOpen("deviceModal")}
          onClose={closeModal}
          title={editingDevice ? "Edit Device" : "New Device"}
          fields={deviceFormFields}
          schema={deviceSchema}
          initialData={deviceInitialData}
          onSubmit={handleSubmit}
        />
      )}
    </ApiErrorBoundary>
  );
}
