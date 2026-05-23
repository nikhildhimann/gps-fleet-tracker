import type { Vehicle } from "@/lib/vehicles"

type AlertItem = {
    _id?: string
    vehicleId?: string | { _id?: string }
    alertName?: string
    severity?: string
    gpsTimestamp?: string
    receivedAt?: string
    createdAt?: string
}

type DailyStats = {
    totalDistance?: number
    maxSpeed?: number
    avgSpeed?: number
    runningTime?: number
    idleTime?: number
    stoppedTime?: number
}

export function ActivityStats({
    vehicles = [],
    alertCount = 0,
    alerts = [],
    selectedVehicleId,
    selectedVehicleObj,
    compact = false,
    dailyStats,
}: {
    vehicles?: Vehicle[]
    alertCount?: number
    alerts?: AlertItem[]
    selectedVehicleId?: string | null
    selectedVehicleObj?: Vehicle | null
    compact?: boolean
    dailyStats?: DailyStats | null
}) {
    void alerts
    void selectedVehicleId
    void selectedVehicleObj
    void dailyStats

    const fleet = vehicles.reduce(
        (acc, vehicle) => {
            acc.total += 1
            if (vehicle.status === "running") acc.running += 1
            if (vehicle.status === "idle") acc.idle += 1
            if (vehicle.status === "inactive") acc.inactive += 1
            return acc
        },
        { total: 0, running: 0, idle: 0, inactive: 0 }
    )

    return (
        <div className={`grid gap-2 ${compact ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 lg:grid-cols-4"}`}>
            <div className="rounded-2xl bg-[#1C2533] p-3 shadow-lg shadow-black/20">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Total Fleet</div>
                <div className="mt-1 text-xl font-bold text-white">{fleet.total}</div>
            </div>

            <div className="rounded-2xl bg-[#1C2533] p-3 shadow-lg shadow-black/20">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Running</div>
                <div className="mt-1 text-xl font-bold text-green-400">{fleet.running}</div>
            </div>

            <div className="rounded-2xl bg-[#1C2533] p-3 shadow-lg shadow-black/20">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Idle</div>
                <div className="mt-1 text-xl font-bold text-yellow-300">{fleet.idle}</div>
            </div>

            <div className="rounded-2xl bg-[#1C2533] p-3 shadow-lg shadow-black/20">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Alerts</div>
                <div className="mt-1 text-xl font-bold text-red-400">{alertCount}</div>
            </div>
        </div>
    )
}
