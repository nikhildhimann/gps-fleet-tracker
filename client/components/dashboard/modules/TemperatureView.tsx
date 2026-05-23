"use client";

import { Thermometer, Wind, AlertCircle, History } from "lucide-react";
import { useDashboardContext } from "../DashboardContext";

export function TemperatureView() {
    const { selectedVehicle } = useDashboardContext();

    if (!selectedVehicle) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 italic">
                <Thermometer className="h-12 w-12 mb-4 opacity-20" />
                Select a vehicle to view temperature data
            </div>
        );
    }

    const tempValue = selectedVehicle.temperature || "32°C";
    const isHigh = parseInt(tempValue) > 40;

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/5 bg-slate-800/40 p-6 flex items-center gap-6">
                    <div className={`p-5 rounded-2xl ${isHigh ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        <Thermometer size={40} />
                    </div>
                    <div>
                        <div className="text-4xl font-black text-slate-100">{tempValue}</div>
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500 font-bold mt-1">Ambient Temperature</div>
                    </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-800/40 p-6 flex items-center gap-6 text-slate-400 italic text-sm">
                    <div className="p-5 rounded-2xl bg-white/5 text-slate-300">
                        <History size={40} />
                    </div>
                    Trend data will be visualized here as sensor logs accumulate.
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                    <Wind size={20} className="text-blue-400" />
                    <div className="text-xs">
                        <div className="font-black text-slate-100 uppercase tracking-tighter">Humidity</div>
                        <div className="text-slate-500 font-bold">---</div>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                    <AlertCircle size={20} className="text-amber-400" />
                    <div className="text-xs">
                        <div className="font-black text-slate-100 uppercase tracking-tighter">Threshold</div>
                        <div className="text-slate-500 font-bold">Set at 45°C</div>
                    </div>
                </div>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/5">
                    <History size={20} className="text-emerald-400" />
                    <div className="text-xs">
                        <div className="font-black text-slate-100 uppercase tracking-tighter">Last Checked</div>
                        <div className="text-slate-500 font-bold">Just Now</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
