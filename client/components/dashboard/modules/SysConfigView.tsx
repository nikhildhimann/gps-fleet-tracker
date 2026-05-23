"use client"

import React, { useState, useEffect } from "react"
import { 
  Terminal, 
  Activity, 
  Cpu, 
  Database, 
  ShieldCheck, 
  Timer, 
  GitBranch, 
  RefreshCcw,
  Zap,
  HardDrive,
  Gauge,
  Wifi,
  WifiOff,
  Clock,
  Settings2,
  Lock,
  Network,
  Save,
  Check,
  Calendar,
  Monitor
} from "lucide-react"
import { RUNNING_SPEED_THRESHOLD, STOPPED_SPEED_THRESHOLD } from "@/lib/vehicleStatusUtils"

/**
 * SysConfigView - Redesigned System-Level Operational Configuration
 * Focus: Telemetry processing, status logic, and infrastructure health
 */
export function SysConfigView() {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSync, setLastSync] = useState(new Date().toLocaleTimeString())
  const [saved, setSaved] = useState(false)

  // System Parameters (Initialized with project constants where available)
  const [runningThreshold, setRunningThreshold] = useState(RUNNING_SPEED_THRESHOLD)
  const [offlineTimeout, setOfflineTimeout] = useState(15) // Minutes
  const [staleTimeout, setStaleTimeout] = useState(12) // Hours
  const [pollInterval, setPollInterval] = useState(10) // Seconds
  const [retentionPeriod, setRetentionPeriod] = useState(90) // Days

  const handleExecuteDiagnostics = () => {
    setIsSyncing(true)
    setTimeout(() => {
        setIsSyncing(false)
        setLastSync(new Date().toLocaleTimeString())
    }, 1200)
  }

  const handleApplyRules = () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex flex-col gap-10 p-8 h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto CustomScrollbar pb-16">
      
      {/* Infrastructure Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-[#1f3b1f] uppercase tracking-tight">System Infrastructure</h2>
          <p className="mt-1 text-sm font-bold text-slate-400">Low-level telemetry processing rules & architectural parameters</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="hidden md:flex flex-col items-end mr-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-[#38a63c]">Active Cluster Status</p>
                <p className="text-[11px] font-bold text-slate-400">Last Core Sync: {lastSync}</p>
            </div>
            <button 
                onClick={handleExecuteDiagnostics}
                className="group flex items-center justify-center h-12 w-12 rounded-2xl bg-white border border-[#dbe7d4] text-[#1f3b1f] hover:bg-[#f7fbf5] hover:border-[#38a63c]/30 transition-all active:scale-95 shadow-sm"
                title="Execute Cluster Diagnostics"
            >
                <RefreshCcw size={18} className={isSyncing ? "animate-spin text-[#38a63c]" : ""} />
            </button>
            <button 
                onClick={handleApplyRules}
                className={`flex items-center gap-2 rounded-2xl px-8 py-3.5 text-xs font-black uppercase tracking-widest transition-all ${
                    saved ? "bg-[#38a63c] text-white shadow-lg shadow-[#38a63c]/20" : "bg-[#1f3b1f] text-white hover:bg-black shadow-xl shadow-[#1f3b1f]/10"
                }`}
            >
                {saved ? <Check size={16} /> : <Save size={16} />}
                {saved ? "Rules Applied" : "Synchronize Logic"}
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Section: Live Tracking & Status Logic */}
        <TechnicalCard title="Operational Logic Rules" icon={Activity} color="#38a63c">
           <div className="space-y-1">
                <TechnicalRow 
                    label="Running Velocity Threshold" 
                    description="Speed at which vehicle transitions to 'Running' (Sync with Utils)"
                    value={`${runningThreshold} km/h`}
                    editable={false}
                    icon={Gauge}
                />
                <TechnicalSliderRow 
                    label="Device Offline Window" 
                    description="Duration of silence before marking device as 'Offline'"
                    value={offlineTimeout} 
                    unit="Min"
                    min={1} max={60}
                    onChange={setOfflineTimeout}
                    icon={WifiOff}
                />
                <TechnicalSliderRow 
                    label="Stale Record Expiry" 
                    description="Threshold to prune inactive map markers"
                    value={staleTimeout} 
                    unit="Hrs"
                    min={1} max={48}
                    onChange={setStaleTimeout}
                    icon={Clock}
                />
                <TechnicalRow 
                    label="Ignition State Weight" 
                    description="Priority of IGN signal over Accelerometer data"
                    value="Heavy (70/30)"
                    icon={Zap}
                />
           </div>
        </TechnicalCard>

        {/* Section: Telemetry / Packet Rules */}
        <TechnicalCard title="Telemetry Stream Processor" icon={Network} color="#4da2e9">
            <div className="space-y-1">
                <TechnicalSliderRow 
                    label="Global Polling Cadence" 
                    description="Default socket frequency for active tracking"
                    value={pollInterval} 
                    unit="Sec"
                    min={1} max={60}
                    onChange={setPollInterval}
                    icon={Timer}
                />
                <TechnicalRow 
                    label="Inbound Packet Protocol" 
                    description="Accepted binary/JSON telemetry formats"
                    value="Mixed (TCP/MQTT)"
                    icon={Database}
                />
                <TechnicalRow 
                    label="Reverse Geocode Mode" 
                    description="Strategy for address enrichment"
                    value="On-Packet + Cache"
                    icon={MapIcon}
                />
                <div className="mt-4 p-4 rounded-2xl bg-[#f7fbf5] border border-[#dbe7d4]">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck size={14} className="text-[#38a63c]" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#38a63c]">Validator Status</span>
                    </div>
                    <p className="text-xs font-bold text-slate-600 leading-tight">Checksum verification is ACTIVE for all hex-encoded packets from GT06/Coban protocols.</p>
                </div>
            </div>
        </TechnicalCard>

        {/* Section: Retention & Memory */}
        <TechnicalCard title="Data Persistence Cluster" icon={HardDrive} color="#f3a338">
            <div className="space-y-1">
                <TechnicalSliderRow 
                    label="Gps History Retention" 
                    description="Duration for keeping raw telemetry points in Hot-Storage"
                    value={retentionPeriod} 
                    unit="Days"
                    min={30} max={365}
                    onChange={setRetentionPeriod}
                    icon={Calendar}
                />
                <TechnicalRow 
                    label="Log Rotation Frequency" 
                    description="Server log archival schedule"
                    value="Every 24 Hours"
                    icon={RefreshCcw}
                />
                <TechnicalRow 
                    label="Index Optimization" 
                    description="Geospatial index maintenance status"
                    value="Automated (2:00 AM)"
                    icon={Settings2}
                />
            </div>
        </TechnicalCard>

        {/* Section: Environment Diagnostics */}
        <TechnicalCard title="Node Environment Hub" icon={Cpu} color="#1f3b1f">
           <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-[28px] bg-slate-50 border border-slate-100 flex flex-col justify-between">
                 <div className="flex items-center gap-2 mb-2">
                    <GitBranch size={16} className="text-slate-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Core Version</span>
                 </div>
                 <div>
                    <p className="text-2xl font-black text-[#1f3b1f]">v3.2.1-LTS</p>
                    <p className="text-[10px] font-black text-[#38a63c] uppercase mt-1">Stable Production</p>
                 </div>
              </div>
              <div className="p-5 rounded-[28px] bg-slate-50 border border-slate-100 flex flex-col justify-between">
                 <div className="flex items-center gap-2 mb-2">
                    <Wifi size={16} className="text-[#38a63c]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#38a63c]">Inbound Stream</span>
                 </div>
                 <div>
                    <p className="text-2xl font-black text-[#1f3b1f]">12.8 Mbps</p>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Telemetry Load</p>
                 </div>
              </div>
              <div className="col-span-2 p-5 rounded-[28px] bg-[#1f3b1f] text-white flex items-center justify-between overflow-hidden relative">
                 <div className="relative z-10">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">System Security State</p>
                    <p className="text-xl font-black mt-1">AES-256 E2EE Enabled</p>
                 </div>
                 <Lock className="absolute -bottom-2 -right-2 h-16 w-16 opacity-10 rotate-12" />
              </div>
           </div>
        </TechnicalCard>

      </div>
    </div>
  )
}

