"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
    Pencil,
    Trash2,
    ChevronLeft,
    ChevronRight,
    Filter,
    X,
    RefreshCw,
    Car,
    AlertCircle,
} from "lucide-react"
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi"
import { useGetLiveVehiclesQuery } from "@/redux/api/gpsLiveApi"
import { toast } from "sonner"
import VehicleEditModal from "./vehicle-edit-modal"
import VehicleDeleteDialog from "./vehicle-delete-dialog"
import type { VehicleRecord } from "@/lib/api"

// ─── Types ────────────────────────────────────────────────────────────────────
type StatusFilter = "all" | "active" | "inactive" | "moving" | "stopped"

type LiveGpsItem = {
    vehicleId?: string | { _id?: string }
    gpsDeviceId?: string | { _id?: string }
    imei?: string
    latitude?: number
    longitude?: number
    currentLocation?:
    | string
    | {
        address?: string
        addressLine?: string
        city?: string
        state?: string
        country?: string
        pincode?: string | number
    }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStatusColor(status?: string): string {
    switch ((status || "").toLowerCase()) {
        case "active":
        case "online":
        case "running":
            return "bg-emerald-400/15 text-emerald-300 border-emerald-400/30"
        case "inactive":
        case "offline":
            return "bg-slate-500/20 text-slate-400 border-slate-500/30"
        case "stopped":
            return "bg-red-500/15 text-red-300 border-red-500/30"
        case "idle":
            return "bg-amber-400/15 text-amber-300 border-amber-400/30"
        default:
            return "bg-slate-600/20 text-slate-400 border-slate-600/30"
    }
}

function getStatusDot(status?: string): string {
    switch ((status || "").toLowerCase()) {
        case "active":
        case "online":
        case "running":
            return "bg-emerald-400"
        case "inactive":
        case "offline":
            return "bg-slate-400"
        case "stopped":
            return "bg-red-400"
        case "idle":
            return "bg-amber-400"
        default:
            return "bg-slate-500"
    }
}

function toLocationText(value: unknown): string {
    if (!value) return ""
    if (typeof value === "string") return value.trim()
    if (typeof value === "object") {
        const loc = value as {
            address?: string
            addressLine?: string
            city?: string
            state?: string
            country?: string
            pincode?: string | number
        }
        const direct = [loc.address, loc.addressLine].find(
            (entry) => typeof entry === "string" && entry.trim().length > 0
        )
        if (direct) return String(direct).trim()
        const parts = [loc.city, loc.state, loc.country, loc.pincode ? String(loc.pincode) : ""].filter(Boolean)
        return parts.join(", ")
    }
    return ""
}

function formatCoordinateText(latitude?: number | null, longitude?: number | null): string {
    if (typeof latitude !== "number" || typeof longitude !== "number") return ""
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return ""
    return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
}

function getLiveKey(value: unknown): string {
    if (!value) return ""
    if (typeof value === "string") return value
    return (value as { _id?: string })._id || ""
}

function normalizeRecord(raw: Record<string, unknown>): VehicleRecord {
    return {
        _id: (raw._id as string) || "",
        vehicleNumber: (raw.vehicleNumber || raw.registrationNumber || raw.vehicleName) as string | undefined,
        imei: (raw.imei || raw.deviceImei) as string | undefined,
        deviceImei: raw.deviceImei as string | undefined,
        status: raw.status as string | undefined,
        currentLocation: raw.currentLocation as VehicleRecord["currentLocation"],
        organizationId: raw.organizationId as VehicleRecord["organizationId"],
        driverName: raw.driverName as string | undefined,
        make: raw.make as string | undefined,
        model: raw.model as string | undefined,
        vehicleType: raw.vehicleType as string | undefined,
        color: raw.color as string | undefined,
        year: raw.year as string | undefined,
    }
}

// ─── Skeleton Row ─────────────────────────────────────────────────────────────
function SkeletonRow() {
    return (
        <tr className="border-b border-white/5 animate-pulse">
            {Array.from({ length: 7 }).map((_, i) => (
                <td key={i} className="px-4 py-3">
                    <div className="h-4 rounded bg-slate-700/60" style={{ width: `${60 + Math.random() * 30}%` }} />
                </td>
            ))}
        </tr>
    )
}

// ─── Filter Pill ──────────────────────────────────────────────────────────────
function FilterPill({
    label,
    active,
    onClick,
    dotColor,
}: {
    label: string
    active: boolean
    onClick: () => void
    dotColor: string
}) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all
        ${active
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                    : "bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                }`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
            {label}
        </button>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function VehicleTable() {
    const [page, setPage] = useState(1)
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
    const [editVehicle, setEditVehicle] = useState<VehicleRecord | null>(null)
    const [deleteVehicle, setDeleteVehicle] = useState<VehicleRecord | null>(null)
    const LIMIT = 10

    // Build query params
    const queryParams = {
        page,
        limit: LIMIT,
        ...(statusFilter !== "all" ? { status: statusFilter } : {}),
    }

    const {
        data: rawData,
        isLoading,
        isFetching,
        isError,
        refetch,
    } = useGetVehiclesQuery(queryParams as unknown as undefined, {
        refetchOnMountOrArgChange: true,
    })

    const { data: liveData } = useGetLiveVehiclesQuery(undefined, {
        pollingInterval: 10000,
        refetchOnMountOrArgChange: true,
        refetchOnReconnect: true,
    })

    // Extract vehicles + pagination
    const vehicles: VehicleRecord[] = (
        (rawData as { vehicles?: unknown[]; data?: unknown[] } | null)?.vehicles ??
        (rawData as { vehicles?: unknown[]; data?: unknown[] } | null)?.data ??
        []
    ).map((v: unknown) => normalizeRecord(v as Record<string, unknown>))

    const total: number = (rawData as { total?: number } | null)?.total ?? vehicles.length
    const totalPages: number = (rawData as { totalPages?: number } | null)?.totalPages ?? (Math.ceil(total / LIMIT) || 1)

    const liveVehicles = useMemo(
        () =>
            (
                (liveData as { vehicles?: unknown[]; data?: unknown[] } | null)?.vehicles ??
                (liveData as { vehicles?: unknown[]; data?: unknown[] } | null)?.data ??
                []
            ) as LiveGpsItem[],
        [liveData]
    )

    const liveByKey = useMemo(() => {
        const map = new Map<string, LiveGpsItem>()
        liveVehicles.forEach((item) => {
            const vehicleId = getLiveKey(item.vehicleId)
            const gpsDeviceId = getLiveKey(item.gpsDeviceId)
            if (vehicleId) map.set(vehicleId, item)
            if (item.imei) map.set(item.imei, item)
            if (gpsDeviceId) map.set(gpsDeviceId, item)
        })
        return map
    }, [liveVehicles])

    const handleFilterChange = (f: StatusFilter) => {
        setStatusFilter(f)
        setPage(1)
    }

    const handleEditSuccess = useCallback(() => {
        toast.success("Vehicle updated successfully")
        refetch()
    }, [refetch])

    const handleDeleteSuccess = useCallback(() => {
        toast.success("Vehicle deleted successfully")
        refetch()
    }, [refetch])

    const filters: { label: string; value: StatusFilter; dot: string }[] = [
        { label: "All", value: "all", dot: "bg-slate-400" },
        { label: "Active", value: "active", dot: "bg-emerald-400" },
        { label: "Inactive", value: "inactive", dot: "bg-slate-500" },
        { label: "Moving", value: "moving", dot: "bg-blue-400" },
        { label: "Stopped", value: "stopped", dot: "bg-red-400" },
    ]

    return (
        <div className="flex flex-col h-full min-h-0 bg-slate-950/80">
            {/* ── Toolbar ─────────────────────────────────────────────────────── */}
            <div className="shrink-0 flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3 bg-slate-900/60">
                {/* Title */}
                <div className="flex items-center gap-2 mr-auto">
                    <Car className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm font-bold text-slate-100">
                        Vehicles
                        {!isLoading && (
                            <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                                {total}
                            </span>
                        )}
                    </span>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter className="h-3.5 w-3.5 text-slate-500" />
                    {filters.map((f) => (
                        <FilterPill
                            key={f.value}
                            label={f.label}
                            active={statusFilter === f.value}
                            onClick={() => handleFilterChange(f.value)}
                            dotColor={f.dot}
                        />
                    ))}
                </div>

                {/* Refresh */}
                <button
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition-colors disabled:opacity-50"
                    title="Refresh"
                >
                    <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
                </button>
            </div>

            {/* ── Table ───────────────────────────────────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-auto">
                <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-900/90 border-b border-white/10">
                        <tr>
                            {[
                                "Vehicle Name",
                                "IMEI",
                                "Plate Number",
                                "Status",
                                "Last Location",
                                "Driver",
                                "Actions",
                            ].map((col) => (
                                <th
                                    key={col}
                                    className={`px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 ${col === "IMEI" || col === "Plate Number" ? "hidden sm:table-cell" :
                                        col === "Driver" ? "hidden md:table-cell" : ""
                                        }`}
                                >
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>

                    <tbody>
                        {/* Loading skeletons */}
                        {isLoading &&
                            Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

                        {/* Error */}
                        {isError && !isLoading && (
                            <tr>
                                <td colSpan={7} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3 text-red-400">
                                        <AlertCircle className="h-8 w-8" />
                                        <p className="text-sm font-semibold">Failed to load vehicles</p>
                                        <button
                                            onClick={() => refetch()}
                                            className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-xs font-semibold hover:bg-red-500/20 transition-colors"
                                        >
                                            Try Again
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )}

                        {/* Empty state */}
                        {!isLoading && !isError && vehicles.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3 text-slate-500">
                                        <Car className="h-10 w-10 opacity-40" />
                                        <p className="text-sm font-semibold text-slate-400">No Vehicles Found</p>
                                        {statusFilter !== "all" && (
                                            <button
                                                onClick={() => handleFilterChange("all")}
                                                className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
                                            >
                                                <X className="h-3.5 w-3.5" /> Clear filter
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )}

                        {/* Data rows */}
                        {!isLoading &&
                            !isError &&
                            vehicles.map((v) => {
                                const plateNumber = v.vehicleNumber || v.registrationNumber || "—"
                                const vehicleName =
                                    v.vehicleType
                                        ? `${v.vehicleType.charAt(0).toUpperCase() + v.vehicleType.slice(1)} – ${plateNumber}`
                                        : plateNumber
                                const imei = v.imei || v.deviceImei || "—"
                                const status = v.status || "unknown"
                                const liveItem =
                                    liveByKey.get(v._id) ||
                                    (v.imei ? liveByKey.get(v.imei) : undefined) ||
                                    (v.deviceImei ? liveByKey.get(v.deviceImei) : undefined)
                                const liveLocation = toLocationText(liveItem?.currentLocation)
                                const storedLocation =
                                    typeof v.currentLocation === "object" ? v.currentLocation?.address || "" : ""
                                const coordinateLocation =
                                    formatCoordinateText(liveItem?.latitude, liveItem?.longitude) ||
                                    formatCoordinateText(v.currentLocation?.latitude, v.currentLocation?.longitude)
                                const location = liveLocation || storedLocation || coordinateLocation || "—"
                                const driver = v.driverName || "Unassigned"

                                return (
                                    <tr
                                        key={v._id}
                                        className="group border-b border-white/5 hover:bg-emerald-500/5 transition-colors"
                                    >
                                        {/* Vehicle Name */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`h-2 w-2 shrink-0 rounded-full ${getStatusDot(status)}`} />
                                                <span className="font-semibold text-slate-100 truncate max-w-[140px]">
                                                    {vehicleName}
                                                </span>
                                            </div>
                                        </td>

                                        {/* IMEI */}
                                        <td className="px-4 py-3 font-mono text-slate-400 text-[11px] hidden sm:table-cell">{imei}</td>

                                        {/* Plate Number */}
                                        <td className="px-4 py-3 hidden sm:table-cell">
                                            <span className="rounded-md bg-slate-800 px-2 py-1 font-mono text-[11px] text-slate-200 border border-white/10">
                                                {plateNumber}
                                            </span>
                                        </td>

                                        {/* Status */}
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${getStatusColor(status)}`}
                                            >
                                                <span className={`h-1.5 w-1.5 rounded-full ${getStatusDot(status)}`} />
                                                {status}
                                            </span>
                                        </td>

                                        {/* Last Location */}
                                        <td className="px-4 py-3 text-slate-400 max-w-[180px]">
                                            <span className="block truncate" title={location}>
                                                {location}
                                            </span>
                                        </td>

                                        {/* Driver */}
                                        <td className="px-4 py-3 text-slate-300 hidden md:table-cell">{driver}</td>

                                        {/* Actions */}
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    title="Edit vehicle"
                                                    onClick={() => setEditVehicle(v)}
                                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button
                                                    title="Delete vehicle"
                                                    onClick={() => setDeleteVehicle(v)}
                                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                    </tbody>
                </table>
            </div>

            {/* ── Pagination ──────────────────────────────────────────────────── */}
            {!isLoading && !isError && vehicles.length > 0 && (
                <div className="shrink-0 flex items-center justify-between border-t border-white/10 px-4 py-2.5 bg-slate-900/60">
                    <span className="text-xs text-slate-400">
                        Page <span className="font-semibold text-slate-200">{page}</span> of{" "}
                        <span className="font-semibold text-slate-200">{totalPages}</span>
                        &nbsp;·&nbsp;
                        <span className="text-slate-300">{total} vehicles total</span>
                    </span>

                    <div className="flex items-center gap-1">
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1 || isFetching}
                            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Prev
                        </button>

                        {/* Page numbers */}
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                                let pageNum: number
                                if (totalPages <= 7) {
                                    pageNum = i + 1
                                } else if (page <= 4) {
                                    pageNum = i + 1
                                } else if (page >= totalPages - 3) {
                                    pageNum = totalPages - 6 + i
                                } else {
                                    pageNum = page - 3 + i
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setPage(pageNum)}
                                        disabled={isFetching}
                                        className={`h-7 w-7 rounded-lg text-xs font-semibold transition-colors
                      ${page === pageNum
                                                ? "bg-emerald-500 text-slate-900"
                                                : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border border-white/10"
                                            }`}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })}
                        </div>

                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages || isFetching}
                            className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                            <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            )}

            {/* ── Modals ──────────────────────────────────────────────────────── */}
            <VehicleEditModal
                vehicle={editVehicle}
                isOpen={!!editVehicle}
                onClose={() => setEditVehicle(null)}
                onSuccess={handleEditSuccess}
            />
            <VehicleDeleteDialog
                vehicle={deleteVehicle}
                isOpen={!!deleteVehicle}
                onClose={() => setDeleteVehicle(null)}
                onSuccess={handleDeleteSuccess}
            />
        </div>
    )
}
