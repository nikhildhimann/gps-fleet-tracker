import { deriveInventoryStatus, formatInventoryStatus, GpsDeviceRecord, InventoryStatus } from "./inventoryTypes";

type Variant = "light" | "dark";

const BADGE_STYLES: Record<Variant, Record<InventoryStatus, string>> = {
  light: {
    in_stock: "border-slate-300 bg-slate-100 text-slate-700",
    assigned: "border-blue-200 bg-blue-50 text-blue-700",
    installed: "border-emerald-200 bg-emerald-50 text-emerald-700",
    faulty: "border-rose-200 bg-rose-50 text-rose-700",
    repair: "border-amber-200 bg-amber-50 text-amber-700",
    retired: "border-zinc-300 bg-zinc-100 text-zinc-700",
  },
  dark: {
    in_stock: "border-slate-700 bg-slate-800 text-slate-200",
    assigned: "border-blue-500/30 bg-blue-500/15 text-blue-200",
    installed: "border-emerald-500/30 bg-emerald-500/15 text-emerald-200",
    faulty: "border-rose-500/30 bg-rose-500/15 text-rose-200",
    repair: "border-amber-500/30 bg-amber-500/15 text-amber-200",
    retired: "border-zinc-600 bg-zinc-800 text-zinc-200",
  },
};

export function InventoryStatusBadge({
  device,
  status,
  variant = "light",
  compact = false,
}: {
  device?: Partial<GpsDeviceRecord>;
  status?: InventoryStatus;
  variant?: Variant;
  compact?: boolean;
}) {
  const resolvedStatus = status || deriveInventoryStatus(device || {});

  return (
    <span
      className={`inline-flex items-center rounded-full border font-black uppercase tracking-[0.18em] ${compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-[10px]"} ${BADGE_STYLES[variant][resolvedStatus]}`}
    >
      {formatInventoryStatus(resolvedStatus)}
    </span>
  );
}
