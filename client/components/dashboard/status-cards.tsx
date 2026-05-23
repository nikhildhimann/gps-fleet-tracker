import { Activity, Car, Clock3, Database, Power, Signal } from "lucide-react"
import type { Vehicle } from "@/lib/vehicles"

export type VehicleStatusFilter = "running" | "idle" | "stopped" | "inactive" | "nodata" | "total" | "active"

export function StatusCards({
    activeFilter = "total",
    onFilterChange,
    vehicles = [],
}: {
    activeFilter?: VehicleStatusFilter
    onFilterChange?: (filter: VehicleStatusFilter) => void
    vehicles?: Vehicle[]
}) {
    const totals = vehicles.reduce(
        (acc, vehicle) => {
            acc.total += 1
            if (vehicle.status === "running") acc.running += 1
            if (vehicle.status === "idle") acc.idle += 1
            if (vehicle.status === "stopped") acc.stopped += 1
            if (vehicle.status === "inactive") acc.inactive += 1
            if (vehicle.status === "nodata") acc.nodata += 1
            return acc
        },
        { running: 0, idle: 0, stopped: 0, inactive: 0, nodata: 0, total: 0 }
    )

    const stats = [
        {
            label: "Running",
            count: totals.running,
            filter: "running" as const,
            icon: Activity,
            cardClass: "bg-gradient-to-br from-[#46b24b] to-[#2f8d35] text-white border-[#2f8d35]/30",
        },
        {
            label: "Idle",
            count: totals.idle,
            filter: "idle" as const,
            icon: Clock3,
            cardClass: "bg-gradient-to-br from-[#f3a338] to-[#dd7d16] text-white border-[#dd7d16]/30",
        },
        {
            label: "Stopped",
            count: totals.stopped,
            filter: "stopped" as const,
            icon: Power,
            cardClass: "bg-gradient-to-br from-[#ef5b4d] to-[#d83a2d] text-white border-[#d83a2d]/30",
        },
        {
            label: "Inactive",
            count: totals.inactive,
            filter: "inactive" as const,
            icon: Signal,
            cardClass: "bg-gradient-to-br from-[#53a8e9] to-[#2d7bc1] text-white border-[#2d7bc1]/30",
        },
        {
            label: "No Data",
            count: totals.nodata,
            filter: "nodata" as const,
            icon: Database,
            cardClass: "bg-gradient-to-br from-[#a8adb7] to-[#7e8794] text-white border-[#7e8794]/30",
        },
        {
            label: "Total",
            count: totals.total,
            filter: "total" as const,
            icon: Car,
            cardClass: "bg-white text-[#1f2937] border-[#d7e4d0]",
        },
    ]

    return (
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-6">
            {stats.map((stat) => (
                <button
                    key={stat.label}
                    type="button"
                    onClick={() => onFilterChange?.(stat.filter)}
                    className={`group relative overflow-hidden rounded-2xl border px-4 py-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${stat.cardClass} ${activeFilter === stat.filter ? "ring-2 ring-[#2f8d35]/35 ring-offset-2 ring-offset-[#f3f7f1]" : ""}`}
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.24em] opacity-85">{stat.label}</p>
                            <p className="mt-3 text-3xl font-black leading-none">{stat.count}</p>
                        </div>
                        <div className="rounded-xl bg-white/20 p-2 text-current backdrop-blur-sm">
                            <stat.icon className="h-5 w-5" />
                        </div>
                    </div>
                    <div className="mt-4 text-[11px] font-semibold opacity-85">
                        {activeFilter === stat.filter ? "Active filter" : "Tap to filter"}
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-black/10 opacity-40" />
                </button>
            ))}
        </div>
    )
}