function TechnicalCard({ title, icon: Icon, color, children }: { title: string, icon: any, color: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-[32px] border border-[#dbe7d4] bg-white p-8 shadow-sm transition-all ring-1 ring-black/5">
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
           <div className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: color }}>
             <Icon size={20} />
           </div>
           <h4 className="text-sm font-black text-[#1f3b1f] uppercase tracking-tight leading-none">{title}</h4>
        </div>
        <div className="h-1.5 w-1.5 rounded-full bg-[#38a63c] shadow-[0_0_8px_#38a63c]" />
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}

function TechnicalRow({ label, description, value, icon: Icon, editable = true }: { label: string, description: string, value: string, icon: any, editable?: boolean }) {
  return (
    <div className="flex items-start justify-between py-5 border-b border-slate-50 last:border-0 group">
       <div className="flex gap-4">
          <div className="mt-1 h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#f7fbf5] group-hover:text-[#38a63c] transition-all">
             <Icon size={14} />
          </div>
          <div>
            <p className="text-xs font-black text-[#1f3b1f] uppercase tracking-tight">{label}</p>
            <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-tight">{description}</p>
          </div>
       </div>
       <div className="flex items-center gap-2">
          <span className={`px-4 py-2 rounded-xl border text-xs font-black transition-all ${
            editable ? "bg-[#f7fbf5] border-[#dbe7d4] text-[#1f3b1f]" : "bg-slate-50 border-slate-100 text-slate-400"
          }`}>
            {value}
          </span>
       </div>
    </div>
  )
}

function TechnicalSliderRow({ label, description, value, unit, min, max, onChange, icon: Icon }: { label: string, description: string, value: number, unit: string, min: number, max: number, onChange: (v: number) => void, icon: any }) {
    return (
        <div className="flex flex-col py-5 border-b border-slate-50 last:border-0 group">
           <div className="flex items-start justify-between mb-4">
                <div className="flex gap-4">
                    <div className="mt-1 h-8 w-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#f7fbf5] group-hover:text-[#38a63c] transition-all">
                        <Icon size={14} />
                    </div>
                    <div>
                        <p className="text-xs font-black text-[#1f3b1f] uppercase tracking-tight">{label}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-0.5 leading-tight">{description}</p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1f3b1f] text-white">
                    <span className="text-xs font-black">{value}</span>
                    <span className="text-[9px] font-black uppercase opacity-60 tracking-widest">{unit}</span>
                </div>
           </div>
           <div className="flex items-center gap-4 px-1">
                <span className="text-[9px] font-bold text-slate-300 uppercase">{min}</span>
                <input 
                    type="range" 
                    min={min} 
                    max={max} 
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="flex-1 h-1 bg-[#edf3e8] rounded-lg appearance-none cursor-pointer accent-[#38a63c]" 
                />
                <span className="text-[9px] font-bold text-slate-300 uppercase">{max}</span>
           </div>
        </div>
    )
}

// Sub-component proxy for Map icon since Map is a reserved name
function MapIcon({ size, className }: { size: number, className: string }) {
    return <Monitor size={size} className={className} />
}
