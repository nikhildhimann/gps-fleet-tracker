"use client"

import { useState, useMemo } from "react"
import { ReportFilterBar, ReportFilterState, getDefaultReportFilter } from "./ReportFilterBar"
import { useGetTravelSummaryQuery } from "@/redux/api/gpsHistoryApi"
import { Activity, CalendarDays, Filter, Navigation } from "lucide-react"
import React from "react"

export function DaywiseDistancePage({
    organizations,
    vehicles,
    userRole,
    userOrgId,
}: {
    organizations: any[]
    vehicles: any[]
    userRole: string | null
    userOrgId: string | null
}) {
    const [filters, setFilters] = useState<ReportFilterState>(getDefaultReportFilter())

    const { data, isFetching, error } = useGetTravelSummaryQuery(
        { vehicleId: filters.vehicleId, from: filters.from, to: filters.to }
    )

    const vehiclesSummary = useMemo(() => (data?.data?.trips || []) as any[], [data])

    // Generate columns based on date range
    const columns = useMemo(() => {
        const start = new Date(filters.from)
        const end = new Date(filters.to)
        const dates = []
        const curr = new Date(start)

        // Safety break
        let limit = 0
        while (curr <= end && limit < 62) {
            dates.push(new Date(curr).toISOString().split('T')[0])
            curr.setDate(curr.getDate() + 1)
            limit++
        }
        return dates
    }, [filters.from, filters.to])

    // Prepare report data for export
    const reportData = useMemo(() => {
        return vehiclesSummary.map((vehicle) => {
            const row: any = {
                Branch: vehicle.branchName || "-",
                Vehicle: vehicle.vehicleNumber,
                "Vehicle Brand": vehicle.brand || "-",
                "Vehicle Model": vehicle.model || "-",
                "Total Distance": Number(vehicle.distance || 0).toFixed(2)
            }
            
            // Add daily distances
            columns.forEach(date => {
                const ddmm = formatDateToDDMMYYYY(date)
                const dayData = vehicle.dailyBreakdown?.find((d: any) => d.date === ddmm)
                const distance = dayData?.distance || 0
                row[date] = distance.toFixed(2)
            })
            
            return row
        })
    }, [vehiclesSummary, columns])

    const formatDateToDD = (dateStr: string) => {
        return dateStr.split('-')[2]
    }

    const formatDateToDDMMYYYY = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-')
        return `${d}-${m}-${y}`
    }

    const formatDurationCompact = (seconds?: number) => {
        const total = Math.max(0, Number(seconds || 0))
        const hrs = Math.floor(total / 3600)
        const mins = Math.floor((total % 3600) / 60)

        if (hrs > 0) return `${hrs}h ${mins}m`
        if (mins > 0) return `${mins}m`
        return `${Math.floor(total % 60)}s`
    }

    const normalizedVehicles = useMemo(() => {
        return vehiclesSummary.map((vehicle) => {
            const dayMap = new Map(
                (vehicle.dailyBreakdown || []).map((day: any) => [day.date, day]),
            )
            const activeDays = Array.from(dayMap.values()).filter((day: any) => Number(day?.distance || 0) > 0).length

            return {
                ...vehicle,
                dayMap,
                activeDays,
            }
        })
    }, [vehiclesSummary])

    const reportStats = useMemo(() => {
        const totalFleetDistance = normalizedVehicles.reduce((sum, vehicle) => sum + Number(vehicle.distance || 0), 0)
        const activeVehicles = normalizedVehicles.filter((vehicle) => Number(vehicle.distance || 0) > 0).length
        const activeDateCount = columns.filter((date) => {
            const key = formatDateToDDMMYYYY(date)
            return normalizedVehicles.some((vehicle) => Number(vehicle.dayMap.get(key)?.distance || 0) > 0)
        }).length

        const maxDailyDistance = Math.max(
            0,
            ...normalizedVehicles.flatMap((vehicle) =>
                Array.from(vehicle.dayMap.values()).map((day: any) => Number(day?.distance || 0)),
            ),
        )

        return {
            totalFleetDistance,
            activeVehicles,
            activeDateCount,
            avgDistancePerVehicle: activeVehicles > 0 ? totalFleetDistance / activeVehicles : 0,
            maxDailyDistance,
        }
    }, [columns, normalizedVehicles])

    const getDistanceCellClass = (distance: number) => {
        if (distance <= 0) return "text-slate-300 font-medium bg-white"
        if (distance >= reportStats.maxDailyDistance * 0.75) return "bg-[#0b78b8] text-white font-black shadow-inner"
        if (distance >= reportStats.maxDailyDistance * 0.4) return "bg-[#5aaee0] text-white font-black"
        return "bg-[#dff0fb] text-[#0b5c8e] font-bold"
    }

    return (
        <div className="flex h-full flex-col bg-white">
            <div className="bg-[#2f8d35] px-6 py-2">
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Daywise Distance Report</h2>
            </div>

            <ReportFilterBar
                organizations={organizations}
                vehicles={vehicles}
                userRole={userRole}
                userOrgId={userOrgId}
                value={filters}
                onApply={setFilters}
                reportData={reportData}
                reportType="daywise-distance"
            />

            <div className="flex-1 overflow-auto">
                {isFetching ? (
                    <div className="flex h-full flex-col items-center justify-center bg-slate-50">
                        <div className="animate-spin h-8 w-8 border-4 border-[#2f8d35]/20 border-t-[#2f8d35] rounded-full mb-4"></div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Compiling Analytics...</p>
                    </div>
                ) : error ? (
                    <div className="flex h-full items-center justify-center text-red-500 bg-slate-50 p-6 text-center">
                        <div className="max-w-xs">
                            <Activity className="h-10 w-10 mx-auto mb-4 opacity-20" />
                            <p className="text-xs font-bold uppercase tracking-widest">Failed to fetch daywise statistics. Please try a different range.</p>
                        </div>
                    </div>
                ) : vehiclesSummary.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400 bg-slate-50 p-10">
                        <Navigation className="mb-4 h-12 w-12 opacity-10" />
                        <p className="text-xs font-black uppercase tracking-[0.2em]">No Movement Records found for this period</p>
                    </div>
                ) : (
                    <div className="p-4 bg-slate-50 min-h-full">
                        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vehicles In Report</p>
                                <p className="mt-2 text-2xl font-black text-slate-900">{normalizedVehicles.length}</p>
                                <p className="mt-1 text-[11px] font-medium text-slate-500">{reportStats.activeVehicles} with movement</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Fleet Distance</p>
                                <p className="mt-2 text-2xl font-black text-[#2f8d35]">{reportStats.totalFleetDistance.toFixed(1)} km</p>
                                <p className="mt-1 text-[11px] font-medium text-slate-500">Average {reportStats.avgDistancePerVehicle.toFixed(1)} km per active vehicle</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Active Report Days</p>
                                <p className="mt-2 flex items-center gap-2 text-2xl font-black text-slate-900">
                                    <CalendarDays className="h-5 w-5 text-[#0b78b8]" />
                                    {reportStats.activeDateCount}
                                </p>
                                <p className="mt-1 text-[11px] font-medium text-slate-500">Out of {columns.length} selected days</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Reading Guide</p>
                                <div className="mt-3 flex items-center gap-2 text-[11px] font-medium text-slate-600">
                                    <span className="h-3 w-3 rounded bg-[#dff0fb]"></span>
                                    Low
                                    <span className="h-3 w-3 rounded bg-[#5aaee0] ml-3"></span>
                                    Medium
                                    <span className="h-3 w-3 rounded bg-[#0b78b8] ml-3"></span>
                                    High
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-max min-w-full border-collapse text-[10px] text-slate-600">
                                    <thead>
                                        <tr className="bg-[#2f8d35] text-white">
                                            <th className="border border-white/10 p-2 text-center w-6"><Filter size={10} /></th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Branch</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Vehicle</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Vehicle Brand</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Vehicle Model</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Active Days</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center bg-white/10">Total Distance</th>
                                            {/* Date Columns */}
                                            {columns.map(date => (
                                                <th
                                                    key={date}
                                                    title={new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
                                                        day: "2-digit",
                                                        month: "short",
                                                        year: "numeric",
                                                        weekday: "short",
                                                    })}
                                                    className={`border border-white/10 p-2 font-bold text-center min-w-[32px] ${
                                                        [0, 6].includes(new Date(`${date}T00:00:00`).getDay()) ? "bg-white/10" : ""
                                                    }`}
                                                >
                                                    {formatDateToDD(date)}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {normalizedVehicles.map((vehicle, vIdx) => (
                                            <tr key={vehicle.vehicleId || vIdx} className="hover:bg-emerald-50/30 transition-colors border-b border-slate-100">
                                                <td className="p-2 text-center text-[#2f8d35] font-bold border-r border-slate-100 bg-slate-50/50">{vIdx + 1}</td>
                                                <td className="p-2 uppercase text-center font-medium">{vehicle.branchName || "-"}</td>
                                                <td className="p-2 font-black text-slate-900 text-center tracking-tight bg-white border-x border-slate-100">{vehicle.vehicleNumber}</td>
                                                <td className="p-2 text-center text-slate-500">{vehicle.brand || "-"}</td>
                                                <td className="p-2 text-center text-slate-500">{vehicle.model || "-"}</td>
                                                <td className="p-2 text-center font-bold text-[#0b78b8]">{vehicle.activeDays}</td>
                                                <td className="p-2 font-black text-[#2f8d35] text-center bg-[#f0f9ef]">
                                                    {Number(vehicle.distance || 0).toFixed(0)}
                                                </td>

                                                {/* Daily distance cells */}
                                                {columns.map(date => {
                                                    const ddmm = formatDateToDDMMYYYY(date)
                                                    const dayData = vehicle.dayMap.get(ddmm)
                                                    const distance = dayData?.distance || 0
                                                    const hasDistance = distance > 0

                                                    return (
                                                        <td
                                                            key={date}
                                                            className={`border border-slate-100 p-2 text-center transition-all ${getDistanceCellClass(distance)}`}
                                                            title={
                                                                hasDistance
                                                                    ? [
                                                                        `${distance.toFixed(2)} km on ${ddmm}`,
                                                                        `Running: ${formatDurationCompact(dayData?.runningTime)}`,
                                                                        `Idle: ${formatDurationCompact(dayData?.idleTime)}`,
                                                                        `Stop: ${formatDurationCompact(dayData?.stopTime)}`,
                                                                        `Alerts: ${dayData?.alerts || 0}`,
                                                                    ].join(" | ")
                                                                    : `No movement on ${ddmm}`
                                                            }
                                                        >
                                                            {hasDistance ? Math.round(distance) : "0"}
                                                        </td>
                                                    )
                                                })}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
