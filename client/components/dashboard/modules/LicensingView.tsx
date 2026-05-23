"use client";

import { ClipboardList, AlertTriangle, CheckCircle2, CloudUpload, Clock, FileText } from "lucide-react";
import { useDashboardContext } from "../DashboardContext";

export function LicensingView() {
    const { selectedVehicle } = useDashboardContext();

    const documents = selectedVehicle ? [
        {
            name: "AIS-140 Compliance",
            vehicle: selectedVehicle.vehicleNumber,
            expiry: "2026-12-31", // Mocked expiry as it's not in the payload
            status: selectedVehicle.ais140Compliant ? "Active" : "Not Compliant",
            cert: selectedVehicle.ais140CertificateNumber
        },
        {
            name: "Vehicle Status",
            vehicle: selectedVehicle.vehicleNumber,
            expiry: "N/A",
            status: selectedVehicle.status.charAt(0).toUpperCase() + selectedVehicle.status.slice(1),
            cert: "System Check"
        },
    ] : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-500 flex items-center gap-3">
                    <ClipboardList size={16} className="text-emerald-400" />
                    Compliance Documents
                </h3>
                <button className="flex items-center gap-2 px-6 py-2.5 bg-emerald-500 text-slate-950 rounded-xl text-xs font-black uppercase tracking-tighter hover:bg-emerald-400 transition-all">
                    <CloudUpload size={14} /> Upload New Document
                </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/5 bg-slate-900/50">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-950/50 border-b border-white/5">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Document Name</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Vehicle</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Expiry Date</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Status</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-500">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {documents.map((doc, i) => (
                            <tr key={i} className="hover:bg-white/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <FileText size={16} className="text-slate-400" />
                                        <span className="text-xs font-bold text-slate-100">{doc.name}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-xs font-medium text-slate-400">{doc.vehicle}</td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                                        <Clock size={12} className="text-slate-500" />
                                        {doc.expiry}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tight ${doc.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/10' :
                                        doc.status === 'Expiring Soon' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10' :
                                            doc.status === 'Not Compliant' || doc.status === 'Expired' ? 'bg-red-500/10 text-red-400 border border-red-500/10' :
                                                'bg-blue-500/10 text-blue-400 border border-blue-500/10'
                                        }`}>
                                        {doc.status === 'Active' ? <CheckCircle2 size={10} /> : <AlertTriangle size={10} />}
                                        {doc.status}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    <button className="text-[10px] font-black text-emerald-400 uppercase tracking-widest hover:text-emerald-300">Renew Now</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
