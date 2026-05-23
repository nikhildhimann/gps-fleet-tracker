"use client";

import { useState, useMemo, useEffect } from "react";
import { FileText, Download, Calendar, Filter, ChevronDown, Table as TableIcon, Search, CheckSquare, Square } from "lucide-react";
import { useDashboardContext } from "../DashboardContext";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";
import { useLazyGetVehicleHistoryQuery } from "@/redux/api/gpsHistoryApi";

export function ReportView() {
    const { selectedVehicle } = useDashboardContext();
    const [reportType, setReportType] = useState("General");
    const [dateRange, setDateRange] = useState({ start: "", end: "" });
    const [vehicleSearch, setVehicleSearch] = useState("");
    const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
    const [fetchEnabled, setFetchEnabled] = useState(false);

    const { data: vehData } = useGetVehiclesQuery(undefined);
    const vehicles = useMemo(() => vehData?.vehicles || vehData?.data || [], [vehData]);

    useEffect(() => {
        if (selectedVehicle) {
            setSelectedVehicleIds([selectedVehicle.id]);
        }
    }, [selectedVehicle]);

    const filteredVehicles = useMemo(() => {
        if (!vehicleSearch) return vehicles;
        const lowerSearch = vehicleSearch.toLowerCase();
        return vehicles.filter((v: any) =>
            v.vehicleNumber?.toLowerCase().includes(lowerSearch) ||
            v.driverName?.toLowerCase().includes(lowerSearch) ||
            v.name?.toLowerCase().includes(lowerSearch)
        );
    }, [vehicles, vehicleSearch]);

    const allSelected = filteredVehicles.length > 0 && selectedVehicleIds.length === filteredVehicles.length;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedVehicleIds([]);
        } else {
            setSelectedVehicleIds(filteredVehicles.map((v: any) => v.id || v._id));
        }
    };

    const toggleVehicle = (id: string) => {
        setSelectedVehicleIds(prev =>
            prev.includes(id) ? prev.filter(vid => vid !== id) : [...prev, id]
        );
    };

    const [triggerFetchHistory] = useLazyGetVehicleHistoryQuery();
    const [combinedHistory, setCombinedHistory] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(false);

    const handleGenerate = async () => {
        if (selectedVehicleIds.length === 0) {
            alert("Please select at least one vehicle.");
            return;
        }
        if (!dateRange.start || !dateRange.end) {
            alert("Please select a date range.");
            return;
        }

        setIsFetching(true);
        setFetchEnabled(true);
        setCombinedHistory([]);

        try {
            const results = await Promise.all(
                selectedVehicleIds.map(async (vid) => {
                    const res = await triggerFetchHistory({
                        vehicleId: vid,
                        from: dateRange.start,
                        to: dateRange.end
                    }).unwrap();

                    // Map the results and append vehicle contextual data
                    const vehicleObj = filteredVehicles.find((v: any) => (v.id || v._id) === vid);
                    return (res.data || res.history || []).map((point: any) => ({
                        ...point,
                        vehicleName: vehicleObj?.name || vehicleObj?.vehicleNumber || "Unknown",
                        driverName: vehicleObj?.driverName || "Unknown"
                    }));
                })
            );

            // Flatten the array and sort by timestamp
            const flatResults = results.flat().sort((a, b) =>
                new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime()
            );

            setCombinedHistory(flatResults);
        } catch (error) {
            console.error("Failed to fetch reports:", error);
            alert("Failed to fetch some reports. Please try again.");
        } finally {
            setIsFetching(false);
        }
    };

    // Reset fetch when params change
    useEffect(() => {
        setFetchEnabled(false);
        setCombinedHistory([]);
    }, [selectedVehicleIds, dateRange, reportType]);

    return (
        <div className="space-y-6">
            {/* Vehicle Selection Section */}
            <div className="space-y-4 border border-white/5 rounded-2xl p-4 bg-slate-900/50">
                <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Select Vehicles</label>
                    <div className="relative w-64">
                        <input
                            type="text"
                            placeholder="Search vehicle..."
                            value={vehicleSearch}
                            onChange={(e) => setVehicleSearch(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        />
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                </div>

                <div className="flex flex-col border border-white/10 rounded-xl overflow-hidden max-h-48 bg-slate-950">
                    <div
                        className="flex items-center gap-3 p-3 border-b border-white/10 bg-slate-900 cursor-pointer hover:bg-slate-800"
                        onClick={toggleSelectAll}
                    >
                        {allSelected ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} className="text-slate-500" />}
                        <span className="text-xs font-bold text-slate-200">Select All ({filteredVehicles.length})</span>
                    </div>
                    <div className="overflow-y-auto">
                        {filteredVehicles.map((v: any) => {
                            const vid = v.id || v._id;
                            const isSelected = selectedVehicleIds.includes(vid);
                            return (
                                <div
                                    key={vid}
                                    className="flex items-center gap-3 p-3 border-b border-white/5 cursor-pointer hover:bg-slate-900/50"
                                    onClick={() => toggleVehicle(vid)}
                                >
                                    {isSelected ? <CheckSquare size={16} className="text-emerald-500" /> : <Square size={16} className="text-slate-500" />}
                                    <span className="text-xs text-slate-300">{v.vehicleNumber || v.name || "Unknown Vehicle"} - {v.driverName || "No Driver"}</span>
                                </div>
                            );
                        })}
                        {filteredVehicles.length === 0 && (
                            <div className="p-4 text-center text-xs text-slate-500">No vehicles found.</div>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Report Type */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Report Type</label>
                    <div className="relative">
                        <select
                            value={reportType}
                            onChange={(e) => setReportType(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-100 appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all hover:bg-white/10"
                        >
                            <option value="General" className="bg-slate-900 text-slate-100">General Report</option>
                            <option value="Trip" className="bg-slate-900 text-slate-100">Trip Report</option>
                            <option value="Idle" className="bg-slate-900 text-slate-100">Idle Report</option>
                            <option value="Alert" className="bg-slate-900 text-slate-100">Alert Report</option>
                            <option value="Fuel" className="bg-slate-900 text-slate-100">Fuel Report</option>
                        </select>
                        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Date From */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Date From</label>
                    <div className="relative">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all [color-scheme:dark]"
                        />
                        <Calendar size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>

                {/* Date To */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Date To</label>
                    <div className="relative">
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all [color-scheme:dark]"
                        />
                        <Calendar size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 py-4 border-y border-white/5">
                <button onClick={handleGenerate} className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-emerald-400 transition-all active:scale-95 disabled:opacity-50">
                    <Filter size={14} /> {isFetching ? "Generating..." : "Generate Report"}
                </button>
                <button className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 text-slate-100 rounded-xl text-xs font-bold hover:bg-white/10 transition-all">
                    <Download size={14} /> Export PDF
                </button>
                <button className="flex items-center gap-2 px-6 py-2.5 bg-white/5 border border-white/10 text-slate-100 rounded-xl text-xs font-bold hover:bg-white/10 transition-all">
                    <Download size={14} /> Export Excel
                </button>
            </div>

            {/* Data Table */}
            {fetchEnabled ? (
                <div className="rounded-2xl border border-white/5 bg-slate-950/30 overflow-hidden min-h-[300px]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-900 border-b border-white/10">
                                <tr>
                                    <th className="px-4 py-3 font-bold text-slate-300">Vehicle</th>
                                    <th className="px-4 py-3 font-bold text-slate-300">Timestamp</th>
                                    <th className="px-4 py-3 font-bold text-slate-300">Speed (km/h)</th>
                                    <th className="px-4 py-3 font-bold text-slate-300">Location</th>
                                    <th className="px-4 py-3 font-bold text-slate-300">Ignition</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isFetching ? (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Generating report...</td>
                                    </tr>
                                ) : combinedHistory.length > 0 ? (
                                    combinedHistory.map((row: any, i: number) => (
                                        <tr key={i} className="hover:bg-slate-900/50">
                                            <td className="px-4 py-3 text-slate-400 font-bold">{row.vehicleName}</td>
                                            <td className="px-4 py-3 text-slate-400">{new Date(row.timestamp || row.createdAt).toLocaleString()}</td>
                                            <td className="px-4 py-3 text-slate-400">{row.speed || 0}</td>
                                            <td className="px-4 py-3 text-slate-400">{row.latitude?.toFixed(4) || "0"}, {row.longitude?.toFixed(4) || "0"}</td>
                                            <td className="px-4 py-3 text-[10px] font-bold">
                                                {row.ignition ? (
                                                    <span className="bg-emerald-500/10 text-emerald-500 px-2 py-1 rounded">ON</span>
                                                ) : (
                                                    <span className="bg-slate-500/10 text-slate-400 px-2 py-1 rounded">OFF</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-500">No data found for this period.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-white/5 bg-slate-950/30 p-8 flex flex-col items-center justify-center text-slate-500 italic text-center min-h-[300px]">
                    <TableIcon size={48} className="mb-4 opacity-10" />
                    <p className="text-sm">Select vehicles, date range, and click "Generate Report" to view results</p>
                    <p className="text-[10px] uppercase tracking-widest mt-2 opacity-50">Report engine ready</p>
                </div>
            )}
        </div>
    );
}
