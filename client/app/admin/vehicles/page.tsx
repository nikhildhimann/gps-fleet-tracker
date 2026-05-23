"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Table from "@/components/ui/Table";
import Pagination from "@/components/ui/Pagination";
import ApiErrorBoundary from "@/components/admin/ErrorBoundary/ApiErrorBoundary";
import { Plus, Edit, Trash2, Filter } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  useGetVehiclesQuery,
  useCreateVehicleMutation,
  useUpdateVehicleMutation,
  useDeleteVehicleMutation,
} from "@/redux/api/vehicleApi";
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi";
import { useGetGpsDevicesQuery } from "@/redux/api/gpsDeviceApi";
import { useGetDriversQuery } from "@/redux/api/driversApi";
import {
  useAssignDeviceMutation,
  useUnassignDeviceByDetailsMutation,
} from "@/redux/api/deviceMappingApi";
import {
  useAssignDriverMutation,
  useUnassignDriverMutation,
} from "@/redux/api/vehicleDriverMappingApi";

import { usePopups } from "../Helpers/PopupContext";
import { capitalizeFirstLetter } from "../Helpers/CapitalizeFirstLetter";
import { DynamicModal } from "@/components/common";
import { FormField } from "@/lib/formTypes";
import AdminLoadingState from "@/components/admin/UI/AdminLoadingState";
import AdminPageHeader from "@/components/admin/UI/AdminPageHeader";
import AdminPageShell from "@/components/admin/UI/AdminPageShell";
import AdminSectionCard from "@/components/admin/UI/AdminSectionCard";
// 🔐 ORG CONTEXT UPDATE
import { useOrgContext } from "@/hooks/useOrgContext";

import ImportExportButton from "@/components/admin/import-export/ImportExportButton";
import { getApiErrorMessage } from "@/utils/apiError";
import {
  Building2,
  Car,
  Hash,
  Info,
  Calendar,
  Palette,
  ToggleLeft,
  ShieldAlert,
} from "lucide-react";

export interface Vehicle {
  _id: string;
  organizationId: string | { _id: string; name: string };
  vehicleType: string;

  vehicleNumber: string;
  make?: string;
  model?: string;
  year?: string;
  color?: string;
  status: "active" | "inactive";
  runningStatus?: "running" | "idle" | "stopped" | "inactive";
  deviceId?: string;
  driverId?: string; // Backend uses driverId
  driverName?: string; // Frontend form uses this, might need mapping if backend supports it or ignored
}

const normalizeOptionalString = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const buildVehicleDeviceMeta = (device: {
  connectionStatus?: string;
  simNumber?: string;
  status?: string;
}) =>
  [device.connectionStatus, device.simNumber ? `SIM ${device.simNumber}` : "", device.status]
    .filter(Boolean)
    .join(" | ");

const buildVehicleDriverMeta = (driver: {
  phone?: string;
  status?: string;
}) => [driver.phone, driver.status].filter(Boolean).join(" | ");

