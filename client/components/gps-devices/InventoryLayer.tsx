"use client";

import type { ComponentType } from "react";
import { useMemo, useState } from "react";
import { Boxes, CalendarClock, ClipboardList, Edit3, ShieldAlert, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import {
  useGetGpsDeviceInventoryByIdQuery,
  useGetGpsDeviceInventoryQuery,
  useUpdateGpsDeviceInventoryMutation,
} from "@/redux/api/gpsDeviceApi";
import { InventoryStatusBadge } from "./InventoryStatusBadge";
import {
  deriveInventoryStatus,
  formatCurrencyValue,
  formatDateValue,
  formatUpdatedBy,
  formatInventoryStatus,
  DeviceInventoryHistoryEntry,
  GpsDeviceRecord,
  INVENTORY_STATUS_OPTIONS,
  InventoryFilters,
  InventoryUpdatePayload,
  toDateInputValue,
} from "./inventoryTypes";

type Variant = "light" | "dark";

const DEFAULT_FILTERS: InventoryFilters = {
  inventoryStatus: "",
  manufacturer: "",
  supplierName: "",
  warrantyExpiry: "",
};

const PALETTE: Record<
  Variant,
  {
    panel: string;
    border: string;
    subText: string;
    text: string;
    muted: string;
    input: string;
    button: string;
    buttonAlt: string;
    tableHead: string;
    tableRow: string;
    drawer: string;
    overlay: string;
  }
> = {
  light: {
    panel: "bg-white border-slate-200 shadow-sm",
    border: "border-slate-200",
    subText: "text-slate-500",
    text: "text-slate-900",
    muted: "text-slate-600",
    input: "border-slate-200 bg-white text-slate-900 focus:ring-blue-500/20",
    button: "bg-blue-600 text-white hover:bg-blue-700",
    buttonAlt: "bg-slate-100 text-slate-700 hover:bg-slate-200",
    tableHead: "bg-slate-50 text-slate-500",
    tableRow: "border-slate-100 hover:bg-slate-50",
    drawer: "bg-white border-slate-200 text-slate-900",
    overlay: "bg-slate-950/35",
  },
  dark: {
    panel: "bg-slate-900/70 border-slate-800/80 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.85)]",
    border: "border-slate-800/80",
    subText: "text-slate-400",
    text: "text-slate-100",
    muted: "text-slate-300",
    input: "border-slate-800 bg-slate-950/70 text-slate-100 focus:ring-emerald-500/20",
    button: "bg-emerald-500/25 text-emerald-100 hover:bg-emerald-500/35",
    buttonAlt: "bg-slate-950/70 text-slate-200 hover:bg-slate-900",
    tableHead: "bg-slate-950/70 text-slate-400",
    tableRow: "border-slate-800/80 hover:bg-slate-950/60",
    drawer: "bg-slate-950 border-slate-800 text-slate-100",
    overlay: "bg-slate-950/70",
  },
};

const emptyFormState: InventoryUpdatePayload = {
  status: "in_stock",
  purchaseDate: "",
  purchasePrice: null,
  supplierName: "",
  invoiceNumber: "",
  stockLocation: "",
  rackNumber: "",
  faultReason: "",
  repairStatus: "",
  lastAuditAt: "",
};

const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "data" in error &&
    typeof (error as { data?: { message?: string } }).data?.message === "string"
  ) {
    return (error as { data: { message: string } }).data.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
};

