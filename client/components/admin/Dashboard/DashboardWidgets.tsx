"use client";
import React from "react";
import { 
    Gauge, 
    Zap, 
    Battery, 
    Satellite, 
    Compass, 
    Mountain,
    Share2,
    Utensils,
    Fuel,
    Gamepad
} from "lucide-react";

export default function DashboardWidgets() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {/* Speedometer Widget */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center relative overflow-hidden group">
                <Gauge size={80} className="text-[#1565C0] group-hover:scale-110 transition-transform mb-4" strokeWidth={1} />
                <div className="text-center">
                    <div className="flex items-baseline gap-2 justify-center">
                        <span className="text-sm font-bold text-gray-400">Avg Speed</span>
                        <span className="text-2xl font-black text-[#1565C0]">20 km/h</span>
                    </div>
                    <div className="flex items-baseline gap-2 justify-center mt-1">
                        <span className="text-sm font-bold text-gray-400">Max Speed</span>
                        <span className="text-2xl font-black text-red-500">60 km/h</span>
                    </div>
                </div>
            </div>

            {/* Today Activity Widget */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-[#2E7D32]">Today Activity</h3>
                    <div className="bg-green-100 text-[#2E7D32] px-2 py-0.5 rounded text-[10px] font-bold">17 km</div>
                </div>
                <div className="space-y-3">
                    <ActivityRow label="Running" value="00:54 hrs" color="text-green-600" />
                    <ActivityRow label="Idle" value="00:57 hrs" color="text-orange-500" />
                    <ActivityRow label="Stop" value="09:55 hrs" color="text-red-500" />
                    <ActivityRow label="Inactive" value="00:00 hrs" color="text-gray-400" />
                </div>
            </div>

            {/* Alert Widget */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black uppercase tracking-widest text-red-600">Alert</h3>
                    <div className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-[10px] font-bold">25</div>
                </div>
                <div className="space-y-3">
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Recent alerts</div>
                    <AlertRow label="ignition" time="0 min ago" status="on" />
                    <AlertRow label="ignition" time="1 min ago" status="off" />
                    <AlertRow label="ignition" time="7 min ago" status="on" />
                    <AlertRow label="ignition" time="9 min ago" status="off" />
                </div>
            </div>

            {/* Device Parameters Widget */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#01579B] mb-4">GPS Device Parameters</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <ParamItem label="Int Battery" value="NA" icon={<Battery size={14} />} />
                    <ParamItem label="Satellite" value="6" icon={<Satellite size={14} />} />
                    <ParamItem label="Int Battery %" value="100.00" icon={<Zap size={14} />} />
                    <ParamItem label="Angle" value="350" icon={<Compass size={14} />} />
                    <ParamItem label="Altitude" value="0" icon={<Mountain size={14} />} />
                </div>
            </div>

            {/* Driver Profile & Map Actions */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2 flex items-center gap-8">
                <div className="flex flex-col items-center gap-2 flex-shrink-0">
                    <div className="w-16 h-16 bg-[#1565C0] rounded-full flex items-center justify-center text-white text-xl font-black">DM</div>
                    <span className="text-xs font-bold text-gray-800">Dave Mattew</span>
                    <span className="text-[10px] text-gray-400 uppercase font-black">Driver</span>
                </div>
                <div className="flex-1 space-y-4">
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-[#4ADE80] h-full" style={{ width: '50%' }}></div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
                        <span className="text-gray-400">Delhi</span>
                        <span className="text-gray-400">Rai</span>
                    </div>
                    <div className="flex gap-2">
                        <button className="flex-1 bg-red-500 text-white py-2 rounded-lg text-xs font-black uppercase shadow-lg shadow-red-100">Stop</button>
                        <button className="flex-1 bg-green-500 text-white py-2 rounded-lg text-xs font-black uppercase shadow-lg shadow-green-100 flex items-center justify-center gap-2">
                            <Share2 size={14} />
                            Share Location
                        </button>
                    </div>
                </div>
            </div>

            {/* POI Widget */}
            <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm lg:col-span-2 flex items-center justify-around">
                <POIItem label="GAS STATION" icon={<Fuel size={24} />} value="5 Km Forward" time="20 Min" />
                <div className="w-px h-12 bg-gray-100"></div>
                <POIItem label="RESTAURANT" icon={<Utensils size={24} />} value="1 Km Turn Left" time="20 Min" />
                <div className="w-px h-12 bg-gray-100"></div>
                <POIItem label="ZOO" icon={<Gamepad size={24} />} value="3 Km Turn Right" time="20 Min" />
            </div>
        </div>
    );
}

interface ActivityRowProps {
    label: string;
    value: string;
    color: string;
}

function ActivityRow({ label, value, color }: ActivityRowProps) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-600">{label}</span>
            <span className={`text-[11px] font-black ${color}`}>{value}</span>
        </div>
    );
}

interface AlertRowProps {
    label: string;
    time: string;
    status: "on" | "off";
}

function AlertRow({ label, time, status }: AlertRowProps) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-gray-600 capitalize">{label}</span>
            <span className="text-[11px] font-bold text-gray-400">{time}</span>
            <span className={`text-[10px] font-black uppercase ${status === 'on' ? 'text-red-500' : 'text-gray-400'}`}>{status}</span>
        </div>
    );
}

interface ParamItemProps {
    label: string;
    value: string;
    icon: React.ReactNode;
}

function ParamItem({ label, value, icon }: ParamItemProps) {
    return (
        <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5 text-gray-400">
                {icon}
                <span className="text-[10px] font-bold uppercase tracking-tight">{label}</span>
            </div>
            <span className="text-xs font-black text-[#01579B] ml-5">{value}</span>
        </div>
    );
}

interface POIItemProps {
    label: string;
    icon: React.ReactNode;
    value: string;
    time: string;
}

function POIItem({ label, icon, value, time }: POIItemProps) {
    return (
        <div className="flex flex-col items-center gap-2 group cursor-pointer">
            <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-400 group-hover:bg-green-50 group-hover:text-green-600 transition-colors border border-gray-100 group-hover:border-green-200">
                {icon}
            </div>
            <div className="text-center">
                <span className="text-[9px] font-black text-[#004D40] uppercase block">{label}</span>
                <span className="text-[10px] text-gray-400 block">{value}</span>
                <span className="text-[9px] font-bold text-gray-300">Estimated time : {time}</span>
            </div>
        </div>
    );
}
