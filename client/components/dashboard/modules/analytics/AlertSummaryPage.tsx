"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Siren, TriangleAlert, ShieldAlert, Filter } from "lucide-react"
import { useGetAlertSummaryQuery } from "@/redux/api/gpsHistoryApi"
import { ReportFilterBar, ReportFilterState, getDefaultReportFilter } from "./ReportFilterBar"

export function AlertSummaryPage({
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
    const [alertPage, setAlertPage] = useState(0)
    const [alertType, setAlertType] = useState("all")
    const [alertSearch, setAlertSearch] = useState("")

    useEffect(() => {
        setAlertPage(0)
    }, [filters, alertType, alertSearch])

    const isValidSelection = filters.vehicleId !== ""
    const { data, isFetching, error } = useGetAlertSummaryQuery(
        {
            vehicleId: filters.vehicleId,
            from: filters.from,
            to: filters.to,
            page: alertPage,
            limit: 50,
            alertType,
            search: alertSearch,
        },
        { skip: !isValidSelection },
    )

    const alertData = data?.data
    const alerts = alertData?.alerts || []
    const pagination = alertData?.pagination
    const totalAlerts = pagination?.totalrecords ?? (alertData?.alerts?.length || 0)

    const currentPage = pagination?.currentPage ?? alertPage
    const totalPages = pagination?.totalPages ?? 1
    const pageSize = pagination?.limit ?? 50
    const startIndex = totalAlerts === 0 ? 0 : currentPage * pageSize + 1
    const endIndex = totalAlerts === 0 ? 0 : Math.min(totalAlerts, (currentPage + 1) * pageSize)

    // Group alerts by Vehicle number for the dropdown functionality
    const groupedAlerts = alerts.reduce((acc: any, alert: any) => {
        const key = alert.vehicle || "Unknown Vehicle"
        if (!acc[key]) acc[key] = []
        acc[key].push(alert)
        return acc
    }, {})

    const [expandedVehicles, setExpandedVehicles] = useState<Record<string, boolean>>({})

    const toggleVehicle = (v: string) => {
        setExpandedVehicles(prev => ({ ...prev, [v]: !prev[v] }))
    }

    return (
        <div className="flex h-full flex-col bg-white font-sans">
            {/* Top Green Accent Bar */}
            <div className="h-1 w-full bg-[#2f8d35]" />

            <ReportFilterBar
                organizations={organizations}
                vehicles={vehicles}
                userRole={userRole}
                userOrgId={userOrgId}
                value={filters}
                onApply={setFilters}
            />

            <div className="flex-1 overflow-auto">
                {!isValidSelection ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-500 text-center p-10">
                        <ShieldAlert className="mb-4 h-16 w-16 opacity-10 text-[#2f8d35]" />
                        <p className="font-bold text-lg text-slate-600">Select a vehicle or scope to generate the alert report</p>
                        <p className="text-sm text-slate-400 mt-1">Use the filter bar above to get started</p>
                    </div>
                ) : isFetching ? (
                    <div className="flex h-full flex-col items-center justify-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#2f8d35]/20 border-t-[#2f8d35]"></div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Generating detailed report...</p>
                    </div>
                ) : error ? (
                    <div className="flex h-full items-center justify-center p-10 bg-red-50 text-red-500 rounded-xl m-4 border border-red-100">
                        <TriangleAlert className="mr-3" />
                        <span className="font-bold">Error fetching alert summary. Please try again.</span>
                    </div>
                ) : (
                    <div className="min-w-max">
                        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-[#f8faf8] p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Alert Type</label>
                                <select
                                    value={alertType}
                                    onChange={(e) => setAlertType(e.target.value)}
                                    className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#2f8d35]/30"
                                >
                                    {['all', 'Overspeed', 'Ignition On', 'Ignition Off', 'Low Battery'].map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <label className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Search</label>
                                <div className="relative">
                                    <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        value={alertSearch}
                                        onChange={(e) => setAlertSearch(e.target.value)}
                                        placeholder="Alert name..."
                                        className="h-8 rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-[#2f8d35]/30"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Summary Header Row */}
                        <div className="grid grid-cols-[140px_160px_120px_120px_100px_160px_100px_1fr_100px] border-b border-slate-200 bg-slate-900 sticky top-0 z-20 shadow-sm">
                            {["Alert DateTime", "Branch", "Vehicle", "Driver", "Alert", "Alert Information", "Duration", "Location", "No of Alerts"].map((h) => (
                                <div key={h} className="border-r border-white/5 p-3 text-[10px] font-black text-slate-300 text-center uppercase tracking-[0.1em]">
                                    {h}
                                </div>
                            ))}
                        </div>

                        {/* Totals Row */}
                        <div className="grid grid-cols-[140px_160px_120px_120px_100px_160px_100px_1fr_100px] bg-slate-50 border-b-2 border-slate-200">
                            <div className="col-span-6 p-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right pr-4">Total for Selection:</div>
                            <div className="p-2 text-[10px] font-black text-slate-800 text-center flex items-center justify-center bg-slate-100/50 italic">00:00:00</div>
                            <div className="p-2"></div>
                            <div className="p-2 text-[11px] font-black text-[#2f8d35] text-center flex items-center justify-center bg-[#2f8d35]/5">{totalAlerts}</div>
                        </div>

                        {/* Grouped Content */}
                        <div className="flex flex-col">
                            {Object.keys(groupedAlerts).length > 0 ? (
                                Object.entries(groupedAlerts).map(([vehicleNum, vehicleAlerts]: [string, any], groupIdx) => (
                                    <div key={vehicleNum} className="flex flex-col">
                                        {/* Vehicle Summary Row (The Dropdown Trigger) */}
                                        <div
                                            onClick={() => toggleVehicle(vehicleNum)}
                                            className="grid grid-cols-[140px_160px_120px_120px_100px_160px_100px_1fr_100px] cursor-pointer bg-white hover:bg-slate-50 border-b border-slate-200 group transition-all duration-300 relative"
                                        >
                                            {/* Selection indicator line */}
                                            <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${expandedVehicles[vehicleNum] ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-[#2f8d35]'}`} />

                                            <div className="p-3 flex items-center justify-center gap-2 border-r border-slate-100">
                                                <div className={`flex h-5 w-5 items-center justify-center rounded-md shadow-sm transition-all duration-300 text-white font-bold text-xs ${expandedVehicles[vehicleNum] ? 'bg-amber-500 rotate-180' : 'bg-[#2f8d35]'}`}>
                                                    {expandedVehicles[vehicleNum] ? '−' : '+'}
                                                </div>
                                            </div>
                                            <div className="p-3 text-[10px] text-slate-500 text-center border-r border-slate-100 truncate uppercase font-bold tracking-tight">{vehicleAlerts[0]?.branch}</div>
                                            <div className="p-3 text-[11px] text-[#2f8d35] font-black text-center border-r border-slate-100 uppercase tracking-wider">{vehicleNum}</div>
                                            <div className="p-3 text-[10px] text-slate-500 text-center border-r border-slate-100 truncate uppercase italic font-medium">{vehicleAlerts[0]?.driver}</div>
                                            <div className="p-3 text-[10px] text-slate-400 font-black text-center border-r border-slate-100 tracking-widest opacity-80">SUMMARY</div>
                                            <div className="p-3 text-[10px] text-orange-600 text-center border-r border-slate-100 uppercase truncate px-4 font-black tracking-tight flex items-center justify-center gap-1">
                                                {Math.max(...vehicleAlerts.map((a: any) => a.speed || 0)) > 0 ? (
                                                    <>
                                                        <span className="text-[8px] text-slate-400">MAX</span>
                                                        {Math.max(...vehicleAlerts.map((a: any) => a.speed || 0))} KM/H
                                                    </>
                                                ) : "FLEET DATA LOG"}
                                            </div>
                                            <div className="p-3 text-[10px] text-slate-600 text-center border-r border-slate-100 font-black italic opacity-70">00:00:00</div>
                                            <div className="p-3 text-[10px] text-slate-400 text-center border-r border-slate-100 tracking-tight font-medium opacity-80">VARIOUS LOCATIONS</div>
                                            <div className={`p-3 text-[11px] text-slate-900 font-black text-center transition-colors duration-300 ${expandedVehicles[vehicleNum] ? 'bg-amber-50' : 'bg-slate-50'}`}>{vehicleAlerts.length}</div>
                                        </div>

                                        {/* Individual Alert Rows (The Dropdown Content) */}
                                        {expandedVehicles[vehicleNum] && vehicleAlerts.map((row: any, idx: number) => {
                                            // Dynamic Styling based on alert type
                                            const getAlertStyle = (type: string) => {
                                                const normalized = type?.toUpperCase() || ''
                                                if (normalized.includes('OVERSPEED')) return 'text-orange-600 bg-orange-50 border-orange-100'
                                                if (normalized.includes('IGNITION ON')) return 'text-emerald-600 bg-emerald-50 border-emerald-100'
                                                if (normalized.includes('IGNITION OFF')) return 'text-slate-600 bg-slate-50 border-slate-100'
                                                if (normalized.includes('LOW BATTERY')) return 'text-red-600 bg-red-50 border-red-100'
                                                return 'text-[#2f8d35] bg-[#e1f5e2]/20 border-slate-100'
                                            }

                                            const alertStyle = getAlertStyle(row.type)

                                            // Detect if we have speed detail
                                            const hasSpeedInfo = row.type?.toUpperCase().includes('OVERSPEED')
                                            const speedLimit = row.limit !== undefined && row.limit !== null ? row.limit : '-'
                                            const currentSpeed = row.speed !== undefined && row.speed !== null ? row.speed : '-'

                                            return (
                                                <div
                                                    key={row.id || idx}
                                                    className={`grid grid-cols-[140px_160px_120px_120px_100px_160px_100px_1fr_100px] border-b border-slate-100 items-center hover:bg-slate-50 transition-all duration-200`}
                                                >
                                                    <div className="p-2.5 text-[10px] text-slate-600 text-center border-r border-slate-100/50 font-medium">
                                                        {row.gpsTimestamp ? new Date(row.gpsTimestamp).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\//g, '-') : "-"}
                                                    </div>
                                                    <div className="p-2.5 text-[10px] text-slate-900 text-center border-r border-slate-100/50 truncate uppercase font-medium">{row.branch}</div>
                                                    <div className="p-2.5 text-[10px] text-slate-900 font-bold text-center border-r border-slate-100/50 uppercase italic">{row.vehicle}</div>
                                                    <div className="p-2.5 text-[10px] text-slate-900 text-center border-r border-slate-100/50 truncate uppercase italic">{row.driver}</div>
                                                    <div className={`p-2.5 text-[10px] font-black text-center border-r border-slate-100/50 uppercase flex items-center justify-center`}>
                                                        <span className={`px-2 py-0.5 rounded-full border ${alertStyle}`}>
                                                            {row.type}
                                                        </span>
                                                    </div>
                                                    <div className="p-2.5 text-[10px] text-slate-700 text-center border-r border-slate-100/50 uppercase">
                                                        {hasSpeedInfo ? (
                                                            <div className="flex flex-col gap-0.5 leading-tight items-center">
                                                                <span className="text-[8px] font-bold text-slate-400">LIMIT: {speedLimit} KM/H</span>
                                                                <span className="text-[11px] font-black text-white bg-orange-600 rounded px-2 py-0.5 whitespace-nowrap shadow-sm">SPEED: {currentSpeed} KM/H</span>
                                                            </div>
                                                        ) : (
                                                            <span className="font-bold">{row.information}</span>
                                                        )}
                                                    </div>
                                                    <div className="p-2.5 text-[10px] text-slate-600 text-center border-r border-slate-100/50 font-black tracking-tight">{row.duration || "00:00:00"}</div>
                                                    <div className="p-2.5 text-[9px] text-[#2f8d35] font-black text-left border-r border-slate-100/50 underline decoration-dotted truncate underline-offset-2 hover:text-[#276e2c] cursor-pointer">
                                                        {row.location || "Various Locations"}
                                                    </div>
                                                    <div className="p-2.5 text-[10px] text-slate-800 font-black text-center">1</div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))
                            ) : (
                                <div className="p-20 text-center">
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">No alert data found for this period</p>
                                </div>
                            )}
                        </div>

                        {pagination && (
                            <div className="mt-4 flex flex-col gap-2 rounded-b-2xl border border-t-0 border-slate-200 bg-white px-4 py-3 text-[11px] text-slate-600 md:flex-row md:items-center md:justify-between">
                                <div>
                                    Showing {startIndex}–{endIndex} of {totalAlerts} alerts
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setAlertPage((prev) => Math.max(0, prev - 1))}
                                        disabled={alertPage === 0}
                                        className={`rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold transition ${alertPage === 0
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
                                        onClick={() => setAlertPage((prev) => Math.min(totalPages - 1, prev + 1))}
                                        disabled={alertPage >= totalPages - 1}
                                        className={`rounded-lg border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold transition ${alertPage >= totalPages - 1
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
