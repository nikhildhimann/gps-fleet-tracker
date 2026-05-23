"use client"

import { useMemo, useState, useEffect } from "react"
import { Building2, CalendarRange, Car, Filter, ChevronDown, Search, Truck, Zap, Calendar, ArrowRight, Download } from "lucide-react"
import { AnalyticsFilterModal } from "./AnalyticsFilterModal"
import { ExportModal } from "./ExportModal"

export type ReportFilterState = {
    organizationId: string
    vehicleId: string
    from: string
    to: string
    brand?: string
    model?: string
    branch?: string
    vehicleType?: string
    preset?: string
}

const formatDate = (date: Date) => {
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, "0")
    const dd = String(date.getDate()).padStart(2, "0")
    return `${yyyy}-${mm}-${dd}`
}

const getYesterday = () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return formatDate(d)
}

const getLastWeek = () => {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    return { from: formatDate(d), to: formatDate(new Date()) }
}

const getLastMonth = () => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return { from: formatDate(d), to: formatDate(new Date()) }
}

export function getDefaultReportFilter(): ReportFilterState {
    const today = formatDate(new Date())
    return {
        organizationId: "all",
        vehicleId: "all",
        from: today,
        to: today,
        brand: "all",
        model: "all",
        branch: "all",
        vehicleType: "all"
    }
}

