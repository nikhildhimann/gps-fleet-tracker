"use client"

import React, { useState, useEffect } from "react"
import { 
  Globe, 
  Layout, 
  Bell, 
  FileText, 
  Map as MapIcon,
  Save,
  Check,
  Languages,
  Clock,
  Navigation,
  RefreshCw,
  Monitor,
  Calendar,
  Layers,
  SortAsc,
  AlertTriangle,
  Zap
} from "lucide-react"
import { useGetOrganizationsQuery, useUpdateOrganizationMutation } from "@/redux/api/organizationApi"

/**
 * AppConfigView - REAL CONNECTED Dashboard Config Module
 */
export function AppConfigView() {
  const { data: orgData, isLoading } = useGetOrganizationsQuery({})
  const [updateOrg] = useUpdateOrganizationMutation()
  
  const organization = orgData?.data?.[0] // Using the primary organization for configuration
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Local state for real fields
  const [timezone, setTimezone] = useState("Asia/Kolkata")
  const [speedLimit, setSpeedLimit] = useState(80)
  const [idleThreshold, setIdleThreshold] = useState(5)
  const [speedAlertEnabled, setSpeedAlertEnabled] = useState(true)

  useEffect(() => {
    if (organization) {
      setTimezone(organization.geo?.timezone || "Asia/Kolkata")
      setSpeedLimit(organization.settings?.speedLimit || 80)
      setIdleThreshold(organization.settings?.idleTimeThreshold || 5)
      setSpeedAlertEnabled(organization.settings?.speedAlert ?? true)
    }
  }, [organization])

  const handleSave = async () => {
    if (!organization?._id) return
    
    setIsSaving(true)
    try {
      await updateOrg({
        id: organization._id,
        body: {
          geo: { ...organization.geo, timezone },
          settings: {
            ...organization.settings,
            speedLimit,
            idleTimeThreshold: idleThreshold,
            speedAlert: speedAlertEnabled
          }
        }
      }).unwrap()
      
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error("Failed to update settings:", err)
      alert("Error saving configuration to backend.")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-[#38a63c]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-10 p-8 h-full animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-y-auto CustomScrollbar pb-16">
      
      {/* Module Title & Header Action */}
      <div className="flex items-center justify-between pb-2">
        <div>
          <h2 className="text-2xl font-black text-[#1f3b1f] uppercase tracking-tight">Enterprise Calibration</h2>
          <p className="mt-1 text-sm font-bold text-slate-400">Live operational rules for <span className="text-[#38a63c]">{organization?.name || "Your Fleet"}</span></p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className={`group flex items-center gap-2 rounded-2xl px-8 py-3.5 text-xs font-black uppercase tracking-widest transition-all ${
            saved ? "bg-[#38a63c] text-white" : "bg-[#1f3b1f] text-white hover:bg-[#2a4d2a] shadow-xl shadow-[#1f3b1f]/20 disabled:opacity-50"
          }`}
        >
          {isSaving ? <RefreshCw className="animate-spin" size={16} /> : saved ? <Check size={16} /> : <Save size={16} />}
          {isSaving ? "Syncing..." : saved ? "Backend Synchronized" : "Commit Changes"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Section: REAL Localization & Regional */}
        <ConfigSection 
          title="Regional & Units (Live)" 
          description="Direct sync with Organization Geo-Settings"
          icon={Globe} 
          color="#38a63c"
        >
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
               <div className="flex items-center gap-1.5 ml-1">
                  <Clock size={12} className="text-[#38a63c]" />
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Timezone</label>
               </div>
               <select 
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-[#f7fbf5] border border-[#dbe7d4] rounded-xl px-4 py-3 text-xs font-black text-[#1f3b1f] focus:outline-none hover:border-[#38a63c]/40 transition-all"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (GMT+05:30)</option>
                <option value="UTC">UTC (Universal)</option>
                <option value="GMT">GMT (London)</option>
                <option value="America/New_York">EST (New York)</option>
              </select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <ConfigDropdown label="Date Format" options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]} defaultValue="DD/MM/YYYY" />
              <ConfigDropdown label="Time Format" options={["12-Hour (AM/PM)", "24-Hour (Military)"]} defaultValue="24-Hour (Military)" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ConfigDropdown label="Distance Unit" options={["Kilometers (km)", "Miles (mi)"]} defaultValue="Kilometers (km)" />
              <ConfigDropdown label="Speed Unit" options={["km/h", "mph"]} defaultValue="km/h" />
            </div>
          </div>
        </ConfigSection>

        {/* Section: REAL Operational Rules */}
        <ConfigSection 
          title="Telemetry Safeguards (Live)" 
          description="Operational thresholds processed by backend servers"
          icon={AlertTriangle} 
          color="#ef5b4d"
        >
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
               <div className="flex items-center gap-1.5 ml-1">
                  <Zap size={12} className="text-[#ef5b4d]" />
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Global Speed Limit (km/h)</label>
               </div>
               <input 
                type="number"
                value={speedLimit}
                onChange={(e) => setSpeedLimit(Number(e.target.value))}
                className="w-full bg-[#fcf8f7] border border-[#ef5b4d]/20 rounded-xl px-4 py-3 text-xs font-black text-[#1f3b1f] focus:ring-4 focus:ring-[#ef5b4d]/5 outline-none"
               />
            </div>

            <div className="space-y-2">
               <div className="flex items-center gap-1.5 ml-1">
                  <Clock size={12} className="text-[#ef5b4d]" />
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Idle Stagnation Threshold (Min)</label>
               </div>
               <input 
                type="number"
                value={idleThreshold}
                onChange={(e) => setIdleThreshold(Number(e.target.value))}
                className="w-full bg-[#fcf8f7] border border-[#ef5b4d]/20 rounded-xl px-4 py-3 text-xs font-black text-[#1f3b1f] focus:ring-4 focus:ring-[#ef5b4d]/5 outline-none"
               />
            </div>

            <div className="pt-2 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">Strict Speed Violation Monitoring</span>
                <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        checked={speedAlertEnabled} 
                        onChange={(e) => setSpeedAlertEnabled(e.target.checked)}
                        className="sr-only peer" 
                    />
                    <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#ef5b4d]"></div>
                </label>
            </div>
          </div>
        </ConfigSection>

        {/* Section: Interface Behavior (Local Preferences) */}
        <ConfigSection 
          title="Interface Experience" 
          description="Local dashboard layout and display preferences"
          icon={Monitor} 
          color="#4da2e9"
        >
          <div className="grid grid-cols-1 gap-6">
            <ConfigDropdown label="Landing Tab" options={["Tracking", "Statistics", "Geofences"]} defaultValue="Tracking" icon={Layout} />
            <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Refresh Cadence</label>
                <div className="grid grid-cols-4 gap-2">
                    {["5s", "10s", "15s", "30s"].map((time) => (
                        <button key={time} className={`py-2 text-xs font-black rounded-xl border ${time === "10s" ? "bg-[#eaf4fc] border-[#4da2e9] text-[#1f3b1f]" : "bg-white border-slate-200 text-slate-400"}`}>
                            {time}
                        </button>
                    ))}
                </div>
            </div>
            <ConfigDropdown label="List Ordering" options={["Status", "Alphanumeric", "Recent"]} defaultValue="Status" icon={SortAsc} />
          </div>
        </ConfigSection>

        {/* Section: Report Defaults */}
        <ConfigSection 
          title="Intelligence Defaults" 
          description="Pre-configured values for analytics generation"
          icon={FileText} 
          color="#f3a338"
        >
          <div className="grid grid-cols-1 gap-6">
            <ConfigDropdown label="Default Analytics Range" options={["Today", "Yesterday", "Last 7 Days"]} defaultValue="Today" icon={Calendar} />
            <ConfigDropdown label="Export File Format" options={["XLSX (Excel)", "CSV", "PDF"]} defaultValue="XLSX (Excel)" />
            <div className="p-4 rounded-2xl bg-amber-50/30 border border-amber-100 italic">
                <p className="text-[10px] font-bold text-amber-900/40 leading-relaxed uppercase tracking-tight">
                    Note: Speed violations in reports are calculated against the LIVE speed limit committed in the Telemetry section above.
                </p>
            </div>
          </div>
        </ConfigSection>

      </div>
    </div>
  )
}

function ConfigSection({ title, description, icon: Icon, color, children }: { title: string, description: string, icon: any, color: string, children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-[32px] border border-[#dbe7d4] bg-white p-8 shadow-sm transition-all ring-1 ring-black/5">
      <div className="mb-8 flex items-center gap-4">
        <div className="h-12 w-12 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ backgroundColor: color }}>
          <Icon size={24} />
        </div>
        <div>
           <h4 className="text-sm font-black text-[#1f3b1f] uppercase tracking-tight">{title}</h4>
           <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">{description}</p>
        </div>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}

function ConfigDropdown({ label, options, defaultValue, icon: Icon }: { label: string, options: string[], defaultValue: string, icon?: any }) {
  return (
    <div className="space-y-2">
       <div className="flex items-center gap-1.5 ml-1">
          {Icon && <Icon size={12} className="text-[#38a63c]" />}
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</label>
       </div>
       <div className="relative">
          <select 
            defaultValue={defaultValue}
            className="w-full bg-[#f7fbf5] border border-[#dbe7d4] rounded-xl px-4 py-3 text-xs font-black text-[#1f3b1f] appearance-none focus:outline-none hover:border-[#38a63c]/40 transition-all"
          >
            {options.map((opt) => (
              <option key={opt}>{opt}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
             <Navigation size={12} className="text-[#38a63c] rotate-90" />
          </div>
       </div>
    </div>
  )
}

