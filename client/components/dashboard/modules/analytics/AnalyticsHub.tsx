"use client"

import React from "react"
import { 
  BarChart3, 
  TrendingUp, 
  Route, 
  MapPin, 
  AlertTriangle, 
  Zap, 
  Timer, 
  Activity,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Calendar
} from "lucide-react"
import { useAppDispatch } from "@/redux/hooks"
import { setActiveTab } from "@/redux/features/vehicleSlice"
import { useDashboardContext } from "@/components/dashboard/DashboardContext"

/**
 * AnalyticsHub - The "Intelligence Center" for the Dashboard
 * Grouped summaries for quick insights before drilling down into specifics.
 */
export function AnalyticsHub() {
  const dispatch = useAppDispatch()
  const { selectedVehicle } = useDashboardContext()

  const handleNavigate = (tab: string) => {
    dispatch(setActiveTab(tab))
  }

  return (
    <div className="flex flex-col gap-10 p-8 h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto CustomScrollbar pb-16">
      
      {/* Header Segment */}
      <div className="flex items-center justify-between">
        <div>
           <div className="flex items-center gap-2 mb-1">
              <div className="h-1.5 w-1.5 rounded-full bg-[#38a63c] shadow-[0_0_8px_#38a63c]" />
              <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#38a63c]">Fleet Intelligence</p>
           </div>
           <h2 className="text-2xl font-black text-[#1f3b1f] uppercase tracking-tight">Intelligence Hub</h2>
           <p className="mt-1 text-sm font-bold text-slate-400">
             {selectedVehicle ? `Analyzing metrics for ${selectedVehicle.vehicleNumber}` : "Global fleet overview & operational trends"}
           </p>
        </div>
        <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-white border border-[#dbe7d4] rounded-xl flex items-center gap-2 text-xs font-black text-[#1f3b1f]">
                <Calendar size={14} className="text-[#38a63c]" />
                LATEST 24H WINDOW
            </div>
        </div>
      </div>

      {/* KPI Trend Corridor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <TrendCard 
            title="Operational Utilization" 
            value="84.2%" 
            trend="+5.2%" 
            isPositive={true} 
            icon={Activity} 
            color="#38a63c" 
        />
        <TrendCard 
            title="Fleet Fuel Efficiency" 
            value="14.8 L/100km" 
            trend="-1.4%" 
            isPositive={true} 
            icon={Zap} 
            color="#f3a338" 
        />
        <TrendCard 
            title="Avg Response Latency" 
            value="182ms" 
            trend="+12ms" 
            isPositive={false} 
            icon={TrendingUp} 
            color="#4da2e9" 
        />
      </div>

      {/* Grouped Discovery Modules */}
      <div className="space-y-6">
        <h3 className="text-xs font-black text-[#1f3b1f] uppercase tracking-[0.2em] opacity-30 px-2">Operational Perspectives</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            <AnalyticsModuleCard 
                title="Statistics" 
                description="Raw telemetry, speed metrics, and ignition counts."
                icon={BarChart3}
                color="#38a63c"
                onClick={() => handleNavigate("Statistics")}
                metrics={["Total Distance", "Max Velocity", "Idle Time"]}
            />
            <AnalyticsModuleCard 
                title="Travel Summary" 
                description="Executive overview of vehicle movement cycles."
                icon={Route}
                color="#1f3b1f"
                onClick={() => handleNavigate("Travel Summary")}
                metrics={["Trip Count", "Parked Time", "Fleet Coverage"]}
            />
            <AnalyticsModuleCard 
                title="Alert Summary" 
                description="Critical violations and safety events log."
                icon={AlertTriangle}
                color="#ef5b4d"
                onClick={() => handleNavigate("Alert Summary")}
                metrics={["Speeding", "Geofence Hits", "SOS Triggers"]}
            />
            <AnalyticsModuleCard 
                title="Vehicle Status" 
                description="Live availability and health distribution."
                icon={Activity}
                color="#4da2e9"
                onClick={() => handleNavigate("Vehicle Status")}
                metrics={["Online %", "Offline Since", "Health Score"]}
            />
            <AnalyticsModuleCard 
                title="Daywise Distance" 
                description="Chronological mileage tracking over time."
                icon={MapPin}
                color="#f3a338"
                onClick={() => handleNavigate("Daywise Distance")}
                metrics={["Daily Average", "Peak Usage Day", "Consistency"]}
            />
            <AnalyticsModuleCard 
                title="AC / Engine Idle" 
                description="Efficiency monitoring for stationary operations."
                icon={Timer}
                color="#1f3b1f"
                onClick={() => handleNavigate("AC Summary")}
                metrics={["AC Runtime", "Fuel Waste", "Idle Heat"]}
            />
        </div>
      </div>
    </div>
  )
}

function TrendCard({ title, value, trend, isPositive, icon: Icon, color }: any) {
  return (
    <div className="bg-white border border-[#dbe7d4] rounded-[32px] p-7 shadow-sm hover:shadow-xl hover:shadow-[#38a63c]/5 transition-all group overflow-hidden relative ring-1 ring-black/5">
       <div className="flex items-center justify-between mb-4">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: color }}>
             <Icon size={20} />
          </div>
          <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black ${isPositive ? "bg-[#f7fbf5] text-[#38a63c]" : "bg-red-50 text-red-500"}`}>
             {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
             {trend}
          </div>
       </div>
       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
       <p className="text-2xl font-black text-[#1f3b1f] mt-1">{value}</p>
       
       {/* Small background graph hint */}
       <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-50 overflow-hidden">
          <div className="h-full bg-slate-200 w-[70%]" style={{ backgroundColor: color, opacity: 0.1 }} />
       </div>
    </div>
  )
}

function AnalyticsModuleCard({ title, description, icon: Icon, color, onClick, metrics }: any) {
    return (
        <button 
            onClick={onClick}
            className="flex flex-col rounded-[32px] border border-[#dbe7d4] bg-white p-8 text-left transition-all hover:border-[#38a63c]/40 hover:shadow-2xl hover:shadow-[#38a63c]/10 group ring-1 ring-black/5 active:scale-[0.98]"
        >
            <div className="flex items-center justify-between mb-6">
                <div className="h-12 w-12 rounded-2xl bg-[#f7fbf5] border border-[#dbe7d4] flex items-center justify-center text-[#38a63c] group-hover:bg-[#38a63c] group-hover:text-white transition-all shadow-sm">
                    <Icon size={24} />
                </div>
                <div className="h-10 w-10 rounded-full flex items-center justify-center text-slate-200 group-hover:text-[#38a63c] transition-all">
                    <ChevronRight size={20} />
                </div>
            </div>
            
            <h4 className="text-xl font-black text-[#1f3b1f] uppercase tracking-tight">{title}</h4>
            <p className="mt-2 text-xs font-bold text-slate-400 leading-relaxed mb-6">{description}</p>
            
            <div className="mt-auto flex flex-wrap gap-2 opacity-40 group-hover:opacity-100 transition-opacity">
                {metrics.map((m: any) => (
                    <span key={m} className="px-3 py-1.5 rounded-lg bg-white border border-[#dbe7d4] text-[9px] font-black uppercase tracking-tighter text-[#1f3b1f]">
                        {m}
                    </span>
                ))}
            </div>
        </button>
    )
}
