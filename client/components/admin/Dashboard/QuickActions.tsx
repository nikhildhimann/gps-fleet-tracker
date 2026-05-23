"use client";
import React from "react";
import { 
    MapPin, 
    FileText, 
    Zap, 
    Thermometer, 
    Map as MapIcon, 
    ShieldCheck, 
    CircleDot, 
    Smartphone, 
    Settings, 
    Users, 
    AlertTriangle 
} from "lucide-react";

const actions = [
    { name: "Tracking", icon: MapPin },
    { name: "Reports", icon: FileText },
    { name: "Fuel", icon: Zap },
    { name: "Temperature", icon: Thermometer },
    { name: "Tour", icon: MapIcon },
    { name: "Licensing", icon: ShieldCheck },
    { name: "Geofences", icon: CircleDot },
    { name: "App Config", icon: Smartphone },
    { name: "Sys Config", icon: Settings },
    { name: "User Rights", icon: Users },
    { name: "Alerts", icon: AlertTriangle, badge: 312 },
];

export default function QuickActions() {
    return (
        <div className="flex items-center gap-2 overflow-x-auto rounded-[24px] border border-slate-200 bg-white p-3 shadow-[0_10px_30px_rgba(15,23,42,0.05)] no-scrollbar">
            {actions.map((action) => (
                <button 
                    key={action.name} 
                    className="group relative flex min-w-[92px] flex-col items-center gap-2 rounded-2xl px-4 py-3 transition-colors hover:bg-slate-50"
                >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-700">
                        <action.icon size={20} strokeWidth={1.7} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 group-hover:text-slate-900">{action.name}</span>
                    {action.badge && (
                        <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-rose-500 px-1 text-[8px] font-black text-white">
                            {action.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
}
