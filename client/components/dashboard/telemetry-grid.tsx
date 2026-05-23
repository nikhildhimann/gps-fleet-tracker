"use client";

import { useState } from "react";
import { Fan, FileText, Fuel, Mail, MapPin, Navigation, Phone, Power, Signal, Thermometer, User, X, Zap } from "lucide-react";
import type { Vehicle } from "@/lib/vehicles";

const booleanTone = (value?: boolean) => (value ? "text-[#38a63c]" : "text-slate-300")

const InfoTile = ({
    label,
    value,
    icon: Icon,
    compact = false,
}: {
    label: string
    value: React.ReactNode
    icon: typeof Navigation
    compact?: boolean
}) => (
    <div className={`rounded-2xl border border-[#dbe7d4] bg-[#f8fcf7] ${compact ? "p-3" : "p-4"}`}>
        <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
            <Icon className="h-4 w-4 text-[#38a63c]" />
        </div>
        <div className="mt-2 text-sm font-semibold text-slate-800">{value}</div>
    </div>
)

export function TelemetryGrid({ vehicle, compact = false }: { vehicle: Vehicle; compact?: boolean }) {
    const [isDriverModalOpen, setIsDriverModalOpen] = useState(false);
    const fullDriverName = [vehicle.driverDetails?.firstName, vehicle.driverDetails?.lastName]
        .filter(Boolean)
        .filter((name) => name !== "N/A")
        .join(" ")
        .trim() || vehicle.driver || "Unassigned";
    const driverPhone = vehicle.driverDetails?.phone || "N/A";
    const driverEmail = vehicle.driverDetails?.email || "N/A";
    const driverLicense = vehicle.driverDetails?.licenseNumber || "N/A";
    const driverAddress = vehicle.driverDetails?.address || "N/A";
    const hasDriverData = vehicle.driverDetails?.hasData || false;

    const fields = [
        { label: "Ignition", value: vehicle.ign ? "On" : "Off", icon: Power },
        { label: "AC", value: vehicle.ac ? "On" : "Off", icon: Fan },
        { label: "Power", value: vehicle.pw ? "On" : "Off", icon: Zap },
        { label: "GPS", value: vehicle.gps ? "Live" : "Offline", icon: Signal },
        { label: "Fuel", value: vehicle.fuel != null ? `${vehicle.fuel}%` : "N/A", icon: Fuel },
        { label: "Temp", value: vehicle.temperature || "N/A", icon: Thermometer },
        { label: "Speed", value: `${vehicle.speed || 0} km/h`, icon: Navigation },
        { label: "POI", value: vehicle.poi || "N/A", icon: MapPin },
    ];

    return (
        <div className="w-full">
            <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3"}`}>
                <InfoTile label="Vehicle" value={vehicle.vehicleNumber || vehicle.id || "N/A"} icon={Navigation} compact={compact} />
                <button
                    type="button"
                    onClick={() => setIsDriverModalOpen(true)}
                    className="text-left"
                >
                    <InfoTile label="Driver" value={fullDriverName} icon={User} compact={compact} />
                </button>

                {fields.map((field) => (
                    <div key={field.label} className="rounded-2xl border border-[#dbe7d4] bg-[#f8fcf7] p-4">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{field.label}</span>
                            <field.icon className={`h-4 w-4 ${["Ignition", "AC", "Power", "GPS"].includes(field.label) ? booleanTone(field.value === "On" || field.value === "Live") : "text-[#38a63c]"}`} />
                        </div>
                        <div className="mt-2 text-sm font-semibold text-slate-800">{field.value}</div>
                    </div>
                ))}

                <div className="rounded-2xl border border-[#dbe7d4] bg-[#f8fcf7] p-4 sm:col-span-2 xl:col-span-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Location</span>
                        <MapPin className="h-4 w-4 text-[#38a63c]" />
                    </div>
                    <div className="mt-2 text-sm font-semibold leading-6 text-slate-800">{vehicle.location || "N/A"}</div>
                </div>
            </div>

            {isDriverModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4 backdrop-blur-sm" onClick={() => setIsDriverModalOpen(false)}>
                    <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between border-b border-[#e6efe0] px-5 py-4">
                            <div className="flex items-center gap-3">
                                <div className="rounded-full bg-[#ecf8ea] p-2">
                                    <User size={20} className="text-[#38a63c]" />
                                </div>
                                <div className="min-w-0">
                                    <h4 className="truncate text-sm font-black uppercase tracking-[0.2em] text-slate-800">Driver Profile</h4>
                                    <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{vehicle.vehicleNumber || "N/A"}</p>
                                </div>
                            </div>
                            <button onClick={() => setIsDriverModalOpen(false)} className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                                <X size={18} />
                            </button>
                        </div>

                        <div className="space-y-4 p-5">
                            {!hasDriverData && (
                                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-medium text-amber-700">
                                    Driver details are not available for this vehicle.
                                </div>
                            )}

                            <InfoTile label="Full Name" value={fullDriverName} icon={User} />
                            <InfoTile label="Phone Number" value={driverPhone} icon={Phone} />
                            <InfoTile label="Email Address" value={driverEmail} icon={Mail} />
                            <InfoTile label="License Number" value={driverLicense} icon={FileText} />
                            <InfoTile label="Address" value={driverAddress} icon={MapPin} />

                            <button onClick={() => setIsDriverModalOpen(false)} className="w-full rounded-2xl bg-[#38a63c] py-3 text-xs font-black uppercase tracking-[0.2em] text-white transition hover:bg-[#2f8d35]">
                                Close Details
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
