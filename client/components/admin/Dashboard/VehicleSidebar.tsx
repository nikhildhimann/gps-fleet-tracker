"use client";
import React, { useState } from "react";
import { Search, Info, User, Play, Wifi, ShieldAlert, CircleDot, Eye } from "lucide-react";
import { Vehicle } from "@/types";

interface VehicleSidebarProps {
    vehicles: Vehicle[];
    onVehicleClick?: (vehicle: Vehicle) => void;
    onViewMap?: (vehicle: Vehicle) => void;
    selectedVehicleId?: string;
}

export default function VehicleSidebar({ vehicles, onVehicleClick, onViewMap, selectedVehicleId }: VehicleSidebarProps) {
    const [filter, setFilter] = useState("All");

    const filters = ["All", "Hired", "Available", "Service", "Withdrawn"];

    return (
        <div className="flex flex-col h-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            {/* Title & Search */}
            <div className="p-4 bg-gray-50/50 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-black text-[#004D40]">Ajiva Tracker</h2>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{vehicles.length} Car in my tracker</p>
                    </div>
                    <button className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white shadow-lg shadow-green-200 hover:scale-105 transition-transform">
                        <Search size={20} />
                    </button>
                </div>

                <div className="flex flex-wrap gap-2">
                    {filters.map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-widest transition-all ${
                                filter === f 
                                ? "bg-green-500 text-white shadow-md shadow-green-100" 
                                : "bg-white text-gray-400 border border-gray-200 hover:border-green-500"
                            }`}
                        >
                            {f}
                        </button>
                    ))}
                </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-7 gap-2 px-4 py-2 bg-gray-100/50 border-y border-gray-200 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-black text-gray-400 uppercase min-w-[100px]">Vehicle</span>
                <span className="text-[10px] font-black text-gray-400 uppercase">Driver</span>
                <span className="text-[10px] font-black text-gray-400 uppercase">IGN</span>
                <span className="text-[10px] font-black text-gray-400 uppercase">PWR</span>
                <span className="text-[10px] font-black text-gray-400 uppercase">AC</span>
                <span className="text-[10px] font-black text-gray-400 uppercase">GPS</span>
                <span className="text-[10px] font-black text-gray-400 uppercase">Speed</span>
            </div>

            {/* Vehicle List */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                {vehicles.map((v, i) => (
                    <div 
                        key={v._id || i} 
                        onClick={() => onVehicleClick?.(v)}
                        className={`px-4 py-3 hover:bg-green-50/30 transition-colors cursor-pointer group ${
                            selectedVehicleId === v._id ? 'bg-green-50 border-l-4 border-green-500' : ''
                        }`}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${i % 3 === 0 ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : i % 3 === 1 ? 'bg-orange-500' : 'bg-red-500 animate-pulse'}`}></div>
                                <div>
                                    <p className="text-xs font-black text-gray-800 tracking-tight">{(v.registrationNumber as string) || v.vehicleNumber || "DL 10CK1840"}</p>
                                    <p className="text-[9px] font-bold text-gray-400 font-mono tracking-tight text-opacity-70 dark:text-opacity-70">22-12-2023 15:00:00</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onViewMap?.(v);
                                    }}
                                    className="p-1 px-2 bg-blue-50 text-blue-600 rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center gap-1"
                                >
                                    <Eye size={10} /> View
                                </button>
                                <button className="p-1 bg-green-50 text-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all">
                                    <Info size={12} />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-gray-400">
                            <User size={14} className="group-hover:text-green-600" />
                            <Play size={14} className="text-green-500" />
                            <Wifi size={14} className="text-green-500" />
                            <ShieldAlert size={14} className="text-green-500" />
                            <CircleDot size={14} className="text-green-500" />
                            <span className="text-[10px] font-black text-gray-600">40</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
