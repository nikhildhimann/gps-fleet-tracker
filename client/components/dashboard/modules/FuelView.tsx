"use client";

import { Fuel, Droplets, TrendingUp, AlertTriangle } from "lucide-react";
import { useDashboardContext } from "../DashboardContext";

export function FuelView() {
    const { selectedVehicle } = useDashboardContext();

    if (!selectedVehicle) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-slate-500 italic">
                <Fuel className="h-12 w-12 mb-4 opacity-20" />
                Select a vehicle to view fuel statistics
            </div>
        );
    }

    const fuelLevel = selectedVehicle.fuel ?? 0;
    const isLow = fuelLevel < 20;

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-2xl border border-white/5 bg-slate-800/40 p-5 flex flex-col items-center justify-center text-center">
                    <div className={`p-4 rounded-2xl mb-4 ${isLow ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                        <Droplets size={32} />
                    </div>
                    <div className="text-3xl font-black text-slate-100">{fuelLevel}%</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">Current Fuel Level</div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-800/40 p-5 flex flex-col items-center justify-center text-center">
                    <div className="p-4 rounded-2xl mb-4 bg-blue-500/10 text-blue-400">
                        <TrendingUp size={32} />
                    </div>
                    <div className="text-3xl font-black text-slate-100">---</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">Consumption Rate</div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-800/40 p-5 flex flex-col items-center justify-center text-center">
                    <div className="p-4 rounded-2xl mb-4 bg-amber-500/10 text-amber-400">
                        <AlertTriangle size={32} />
                    </div>
                    <div className="text-3xl font-black text-slate-100">{isLow ? "Low Fuel" : "Normal"}</div>
                    <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">Refuel Status</div>
                </div>
            </div>

            <div className="flex-1 rounded-2xl border border-white/5 bg-slate-900/50 p-6 flex items-center justify-center italic text-slate-500 text-sm">
                Fuel consumption graph and historical data will appear here as telemetry accumulates.
            </div>
        </div>
    );
}
