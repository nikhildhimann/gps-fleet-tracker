"use client"

import { useState, useMemo } from "react"
import { X, Search, Filter, ArrowUpDown, ChevronRight, Car, Building2, MapPin, Tag, Truck, Zap } from "lucide-react"
import { ReportFilterState, getDefaultReportFilter } from "./ReportFilterBar"

export type AnalyticsFilterState = ReportFilterState
export const getDefaultAnalyticsFilter = getDefaultReportFilter

export interface AnalyticsFilterModalProps {
    isOpen: boolean
    onClose: () => void
    organizations?: any[]
    vehicles?: any[]
    value: ReportFilterState
    onApply: (next: ReportFilterState) => void
    vehicleLabel?: string
}

export function AnalyticsFilterModal({
    isOpen,
    onClose,
    organizations = [],
    vehicles = [],
    value,
    onApply,
    vehicleLabel,
}: AnalyticsFilterModalProps) {
    const [draft, setDraft] = useState<ReportFilterState>(value)
    const [searchTerm, setSearchTerm] = useState("")

    // Unique filter options
    const uniqueBrands = useMemo(() => {
        const brands = new Set<string>()
        vehicles.forEach(v => {
            const b = v.brand || v.make || v.vehicleBrand
            if (b) brands.add(b)
        })
        return Array.from(brands).sort()
    }, [vehicles])

    const uniqueModels = useMemo(() => {
        const models = new Set<string>()
        vehicles.forEach(v => {
            const b = v.brand || v.make || v.vehicleBrand
            if (draft.brand !== "all" && b !== draft.brand) return
            const m = v.model || v.vehicleModel
            if (m) models.add(m)
        })
        return Array.from(models).sort()
    }, [vehicles, draft.brand])

    const uniqueTypes = useMemo(() => {
        const types = new Set<string>()
        vehicles.forEach(v => {
            if (v.vehicleType) types.add(v.vehicleType)
        })
        return Array.from(types).sort()
    }, [vehicles])

    const uniqueBranches = useMemo(() => {
        const branches = new Set<string>()
        vehicles.forEach(v => {
            if (v.branch) branches.add(v.branch)
        })
        return Array.from(branches).sort()
    }, [vehicles])

    // Filter vehicles based on active selectors
    const filteredVehicles = useMemo(() => {
        return vehicles.filter(v => {
            // Org check
            if (draft.organizationId !== "all" && (v.organizationId?._id || v.organizationId) !== draft.organizationId) return false
            // Brand check
            const vBrand = v.brand || v.make || v.vehicleBrand
            if (draft.brand !== "all" && vBrand !== draft.brand) return false
            // Model check
            const vModel = v.model || v.vehicleModel
            if (draft.model !== "all" && vModel !== draft.model) return false
            // Branch check
            if (draft.branch !== "all" && v.branch !== draft.branch) return false
            // Type check
            if (draft.vehicleType !== "all" && v.vehicleType !== draft.vehicleType) return false

            // Search term check
            if (searchTerm) {
                const search = searchTerm.toLowerCase()
                const nameMatch = (v.vehicleNumber || "").toLowerCase().includes(search)
                const imeiMatch = (v.imei || v.deviceImei || "").toLowerCase().includes(search)
                if (!nameMatch && !imeiMatch) return false
            }

            return true
        })
    }, [vehicles, draft, searchTerm])

    const activeScopeSummary = useMemo(() => {
        const org = organizations.find(o => o._id === draft.organizationId)?.name || "All Branches"
        const vehicle = draft.vehicleId === "all" ? `${filteredVehicles.length} Assets` : vehicles.find(v => (v._id || v.id) === draft.vehicleId)?.vehicleNumber || "1 Asset"
        const range = `${new Date(draft.from).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} - ${new Date(draft.to).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
        return { org, vehicle, range }
    }, [draft, filteredVehicles, vehicles, organizations])

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md transition-all duration-300">
            <div className="w-full max-w-5xl overflow-hidden rounded-[32px] bg-white shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20 flex flex-col h-[85vh]">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-[#2f8d35] rounded-2xl flex items-center justify-center text-white shadow-lg shadow-[#2f8d35]/20">
                            <Filter size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">Advanced Report Filters</h2>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-0.5">Configure your asset analysis parameters</p>
                        </div>
                    </div>

                    {/* Active Selection Summary in Modal Header */}
                    <div className="hidden md:flex items-center gap-4 px-6 py-2 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Primary Scope</span>
                            <span className="text-[10px] font-black text-slate-800 uppercase truncate max-w-[120px]">{activeScopeSummary.org}</span>
                        </div>
                        <div className="h-6 w-[1px] bg-slate-200"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Target</span>
                            <span className="text-[10px] font-black text-[#2f8d35] uppercase">{activeScopeSummary.vehicle}</span>
                        </div>
                        <div className="h-6 w-[1px] bg-slate-200"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Duration</span>
                            <span className="text-[10px] font-black text-slate-500 uppercase">{activeScopeSummary.range}</span>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-all border border-slate-100"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Main Content Area: Both Sides */}
                <div className="flex flex-1 overflow-hidden">

                    {/* LEFT SIDE: Filter Controls */}
                    <div className="w-72 border-r border-slate-100 bg-slate-50/50 p-6 overflow-y-auto space-y-6">
                        <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Filter Criteria</h3>

                        {/* Company */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                <Building2 size={12} className="text-[#2f8d35]" />
                                Company
                            </label>
                            <select
                                value={draft.organizationId}
                                onChange={(e) => setDraft(p => ({ ...p, organizationId: e.target.value, vehicleId: "all" }))}
                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 focus:border-[#2f8d35] focus:ring-4 focus:ring-[#2f8d35]/5 outline-none transition-all appearance-none"
                            >
                                <option value="all">All Organizations</option>
                                {organizations.map(org => (
                                    <option key={org._id} value={org._id}>{org.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Brand */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                <Tag size={12} className="text-[#2f8d35]" />
                                Brand
                            </label>
                            <select
                                value={draft.brand}
                                onChange={(e) => setDraft(p => ({ ...p, brand: e.target.value, model: "all", vehicleId: "all" }))}
                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 focus:border-[#2f8d35] focus:ring-4 focus:ring-[#2f8d35]/5 outline-none transition-all"
                            >
                                <option value="all">Every Brand</option>
                                {uniqueBrands.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>

                        {/* Model */}
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">
                                <Truck size={12} className="text-[#2f8d35]" />
                                Model
                            </label>
                            <select
                                value={draft.model}
                                onChange={(e) => setDraft(p => ({ ...p, model: e.target.value, vehicleId: "all" }))}
                                className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 focus:border-[#2f8d35] focus:ring-4 focus:ring-[#2f8d35]/5 outline-none transition-all"
                            >
                                <option value="all">All Models</option>
                                {uniqueModels.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        {/* Date Range in Sidebar */}
                        <div className="pt-4 border-t border-slate-100 space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Period From</label>
                                <input
                                    type="date"
                                    value={draft.from}
                                    onChange={(e) => setDraft(p => ({ ...p, from: e.target.value }))}
                                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 outline-none focus:border-[#2f8d35]"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Period To</label>
                                <input
                                    type="date"
                                    value={draft.to}
                                    onChange={(e) => setDraft(p => ({ ...p, to: e.target.value }))}
                                    className="w-full h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 outline-none focus:border-[#2f8d35]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* RIGHT SIDE: Vehicle Selection */}
                    <div className="flex-1 flex flex-col bg-white">

                        {/* Search & Stats Bar */}
                        <div className="p-6 border-b border-slate-50 flex items-center justify-between gap-4">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-[#2f8d35] transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by Vehicle Number or IMEI..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-12 pl-12 pr-4 bg-slate-50 rounded-2xl border-none focus:ring-4 focus:ring-[#2f8d35]/5 outline-none text-sm font-bold text-slate-700 transition-all placeholder:text-slate-300"
                                />
                            </div>
                            <div className="bg-[#f0f9ef] px-4 py-2 rounded-2xl border border-[#2f8d35]/10 flex flex-col items-end">
                                <span className="text-[9px] font-black text-[#2f8d35] uppercase tracking-widest mb-0.5">Visible Assets</span>
                                <span className="text-sm font-black text-[#2f8d35]">{filteredVehicles.length} of {vehicles.length}</span>
                            </div>
                        </div>

                        {/* Vehicle Grid */}
                        <div className="flex-1 overflow-y-auto p-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

                                {/* "ALL" OPTION CARD */}
                                <button
                                    onClick={() => setDraft(p => ({ ...p, vehicleId: "all" }))}
                                    className={`relative group min-h-[80px] rounded-[32px] border-2 p-4 flex items-center transition-all duration-300 hover:shadow-xl ${draft.vehicleId === "all"
                                        ? "border-[#2f8d35] bg-[#f0f9ef] shadow-lg shadow-[#2f8d35]/10"
                                        : "border-slate-50 bg-slate-50/30 hover:bg-white hover:border-[#2f8d35]/20"
                                        }`}
                                >
                                    <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors ${draft.vehicleId === "all" ? "bg-[#2f8d35] text-white" : "bg-slate-200 text-slate-400 group-hover:bg-[#2f8d35]/10 group-hover:text-[#2f8d35]"}`}>
                                        <Truck size={24} />
                                    </div>
                                    <div className="ml-4 text-left">
                                        <span className={`text-xs font-black tracking-widest uppercase block ${draft.vehicleId === "all" ? "text-slate-800" : "text-slate-400"}`}>All Assets</span>
                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{filteredVehicles.length} Vehicles in report</span>
                                    </div>
                                    {draft.vehicleId === "all" && (
                                        <div className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-[#2f8d35] flex items-center justify-center border-4 border-white shadow-lg text-white">
                                            <Zap size={14} fill="currentColor" />
                                        </div>
                                    )}
                                </button>

                                {filteredVehicles.map(v => {
                                    const vId = v._id || v.id
                                    const isSelected = draft.vehicleId === vId
                                    return (
                                        <button
                                            key={vId}
                                            onClick={() => setDraft(p => ({ ...p, vehicleId: vId }))}
                                            className={`relative group min-h-[80px] rounded-[32px] border-2 p-4 flex items-center transition-all duration-300 hover:shadow-xl text-left ${isSelected
                                                ? "border-[#2f8d35] bg-[#f0f9ef] shadow-lg shadow-[#2f8d35]/10"
                                                : "border-slate-50 bg-slate-50/50 hover:bg-white hover:border-[#2f8d35]/20"
                                                }`}
                                        >
                                            <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-all ${isSelected ? "bg-[#2f8d35] text-white rotate-6" : "bg-white text-slate-300 shadow-sm group-hover:rotate-6"}`}>
                                                <Car size={24} />
                                            </div>
                                            <div className="ml-4">
                                                <h4 className={`text-[14px] font-black leading-tight ${isSelected ? "text-slate-800" : "text-slate-500 group-hover:text-slate-700"}`}>{v.vehicleNumber}</h4>
                                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{v.make || "General"} {v.model || "Asset"}</p>
                                            </div>
                                            {isSelected && (
                                                <div className="absolute -top-3 -right-3 h-8 w-8 rounded-full bg-[#2f8d35] flex items-center justify-center border-4 border-white shadow-lg text-white">
                                                    <Zap size={14} fill="currentColor" />
                                                </div>
                                            )}
                                        </button>
                                    )
                                })}

                                {filteredVehicles.length === 0 && (
                                    <div className="col-span-full h-64 flex flex-col items-center justify-center text-center opacity-20">
                                        <Search size={48} className="mb-4" />
                                        <p className="text-xl font-black uppercase tracking-widest">No Matches Found</p>
                                        <p className="text-xs font-bold mt-1 uppercase">Adjust filters or search criteria</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between sticky bottom-0 z-10">
                    <button
                        onClick={() => {
                            const def = { ...value, brand: 'all', model: 'all', branch: 'all', vehicleType: 'all', organizationId: 'all', vehicleId: 'all' }
                            setDraft(def)
                            setSearchTerm("")
                        }}
                        className="px-6 py-3 rounded-2xl bg-white border border-slate-200 text-slate-400 text-xs font-black uppercase tracking-widest hover:bg-slate-100 transition-all hover:text-slate-600 active:scale-95"
                    >
                        Reset All Filters
                    </button>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 text-slate-400 text-xs font-black uppercase tracking-widest hover:text-slate-600 transition-all"
                        >
                            Discard
                        </button>
                        <button
                            onClick={() => onApply(draft)}
                            className="px-10 py-3 rounded-2xl bg-[#2f8d35] text-white text-xs font-black uppercase tracking-widest shadow-xl shadow-[#2f8d35]/30 hover:bg-[#26702b] hover:-translate-y-1 transition-all active:translate-y-0 flex items-center gap-3"
                        >
                            Generate Report ({draft.vehicleId === "all" ? filteredVehicles.length : 1} Vehicles)
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
