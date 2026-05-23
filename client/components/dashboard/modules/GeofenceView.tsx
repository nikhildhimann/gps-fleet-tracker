"use client";

import { Shield, Plus, Map, Search, Trash2, MapPin, MousePointer2 } from "lucide-react";
import { useGetGeofencesQuery } from "@/redux/api/vehicleApi";
import { useState, useMemo } from "react";

export function GeofenceView() {
    const { data: geofenceData, isLoading, error } = useGetGeofencesQuery(undefined);
    const [searchTerm, setSearchTerm] = useState("");

    const isForbidden = (error as any)?.status === 403;

    const geofences = useMemo(() => {
        if (isForbidden) return [];
        const raw = geofenceData?.data || [];
        if (!searchTerm) return raw;
        return raw.filter((g: any) => g.name?.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [geofenceData, searchTerm, isForbidden]);

    if (isForbidden) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500 bg-white rounded-[32px] border border-[#dbe7d4] shadow-sm m-6">
                <Shield className="h-16 w-16 mb-4 opacity-10 text-red-500" />
                <h3 className="text-xl font-black text-[#1f3b1f] uppercase tracking-tight">Access Restricted</h3>
                <p className="text-xs font-bold text-slate-400 mt-2">You do not have administrative clearance to manage perimeter zones.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full gap-8 p-8 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto CustomScrollbar pb-16">
            
            {/* Header / Search Segment */}
            <div className="flex flex-wrap items-center justify-between gap-6">
                <div>
                     <div className="flex items-center gap-2 mb-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-[#38a63c] shadow-[0_0_8px_#38a63c]" />
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#38a63c]">Zone Orchestration</p>
                     </div>
                     <h2 className="text-2xl font-black text-[#1f3b1f] uppercase tracking-tight">Geofence Inventory</h2>
                </div>

                <div className="flex items-center gap-4 flex-1 max-w-2xl">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Find specific corridors or zones..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border border-[#dbe7d4] rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-[#1f3b1f] focus:outline-none focus:ring-4 focus:ring-[#38a63c]/5 placeholder:text-slate-300 transition-all"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-8 py-3.5 bg-[#1f3b1f] text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-[#1f3b1f]/10 active:scale-95 group">
                        <Plus size={16} className="group-hover:rotate-90 transition-transform" /> 
                        Deploy Zone
                    </button>
                </div>
            </div>

            {/* Main Geofence Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                
                {/* Draw New Geofence Card */}
                <div className="h-full min-h-[220px] border-2 border-dashed border-[#dbe7d4] rounded-[32px] p-8 flex flex-col items-center justify-center text-slate-400 hover:border-[#38a63c]/50 hover:bg-[#f7fbf5] hover:text-[#38a63c] transition-all cursor-pointer group bg-slate-50/30">
                    <div className="h-14 w-14 rounded-2xl bg-white border border-[#dbe7d4] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-sm">
                        <MousePointer2 size={24} className="opacity-40 group-hover:opacity-100" />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-widest">Draw Custom Perimeter</span>
                    <p className="text-[9px] font-bold text-slate-300 mt-1 uppercase">Define coordinates via Map</p>
                </div>

                {isLoading ? (
                    [1, 2, 3].map(i => (
                        <div key={i} className="h-[220px] rounded-[32px] bg-slate-50 animate-pulse border border-[#dbe7d4]" />
                    ))
                ) : geofences.length > 0 ? (
                    geofences.map((g: any, i: number) => (
                        <div key={i} className="group relative rounded-[32px] border border-[#dbe7d4] bg-white p-7 shadow-sm transition-all hover:shadow-xl hover:shadow-[#38a63c]/5 hover:border-[#38a63c]/30 ring-1 ring-black/5">
                            <div className="flex items-start justify-between mb-6">
                                <div className="p-4 rounded-2xl bg-[#f7fbf5] text-[#38a63c] border border-[#dbe7d4] group-hover:scale-110 transition-transform">
                                    <Shield size={24} className="drop-shadow-sm" />
                                </div>
                                <div className="flex gap-2">
                                    <button className="p-2.5 rounded-xl text-slate-300 hover:text-[#38a63c] hover:bg-[#f7fbf5] transition-all">
                                        <MapPin size={18} />
                                    </button>
                                    <button className="p-2.5 rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                            
                            <h4 className="text-lg font-black text-[#1f3b1f] uppercase tracking-tight truncate">{g.name || "Unnamed Corridor"}</h4>
                            
                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-50 text-[10px] font-black uppercase tracking-tighter text-slate-500 border border-slate-100">
                                    <Map size={12} className="text-[#38a63c]" /> {g.areaType || "Polygon"}
                                </span>
                                {g.radius && (
                                    <span className="px-3 py-1.5 rounded-lg bg-slate-50 text-[10px] font-black uppercase tracking-tighter text-slate-500 border border-slate-100">
                                        Rad: {g.radius}m
                                    </span>
                                )}
                            </div>

                            <div className="mt-auto pt-6 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1 text-left">Alert Trigger</span>
                                    <span className="text-[10px] font-black text-[#38a63c] uppercase">{g.alertOn || "Entry & Exit"}</span>
                                </div>
                                <div className="h-2 w-2 rounded-full bg-[#38a63c] shadow-[0_0_8px_#38a63c]" />
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="col-span-full py-20 bg-slate-50/50 rounded-[32px] border border-dashed border-[#dbe7d4] flex flex-col items-center justify-center text-slate-400">
                        <Map className="h-16 w-16 mb-4 opacity-10" />
                        <span className="text-xs font-black uppercase tracking-widest">No Operational Zones Found</span>
                    </div>
                )}
            </div>

            {/* Zone Utilization Intel */}
            <div className="mt-auto grid grid-cols-1 md:grid-cols-4 gap-6 bg-[#1f3b1f] rounded-[32px] p-8 text-white relative overflow-hidden shadow-2xl">
                 <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Shield size={160} />
                 </div>
                 <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-50">Fleet Occupancy</p>
                    <p className="text-3xl font-black mt-2">18 <span className="text-sm opacity-50 font-bold ml-1">VEHICLES</span></p>
                    <div className="mt-4 h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-[#38a63c] w-[65%]" />
                    </div>
                 </div>
                 <div className="relative z-10 border-l border-white/10 pl-6 h-full flex flex-col justify-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-50">Today's Alerts</p>
                    <p className="text-3xl font-black mt-2">142</p>
                 </div>
                 <div className="relative z-10 border-l border-white/10 pl-6 h-full flex flex-col justify-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-50">Most Active Zone</p>
                    <p className="text-sm font-black mt-2 uppercase">Main Warehouse</p>
                    <p className="text-[10px] font-bold opacity-40 uppercase mt-1 tracking-widest">Zone Corridor-B</p>
                 </div>
                 <div className="relative z-10 flex items-center justify-end">
                    <button className="px-6 py-3 bg-white text-[#1f3b1f] rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-[#38a63c] hover:text-white transition-all">
                        Geofence Log Hub
                    </button>
                 </div>
            </div>
        </div>
    );
}