export function ReportFilterBar({
    organizations,
    vehicles,
    userRole,
    userOrgId,
    value,
    onApply,
    reportData,
    reportType,
}: {
    organizations: any[]
    vehicles: any[]
    userRole: string | null
    userOrgId: string | null
    value: ReportFilterState
    onApply: (next: ReportFilterState) => void
    reportData?: any[]
    reportType?: string
}) {
    const [draft, setDraft] = useState<ReportFilterState>(value)
    const [isAdvancedModalOpen, setIsAdvancedModalOpen] = useState(false)
    const [isExportModalOpen, setIsExportModalOpen] = useState(false)

    const normalizedRole = userRole?.toLowerCase() || "user"
    const isSuperAdmin = normalizedRole === "superadmin" || normalizedRole === "root"
    const isAdmin = normalizedRole === "admin"

    // Sync draft with value when value changes externally (e.g. from modal apply)
    useEffect(() => {
        setDraft(value)
    }, [value])

    useEffect(() => {
        if (!isSuperAdmin && isAdmin && organizations.length === 1 && draft.organizationId !== organizations[0]._id) {
            setDraft(prev => ({ ...prev, organizationId: organizations[0]._id }))
        } else if (!isSuperAdmin && !isAdmin && userOrgId && draft.organizationId !== userOrgId) {
            setDraft(prev => ({ ...prev, organizationId: userOrgId }))
        }
    }, [isSuperAdmin, isAdmin, organizations, userOrgId, draft.organizationId])

    const showOrgSelector = isSuperAdmin || (isAdmin && organizations.length > 1)

    const availableVehicles = useMemo(() => {
        let filtered = vehicles;

        // Filter by organization
        if (draft.organizationId && draft.organizationId !== "all") {
            filtered = filtered.filter(v => (v.organizationId?._id || v.organizationId) === draft.organizationId)
        } else if (!isSuperAdmin && userOrgId) {
            filtered = filtered.filter(v => (v.organizationId?._id || v.organizationId) === userOrgId)
        }

        // Filter by advanced attributes
        if (draft.brand && draft.brand !== "all") {
            filtered = filtered.filter(v => (v.brand || v.make || v.vehicleBrand) === draft.brand)
        }
        if (draft.model && draft.model !== "all") {
            filtered = filtered.filter(v => (v.model || v.vehicleModel) === draft.model)
        }
        if (draft.branch && draft.branch !== "all") {
            filtered = filtered.filter(v => v.branch === draft.branch)
        }
        if (draft.vehicleType && draft.vehicleType !== "all") {
            filtered = filtered.filter(v => v.vehicleType === draft.vehicleType)
        }

        return filtered
    }, [vehicles, draft.organizationId, draft.brand, draft.model, draft.branch, draft.vehicleType, isSuperAdmin, userOrgId])

    const selectedVehicleLabel = useMemo(() => {
        if (value.vehicleId === "all") return "All Vehicles"
        const v = vehicles.find(v => (v._id || v.id) === value.vehicleId)
        return v ? v.vehicleNumber : "Selected Vehicle"
    }, [value.vehicleId, vehicles])

    const applyPreset = (preset: "yesterday" | "week" | "month") => {
        let next = { ...draft }
        if (preset === "yesterday") {
            const y = getYesterday()
            next = { ...draft, from: y, to: y, preset: "Yesterday" }
        } else if (preset === "week") {
            const w = getLastWeek()
            next = { ...draft, ...w, preset: "Last Week" }
        } else if (preset === "month") {
            const m = getLastMonth()
            next = { ...draft, ...m, preset: "Last Month" }
        }
        setDraft(next)
        onApply(next)
    }

    const reportLabel = useMemo(() => {
        if (value.vehicleId === "all") return `${availableVehicles.length} Vehicles`
        return vehicles.find(v => (v._id || v.id) === value.vehicleId)?.vehicleNumber || "1 Vehicle"
    }, [value.vehicleId, availableVehicles, vehicles])

    const activeOrgName = useMemo(() => {
        return organizations.find(o => o._id === value.organizationId)?.name || "All Organizations"
    }, [value.organizationId, organizations])

    const dateRangeLabel = useMemo(() => {
        const from = new Date(value.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        const to = new Date(value.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
        return `${from} → ${to}`
    }, [value.from, value.to])

    const handleExportClick = () => {
        setIsExportModalOpen(true)
    }

    return (
        <div className="flex flex-col border-b border-slate-200 bg-white shadow-sm z-10 sticky top-0">
            <div className="flex flex-wrap items-center gap-0">

                {/* Quick Search & Filter Buttons */}
                <div className="flex items-center gap-1 border-r border-slate-100 p-2">
                    <button
                        onClick={() => setIsAdvancedModalOpen(true)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-400 hover:bg-slate-50 hover:text-[#2f8d35] transition-all border border-slate-100 shadow-sm group"
                        title="Advanced Filters"
                    >
                        <Search size={18} className="group-hover:scale-110 transition-transform" />
                    </button>
                    <div className="h-6 w-[1px] bg-slate-100 mx-1"></div>
                    <button
                        onClick={() => setIsAdvancedModalOpen(true)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2f8d35] text-white shadow-lg shadow-[#2f8d35]/20 hover:bg-[#26702b] transition-all active:scale-95 group"
                        title="Filters Applied"
                    >
                        <Filter size={18} className="group-hover:rotate-12 transition-transform" />
                    </button>
                </div>

                {/* Presets Grid */}
                <div className="flex items-center gap-4 px-6 border-r border-slate-100 h-14 bg-slate-50/30">
                    <button
                        onClick={() => applyPreset("yesterday")}
                        className={`text-[10px] uppercase font-black tracking-widest transition-colors ${draft.preset === "Yesterday" ? "text-[#2f8d35] border-b-2 border-[#2f8d35]/50 pb-0.5" : "text-slate-400 hover:text-[#2f8d35]"}`}
                    >
                        Yesterday
                    </button>
                    <button
                        onClick={() => applyPreset("week")}
                        className={`text-[10px] uppercase font-black tracking-widest transition-colors ${draft.preset === "Last Week" ? "text-[#2f8d35] border-b-2 border-[#2f8d35]/50 pb-0.5" : "text-slate-400 hover:text-[#2f8d35]"}`}
                    >
                        Last Week
                    </button>
                    <button
                        onClick={() => applyPreset("month")}
                        className={`text-[10px] uppercase font-black tracking-widest transition-colors ${draft.preset === "Last Month" ? "text-[#2f8d35] border-b-2 border-[#2f8d35]/50 pb-0.5" : "text-slate-400 hover:text-[#2f8d35]"}`}
                    >
                        Last Month
                    </button>
                </div>

                {/* Smart Selectors */}
                {showOrgSelector && (
                    <div className="flex items-center border-r border-slate-100 group cursor-pointer hover:bg-slate-50 transition-all" onClick={() => setIsAdvancedModalOpen(true)}>
                        <div className="flex h-14 items-center bg-[#fcfdfc] px-4 font-black text-[9px] uppercase tracking-widest text-slate-400 border-r border-slate-100/50">
                            Company
                        </div>
                        <div className="flex items-center px-4 py-2 gap-2">
                            <div className="h-6 w-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400">
                                <Building2 size={12} />
                            </div>
                            <span className="text-[11px] font-black text-slate-700 max-w-[120px] truncate uppercase">
                                {activeOrgName}
                            </span>
                            <ChevronDown size={14} className="text-slate-300 group-hover:text-[#2f8d35] transition-colors" />
                        </div>
                    </div>
                )}

                <div className="flex items-center border-r border-slate-100 group cursor-pointer hover:bg-slate-50 transition-all" onClick={() => setIsAdvancedModalOpen(true)}>
                    <div className="flex h-14 items-center bg-[#fcfdfc] px-4 font-black text-[9px] uppercase tracking-widest text-slate-400 border-r border-slate-100/50">
                        Vehicle
                    </div>
                    <div className="flex items-center px-4 py-2 gap-2">
                        <div className="h-6 w-6 rounded-lg bg-[#f0f9ef] flex items-center justify-center text-[#2f8d35]">
                            <Truck size={12} />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black text-[#2f8d35] max-w-[140px] truncate uppercase tracking-tight leading-none">
                                {selectedVehicleLabel}
                            </span>
                            {value.vehicleId === "all" && (
                                <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                    {availableVehicles.length} Assets in scope
                                </span>
                            )}
                        </div>
                        <ChevronDown size={14} className="text-[#2f8d35]/30 group-hover:text-[#2f8d35] transition-colors" />
                    </div>
                </div>

                {/* Date Range - High Profile */}
                <div className="flex items-center border-r border-slate-100 px-6 h-14 bg-slate-50/10">
                    <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-sm group hover:border-[#2f8d35]/30 transition-all">
                        <Calendar size={14} className="text-slate-300" />
                        <input
                            type="date"
                            value={draft.from}
                            onChange={(e) => {
                                const next = { ...draft, from: e.target.value }
                                setDraft(next)
                                onApply(next)
                            }}
                            className="bg-transparent text-[11px] font-black text-slate-700 outline-none uppercase tracking-tighter"
                        />
                        <ArrowRight size={12} className="text-slate-200" />
                        <input
                            type="date"
                            value={draft.to}
                            onChange={(e) => {
                                const next = { ...draft, to: e.target.value }
                                setDraft(next)
                                onApply(next)
                            }}
                            className="bg-transparent text-[11px] font-black text-slate-700 outline-none uppercase tracking-tighter"
                        />
                    </div>
                </div>

                {/* Final Action */}
                <div className="ml-auto flex items-center pr-4 py-2 gap-2">
                    <button
                        type="button"
                        onClick={handleExportClick}
                        disabled={!reportData || reportData.length === 0}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#d8e6d2] bg-white px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-700 transition shadow-sm hover:bg-[#eef8ec] hover:text-[#2f8d35] disabled:opacity-50 disabled:cursor-not-allowed group"
                        title="Export current report data"
                    >
                        <Download className="h-3.5 w-3.5 group-hover:scale-110 transition-transform" />
                        Export
                    </button>
                    <button
                        type="button"
                        onClick={() => onApply(draft)}
                        className="inline-flex h-10 items-center gap-3 rounded-xl bg-[#2f8d35] px-6 text-[10px] font-black uppercase tracking-[0.2em] text-white transition shadow-lg shadow-[#2f8d35]/20 hover:bg-[#26702b] hover:-translate-y-0.5 active:translate-y-0 group"
                    >
                        <Zap className="h-3.5 w-3.5 group-hover:animate-pulse" />
                        Update Report ({value.vehicleId === "all" ? availableVehicles.length : 1})
                    </button>
                </div>
            </div>

            {/* Summary Context Strip */}
            <div className="flex flex-wrap items-center gap-6 px-4 py-1.5 bg-slate-900 text-white min-h-[32px]">
                <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Organization:</span>
                    <span className="text-[9px] font-black text-[#4ade80] uppercase tracking-wider">{activeOrgName}</span>
                </div>
                <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Assets:</span>
                    <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-black text-white uppercase tracking-wider">{reportLabel}</span>
                        {value.vehicleId === "all" && <span className="bg-white/10 px-1.5 py-0.5 rounded text-[8px] font-bold">ALL</span>}
                    </div>
                </div>
                <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Range:</span>
                    <span className="text-[9px] font-black text-white uppercase tracking-wider">{dateRangeLabel}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.2em]">Preset:</span>
                    <span className="text-[9px] font-black text-amber-400 uppercase tracking-wider">{value.preset || "Custom Range"}</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-[#4ade80] animate-pulse"></div>
                    <span className="text-[8px] font-black text-white/30 uppercase tracking-[0.3em]">Live Analytics Stream</span>
                </div>
            </div>

            {isAdvancedModalOpen && (
                <AnalyticsFilterModal
                    isOpen={isAdvancedModalOpen}
                    onClose={() => setIsAdvancedModalOpen(false)}
                    organizations={organizations}
                    vehicles={vehicles}
                    value={draft}
                    onApply={(next: ReportFilterState) => {
                        setDraft(next)
                        onApply(next)
                        setIsAdvancedModalOpen(false)
                    }}
                />
            )}

            {isExportModalOpen && (
                <ExportModal
                    isOpen={isExportModalOpen}
                    onClose={() => setIsExportModalOpen(false)}
                    reportData={reportData || []}
                    reportType={reportType || ""}
                    currentFilters={{ from: value.from, to: value.to }}
                />
            )}
        </div>
    );
}
