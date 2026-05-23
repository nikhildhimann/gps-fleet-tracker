"use client"

import { useEffect, useState } from "react"
import { Navigation, Filter as FilterIcon, Zap, ZapOff } from "lucide-react"
import { useGetACSummaryQuery } from "@/redux/api/gpsHistoryApi"
import { ReportFilterBar, ReportFilterState, getDefaultReportFilter } from "./ReportFilterBar"
import React from "react"

const formatDuration = (seconds?: number) => {
    const total = Math.max(0, Number(seconds || 0))
    const hrs = String(Math.floor(total / 3600)).padStart(2, "0")
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0")
    const secs = String(total % 60).padStart(2, "0")
    return `${hrs}:${mins}:${secs}`
}

const formatLocation = (location?: { address?: string; latitude?: number; longitude?: number }) => {
    if (!location) return "-"
    let text = "-"
    if (location.address) {
        text = location.address
    } else if (typeof location.latitude === "number" && typeof location.longitude === "number") {
        text = `${location.latitude}, ${location.longitude}`
    }
    return text.replace(/(\.\d{6})\d+/g, "$1")
}

const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).replace(/\//g, "-").replace(",", "");
};

export function ACSummaryPage({
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
    const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null)
    const [acPage, setAcPage] = useState(0)

    const isValidVehicle = filters.vehicleId !== ""

    useEffect(() => {
        setAcPage(0)
        setExpandedVehicleId(null)
    }, [filters])

    const { data: res, isFetching, error } = useGetACSummaryQuery(
        {
            vehicleId: filters.vehicleId,
            from: filters.from,
            to: filters.to,
            page: acPage,
            limit: 50,
        },
        { skip: !isValidVehicle },
    )

    // Backend wraps analytics responses as { status: true, data: { ... } }
    // For AC Summary, the payload is { vehicleId, from, to, data: [...] }
    const reports = Array.isArray(res?.data?.data) ? res.data.data : []
    const pagination = res?.data?.pagination
    const totalReports = pagination?.totalrecords ?? reports.length
    const currentPage = pagination?.currentPage ?? acPage
    const totalPages = Math.max(1, pagination?.totalPages ?? 1)
    const pageSize = pagination?.limit ?? 50
    const startIndex = totalReports === 0 ? 0 : currentPage * pageSize + 1
    const endIndex = totalReports === 0 ? 0 : Math.min(totalReports, (currentPage + 1) * pageSize)

    return (
        <div className="flex h-full flex-col bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-[#2f8d35]/10 rounded-lg flex items-center justify-center text-[#2f8d35]">
                        <Zap size={16} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase">
                            AC Summary
                        </h2>
                    </div>
                </div>
            </div>

            <ReportFilterBar
                organizations={organizations}
                vehicles={vehicles}
                userRole={userRole}
                userOrgId={userOrgId}
                value={filters}
                onApply={setFilters}
            />

            <div className="flex-1 overflow-auto p-2">
                {!isValidVehicle ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                        <Zap className="h-10 w-10 opacity-20 mb-4" />
                        <p className="text-xs font-bold uppercase tracking-widest">Select Scope to View Report</p>
                    </div>
                ) : isFetching ? (
                    <div className="flex h-full items-center justify-center bg-white rounded-xl">
                        <div className="animate-spin h-8 w-8 border-4 border-[#2f8d35]/20 border-t-[#2f8d35] rounded-full"></div>
                    </div>
                ) : error ? (
                    <div className="flex h-full items-center justify-center bg-white rounded-xl text-red-400">
                        <p className="text-sm font-bold">Failed to load AC Summary data.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse text-[10px] text-slate-600">
                                <thead>
                                    <tr className="bg-[#2f8d35] text-white">
                                        <th className="border border-white/10 p-2 text-center w-6"><FilterIcon size={10} /></th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Branch</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Vehicle</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Brand</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Model</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Driver</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">IMEI No</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center bg-green-700">AC ON Distance</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center bg-green-700">AC ON Duration</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center bg-green-700">No of times ON</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center bg-red-700">AC OFF Distance</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center bg-red-700">AC OFF Duration</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center bg-red-700">No of times OFF</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Running</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Idle</th>
                                        <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center whitespace-nowrap">Now Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {reports.map((row: any, idx: number) => {
                                        const isExpanded = expandedVehicleId === row.vehicleId;
                                        return (
                                            <React.Fragment key={row.vehicleId || idx}>
                                                <tr className="hover:bg-slate-50 border-b border-slate-100">
                                                    <td className="p-2 text-center">
                                                        <button
                                                            onClick={() => setExpandedVehicleId(isExpanded ? null : row.vehicleId)}
                                                            className={`transition-transform duration-200 ${isExpanded ? "rotate-90 text-slate-800" : "text-[#2f8d35]"}`}
                                                        >
                                                            <Navigation size={10} fill="currentColor" />
                                                        </button>
                                                    </td>
                                                    <td className="p-2 uppercase text-center">{row.branchName}</td>
                                                    <td className="p-2 font-bold text-center">{row.vehicleNumber}</td>
                                                    <td className="p-2 text-center">{row.brand}</td>
                                                    <td className="p-2 text-center">{row.model}</td>
                                                    <td className="p-2 text-center text-slate-400">{row.driverName}</td>
                                                    <td className="p-2 text-center">{row.imei}</td>
                                                    <td className="p-2 text-center bg-green-50 font-bold text-green-700">{row.summary.acOnDistance} KM</td>
                                                    <td className="p-2 text-center bg-green-50 font-bold text-green-700">{formatDuration(row.summary.acOnDuration)}</td>
                                                    <td className="p-2 text-center bg-green-50 font-bold text-green-700">{row.summary.acOnCount}</td>
                                                    <td className="p-2 text-center bg-red-50 font-bold text-red-700">{row.summary.acOffDistance} KM</td>
                                                    <td className="p-2 text-center bg-red-50 font-bold text-red-700">{formatDuration(row.summary.acOffDuration)}</td>
                                                    <td className="p-2 text-center bg-red-50 font-bold text-red-700">{row.summary.acOffCount}</td>
                                                    <td className="p-2 text-center font-bold text-[#2f8d35]">{formatDuration(row.summary.runningTime)}</td>
                                                    <td className="p-2 text-center font-bold text-amber-500">{formatDuration(row.summary.idleTime)}</td>
                                                    <td className="p-2 text-center">
                                                        <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${row.nowStatus === "Running" ? "bg-green-100 text-green-700" :
                                                            row.nowStatus === "Idle" ? "bg-amber-100 text-amber-700" :
                                                                "bg-slate-100 text-slate-700"
                                                            }`}>
                                                            {row.nowStatus}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {isExpanded && row.events && (
                                                    <tr>
                                                        <td colSpan={16} className="bg-slate-50 p-2">
                                                            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-inner">
                                                                <table className="w-full text-[9px] border-collapse">
                                                                    <thead className="bg-[#2a303c] text-white uppercase font-bold">
                                                                        <tr>
                                                                            <th className="p-2 border border-white/10 w-16">Status</th>
                                                                            <th className="p-2 border border-white/10">Start Time</th>
                                                                            <th className="p-2 border border-white/10">Start Location</th>
                                                                            <th className="p-2 border border-white/10">End Time</th>
                                                                            <th className="p-2 border border-white/10">End Location</th>
                                                                            <th className="p-2 border border-white/10">ON Duration</th>
                                                                            <th className="p-2 border border-white/10">OFF Duration</th>
                                                                            <th className="p-2 border border-white/10">Distance</th>
                                                                            <th className="p-2 border border-white/10">Avg Speed</th>
                                                                            <th className="p-2 border border-white/10">Odometer (S/E)</th>
                                                                            <th className="p-2 border border-white/10">Show Path</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {row.events.map((event: any, eIdx: number) => (
                                                                            <tr key={eIdx} className="hover:bg-slate-50 border-b border-slate-100">
                                                                                <td className="p-2 text-center font-bold">
                                                                                    <div className={`flex items-center justify-center gap-1 ${event.status === "ON" ? "text-green-600" : "text-red-600"}`}>
                                                                                        {event.status === "ON" ? <Zap size={10} fill="currentColor" /> : <ZapOff size={10} />}
                                                                                        {event.status}
                                                                                    </div>
                                                                                </td>
                                                                                <td className="p-2 text-center">{formatDateTime(event.startTime)}</td>
                                                                                <td className="p-2 text-center max-w-[150px] truncate" title={formatLocation(event.startLocation)}>{formatLocation(event.startLocation)}</td>
                                                                                <td className="p-2 text-center">{formatDateTime(event.endTime)}</td>
                                                                                <td className="p-2 text-center max-w-[150px] truncate" title={formatLocation(event.endLocation)}>{formatLocation(event.endLocation)}</td>
                                                                                <td className="p-2 text-center font-bold text-green-600">{event.status === "ON" ? formatDuration(event.duration) : "-"}</td>
                                                                                <td className="p-2 text-center font-bold text-red-600">{event.status === "OFF" ? formatDuration(event.duration) : "-"}</td>
                                                                                <td className="p-2 text-center">{event.distance} KM</td>
                                                                                <td className="p-2 text-center font-black text-slate-400">{event.avgSpeed || 0} KM/H</td>
                                                                                <td className="p-2 text-center opacity-60">{(event.startOdometer || 0).toFixed(1)} / {(event.endOdometer || 0).toFixed(1)}</td>
                                                                                <td className="p-2 text-center">
                                                                                    <button className="text-blue-600 hover:text-blue-800 flex items-center justify-center w-full">
                                                                                        <Navigation size={12} className="rotate-45" />
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {pagination && (
                            <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-600 md:flex-row md:items-center md:justify-between">
                                <div>
                                    Showing {startIndex}–{endIndex} of {totalReports} AC summary rows
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            setExpandedVehicleId(null)
                                            setAcPage((prev) => Math.max(0, prev - 1))
                                        }}
                                        disabled={acPage === 0}
                                        className={`rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold transition ${acPage === 0
                                            ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                            : "hover:bg-slate-50"
                                            }`}
                                    >
                                        ← Prev
                                    </button>
                                    <span className="text-[11px] font-semibold">
                                        Page {currentPage + 1} of {totalPages}
                                    </span>
                                    <button
                                        onClick={() => {
                                            setExpandedVehicleId(null)
                                            setAcPage((prev) => Math.min(totalPages - 1, prev + 1))
                                        }}
                                        disabled={acPage >= totalPages - 1}
                                        className={`rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold transition ${acPage >= totalPages - 1
                                            ? "cursor-not-allowed bg-slate-100 text-slate-400"
                                            : "hover:bg-slate-50"
                                            }`}
                                    >
                                        Next →
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