function StatCard({
  label,
  value,
  icon,
  variant,
}: {
  label: string;
  value: number;
  icon: ComponentType<{ size?: number; className?: string }>;
  variant: Variant;
}) {
  const colors =
    variant === "light"
      ? "border-slate-200 bg-white text-slate-900"
      : "border-slate-800/80 bg-slate-900/70 text-slate-100";
  const Icon = icon;

  return (
    <div className={`rounded-2xl border p-4 ${colors}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-[10px] font-black uppercase tracking-[0.28em] ${variant === "light" ? "text-slate-500" : "text-slate-400"}`}>
            {label}
          </p>
          <p className="mt-2 text-2xl font-black">{value}</p>
        </div>
        <div className={`rounded-xl p-3 ${variant === "light" ? "bg-slate-100 text-slate-700" : "bg-slate-800 text-slate-200"}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  variant,
}: {
  label: string;
  value: string;
  variant: Variant;
}) {
  return (
    <div className={`rounded-xl border p-3 ${variant === "light" ? "border-slate-200 bg-slate-50" : "border-slate-800 bg-slate-900/70"}`}>
      <p className={`text-[10px] font-black uppercase tracking-[0.22em] ${variant === "light" ? "text-slate-500" : "text-slate-400"}`}>
        {label}
      </p>
      <p className={`mt-1 text-sm font-semibold break-words ${variant === "light" ? "text-slate-900" : "text-slate-100"}`}>{value}</p>
    </div>
  );
}

const toFormState = (device?: GpsDeviceRecord | null): InventoryUpdatePayload => ({
  status: deriveInventoryStatus(device || {}) as InventoryUpdatePayload["status"],
  purchaseDate: toDateInputValue(device?.inventory?.purchaseDate),
  purchasePrice: device?.inventory?.purchasePrice ?? null,
  supplierName: device?.inventory?.supplierName || "",
  invoiceNumber: device?.inventory?.invoiceNumber || "",
  stockLocation: device?.inventory?.stockLocation || "",
  rackNumber: device?.inventory?.rackNumber || "",
  faultReason: device?.inventory?.faultReason || "",
  repairStatus: device?.inventory?.repairStatus || "",
  lastAuditAt: toDateInputValue(device?.inventory?.lastAuditAt),
});

export function InventoryLayer({
  variant = "light",
  canEdit = true,
}: {
  variant?: Variant;
  canEdit?: boolean;
}) {
  const palette = PALETTE[variant];
  const [filters, setFilters] = useState<InventoryFilters>(DEFAULT_FILTERS);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formState, setFormState] = useState<InventoryUpdatePayload>(emptyFormState);

  const inventoryQueryArgs = useMemo(
    () => ({
      limit: 1000,
      ...(filters.inventoryStatus ? { inventoryStatus: filters.inventoryStatus } : {}),
      ...(filters.manufacturer ? { manufacturer: filters.manufacturer } : {}),
      ...(filters.supplierName ? { supplierName: filters.supplierName } : {}),
      ...(filters.warrantyExpiry ? { warrantyExpiry: filters.warrantyExpiry } : {}),
    }),
    [filters],
  );

  const { data, isLoading } = useGetGpsDeviceInventoryQuery(inventoryQueryArgs, {
    refetchOnMountOrArgChange: true,
  });

  const inventoryRows = useMemo(
    () => ((data?.data || []) as GpsDeviceRecord[]).slice(),
    [data],
  );

  const { data: detailResponse, isFetching: isDetailLoading } = useGetGpsDeviceInventoryByIdQuery(
    selectedDeviceId || "",
    {
      skip: !selectedDeviceId,
      refetchOnMountOrArgChange: true,
    },
  );

  const [updateInventory, { isLoading: isUpdating }] = useUpdateGpsDeviceInventoryMutation();

  const selectedListDevice = useMemo(
    () => inventoryRows.find((device) => device._id === selectedDeviceId) || null,
    [inventoryRows, selectedDeviceId],
  );

  const selectedDevice = useMemo(
    () => ((detailResponse?.data as GpsDeviceRecord | undefined) || selectedListDevice),
    [detailResponse, selectedListDevice],
  );

  const inventoryHistory = useMemo(
    () => (((detailResponse as { history?: DeviceInventoryHistoryEntry[] } | undefined)?.history || []) as DeviceInventoryHistoryEntry[]),
    [detailResponse],
  );

  const summary = useMemo(() => {
    return inventoryRows.reduce(
      (acc, device) => {
        const status = deriveInventoryStatus(device);
        acc.total += 1;
        if (status === "in_stock") acc.inStock += 1;
        if (status === "installed") acc.installed += 1;
        if (status === "faulty") acc.faulty += 1;
        if (status === "repair") acc.repair += 1;
        return acc;
      },
      {
        total: 0,
        inStock: 0,
        installed: 0,
        faulty: 0,
        repair: 0,
      },
    );
  }, [inventoryRows]);

  const handleClearFilters = () => setFilters(DEFAULT_FILTERS);

  const handleOpenDrawer = (id: string) => {
    setSelectedDeviceId(id);
  };

  const handleCloseDrawer = () => {
    setSelectedDeviceId(null);
    setIsEditModalOpen(false);
  };

  const handleOpenEditModal = () => {
    setFormState(toFormState(selectedDevice));
    setIsEditModalOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDeviceId) return;

    try {
          await updateInventory({
        id: selectedDeviceId,
        inventory: {
          status: formState.status,
          purchaseDate: formState.purchaseDate || null,
          purchasePrice:
            formState.purchasePrice === null || formState.purchasePrice === undefined
              ? null
              : Number(formState.purchasePrice),
          supplierName: formState.supplierName || "",
          invoiceNumber: formState.invoiceNumber || "",
          stockLocation: formState.stockLocation || "",
          rackNumber: formState.rackNumber || "",
          faultReason: formState.faultReason || "",
          repairStatus: formState.repairStatus || "",
          lastAuditAt: formState.lastAuditAt || null,
        },
      }).unwrap();

      toast.success("Inventory updated successfully");
      setIsEditModalOpen(false);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "Inventory update failed"));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total Devices" value={summary.total} icon={Boxes} variant={variant} />
        <StatCard label="In Stock" value={summary.inStock} icon={ClipboardList} variant={variant} />
        <StatCard label="Installed" value={summary.installed} icon={CalendarClock} variant={variant} />
        <StatCard label="Faulty" value={summary.faulty} icon={ShieldAlert} variant={variant} />
        <StatCard label="Repair" value={summary.repair} icon={Wrench} variant={variant} />
      </div>

      <div className={`rounded-2xl border p-5 ${palette.panel}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className={`text-[11px] font-black uppercase tracking-[0.32em] ${palette.subText}`}>Inventory</p>
            <h2 className={`mt-1 text-xl font-black ${palette.text}`}>Device Inventory</h2>
            <p className={`mt-1 text-sm ${palette.subText}`}>
              Inventory status is read from the backend and stays aligned with assignment and install state.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearFilters}
            className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${palette.buttonAlt}`}
          >
            Clear Filters
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.24em] ${palette.subText}`}>
              Inventory Status
            </label>
            <select
              value={filters.inventoryStatus}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  inventoryStatus: event.target.value as InventoryFilters["inventoryStatus"],
                }))
              }
              className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
            >
              <option value="">All Statuses</option>
              {INVENTORY_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.24em] ${palette.subText}`}>
              Manufacturer
            </label>
            <input
              value={filters.manufacturer}
              onChange={(event) =>
                setFilters((current) => ({ ...current, manufacturer: event.target.value }))
              }
              placeholder="Filter manufacturer"
              className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
            />
          </div>
          <div>
            <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.24em] ${palette.subText}`}>
              Supplier Name
            </label>
            <input
              value={filters.supplierName}
              onChange={(event) =>
                setFilters((current) => ({ ...current, supplierName: event.target.value }))
              }
              placeholder="Filter supplier"
              className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
            />
          </div>
          <div>
            <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.24em] ${palette.subText}`}>
              Warranty Expiry
            </label>
            <input
              type="date"
              value={filters.warrantyExpiry}
              onChange={(event) =>
                setFilters((current) => ({ ...current, warrantyExpiry: event.target.value }))
              }
              className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
            />
          </div>
        </div>

        <div className={`mt-5 overflow-hidden rounded-2xl border ${palette.border}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead>
                <tr className={`${palette.tableHead} border-b ${palette.border}`}>
                  {[
                    "IMEI",
                    "Device Model",
                    "Manufacturer",
                    "Inventory Status",
                    "Warranty Expiry",
                    "Supplier Name",
                    "Stock Location",
                    "Last Audit",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-4 py-3 text-[10px] font-black uppercase tracking-[0.28em]"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [...Array(5)].map((_, idx) => (
                    <tr key={idx} className={`border-b ${palette.border}`}>
                      <td colSpan={8} className="px-4 py-4">
                        <div className={`h-10 animate-pulse rounded-xl ${variant === "light" ? "bg-slate-100" : "bg-slate-800"}`} />
                      </td>
                    </tr>
                  ))
                ) : inventoryRows.length ? (
                  inventoryRows.map((device) => (
                    <tr
                      key={device._id}
                      onClick={() => handleOpenDrawer(device._id)}
                      className={`cursor-pointer border-b transition-colors ${palette.tableRow}`}
                    >
                      <td className={`px-4 py-4 font-mono text-xs ${palette.text}`}>{device.imei}</td>
                      <td className={`px-4 py-4 font-semibold ${palette.text}`}>{device.deviceModel || "-"}</td>
                      <td className={`px-4 py-4 ${palette.muted}`}>{device.manufacturer || "-"}</td>
                      <td className="px-4 py-4">
                        <InventoryStatusBadge device={device} variant={variant} />
                      </td>
                      <td className={`px-4 py-4 ${palette.muted}`}>{formatDateValue(device.warrantyExpiry)}</td>
                      <td className={`px-4 py-4 ${palette.muted}`}>{device.inventory?.supplierName || "-"}</td>
                      <td className={`px-4 py-4 ${palette.muted}`}>{device.inventory?.stockLocation || "-"}</td>
                      <td className={`px-4 py-4 ${palette.muted}`}>{formatDateValue(device.inventory?.lastAuditAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className={`px-4 py-12 text-center text-sm font-semibold ${palette.subText}`}>
                      No inventory devices found for the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedDeviceId && (
        <div className={`fixed inset-0 z-[70] ${palette.overlay}`}>
          <div className="absolute inset-0" onClick={handleCloseDrawer} />
          <div
            className={`absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l shadow-2xl ${palette.drawer}`}
          >
            <div className={`flex items-start justify-between border-b p-6 ${palette.border}`}>
              <div>
                <p className={`text-[11px] font-black uppercase tracking-[0.32em] ${palette.subText}`}>
                  Inventory Details
                </p>
                <h3 className={`mt-2 text-2xl font-black ${palette.text}`}>{selectedDevice?.imei || "Device"}</h3>
                <div className="mt-3">
                  <InventoryStatusBadge device={selectedDevice || selectedListDevice || {}} variant={variant} />
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseDrawer}
                className={`rounded-xl border p-2 transition-colors ${palette.border} ${palette.buttonAlt}`}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isDetailLoading && !selectedDevice ? (
                <div className="space-y-3">
                  {[...Array(6)].map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-16 animate-pulse rounded-xl ${variant === "light" ? "bg-slate-100" : "bg-slate-900/70"}`}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <DetailItem label="Purchase Date" value={formatDateValue(selectedDevice?.inventory?.purchaseDate)} variant={variant} />
                    <DetailItem label="Purchase Price" value={formatCurrencyValue(selectedDevice?.inventory?.purchasePrice)} variant={variant} />
                    <DetailItem label="Supplier" value={selectedDevice?.inventory?.supplierName || "-"} variant={variant} />
                    <DetailItem label="Invoice Number" value={selectedDevice?.inventory?.invoiceNumber || "-"} variant={variant} />
                    <DetailItem label="Stock Location" value={selectedDevice?.inventory?.stockLocation || "-"} variant={variant} />
                    <DetailItem label="Rack Number" value={selectedDevice?.inventory?.rackNumber || "-"} variant={variant} />
                    <DetailItem label="Fault Reason" value={selectedDevice?.inventory?.faultReason || "-"} variant={variant} />
                    <DetailItem label="Repair Status" value={selectedDevice?.inventory?.repairStatus || "-"} variant={variant} />
                    <DetailItem label="Last Audit" value={formatDateValue(selectedDevice?.inventory?.lastAuditAt, true)} variant={variant} />
                    <DetailItem label="Updated At" value={formatDateValue(selectedDevice?.inventory?.updatedAt, true)} variant={variant} />
                    <DetailItem label="Updated By" value={formatUpdatedBy(selectedDevice?.inventory?.updatedBy)} variant={variant} />
                    <DetailItem label="Warranty Expiry" value={formatDateValue(selectedDevice?.warrantyExpiry)} variant={variant} />
                  </div>

                  <div>
                    <div className="mb-3">
                      <p className={`text-[11px] font-black uppercase tracking-[0.28em] ${palette.subText}`}>
                        Inventory Timeline
                      </p>
                    </div>
                    {inventoryHistory.length ? (
                      <div className="space-y-3">
                        {inventoryHistory.map((entry, index) => {
                          const changeLabel =
                            entry.previousStatus === entry.newStatus
                              ? formatInventoryStatus(entry.newStatus)
                              : `${formatInventoryStatus(entry.previousStatus)} → ${formatInventoryStatus(entry.newStatus)}`;

                          return (
                            <div key={entry._id || `${entry.changedAt}-${index}`} className="flex gap-3">
                              <div className="flex w-6 flex-col items-center">
                                <div className={`mt-1 h-3 w-3 rounded-full ${variant === "light" ? "bg-slate-900" : "bg-emerald-400"}`} />
                                {index !== inventoryHistory.length - 1 && (
                                  <div className={`mt-1 h-full w-px ${variant === "light" ? "bg-slate-200" : "bg-slate-800"}`} />
                                )}
                              </div>
                              <div className={`flex-1 rounded-xl border p-4 ${variant === "light" ? "border-slate-200 bg-slate-50" : "border-slate-800 bg-slate-900/70"}`}>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <div className={`text-sm font-black ${palette.text}`}>{changeLabel}</div>
                                  <div className={`text-xs font-semibold ${palette.subText}`}>{formatDateValue(entry.changedAt, true)}</div>
                                </div>
                                <div className={`mt-2 text-sm font-medium ${palette.muted}`}>
                                  {entry.reason?.trim() ? entry.reason : "No reason provided"}
                                </div>
                                <div className={`mt-2 text-xs font-semibold ${palette.subText}`}>
                                  Changed By: {formatUpdatedBy(entry.changedBy)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className={`rounded-xl border p-4 text-sm font-semibold ${variant === "light" ? "border-slate-200 bg-slate-50 text-slate-600" : "border-slate-800 bg-slate-900/70 text-slate-300"}`}>
                        No inventory history available yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {canEdit && (
              <div className={`border-t p-6 ${palette.border}`}>
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${palette.button}`}
                >
                  <Edit3 size={14} />
                  Edit Inventory
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isEditModalOpen && selectedDeviceId && (
        <div className={`fixed inset-0 z-[80] flex items-center justify-center p-4 ${palette.overlay}`}>
          <div className="absolute inset-0" onClick={() => setIsEditModalOpen(false)} />
          <div className={`relative z-10 w-full max-w-3xl rounded-2xl border p-6 ${palette.drawer}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className={`text-[11px] font-black uppercase tracking-[0.32em] ${palette.subText}`}>
                  Inventory Update
                </p>
                <h3 className={`mt-2 text-2xl font-black ${palette.text}`}>Edit Inventory</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className={`rounded-xl border p-2 transition-colors ${palette.border} ${palette.buttonAlt}`}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.22em] ${palette.subText}`}>
                    Inventory Status
                  </label>
                  <select
                    value={formState.status || "in_stock"}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        status: event.target.value as InventoryUpdatePayload["status"],
                      }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
                  >
                    {INVENTORY_STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.22em] ${palette.subText}`}>
                    Purchase Date
                  </label>
                  <input
                    type="date"
                    value={String(formState.purchaseDate || "")}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, purchaseDate: event.target.value }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.22em] ${palette.subText}`}>
                    Purchase Price
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formState.purchasePrice ?? ""}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        purchasePrice: event.target.value ? Number(event.target.value) : null,
                      }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.22em] ${palette.subText}`}>
                    Supplier Name
                  </label>
                  <input
                    value={formState.supplierName || ""}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, supplierName: event.target.value }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.22em] ${palette.subText}`}>
                    Invoice Number
                  </label>
                  <input
                    value={formState.invoiceNumber || ""}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, invoiceNumber: event.target.value }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.22em] ${palette.subText}`}>
                    Stock Location
                  </label>
                  <input
                    value={formState.stockLocation || ""}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, stockLocation: event.target.value }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.22em] ${palette.subText}`}>
                    Rack Number
                  </label>
                  <input
                    value={formState.rackNumber || ""}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, rackNumber: event.target.value }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.22em] ${palette.subText}`}>
                    Last Audit
                  </label>
                  <input
                    type="date"
                    value={String(formState.lastAuditAt || "")}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, lastAuditAt: event.target.value }))
                    }
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.22em] ${palette.subText}`}>
                    Fault Reason
                  </label>
                  <textarea
                    value={formState.faultReason || ""}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, faultReason: event.target.value }))
                    }
                    rows={4}
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
                  />
                </div>
                <div>
                  <label className={`mb-1 block text-[10px] font-black uppercase tracking-[0.22em] ${palette.subText}`}>
                    Repair Status
                  </label>
                  <textarea
                    value={formState.repairStatus || ""}
                    onChange={(event) =>
                      setFormState((current) => ({ ...current, repairStatus: event.target.value }))
                    }
                    rows={4}
                    className={`w-full rounded-xl border px-3 py-2 text-sm font-semibold outline-none focus:ring-2 ${palette.input}`}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${palette.buttonAlt}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className={`rounded-xl px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${palette.button} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {isUpdating ? "Saving..." : "Save Inventory"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