export default function VehiclesPage() {
  const { openPopup, closePopup, isPopupOpen } = usePopups();
  const searchParams = useSearchParams();
  const filterParam = searchParams.get("filter");
  const routeOrgParam = searchParams.get("org") || searchParams.get("organizationId");

  // 🔐 ORG CONTEXT UPDATE
  const { orgId, role, isSuperAdmin, isRootOrgAdmin, isSubOrgAdmin } = useOrgContext();
  const canUseImportExport = role === "admin" || role === "superadmin";

  const canSelectOrg = isSuperAdmin || isRootOrgAdmin;
  const searchQueryParam = searchParams.get("search");
  const [page, setPage] = useState(1);
  const LIMIT = 10;
  const [showFilters, setShowFilters] = useState(!!searchQueryParam);
  const [selectedVehicleForAssignment, setSelectedVehicleForAssignment] =
    useState<Vehicle | null>(null);
  // Organization selection inside DynamicModal (for superadmin/root admin)
  const [selectedOrgIdForForm, setSelectedOrgIdForForm] = useState<string>("");
  // Track device selected in form — used to gate the driver dropdown
  const [formDeviceId, setFormDeviceId] = useState<string>("");
  const [contextOrgId, setContextOrgId] = useState<string>("");
  const [filters, setFilters] = useState({
    number: searchQueryParam || "",
    type: "",
    organizationId: "",
    status: "",
    runningStatus: "",
    driverId: "",
    deviceAssigned: "",
  });


  const vehicleQueryParams = useMemo(
    () => ({
      page: page - 1,
      limit: LIMIT,
      organizationId: filters.organizationId || undefined,
      vehicleNumber: filters.number || undefined,
      vehicleType: filters.type || undefined,
      status: filters.status || undefined,
      runningStatus: filters.runningStatus || undefined,
      driverId: filters.driverId || undefined,
      deviceAssigned: filters.deviceAssigned || undefined,
      connectionStatus: filterParam === "online" ? "online" : undefined,
    }),
    [LIMIT, page, filters, filterParam],
  );

  // API Hooks
  const { data: vehData, isLoading: isVehLoading, refetch: refetchVehicles } =
    useGetVehiclesQuery(vehicleQueryParams, { refetchOnMountOrArgChange: true });
  const { data: allVehData } =
    useGetVehiclesQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });
  const { data: orgData, isLoading: isOrgLoading } =
    useGetOrganizationsQuery({ page: 0, limit: 1000 }, {
      skip: !(isSuperAdmin || isRootOrgAdmin), // 🔐 Only superadmin or root-org-admin needs full org list
      refetchOnMountOrArgChange: true,
    });
  const { data: devData, isLoading: isDevLoading } =
    useGetGpsDevicesQuery({ page: 0, limit: 1000 }, { refetchOnMountOrArgChange: true });
  const { data: driverData, isLoading: isDriverLoading } =
    useGetDriversQuery({ page: 0, limit: 1000 });

  const [createVehicle, { isLoading: isCreating }] = useCreateVehicleMutation();
  const [updateVehicle, { isLoading: isUpdating }] = useUpdateVehicleMutation();
  const [deleteVehicle, { isLoading: isDeleting }] = useDeleteVehicleMutation();

  const [assignDevice] = useAssignDeviceMutation();
  const [unassignDeviceByDetails] = useUnassignDeviceByDetailsMutation();
  const [assignDriver] = useAssignDriverMutation();
  const [unassignDriver] = useUnassignDriverMutation();

  const vehicles = useMemo(() => (vehData?.data as Vehicle[]) || [], [vehData]);
  const allVehicles = useMemo(
    () => (allVehData?.data as Vehicle[]) || vehicles,
    [allVehData, vehicles],
  );
  const organizations = useMemo(
    () => (orgData?.data as { _id: string; name: string; parentOrganizationId?: string | null }[]) || [],
    [orgData],
  );
  const devices = useMemo(
    () =>
      (devData?.data as {
        _id: string;
        imei: string;
        deviceModel: string;
        connectionStatus?: string;
        simNumber?: string;
        status?: string;
        organizationId?: string | { _id: string; name?: string };
      }[]) || [],
    [devData],
  );
  const drivers = useMemo(
    () =>
      (driverData?.data as {
        _id: string;
        firstName: string;
        lastName: string;
        organizationId?: string | { _id: string; name?: string };
        phone?: string;
        status?: string;
      }[]) || [],
    [driverData],
  );

  // 🔐 ORG CONTEXT UPDATE
  const canCreateVehicle = isSuperAdmin || isRootOrgAdmin || isSubOrgAdmin;
  const canEditVehicle = isSuperAdmin || isRootOrgAdmin || isSubOrgAdmin;
  const canDeleteVehicle = isSuperAdmin || isRootOrgAdmin;

  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const getRefId = (value: any): string | null => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (typeof value === "object") return value._id || null;
    return null;
  };

  // 🔐 Effective organization for driver/device assignment in DynamicModal
  useEffect(() => {
    let nextContextOrgId = routeOrgParam || "";

    if (!nextContextOrgId) {
      nextContextOrgId = orgId || "";
    }

    setContextOrgId(nextContextOrgId);
  }, [orgId, routeOrgParam]);

  const effectiveOrgIdForForm = useMemo(() => {
    if (canSelectOrg) {
      return selectedOrgIdForForm || contextOrgId || "";
    }
    // Sub-admin / branch admin: always locked to their context org
    return orgId || contextOrgId || "";
  }, [canSelectOrg, contextOrgId, orgId, selectedOrgIdForForm]);

  useEffect(() => {
    setPage(1);
  }, [
    filters.number,
    filters.type,
    filters.organizationId,
    filters.status,
    filters.runningStatus,
    filters.driverId,
    filters.deviceAssigned,
    filterParam,
  ]);

  // Calculate available devices
  // Device is available if NOT used by ANY vehicle, OR if it is used by CURRENT editing vehicle
  const getAvailableDevices = (currentVehicleId?: string) => {
    const assignedDeviceIds = new Set(
      allVehicles
        .filter((v) => v._id !== currentVehicleId) // Exclude current vehicle's assignment
        .map((v) => getRefId((v as any).deviceId))
        .filter(Boolean) as string[],
    );
    return devices.filter((d) => !assignedDeviceIds.has(d._id));
  };

  // 🔐 Calculate available drivers scoped by organization and assignment
  const availableDriversForForm = useMemo(() => {
    if (!effectiveOrgIdForForm) return [];

    // Drivers already assigned to some vehicle (excluding current editing vehicle)
    const assignedDriverIds = new Set(
      allVehicles
        .filter((v) => !editingVehicle || v._id !== editingVehicle._id)
        .map((v) => getRefId((v as any).driverId))
        .filter(Boolean) as string[],
    );

    return drivers.filter((driver) => {
      const driverOrgId =
        typeof driver.organizationId === "object"
          ? driver.organizationId._id
          : driver.organizationId;

      if (!driverOrgId || driverOrgId !== effectiveOrgIdForForm) {
        return false;
      }

      // Allow unassigned drivers OR the one already linked to the editing vehicle
      if (!assignedDriverIds.has(driver._id)) return true;
      const editingDriverId = editingVehicle ? getRefId((editingVehicle as any).driverId) : null;
      if (editingVehicle && editingDriverId === driver._id) return true;

      return false;
    });
  }, [drivers, allVehicles, editingVehicle, effectiveOrgIdForForm]);

  // 🔐 Calculate available devices scoped by organization and assignment
  const getAvailableDevicesForForm = (currentVehicleId?: string) => {
    if (!effectiveOrgIdForForm) return [];

    const baseDevices = getAvailableDevices(currentVehicleId);

    return baseDevices.filter((device) => {
      const deviceOrgId =
        typeof (device as any).organizationId === "object"
          ? (device as any).organizationId._id
          : (device as any).organizationId;
      if (!deviceOrgId || deviceOrgId !== effectiveOrgIdForForm) {
        return false;
      }
      return true;
    });
  };


  const handleSubmit = async (
    data: Record<string, string | number | boolean | File>,
  ) => {
    try {
      // 🔹 Build body — strip empty optional ID fields to null
      const resolvedOrganizationId = canSelectOrg
        ? normalizeOptionalString(data.organizationId) || contextOrgId || normalizeOptionalString(orgId)
        : normalizeOptionalString(orgId) || contextOrgId;
      const body: Record<string, any> = {};

      Object.entries(data).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        if (key === "organizationId") return;
        if (value === "" && ["deviceId", "driverId"].includes(key)) {
          body[key] = null;
        } else if (typeof value === "string") {
          const normalizedValue = value.trim();
          if (normalizedValue !== "") {
            body[key] = normalizedValue;
          }
        } else {
          body[key] = value;
        }
      });

      // 🔹 Uppercase vehicle number
      if (body.vehicleNumber) {
        body.vehicleNumber = String(body.vehicleNumber).toUpperCase().trim();
      }

      if (!editingVehicle && resolvedOrganizationId) {
        body.organizationId = resolvedOrganizationId;
      }

      if (editingVehicle) {
        // ─────────────────────────────────────────
        // ✅ EDIT VEHICLE — 4-step orchestration
        // ─────────────────────────────────────────

        // Step 1 — Resolve old vs new values
        const oldDeviceId = getRefId(editingVehicle.deviceId) || null;
        const oldDriverId = getRefId(editingVehicle.driverId) || null;
        const newDeviceId: string | null = body.deviceId !== undefined ? (body.deviceId || null) : oldDeviceId;
        const newDriverId: string | null = body.driverId !== undefined ? (body.driverId || null) : oldDriverId;

        const isDeviceChanged = oldDeviceId !== newDeviceId;
        const isDriverChanged = oldDriverId !== newDriverId;

        // Step 2 — Update core vehicle fields (no deviceId/driverId — mapping owns those)
        const { deviceId: _d, driverId: _dr, ...vehicleUpdateData } = body;
        await updateVehicle({
          id: editingVehicle._id,
          ...vehicleUpdateData,
        }).unwrap();

        // Step 3 — Device mapping
        let deviceRemovedOrChanged = false;
        if (isDeviceChanged) {
          if (oldDeviceId && !newDeviceId) {
            // 3a — Device removed: cascade in backend auto-unassigns driver too
            await unassignDeviceByDetails({
              vehicleId: editingVehicle._id,
              gpsDeviceId: oldDeviceId,
            }).unwrap();
            deviceRemovedOrChanged = true; // driver cascade handled by backend
          } else if (oldDeviceId && newDeviceId) {
            // 3b — Device changed
            await unassignDeviceByDetails({
              vehicleId: editingVehicle._id,
              gpsDeviceId: oldDeviceId,
            }).unwrap();
            await assignDevice({
              vehicleId: editingVehicle._id,
              gpsDeviceId: newDeviceId,
            }).unwrap();
            deviceRemovedOrChanged = true; // old driver also auto-unassigned by cascade
          } else if (!oldDeviceId && newDeviceId) {
            // 3c — Device newly added
            await assignDevice({
              vehicleId: editingVehicle._id,
              gpsDeviceId: newDeviceId,
            }).unwrap();
          }
        }

        // Step 4 — Driver mapping (skip entirely if device was just removed — cascade handled it)
        const effectiveDeviceId = newDeviceId;
        if (effectiveDeviceId && isDriverChanged) {
          if (oldDriverId && !newDriverId) {
            // 4a — Driver removed
            await unassignDriver({ vehicleId: editingVehicle._id }).unwrap();
          } else if (oldDriverId && newDriverId) {
            // 4b — Driver changed: unassign old first (backend handles its own cascade cleanly)
            if (!deviceRemovedOrChanged) {
              // Only unassign if not already cleared by device cascade
              await unassignDriver({ vehicleId: editingVehicle._id }).unwrap();
            }
            await assignDriver({
              vehicleId: editingVehicle._id,
              driverId: newDriverId,
            }).unwrap();
          } else if (!oldDriverId && newDriverId) {
            // 4c — Driver newly added
            await assignDriver({
              vehicleId: editingVehicle._id,
              driverId: newDriverId,
            }).unwrap();
          }
        }

        toast.success("Vehicle updated successfully");
      } else {
        // ─────────────────────────────────────────
        // ✅ CREATE VEHICLE — 3-step orchestration
        // ─────────────────────────────────────────

        // Step 1 — Create vehicle (no deviceId/driverId in payload)
        const { deviceId: initialDeviceId, driverId: initialDriverId, ...createData } = body;
        const result = await createVehicle(createData).unwrap();
        const newVehicleId = result?.data?._id || result?._id;

        if (!newVehicleId) {
          throw new Error("Vehicle created but no vehicle id was returned.");
        }

        // Step 2 — Assign device via Device Mapping API
        if (initialDeviceId) {
          await assignDevice({
            vehicleId: newVehicleId,
            gpsDeviceId: initialDeviceId as string,
          }).unwrap();
        }

        // Step 3 — Assign driver via Driver Mapping API (only if device was also assigned)
        if (initialDeviceId && initialDriverId) {
          await assignDriver({
            vehicleId: newVehicleId,
            driverId: initialDriverId as string,
          }).unwrap();
        }

        toast.success("Vehicle created successfully");
      }
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, "Operation failed"));
      throw err; // re-throw so DynamicModal keeps the form open on failure
    }
  };


  const vehicleFormFields: FormField[] = useMemo(() => [
    // 🔐 ORG CONTEXT UPDATE
    ...(canSelectOrg && !editingVehicle ? [
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
        icon: <Building2 size={14} className="text-slate-500" />,
        resetFields: ["deviceId", "driverId"],
        onChange: (value: string) => {
          setSelectedOrgIdForForm(value);
          setFormDeviceId("");
        },
      }
    ] : []),
    {
      name: "vehicleType",
      label: "Vehicle Type",
      type: "select" as const,
      required: true,
      options: [
        { label: "Car", value: "car" },
        { label: "Truck", value: "truck" },
        { label: "Bus", value: "bus" },
        { label: "Bike", value: "bike" },
        { label: "Other", value: "other" },
      ],
      icon: <Car size={14} className="text-slate-500" />,
      section: "Core Details",
    },
    {
      name: "vehicleNumber",
      label: "Vehicle Number",
      type: "text" as const,
      required: true,
      placeholder: "e.g. MH12AB1234",
      icon: <Hash size={14} className="text-slate-500" />,
      section: "Core Details",
    },
    ...(!editingVehicle
      ? [
          {
            name: "model",
            label: "Model",
            type: "text" as const,
            placeholder: "e.g. Fortuner",
            icon: <Info size={14} className="text-slate-500" />,
            section: "Optional Details",
          },
          {
            name: "year",
            label: "Year",
            type: "number" as const,
            placeholder: "e.g. 2024",
            icon: <Calendar size={14} className="text-slate-500" />,
            section: "Optional Details",
          },
          {
            name: "color",
            label: "Color",
            type: "text" as const,
            placeholder: "e.g. White",
            icon: <Palette size={14} className="text-slate-500" />,
            section: "Optional Details",
          },
          {
            name: "deviceId",
            label: "Assign GPS Device",
            type: "searchable-select" as const,
            searchableOptions: getAvailableDevicesForForm().map((device) => ({
              label: device.imei,
              value: device._id,
              description: device.deviceModel || "GPS Device",
              meta: buildVehicleDeviceMeta(device),
              keywords: [
                device.imei,
                device.deviceModel || "",
                device.simNumber || "",
                device.connectionStatus || "",
              ],
              badge: device.connectionStatus
                ? capitalizeFirstLetter(device.connectionStatus)
                : undefined,
            })),
            icon: <ShieldAlert size={14} className="text-slate-500" />,
            section: "Assignments",
            disabled: !effectiveOrgIdForForm,
            resetFields: ["driverId"],
            placeholder: "Search device by IMEI, model, or SIM",
            searchPlaceholder: "Search IMEI, model, or SIM",
            emptyMessage: effectiveOrgIdForForm
              ? "No available devices found for this organization."
              : "Select an organization before choosing a device.",
            clearable: true,
            clearLabel: "Unassign device",
            onChange: (value: string) => {
              setFormDeviceId(value);
            },
          },
          {
            name: "driverId",
            label: "Assign Driver",
            type: "searchable-select" as const,
            searchableOptions: availableDriversForForm.map((driver) => ({
              label: `${driver.firstName} ${driver.lastName}`.trim(),
              value: driver._id,
              description: driver.phone || "Assigned driver",
              meta: buildVehicleDriverMeta(driver),
              keywords: [
                driver.firstName,
                driver.lastName,
                driver.phone || "",
                driver.status || "",
              ],
              badge: driver.status
                ? capitalizeFirstLetter(driver.status)
                : undefined,
            })),
            icon: <Info size={14} className="text-slate-500" />,
            section: "Assignments",
            disabled: !effectiveOrgIdForForm || !formDeviceId,
            placeholder: "Search driver by name or phone",
            searchPlaceholder: "Search driver name or phone",
            emptyMessage: !formDeviceId
              ? "Assign a GPS device first to filter available drivers."
              : "No available drivers found for this organization.",
            clearable: true,
            clearLabel: "Unassign driver",
          },
        ]
      : []),
    ...(editingVehicle
      ? [
          {
            name: "model",
            label: "Model",
            type: "text" as const,
            placeholder: "e.g. Fortuner",
            icon: <Info size={14} className="text-slate-500" />,
            section: "Optional Details",
          },
          {
            name: "year",
            label: "Year",
            type: "number" as const,
            placeholder: "e.g. 2024",
            icon: <Calendar size={14} className="text-slate-500" />,
            section: "Optional Details",
          },
          {
            name: "color",
            label: "Color",
            type: "text" as const,
            placeholder: "e.g. White",
            icon: <Palette size={14} className="text-slate-500" />,
            section: "Optional Details",
          },
          {
            name: "status",
            label: "Status",
            type: "select" as const,
            required: true,
            options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
            ],
            icon: <ToggleLeft size={14} className="text-slate-500" />,
            section: "Optional Details",
          },
          {
            name: "deviceId",
            label: "Assign GPS Device",
            type: "searchable-select" as const,
            searchableOptions: getAvailableDevicesForForm(editingVehicle?._id).map((d) => ({
              label: d.imei,
              value: d._id,
              description: d.deviceModel || "GPS Device",
              meta: buildVehicleDeviceMeta(d),
              keywords: [
                d.imei,
                d.deviceModel || "",
                d.simNumber || "",
                d.connectionStatus || "",
              ],
              badge: d.connectionStatus
                ? capitalizeFirstLetter(d.connectionStatus)
                : undefined,
            })),
            icon: <ShieldAlert size={14} className="text-slate-500" />,
            section: "Assignments",
            disabled: !effectiveOrgIdForForm,
            resetFields: ["driverId"],
            placeholder: "Search device by IMEI, model, or SIM",
            searchPlaceholder: "Search IMEI, model, or SIM",
            emptyMessage: effectiveOrgIdForForm
              ? "No available devices found for this organization."
              : "Select an organization before choosing a device.",
            clearable: true,
            clearLabel: "Unassign device",
            onChange: (value: string) => {
              setFormDeviceId(value);
            },
          },
          {
            name: "driverId",
            label: "Assign Driver",
            type: "searchable-select" as const,
            searchableOptions: availableDriversForForm.map((driver) => ({
              label: `${driver.firstName} ${driver.lastName}`.trim(),
              value: driver._id,
              description: driver.phone || "Assigned driver",
              meta: buildVehicleDriverMeta(driver),
              keywords: [
                driver.firstName,
                driver.lastName,
                driver.phone || "",
                driver.status || "",
              ],
              badge: driver.status
                ? capitalizeFirstLetter(driver.status)
                : undefined,
            })),
            icon: <Info size={14} className="text-slate-500" />,
            section: "Assignments",
            disabled: !effectiveOrgIdForForm || !formDeviceId,
            placeholder: "Search driver by name or phone",
            searchPlaceholder: "Search driver name or phone",
            emptyMessage: !formDeviceId
              ? "Assign a GPS device first to filter available drivers."
              : "No available drivers found for this organization.",
            clearable: true,
            clearLabel: "Unassign driver",
          },
        ]
      : []),
  ], [organizations, availableDriversForForm, vehicles, editingVehicle, effectiveOrgIdForForm, formDeviceId]);

  const vehicleSchema = useMemo(() => {
    const base = z.object({
      organizationId: z.string().optional(),
      vehicleType: z.enum(["car", "truck", "bus", "bike", "other"]),
      vehicleNumber: z.string().min(1, "Vehicle number is required"),
      make: z.string().optional(),
      model: z.string().optional(),
      year: z.string().optional(),
      color: z.string().optional(),
      status: z.enum(["active", "inactive"]).optional(),
      deviceId: z.string().optional(),
      driverId: z.string().optional(),
    });

    return base.superRefine((val, ctx) => {
      if (!editingVehicle && canSelectOrg && !(val.organizationId || contextOrgId || orgId)) {
        ctx.addIssue({ code: "custom", path: ["organizationId"], message: "Organization is required" });
      }
      if (editingVehicle && !val.status) {
        ctx.addIssue({ code: "custom", path: ["status"], message: "Status is required" });
      }
      if (val.year && !/^\d{4}$/.test(String(val.year))) {
        ctx.addIssue({ code: "custom", path: ["year"], message: "Year must be 4 digits" });
      }
    });
  }, [canSelectOrg, contextOrgId, editingVehicle, orgId]);

  const vehicleInitialData = useMemo(
    () =>
      editingVehicle
        ? {
            organizationId: "",
            vehicleType: editingVehicle.vehicleType,
            vehicleNumber: editingVehicle.vehicleNumber,
            model: editingVehicle.model || "",
            year: editingVehicle.year ? String(editingVehicle.year) : "",
            color: editingVehicle.color || "",
            status: editingVehicle.status,
            driverId: getRefId((editingVehicle as any).driverId) || "",
            deviceId: getRefId((editingVehicle as any).deviceId) || "",
          }
        : {
            organizationId: canSelectOrg ? (selectedOrgIdForForm || contextOrgId || orgId || "") : (orgId || contextOrgId || ""),
            vehicleType: "",
            vehicleNumber: "",
            model: "",
            year: "",
            color: "",
            status: "",
            deviceId: "",
            driverId: "",
          },
    [canSelectOrg, contextOrgId, editingVehicle, orgId, selectedOrgIdForForm],
  );


  const handleAssignDevice = async (deviceId: string) => {
    if (!selectedVehicleForAssignment) return;
    try {
      await assignDevice({
        vehicleId: selectedVehicleForAssignment._id,
        gpsDeviceId: deviceId,
      }).unwrap();
      toast.success("Device assigned successfully");
      closePopup("assignDeviceModal");
      setSelectedVehicleForAssignment(null);
    } catch (err: any) {
      toast.error(getApiErrorMessage(err, "Assignment failed"));
    }
  };

  const openCreateModal = () => {
    setEditingVehicle(null);
    setSelectedOrgIdForForm(routeOrgParam || contextOrgId || orgId || "");
    setFormDeviceId("");
    openPopup("vehicleModal");
  };

  const openEditModal = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    // Pre-populate formDeviceId so driver dropdown is enabled if device is already assigned
    setFormDeviceId(getRefId((vehicle as any).deviceId) || "");
    // Pre-select organization for edit when allowed
    if (canSelectOrg) {
      const vehicleOrgId =
        typeof vehicle.organizationId === "object"
          ? vehicle.organizationId._id
          : vehicle.organizationId;
      setSelectedOrgIdForForm(vehicleOrgId);
    }
    openPopup("vehicleModal");
  };

  const closeModal = () => {
    closePopup("vehicleModal");
    setEditingVehicle(null);
    setSelectedOrgIdForForm("");
    setFormDeviceId("");
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this vehicle?")) {
      try {
        await deleteVehicle(id).unwrap();
        toast.success("Vehicle deleted");
      } catch (err: any) {
        toast.error(getApiErrorMessage(err, "Delete failed"));
      }
    }
  };

  const clearFilters = () => {
    setFilters({
      number: "",
      type: "",
      organizationId: "",
      status: "",
      runningStatus: "",
      driverId: "",
      deviceAssigned: "",
    });
  };

  const openAssignDeviceModal = (vehicle: Vehicle) => {
    setSelectedVehicleForAssignment(vehicle);
    openPopup("assignDeviceModal");
  };

  const columns = [
    { header: "Number", accessor: "vehicleNumber" },
    {
      header: "Type",
      accessor: (row: Vehicle) => (
        <span className="capitalize">
          {capitalizeFirstLetter(row.vehicleType)}
        </span>
      ),
    },
    { header: "Model", accessor: "model" },
    {
      header: "Organization",
      accessor: (row: Vehicle) => {
        // If populated, use name. If Id, find in list.
        if (row.organizationId && typeof row.organizationId === "object")
          return row.organizationId.name;
        const org = organizations.find((o) => o._id === row.organizationId);
        return org?.name || "N/A";
      },
    },
    {
      header: "Driver",
      accessor: (row: Vehicle) => {
        // Support both populated and ID-only driver references
        if (row.driverId && typeof row.driverId === "object") {
          const first = (row.driverId as any).firstName || "";
          const last = (row.driverId as any).lastName || "";
          const full = `${first} ${last}`.trim();
          return full || "-";
        }
        const driver = drivers.find((d) => d._id === row.driverId);
        return driver ? `${driver.firstName} ${driver.lastName}` : "-";
      },
    },
    {
      header: "Status",
      accessor: (row: Vehicle) => (
        <span
          className={`px-2 py-1 rounded-lg text-xs font-bold uppercase ${row.status === "active"
            ? "bg-green-100 text-green-700"
            : "bg-red-100 text-red-700"
            }`}
        >
          {capitalizeFirstLetter(row.status || "active")}
        </span>
      ),
    },
    {
      header: "Device",
      accessor: (row: Vehicle) => {
        if (!row.deviceId) {
          return (
            <button
              onClick={() => openAssignDeviceModal(row)}
              className="text-blue-600 hover:text-blue-800 font-semibold underline"
            >
              Unassigned
            </button>
          );
        }
        const device = devices.find((d) => d._id === row.deviceId);
        return device ? device.imei : "Unknown";
      },
    },
    {
      header: "Actions",
      accessor: (row: Vehicle) => (
        <div className="flex gap-2">
          {canEditVehicle && (
            <button
              onClick={() => openEditModal(row)}
              className="text-blue-600 hover:text-blue-800"
            >
              <Edit size={16} />
            </button>
          )}
          {canDeleteVehicle && !isCreating && !isUpdating && !isDeleting && (
            <button
              onClick={() => handleDelete(row._id)}
              className="text-red-500 hover:text-red-700"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const isLoading = isVehLoading || isOrgLoading || isDevLoading || isDriverLoading;
  const totalRecords =
    (vehData as any)?.pagination?.totalrecords ??
    (vehData as any)?.total ??
    vehicles.length;
  const totalPages =
    (vehData as any)?.pagination?.totalPages ??
    Math.max(1, Math.ceil(totalRecords / LIMIT));

  if (isLoading) {
    return <AdminLoadingState title="Loading vehicles" description="Preparing fleet records, assignments, and filters." />;
  }

  return (
    <ApiErrorBoundary hasError={false}>
      <AdminPageShell contentClassName="space-y-6">
        <AdminPageHeader
          eyebrow="Fleet Registry"
          title="Vehicles"
          description="Manage your fleet vehicles here."
          actions={<div className="flex flex-col gap-3 sm:flex-row">
            {canUseImportExport && (
              <ImportExportButton
                moduleName="vehicles"
                importUrl="/importexport/import/vehicles"
                exportUrl="/importexport/export/vehicles"
                allowedFields={[
                  "organizationName",
                  "vehicleType",
                  "vehicleNumber",
                  "ais140Compliant",
                  "ais140CertificateNumber",
                  "make",
                  "model",
                  "year",
                  "color",
                  "status",
                  "runningStatus",
                  "lastUpdated",
                  "deviceImei",
                ]}
                requiredFields={[
                  "vehicleType",
                  "vehicleNumber",
                ]}
                filters={{
                  vehicleNumber: filters.number,
                  vehicleType: filters.type,
                  organizationId: filters.organizationId,
                  status: filters.status,
                  runningStatus: filters.runningStatus,
                  driverId: filters.driverId,
                }}
                onCompleted={() => {
                  void refetchVehicles();
                }}
              />
            )}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <Filter size={16} /> Filtered Vehicles
            </button>
            {canCreateVehicle && (
              <button
                onClick={openCreateModal}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-xs font-black uppercase tracking-[0.22em] text-white shadow-[0_14px_30px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
              >
                <Plus size={16} /> Add Vehicle
              </button>
            )}
          </div>}
        />

        {showFilters && (
          <AdminSectionCard title="Filter Vehicles" description="Refine fleet results by plate, type, organization, driver, status, and device state." bodyClassName="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Number
                </label>
                <input
                  className="w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={filters.number}
                  onChange={(e) =>
                    setFilters({ ...filters, number: e.target.value })
                  }
                  placeholder="Search number"
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Type
                </label>
                <select
                  className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={filters.type}
                  onChange={(e) =>
                    setFilters({ ...filters, type: e.target.value })
                  }
                >
                  <option value="">All Types</option>
                  <option value="car">Car</option>
                  <option value="truck">Truck</option>
                  <option value="bus">Bus</option>
                  <option value="bike">Bike</option>
                  <option value="other">Other</option>
                </select>
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
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Driver
                </label>
                <select
                  className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={filters.driverId}
                  onChange={(e) =>
                    setFilters({ ...filters, driverId: e.target.value })
                  }
                >
                  <option value="">All Drivers</option>
                  {drivers.map((driver) => (
                    <option key={driver._id} value={driver._id}>
                      {driver.firstName} {driver.lastName}
                    </option>
                  ))}
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
                  Running
                </label>
                <select
                  className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={filters.runningStatus}
                  onChange={(e) =>
                    setFilters({ ...filters, runningStatus: e.target.value })
                  }
                >
                  <option value="">All</option>
                  <option value="running">Running</option>
                  <option value="idle">Idle</option>
                  <option value="stopped">Stopped</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Device
                </label>
                <select
                  className="admin-filter-select w-full border border-slate-200 rounded-xl p-2 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-blue-500/20 outline-none"
                  value={filters.deviceAssigned}
                  onChange={(e) =>
                    setFilters({ ...filters, deviceAssigned: e.target.value })
                  }
                >
                  <option value="">All</option>
                  <option value="assigned">Assigned</option>
                  <option value="unassigned">Unassigned</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={clearFilters}
                  className="w-full bg-slate-100 text-slate-700 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </AdminSectionCard>
        )}

        <AdminSectionCard
          title="Vehicle Directory"
          description="Primary operational table for fleet assets, status, and assignments."
          className="min-h-[420px]"
          bodyClassName="flex min-h-[340px] flex-col justify-between gap-4 p-4"
        >
          <Table columns={columns} data={vehicles} loading={isLoading} />
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={totalRecords}
            onPageChange={setPage}
            disabled={isVehLoading}
          />
        </AdminSectionCard>

        {canCreateVehicle && (
          <DynamicModal
            isOpen={isPopupOpen("vehicleModal")}
            onClose={closeModal}
            title={editingVehicle ? "Edit Vehicle" : "Add New Vehicle"}
            description={editingVehicle ? "Update vehicle details, status, and assignments." : undefined}
            fields={vehicleFormFields}
            schema={vehicleSchema}
            initialData={vehicleInitialData}
            onSubmit={handleSubmit}
            submitLabel={editingVehicle ? "Update Vehicle" : "Create Vehicle"}
          />
        )}
      </AdminPageShell>

      {isPopupOpen("assignDeviceModal") && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-2 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="max-h-[min(100dvh-1rem,90vh)] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-6">
            <h2 className="text-xl text-slate-900 font-bold mb-4">Assign GPS Device</h2>
            <p className="text-sm text-slate-500 mb-4">
              Assign a GPS device to{" "}
              <strong>{selectedVehicleForAssignment?.vehicleNumber}</strong>
            </p>
            {getAvailableDevices().length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center">
                <p className="text-sm font-semibold text-slate-600">
                  No device available
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  All devices are currently assigned
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {getAvailableDevices().map((device) => (
                  <button
                    key={device._id}
                    onClick={() => handleAssignDevice(device._id)}
                    className="w-full p-4 rounded-xl
bg-transparent border border-transparent
hover:bg-slate-300
transition-colors duration-200
text-left cursor-pointer"
                  >
                    <div className="font-semibold text-sm text-black">{device.imei}</div>
                    <div className="text-xs text-slate-500">
                      {device.deviceModel} • {device.connectionStatus}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  closePopup("assignDeviceModal");
                  setSelectedVehicleForAssignment(null);
                }}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </ApiErrorBoundary>
  );
}
