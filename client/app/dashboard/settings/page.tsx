"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    Bell,
    Globe,
    Shield,
    ArrowLeft,
    Save,
    Loader2,
    AlertTriangle,
    CheckCircle2,
    ChevronRight,
} from "lucide-react"
import { toast } from "sonner"
import { Header } from "@/components/dashboard/header"
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper"
import { useGetMeQuery } from "@/redux/api/usersApi"

// ─── Toggle component ─────────────────────────────────────────────────────────
function Toggle({
    label,
    description,
    checked,
    onChange,
}: {
    label: string
    description: string
    checked: boolean
    onChange: (v: boolean) => void
}) {
    return (
        <div className="flex items-center justify-between rounded-[20px] border border-[#dbe7d4] bg-white px-5 py-4 hover:border-[#38a63c]/30 transition-all shadow-sm">
            <div className="space-y-0.5">
                <p className="text-sm font-bold text-slate-800">{label}</p>
                <p className="text-xs font-medium text-slate-500">{description}</p>
            </div>
            <button
                type="button"
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${checked ? "bg-[#38a63c]" : "bg-slate-200"}`}
                role="switch"
                aria-checked={checked}
            >
                <span
                    className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-md transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
                />
            </button>
        </div>
    )
}

// ─── Section card ─────────────────────────────────────────────────────────────
function SectionCard({
    icon: Icon,
    iconColor,
    title,
    children,
}: {
    icon: React.ElementType
    iconColor: string
    title: string
    children: React.ReactNode
}) {
    return (
        <div className="rounded-[24px] border border-[#dbe7d4] bg-white overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 border-b border-[#dbe7d4] px-6 py-4 bg-[#f7fbf5]">
                <div className={`rounded-xl p-2.5 ${iconColor} shadow-inner`}>
                    <Icon className="h-4.5 w-4.5" />
                </div>
                <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#2f8d35]">{title}</h2>
            </div>
            <div className="p-6 space-y-4">{children}</div>
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardSettingsPage() {
    const router = useRouter()
    const [isAuthed, setIsAuthed] = useState(false)

    // Notification preferences (client-side for now — extend with backend as needed)
    const [pushNotifications, setPushNotifications] = useState(true)
    const [emailAlerts, setEmailAlerts] = useState(true)
    const [smsGateway, setSmsGateway] = useState(false)
    const [soundAlerts, setSoundAlerts] = useState(true)

    // App preferences
    const [darkMode, setDarkMode] = useState(true)
    const [autoRefresh, setAutoRefresh] = useState(true)
    const [compactView, setCompactView] = useState(false)

    const [isSaving, setIsSaving] = useState(false)

    const { data: meData } = useGetMeQuery(undefined)
    const user = (meData as { data?: Record<string, unknown> } | null)?.data

    // Auth guard
    useEffect(() => {
        const token = getSecureItem("token")
        const role = getSecureItem("userRole")
        if (!token) { router.replace("/"); return }
        if (role && ["admin", "manager", "driver"].includes(role)) {
            setIsAuthed(true)
        } else {
            router.replace("/")
        }
    }, [router])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            // Persist to localStorage as user preferences
            const prefs = {
                pushNotifications,
                emailAlerts,
                smsGateway,
                soundAlerts,
                darkMode,
                autoRefresh,
                compactView,
            }
            if (typeof window !== "undefined") {
                localStorage.setItem("dashboardPrefs", JSON.stringify(prefs))
            }
            await new Promise((resolve) => setTimeout(resolve, 400)) // simulate async
            toast.success("Settings saved successfully")
        } catch {
            toast.error("Failed to save settings")
        } finally {
            setIsSaving(false)
        }
    }

    const handleDiscard = () => {
        try {
            if (typeof window !== "undefined") {
                const saved = localStorage.getItem("dashboardPrefs")
                if (saved) {
                    const prefs = JSON.parse(saved)
                    setPushNotifications(prefs.pushNotifications ?? true)
                    setEmailAlerts(prefs.emailAlerts ?? true)
                    setSmsGateway(prefs.smsGateway ?? false)
                    setSoundAlerts(prefs.soundAlerts ?? true)
                    setDarkMode(prefs.darkMode ?? true)
                    setAutoRefresh(prefs.autoRefresh ?? true)
                    setCompactView(prefs.compactView ?? false)
                }
            }
        } catch {
            // ignore
        }
        toast.message("Changes discarded")
    }

    if (!isAuthed) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-white text-slate-400">
                Checking session…
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col bg-white text-slate-800">
            <Header vehicleSummary={{ label: "Settings", speed: 0 }} />

            <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
                <div className="mx-auto max-w-5xl">
                    {/* Breadcrumb */}
                    <div className="mb-6 flex items-center gap-2">
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-[#38a63c] transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Dashboard
                        </button>
                        <span className="text-slate-200">/</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-900">Settings</span>
                    </div>

                    {/* Title */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-black text-[#1f3b1f] tracking-tight">Configuration</h1>
                        <p className="mt-1 text-sm font-medium text-slate-500">Manage your system preferences and notification triggers.</p>
                    </div>

                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                        {/* ── Main settings (2/3 width) ── */}
                        <div className="space-y-8 lg:col-span-2">
                            {/* Notification Channels */}
                            <SectionCard icon={Bell} iconColor="bg-amber-500/10 text-amber-600" title="Alert Notifications">
                                <Toggle
                                    label="Push Notifications"
                                    description="Receive critical alerts directly on your browser"
                                    checked={pushNotifications}
                                    onChange={setPushNotifications}
                                />
                                <Toggle
                                    label="Email Reports"
                                    description="Automated summary reports delivered to your inbox"
                                    checked={emailAlerts}
                                    onChange={setEmailAlerts}
                                />
                                <Toggle
                                    label="SMS Alerts"
                                    description="High-priority instant notification via text"
                                    checked={smsGateway}
                                    onChange={setSmsGateway}
                                />
                                <Toggle
                                    label="Audio Feedback"
                                    description="Play distinct alert sounds for important events"
                                    checked={soundAlerts}
                                    onChange={setSoundAlerts}
                                />
                            </SectionCard>

                            {/* App Preferences */}
                            <SectionCard icon={Globe} iconColor="bg-blue-500/10 text-blue-600" title="Interface Settings">
                                <Toggle
                                    label="Dark Interface"
                                    description="Switch to dark layout for reduced eye strain"
                                    checked={darkMode}
                                    onChange={setDarkMode}
                                />
                                <Toggle
                                    label="Real-time Polling"
                                    description="Live continuous updates of vehicle coordinates"
                                    checked={autoRefresh}
                                    onChange={setAutoRefresh}
                                />
                                <Toggle
                                    label="Compact Data Rows"
                                    description="Optimize grid visibility for large fleet tables"
                                    checked={compactView}
                                    onChange={setCompactView}
                                />
                            </SectionCard>
                        </div>

                        {/* ── Sidebar: Account + Status ── */}
                        <div className="space-y-8">
                            {/* Account summary */}
                            <div className="rounded-[24px] border border-[#dbe7d4] bg-white p-6 space-y-5 shadow-sm">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#2f8d35]">
                                    <Shield className="h-4 w-4" />
                                    Active Session
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#f7fbf5] border border-[#38a63c]/20 text-lg font-black text-[#2f8d35] shrink-0">
                                        {((user?.firstName as string) || "U").charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-black text-[#1f3b1f] truncate leading-none mb-1">
                                            {`${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Account User"}
                                        </p>
                                        <p className="text-xs font-medium text-slate-400 truncate">{(user?.email as string) || "user@example.com"}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push("/dashboard/profile")}
                                    className="flex w-full items-center justify-between rounded-2xl bg-[#f7fbf5] border border-[#dbe7d4] px-4 py-3 text-xs font-bold text-[#2f8d35] hover:bg-[#ecf8ea] transition-all active:scale-95"
                                >
                                    Modify Profile
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            </div>

                            {/* System Status */}
                            <div className="rounded-[24px] border border-[#dbe7d4] bg-[#f7fbf5] p-6 space-y-4 shadow-sm">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#2f8d35]">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Platform Engine
                                </div>
                                <div className="space-y-4 pt-1">
                                    {[
                                        { label: "Core Version", value: "v2.5.0" },
                                        { label: "Stability", value: "Standard" },
                                    ].map((item) => (
                                        <div key={item.label} className="flex justify-between border-b border-[#dbe7d4]/50 pb-3">
                                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{item.label}</span>
                                            <span className="text-xs font-black text-slate-700">{item.value}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Operational</span>
                                        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#38a63c]/20 text-[10px] font-black text-[#38a63c]">
                                            <span className="h-2 w-2 rounded-full bg-[#38a63c] animate-pulse" />
                                            Active
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Danger zone */}
                            <div className="rounded-[24px] border border-red-100 bg-red-50/30 p-6 shadow-sm">
                                <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-red-500 mb-4">
                                    <AlertTriangle className="h-4 w-4" />
                                    Security Actions
                                </div>
                                <p className="text-xs font-medium text-slate-500 mb-5 leading-relaxed">
                                    Maintenance mode immediately terminates all active fleet monitoring sessions.
                                </p>
                                <button
                                    onClick={() => {
                                        if (window.confirm("Enable maintenance mode? This will disconnect all active sessions.")) {
                                            toast.warning("Maintenance mode enabled")
                                        }
                                    }}
                                    className="w-full rounded-2xl border border-red-200 bg-white py-3 text-[10px] font-black uppercase tracking-[0.16em] text-red-600 hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-sm"
                                >
                                    Force Stop Engine
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Save/Discard bar */}
                    <div className="mt-12 flex items-center justify-end gap-4 border-t border-[#dbe7d4] pt-8">
                        <button
                            type="button"
                            onClick={handleDiscard}
                            className="rounded-2xl border border-[#dbe7d4] bg-[#f7fbf5] px-8 py-3.5 text-sm font-bold text-slate-600 hover:bg-[#ecf8ea] hover:text-[#2f8d35] transition-all active:scale-95"
                        >
                            Reset Defaults
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 rounded-2xl bg-[#38a63c] px-10 py-3.5 text-sm font-black text-white hover:bg-[#2f8d35] transition-all shadow-lg shadow-[#38a63c]/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            {isSaving ? (
                                <><Loader2 className="h-4 w-4 animate-spin" />Saving Info…</>
                            ) : (
                                <><Save className="h-5 w-5" />Apply Settings</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
