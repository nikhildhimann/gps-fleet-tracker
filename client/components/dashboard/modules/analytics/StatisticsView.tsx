"use client"

import { useState, useMemo } from "react"
import { 
    CalendarRange, 
    Gauge, 
    Route, 
    History, 
    TrendingUp, 
    AlertTriangle, 
    Clock, 
    ChevronRight, 
    ArrowUpRight,
    MapPin,
    BarChart3,  
    Activity,
    Shield
} from "lucide-react"
import { useDashboardContext } from "@/components/dashboard/DashboardContext"
import { useAppDispatch } from "@/redux/hooks"
import { setActiveTab } from "@/redux/features/vehicleSlice"
import { 
    useGetDaywiseDistanceQuery, 
    useGetStatisticsQuery,
    useGetTravelSummaryQuery 
} from "@/redux/api/gpsHistoryApi"
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi"
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi"
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from "recharts"

const formatDuration = (seconds?: number) => {
    const total = Math.max(0, Number(seconds || 0))
    const hrs = Math.floor(total / 3600)
    const mins = Math.floor((total % 3600) / 60)
    return `${hrs}h ${mins}m`
}

const COLORS = ["#38a63c", "#f3a338", "#ef5b4d", "#4da2e9"];

export function StatisticsView() {
    const dispatch = useAppDispatch()
    const { selectedVehicle } = useDashboardContext()
    const { data: organizationData } = useGetOrganizationsQuery(undefined)
    const { data: allVehiclesData } = useGetVehiclesQuery(undefined)
    
    // Default Filter State
    const [dateRange, setDateRange] = useState({
        preset: "Last 7 Days",
        from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    })
    
    const [activeVehicleId, setActiveVehicleId] = useState<string>(selectedVehicle?.id || "all")
    const [selectedOrgId, setSelectedOrgId] = useState<string>("all")

    const handlePresetChange = (preset: string, days: number) => {
        const to = new Date().toISOString().split('T')[0]
        const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        setDateRange({ preset, from, to })
    }

    const goToTab = (tab: string) => {
        dispatch(setActiveTab(tab))
    }

    // Queries
    const statsQuery = useGetStatisticsQuery({ 
        vehicleId: activeVehicleId, 
        from: dateRange.from, 
        to: dateRange.to 
    })
    
    const daywiseQuery = useGetDaywiseDistanceQuery({ 
        vehicleId: activeVehicleId, 
        from: dateRange.from, 
        to: dateRange.to 
    })

    const travelSummaryQuery = useGetTravelSummaryQuery({
        vehicleId: activeVehicleId,
        from: dateRange.from,
        to: dateRange.to
    })

    const statistics = statsQuery.data?.data
    const daywiseData = daywiseQuery.data?.data?.days || []
    const fleetPerformance = travelSummaryQuery.data?.trips || []

    // Chart Data Preparation
    const chartData = useMemo(() => {
        return daywiseData.map((d: any) => ({
            date: d.date,
            distance: Number(d.distance || 0).toFixed(2)
        }))
    }, [daywiseData])

    const pieData = useMemo(() => [
        { name: "Running", value: statistics?.runningTime || 0 },
        { name: "Idle", value: statistics?.idleTime || 0 },
        { name: "Stopped", value: 3600 * 24 - (statistics?.runningTime || 0) - (statistics?.idleTime || 0) }
    ].filter(v => v.value > 0), [statistics])

    return (
        <div className="flex flex-col gap-8 p-8 h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto CustomScrollbar pb-20">
            
            {/* Header Hub */}
            <div className="flex flex-wrap items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <BarChart3 size={14} className="text-[#38a63c]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#38a63c]">Advanced Metrics</p>
                    </div>
                    <h2 className="text-3xl font-black text-[#1f3b1f] uppercase tracking-tight">Fleet Analytics</h2>
                    <p className="mt-1 text-sm font-bold text-slate-400">Discover utilization patterns and efficiency benchmarks</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-[24px] border border-[#dbe7d4] shadow-sm">
                    {["Today", "Last 7 Days", "Last 30 Days"].map((p) => (
                        <button
                            key={p}
                            onClick={() => handlePresetChange(p, p === "Today" ? 0 : p === "Last 7 Days" ? 7 : 30)}
                            className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                dateRange.preset === p ? "bg-[#1f3b1f] text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
                            }`}
                        >
                            {p}
                        </button>
                    ))}
                    <div className="h-6 w-[1.5px] bg-[#dbe7d4] mx-1" />
                    <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-black text-[#1f3b1f] opacity-40">
                        <CalendarRange size={14} />
                        {dateRange.from} — {dateRange.to}
                    </div>
                </div>
            </div>

            {/* Global Filters Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Select Horizon</label>
                     <select 
                        value={selectedOrgId}
                        onChange={(e) => setSelectedOrgId(e.target.value)}
                        className="w-full bg-white border border-[#dbe7d4] rounded-2xl py-3.5 px-4 text-xs font-black text-[#1f3b1f] focus:outline-none focus:ring-4 focus:ring-[#38a63c]/5 appearance-none cursor-pointer"
                     >
                        <option value="all">All Organizations</option>
                        {organizationData?.data?.map((org: any) => (
                            <option key={org._id} value={org._id}>{org.name}</option>
                        ))}
                     </select>
                </div>
                <div className="md:col-span-3">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block px-1">Target Asset</label>
                     <select 
                        value={activeVehicleId}
                        onChange={(e) => setActiveVehicleId(e.target.value)}
                        className="w-full bg-white border border-[#dbe7d4] rounded-2xl py-3.5 px-4 text-xs font-black text-[#1f3b1f] focus:outline-none focus:ring-4 focus:ring-[#38a63c]/5 appearance-none cursor-pointer"
                     >
                        <option value="all">Enterprise Fleet (All {allVehiclesData?.data?.length || 0} Assets)</option>
                        {allVehiclesData?.data?.map((v: any) => (
                            <option key={v._id || v.id} value={v._id || v.id}>{v.vehicleNumber} ({v.deviceName})</option>
                        ))}
                     </select>
                </div>
            </div>

            {/* KPI Stratos */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <KPICard title="Accumulated Path" value={`${Number(statistics?.totalDistance || 0).toFixed(2)} km`} sub="Total Distance" icon={Route} onClick={() => goToTab("Daywise Distance")} />
                <KPICard title="Peak Velocity" value={`${Number(statistics?.maxSpeed || 0).toFixed(1)} km/h`} sub="Max Velocity" icon={Gauge} onClick={() => goToTab("Vehicle Status")} />
                <KPICard title="Active Motion" value={formatDuration(statistics?.runningTime)} sub="Running Time" icon={Activity} onClick={() => goToTab("Travel Summary")} />
                <KPICard title="Fueling Cycles" value={String(statistics?.ignitionOnCount || 0)} sub="Ignition Events" icon={TrendingUp} onClick={() => goToTab("Alert Summary")} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                
                {/* Distance Analytics Chart */}
                <div className="xl:col-span-2 rounded-[32px] border border-[#dbe7d4] bg-white p-8 shadow-sm ring-1 ring-black/5">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h4 className="text-xl font-black text-[#1f3b1f] uppercase tracking-tight">Distance Trajectory</h4>
                            <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Chronological Kilometer Distribution</p>
                        </div>
                        <div className="h-10 w-10 rounded-xl bg-[#f7fbf5] flex items-center justify-center text-[#38a63c]">
                            <History size={18} />
                        </div>
                    </div>
                    
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData}>
                                <defs>
                                    <linearGradient id="colorDist" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#38a63c" stopOpacity={0.1}/>
                                        <stop offset="95%" stopColor="#38a63c" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="date" 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} 
                                    dy={10}
                                />
                                <YAxis 
                                    axisLine={false} 
                                    tickLine={false} 
                                    tick={{fontSize: 10, fontWeight: 800, fill: '#64748b'}} 
                                />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '12px', fontWeight: '800' }}
                                />
                                <Area type="monotone" dataKey="distance" stroke="#38a63c" strokeWidth={3} fillOpacity={1} fill="url(#colorDist)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Utilization Pie */}
                <div className="rounded-[32px] border border-[#dbe7d4] bg-white p-8 shadow-sm flex flex-col ring-1 ring-black/5">
                    <h4 className="text-xl font-black text-[#1f3b1f] uppercase tracking-tight mb-2">Fleet Utilization</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-8">State occupancy breakdown</p>
                    
                    <div className="flex-1 flex items-center justify-center relative min-h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={90}
                                    paddingAngle={8}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-[10px] font-black text-slate-400 uppercase">Operational</span>
                            <span className="text-2xl font-black text-[#1f3b1f]">Active</span>
                        </div>
                    </div>

                    <div className="mt-8 space-y-3">
                        {pieData.map((d, i) => (
                            <div key={d.name} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">{d.name}</span>
                                </div>
                                <span className="text-xs font-black text-[#1f3b1f]">{formatDuration(d.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Performance Hierarchy Table */}
            <div className="flex flex-col rounded-[32px] border border-[#dbe7d4] bg-white shadow-sm overflow-hidden ring-1 ring-black/5">
                <div className="flex items-center justify-between p-8 border-b border-[#dbe7d4]">
                    <div>
                        <h4 className="text-xl font-black text-[#1f3b1f] uppercase tracking-tight">Performance Summary</h4>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">Global Vehicle Benchmarking</p>
                    </div>
                    <button 
                        onClick={() => goToTab("Travel Summary")}
                        className="flex items-center gap-2 px-6 py-2.5 bg-[#f7fbf5] text-[#38a63c] border border-[#dbe7d4] rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#38a63c] hover:text-white transition-all"
                    >
                        Full Analytics Report
                    </button>
                </div>
                
                <div className="overflow-x-auto CustomScrollbar">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-[#f7fbf5] border-b border-[#dbe7d4]">
                                {["Asset Hierarchy", "Distance", "Usage Time", "Avg Spd", "Max Spd", "Events"].map((h) => (
                                    <th key={h} className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {fleetPerformance.length > 0 ? fleetPerformance.map((v: any) => (
                                <tr key={v.vehicleId} className="hover:bg-[#f7fbf5]/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-[#38a63c] group-hover:text-white transition-all">
                                                <Route size={18} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-[#1f3b1f] uppercase">{v.vehicleNumber}</p>
                                                <p className="text-[10px] font-bold text-slate-400 uppercase">IMEI: {v.imei}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5 text-sm font-black text-[#1f3b1f]">{Number(v.distance || 0).toFixed(1)} <span className="text-[10px] opacity-40">KM</span></td>
                                    <td className="px-8 py-5 text-xs font-bold text-slate-500">{formatDuration(v.runningTime)}</td>
                                    <td className="px-8 py-5 text-xs font-black text-[#38a63c]">{Number(v.avgSpeed || 0).toFixed(1)} km/h</td>
                                    <td className="px-8 py-5 text-xs font-black text-orange-500">{Number(v.maxSpeed || 0).toFixed(1)} km/h</td>
                                    <td className="px-8 py-5">
                                        <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase ${v.alerts > 0 ? "bg-red-50 text-red-500 ring-1 ring-red-100" : "bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"}`}>
                                            {v.alerts || 0} Alerts
                                        </span>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="px-8 py-20 text-center">
                                         <Activity className="h-12 w-12 mx-auto text-slate-200 mb-4 opacity-20" />
                                         <p className="text-xs font-black text-slate-300 uppercase tracking-widest">No Operational History for this Range</p>
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

function KPICard({ title, value, sub, icon: Icon, onClick }: any) {
    return (
        <div className="group relative rounded-[32px] border border-[#dbe7d4] bg-white p-7 shadow-sm transition-all hover:shadow-2xl hover:shadow-[#38a63c]/5 hover:border-[#38a63c]/30 ring-1 ring-black/5">
            <div className="flex items-center justify-between mb-5">
                <div className="h-12 w-12 rounded-2xl bg-[#f7fbf5] border border-[#dbe7d4] flex items-center justify-center text-[#38a63c] group-hover:bg-[#38a63c] group-hover:text-white transition-all shadow-sm">
                    <Icon size={24} />
                </div>
                <div 
                    onClick={onClick}
                    className="flex items-center gap-1 group-hover:translate-x-1 transition-transform cursor-pointer"
                >
                    <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">View Report</p>
                    <ChevronRight size={12} className="text-slate-300" />
                </div>
            </div>
            
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{sub}</p>
            <h4 className="mt-2 text-2xl font-black text-[#1f3b1f] uppercase tracking-tight">{value}</h4>
            
            <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                <Icon size={80} />
            </div>
        </div>
    )
}

