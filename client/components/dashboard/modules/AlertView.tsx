"use client";

import { Bell, AlertCircle, TriangleAlert, Info, Check, Trash2, ShieldX } from "lucide-react";
import { useDashboardContext } from "../DashboardContext";
import { useGetNotificationsQuery, useClearAllNotificationsMutation, useDeleteNotificationMutation } from "@/redux/api/notificationsApi";

export function AlertView() {
    const { selectedVehicle } = useDashboardContext();
    const { data: notificationsData, isLoading } = useGetNotificationsQuery(undefined);
    const [clearAll] = useClearAllNotificationsMutation();
    const [deleteAlert] = useDeleteNotificationMutation();

    const alerts = (notificationsData?.data || []).filter((a: any) =>
        !selectedVehicle || a.deviceId === selectedVehicle.deviceId
    ).map((a: any) => ({
        id: a._id,
        title: a.title || "Alert",
        vehicle: a.vehicleNumber || a.imei || "Unknown",
        time: a.createdAt ? new Date(a.createdAt).toLocaleString() : "Unknown",
        severity: a.priority || (a.priority === 3 ? "Critical" : a.priority === 2 ? "Warning" : "Info"),
        location: a.address || "Unknown location",
    }));

    const criticalCount = alerts.filter((a: any) => a.severity === "Critical").length;
    const warningCount = alerts.filter((a: any) => a.severity === "Warning").length;

    return (
        <div className="flex flex-col h-full gap-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div className="flex gap-4">
                    <button className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black uppercase tracking-tighter">Critical ({criticalCount})</button>
                    <button className="px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-black uppercase tracking-tighter">Warnings ({warningCount})</button>
                    <button className="px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-black uppercase tracking-tighter">All ({alerts.length})</button>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => clearAll(undefined)}
                        className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl text-xs font-bold hover:bg-white/10 transition-all"
                    >
                        <Check size={14} /> Clear All
                    </button>
                </div>
            </div>

            <div className="space-y-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {alerts.map((a: any, i: number) => (
                    <div key={i} className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all hover:translate-x-1 ${a.severity === 'Critical' ? 'bg-red-500/5 border-red-500/10 hover:border-red-500/30' :
                        a.severity === 'Warning' ? 'bg-amber-500/5 border-amber-500/10 hover:border-amber-500/30' :
                            'bg-blue-500/5 border-blue-500/10 hover:border-blue-500/30'
                        }`}>
                        <div className={`p-3 rounded-xl shrink-0 ${a.severity === 'Critical' ? 'bg-red-500/10 text-red-500' :
                            a.severity === 'Warning' ? 'bg-amber-500/10 text-amber-500' :
                                'bg-blue-500/10 text-blue-500'
                            }`}>
                            {a.severity === 'Critical' ? <ShieldX size={20} /> : a.severity === 'Warning' ? <TriangleAlert size={20} /> : <Info size={20} />}
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <h4 className="text-sm font-black text-slate-100 uppercase tracking-tighter">{a.title}</h4>
                                <span className="text-[10px] font-bold text-slate-500">{a.time}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                <span className="font-bold text-slate-300">{a.vehicle}</span>
                                <span className="h-1 w-1 rounded-full bg-slate-700" />
                                <span className="truncate italic">{a.location}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => deleteAlert(a.id)}
                            className="p-2 rounded-lg text-slate-700 hover:text-red-400 hover:bg-red-400/10 transition-all"
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                ))}

                {alerts.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-600 italic">
                        <Bell size={48} className="mb-4 opacity-10" />
                        <p className="text-sm">No new alerts. All systems operational.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
