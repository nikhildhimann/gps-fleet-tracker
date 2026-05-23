"use client"

import React, { useState, useMemo } from "react"
import { BatteryCharging, Fuel, Power, Satellite, Thermometer, TimerReset, Zap, Car, Filter, Navigation } from "lucide-react"
import { useGetVehicleStatusQuery } from "@/redux/api/gpsHistoryApi"
import { ReportFilterBar, ReportFilterState, getDefaultReportFilter } from "./ReportFilterBar"

export function VehicleStatusPage({
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
    const [isExpandedId, setIsExpandedId] = useState<string | null>(null)

    // Selection logic: if filters.vehicleId is "all", we show multiple rows. 
    const isShowingAll = filters.vehicleId === "all" || filters.vehicleId === ""

    // For the "All Vehicles" list, we use the 'vehicles' prop.
    const displayVehicles = useMemo(() => {
        let list = vehicles;
        if (!isShowingAll) {
            list = vehicles.filter(v => (v._id || v.id) === filters.vehicleId)
        }

        // Filter by organization if selected
        if (filters.organizationId !== "all") {
            list = list.filter(v => (v.organizationId?._id || v.organizationId) === filters.organizationId)
        }

        return list;
    }, [vehicles, filters.vehicleId, filters.organizationId, isShowingAll])

    const renderStatusIcon = (status: string) => {
        const colors: Record<string, string> = {
            running: "text-[#2f8d35]",
            stopped: "text-[#ea4335]",
            idle: "text-[#f2a600]",
            inactive: "text-slate-400",
            nodata: "text-slate-300"
        }
        return (
            <div className={`p-1.5 rounded-lg ${colors[status] || "text-slate-400"} bg-current bg-opacity-10 border border-current border-opacity-20`}>
                <Car size={14} fill="currentColor" />
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-[#2f8d35] rounded-lg flex items-center justify-center text-white shadow-lg shadow-[#2f8d35]/20">
                        <Car size={18} />
                    </div>
                    <h2 className="text-lg font-black text-slate-800 tracking-tight">VEHICLE STATUS</h2>
                </div>
                <div className="flex items-center gap-2">
                    <div className="text-[10px] font-black text-[#2f8d35] uppercase tracking-[0.2em] bg-[#f0f9ef] px-4 py-1.5 rounded-full border border-[#2f8d35]/20 shadow-sm">
                        {isShowingAll ? "Network Overview" : `Asset Found`}
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

            <div className="flex-1 overflow-auto p-4 sm:p-6">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden min-w-max">
                    <table className="w-full border-collapse text-[10px] text-slate-700">
                        <thead>
                            <tr className="bg-[#2f8d35] text-white uppercase font-black tracking-wider">
                                <th className="border border-white/10 p-3 text-center w-12">
                                    <Filter size={12} className="mx-auto" />
                                </th>
                                <th className="border border-white/10 p-3 text-left">BRANCH</th>
                                <th className="border border-white/10 p-3 text-center">V. TYPE</th>
                                <th className="border border-white/10 p-3 text-center">V. BRAND</th>
                                <th className="border border-white/10 p-3 text-center">V. MODEL</th>
                                <th className="border border-white/10 p-3 text-left">VEHICLE</th>
                                <th className="border border-white/10 p-3 text-center">IMEI NO</th>
                                <th className="border border-white/10 p-3 text-center">D. MODEL</th>
                                <th className="border border-white/10 p-3 text-center">SIM PROV</th>
                                <th className="border border-white/10 p-3 text-center">SIM NO</th>
                                <th className="border border-white/10 p-3 text-center">IGN</th>
                                <th className="border border-white/10 p-3 text-center">PWR</th>
                                <th className="border border-white/10 p-3 text-center">GPS</th>
                                <th className="border border-white/10 p-3 text-center">BAT %</th>
                                <th className="border border-white/10 p-3 text-center">DATA TIME</th>
                                <th className="border border-white/10 p-3 text-center">DURATION</th>
                                <th className="border border-white/10 p-3 text-center">LOCATION</th>
                                <th className="border border-white/10 p-3 text-center">STATUS</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {displayVehicles.map((vehicle, idx) => {
                                const isExpanded = isExpandedId === (vehicle.id || vehicle._id);
                                const status = vehicle.status || "nodata";
                                const orgName = organizations.find(o => (o._id || o.id) === (vehicle.organizationId?._id || vehicle.organizationId))?.name || "N/A";

                                return (
                                    <React.Fragment key={vehicle.id || vehicle._id || idx}>
                                        <tr className={`hover:bg-slate-50 transition-colors group ${isExpanded ? 'bg-slate-50/80 shadow-inner' : ''}`}>
                                            <td className="p-3 text-center">
                                                <button
                                                    onClick={() => setIsExpandedId(isExpanded ? null : (vehicle.id || vehicle._id))}
                                                    className={`p-1.5 rounded-lg transition-all duration-300 shadow-sm ${isExpanded ? "bg-slate-800 text-white rotate-90 scale-110" : "bg-[#f0f9ef] text-[#2f8d35] hover:bg-[#2f8d35] hover:text-white"}`}
                                                >
                                                    <Navigation size={12} fill="currentColor" />
                                                </button>
                                            </td>
                                            <td className="p-3 uppercase font-black text-slate-400 whitespace-nowrap tracking-tight">{orgName}</td>
                                            <td className="p-3 text-center uppercase font-bold text-slate-400">{vehicle.vehicleType || "-"}</td>
                                            <td className="p-3 text-center font-bold text-slate-600">{vehicle.make || "-"}</td>
                                            <td className="p-3 text-center font-medium text-slate-400">{vehicle.model || "-"}</td>
                                            <td className="p-3 font-black text-slate-900 border-l border-slate-50 text-[11px]">{vehicle.vehicleNumber || "N/A"}</td>
                                            <td className="p-3 text-center text-slate-400 font-mono tracking-tighter opacity-60">{vehicle.imei || vehicle.deviceImei || "-"}</td>
                                            <td className="p-3 text-center text-slate-500 font-bold">{vehicle.deviceModel || "S106"}</td>
                                            <td className="p-3 text-center text-blue-500 italic font-black">drashti</td>
                                            <td className="p-3 text-center font-mono tracking-tighter text-slate-400 opacity-60">{vehicle.simNumber || "N/A"}</td>
                                            <td className="p-3 text-center">
                                                <div className={`mx-auto h-6 w-6 flex items-center justify-center rounded-full shadow-sm ${vehicle.ign ? 'bg-[#f0f9ef] text-[#2f8d35]' : 'bg-slate-100 text-slate-300'}`}>
                                                    <Power size={12} />
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="mx-auto h-6 w-6 flex items-center justify-center rounded-full bg-[#f0f9ef] text-[#2f8d35] shadow-sm">
                                                    <BatteryCharging size={12} />
                                                </div>
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="mx-auto h-6 w-6 flex items-center justify-center rounded-full bg-[#f0f9ef] text-[#2f8d35] shadow-sm">
                                                    <Satellite size={12} />
                                                </div>
                                            </td>
                                            <td className="p-3 text-center font-black text-slate-800">{vehicle.batteryPercent != null ? `${vehicle.batteryPercent}%` : "83%"}</td>
                                            <td className="p-3 text-center text-slate-500 font-bold">{vehicle.date || "-"}</td>
                                            <td className="p-3 text-center text-slate-400 font-medium">05:25:12</td>
                                            <td className="p-3 text-center">
                                                <button className="text-[#2f8d35] font-black hover:underline underline-offset-4 uppercase tracking-tighter bg-[#f0f9ef] px-3 py-1 rounded-full border border-[#2f8d35]/10">Locate</button>
                                            </td>
                                            <td className="p-3">
                                                <div className="flex justify-center">
                                                    {renderStatusIcon(status)}
                                                </div>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr>
                                                <td colSpan={18} className="bg-white p-8 border-y-2 border-[#2f8d35]/10 animate-in fade-in slide-in-from-top-2 duration-300">
                                                    <div className="max-w-6xl mx-auto space-y-8">
                                                        <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                                                            <div className="flex items-center gap-5">
                                                                <div className="h-12 w-12 bg-[#2f8d35] text-white rounded-2xl flex items-center justify-center shadow-xl shadow-[#2f8d35]/20 scale-110">
                                                                    <Car size={28} />
                                                                </div>
                                                                <div>
                                                                    <h3 className="text-xl font-black text-slate-800 tracking-tight">STATUS REPORT: <span className="text-[#2f8d35]">{vehicle.vehicleNumber}</span></h3>
                                                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-1">{orgName} • {vehicle.make} {vehicle.model}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-3 bg-[#ecf8ea] px-4 py-2 rounded-2xl border border-[#2f8d35]/10">
                                                                <span className="h-2.5 w-2.5 rounded-full bg-[#2f8d35] animate-pulse shadow-[0_0_8px_rgba(47,141,53,0.5)]"></span>
                                                                <span className="text-[10px] font-black text-[#2f8d35] uppercase tracking-[0.2em]">Telemetry Stream Active</span>
                                                            </div>
                                                        </div>

                                                        {/* Dashboard Cards matching Image 2 */}
                                                        <div className="grid grid-cols-2 lg:grid-cols-7 gap-5">
                                                            <StatusCard label="IGNITION" value={vehicle.ign ? "ON" : "OFF"} icon={Zap} color={vehicle.ign ? "green" : "red"} />
                                                            <StatusCard label="SPEED" value={`${Math.round(vehicle.speed || 0)} KM/H`} icon={TimerReset} color="green" />
                                                            <StatusCard label="BATTERY" value={vehicle.batteryPercent != null ? `${vehicle.batteryPercent}%` : "83%"} icon={BatteryCharging} color="blue" />
                                                            <StatusCard label="SATELLITES" value={vehicle.satelliteCount || "12"} icon={Satellite} color="orange" />
                                                            <StatusCard label="FUEL" value={vehicle.fuel != null ? `${vehicle.fuel}%` : "45%"} icon={Fuel} color="red" />
                                                            <StatusCard label="TEMPERATURE" value={vehicle.temperature || "24°C"} icon={Thermometer} color="orange" />
                                                            <StatusCard label="MAIN POWER" value={vehicle.pw ? "ON" : "OFF"} icon={Power} color={vehicle.pw ? "green" : "red"} />
                                                        </div>

                                                        {/* Parameter Table matching Image 2 */}
                                                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                                                            <div className="lg:col-span-2 space-y-5">
                                                                <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                                                    <Filter size={14} className="text-[#2f8d35]" />
                                                                    Diagnostic Parameters
                                                                </h4>
                                                                <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
                                                                    <table className="w-full text-left text-[11px]">
                                                                        <thead>
                                                                            <tr className="bg-[#2f8d35] text-white uppercase font-black tracking-widest text-[10px]">
                                                                                <th className="p-4 w-14 text-center border-r border-white/10">#</th>
                                                                                <th className="p-4">PARAMETER</th>
                                                                                <th className="p-4 text-center">VALUE</th>
                                                                                <th className="p-4 text-center">UNIT</th>
                                                                                <th className="p-4">STATUS</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-100">
                                                                            <ParameterRow idx={1} label="Current Location" value={vehicle.location || "Detecting address..."} status="ACTIVE" statusColor="text-blue-500 font-black" colSpan={2} />
                                                                            <ParameterRow idx={2} label="GPS Coverage" value={vehicle.satelliteCount || "12"} unit="Satellites" status="FIXED" statusColor="text-[#2f8d35] font-black" />
                                                                            <ParameterRow idx={3} label="Internal Battery" value={vehicle.batteryVoltage?.toFixed(2) || "4.12"} unit="Volts" status={`${vehicle.batteryPercent || 83}%`} statusColor="text-[#2f8d35] font-black" />
                                                                            <ParameterRow idx={4} label="Last Updated" value={vehicle.date || "-"} status="ONLINE" statusColor="text-slate-400 font-bold" colSpan={2} />
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>

                                                            <div className="space-y-5">
                                                                <h4 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                                                                    <Navigation size={14} className="text-[#2f8d35]" />
                                                                    Hardware Specs
                                                                </h4>
                                                                <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-8 space-y-5">
                                                                    <SpecItem label="Registration" value={vehicle.vehicleNumber} />
                                                                    <SpecItem label="Device IMEI" value={vehicle.imei || vehicle.deviceImei || "N/A"} />
                                                                    <SpecItem label="SIM Number" value={vehicle.simNumber || "N/A"} />
                                                                    <SpecItem label="V. Brand" value={vehicle.make || "N/A"} />
                                                                    <div className="pt-4">
                                                                        <button className="w-full bg-[#2f8d35] text-white font-black text-[12px] uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-[#2f8d35]/30 hover:bg-[#26702b] hover:-translate-y-1 transition-all active:translate-y-0">
                                                                            Live Tracking Map
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                )
                            })}
                            {displayVehicles.length === 0 && (
                                <tr>
                                    <td colSpan={18} className="p-32 text-center bg-slate-50/20">
                                        <div className="flex flex-col items-center gap-5">
                                            <div className="h-24 w-24 bg-white shadow-xl rounded-3xl flex items-center justify-center text-slate-200 border border-slate-100">
                                                <Car size={56} />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-lg font-black text-slate-300 uppercase tracking-[0.4em]">Zero Assets Match</p>
                                                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Adjust your search parameters above</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function StatusCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: "green" | "red" | "blue" | "orange" }) {
    const colorClasses = {
        green: "text-[#2f8d35] bg-[#f0f9ef]",
        red: "text-[#ea4335] bg-[#fef5f4]",
        blue: "text-[#4285f4] bg-[#f1f6fe]",
        orange: "text-[#f2a600] bg-[#fffcf5]"
    }

    return (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-slate-100 p-6 shadow-sm text-center bg-white transition-all hover:shadow-2xl hover:border-[#2f8d35]/20 group relative overflow-hidden">
            <div className={`h-14 w-14 rounded-2xl flex items-center justify-center mb-5 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 ${colorClasses[color]}`}>
                <Icon className="h-7 w-7" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-2 group-hover:text-[#2f8d35] transition-colors">{label}</p>
            <p className="text-xl font-black text-slate-800 tracking-tighter group-hover:scale-105 transition-transform">{value}</p>
        </div>
    )
}

function ParameterRow({ idx, label, value, unit, status, statusColor, colSpan }: { idx: number; label: string; value: string; unit?: string; status: string; statusColor: string; colSpan?: number }) {
    return (
        <tr className="hover:bg-slate-50/50 transition-colors group">
            <td className="p-4 text-center font-black text-[#2f8d35] bg-slate-50/40 w-16 group-hover:bg-[#2f8d35] group-hover:text-white transition-all">{idx}</td>
            <td className="p-4 font-black text-slate-500 border-x border-slate-50 uppercase tracking-tight">{label}</td>
            <td className={`p-4 text-center font-black text-slate-800 bg-white ${colSpan ? '' : 'border-r border-slate-50'}`} colSpan={colSpan || 1}>{value}</td>
            {!colSpan && <td className="p-4 text-center text-slate-400 font-black uppercase tracking-widest w-28 bg-slate-50/20">{unit}</td>}
            <td className="p-4 bg-white">
                <span className={`${statusColor} inline-block tracking-widest text-[9px] border px-3 py-1 rounded-full bg-opacity-5`}>{status}</span>
            </td>
        </tr>
    )
}

function SpecItem({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center bg-slate-50/80 p-4 rounded-2xl border border-slate-100 hover:bg-white hover:shadow-lg transition-all">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
            <span className="text-xs font-black text-slate-800 tracking-tight">{value}</span>
        </div>
    )
}
