"use client";
import React from "react";
import { 
    X, 
    User, 
    Phone, 
    MapPin, 
    TrendingUp, 
    Activity, 
    Clock, 
    Shield, 
    Navigation, 
    Zap,
    Building2,
    Calendar,
    Gauge
} from "lucide-react";
import { Vehicle, LiveVehicle } from "@/types";
import DashboardMap from "@/components/admin/Map/DashboardMap";

interface VehicleDetailViewProps {
    vehicle: Vehicle;
    liveData?: LiveVehicle;
    onClose: () => void;
}

export default function VehicleDetailView({ vehicle, liveData, onClose }: VehicleDetailViewProps) {
    const orgName = typeof vehicle.organizationId === 'object' ? vehicle.organizationId.name : "Unknown Organization";

    return (
        <div className="flex flex-col h-full bg-white rounded-2xl overflow-hidden shadow-xl border border-gray-100 animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 border border-blue-100">
                        <Navigation size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-gray-900 tracking-tight">{vehicle.registrationNumber || vehicle.vehicleNumber}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                                {vehicle.vehicleType}
                            </span>
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${
                                liveData?.status === 'running' || liveData?.status === 'online' 
                                ? 'bg-green-50 text-green-600' 
                                : 'bg-gray-50 text-gray-400'
                            }`}>
                                {liveData?.status || 'Offline'}
                            </span>
                        </div>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-gray-50 rounded-full transition-colors group">
                    <X size={20} className="text-gray-400 group-hover:text-gray-900" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
                {/* Map Preview */}
                <div className="h-64 relative border-b border-gray-50">
                    <DashboardMap center={liveData?.location?.coordinates} zoom={15} />
                    <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-white/50 z-10">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center text-white shadow-lg shadow-green-100">
                                <Gauge size={16} />
                            </div>
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Speed</p>
                                <p className="text-sm font-black text-gray-900">{liveData?.location?.speed || 0} km/h</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-8 pb-12">
                    {/* Vehicle Identity */}
                    <div className="grid grid-cols-2 gap-6">
                        <section>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Organization</label>
                            <div className="flex items-center gap-3">
                                <Building2 size={16} className="text-gray-400" />
                                <span className="text-sm font-bold text-gray-700">{orgName}</span>
                            </div>
                        </section>
                        <section>
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-3 block">Model</label>
                            <div className="flex items-center gap-3">
                                <TrendingUp size={16} className="text-gray-400" />
                                <span className="text-sm font-bold text-gray-700">{vehicle.model || "N/A"}</span>
                            </div>
                        </section>
                    </div>

                    {/* Driver Section */}
                    <section className="bg-gray-50 rounded-2xl p-6">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">Driver Information</label>
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 bg-white border-2 border-[#E5E7EB] rounded-full flex items-center justify-center overflow-hidden">
                                <User size={24} className="text-gray-300" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-black text-gray-900">{vehicle.driverName || "Not Assigned"}</p>
                                <div className="flex items-center gap-4 mt-1">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold">
                                        <Phone size={12} />
                                        {vehicle.driverPhone || "N/A"}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-green-600 font-bold">
                                        <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                        Verified
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Statistics */}
                    <section>
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4 block">Real-time Stats</label>
                        <div className="grid grid-cols-3 gap-3">
                            <StatCard icon={<Activity size={14} />} label="Usage" value="4.2h" />
                            <StatCard icon={<Zap size={14} />} label="Ignition" value={liveData?.location?.ignition ? "On" : "Off"} highlight={liveData?.location?.ignition} />
                            <StatCard icon={<Clock size={14} />} label="Last Seen" value="2m ago" />
                        </div>
                    </section>

                    {/* Quick Info List */}
                    <div className="space-y-4">
                        <InfoItem icon={<MapPin size={16} />} label="Last Location" value="Sector 62, Noida, Uttar Pradesh" />
                        <InfoItem icon={<Calendar size={16} />} label="Last Activity" value="Today, 10:30 AM" />
                        <InfoItem icon={<Shield size={16} />} label="Security" value="System Online" success />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4 border-t border-gray-100">
                        <button className="flex-1 bg-white border border-gray-200 text-gray-600 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-50 transition-all">Track History</button>
                        <button className="flex-1 bg-red-500 text-white py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-red-600 shadow-lg shadow-red-100 transition-all">Emergency Stop</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode, label: string, value: string, highlight?: boolean }) {
    return (
        <div className={`p-4 rounded-xl border transition-all ${highlight ? 'bg-blue-50 border-blue-100' : 'bg-white border-gray-100'}`}>
            <div className={`${highlight ? 'text-blue-500' : 'text-gray-400'} mb-2`}>{icon}</div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
            <p className={`text-sm font-black ${highlight ? 'text-blue-600' : 'text-gray-900'}`}>{value}</p>
        </div>
    );
}

function InfoItem({ icon, label, value, success }: { icon: React.ReactNode, label: string, value: string, success?: boolean }) {
    return (
        <div className="flex items-start gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors group cursor-pointer">
            <div className="mt-0.5 text-gray-400 group-hover:text-blue-500 transition-colors">{icon}</div>
            <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{label}</p>
                <p className={`text-sm font-bold ${success ? 'text-green-600' : 'text-gray-700'}`}>{value}</p>
            </div>
        </div>
    );
}
