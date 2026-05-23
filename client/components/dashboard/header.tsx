"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Calendar, Car, ChevronDown, ChevronRight, Clock, Clock3, History, LayoutDashboard, LogOut, Menu, MessageSquare, Settings, AlertTriangle, User, Settings2, Bell } from "lucide-react"
import { useRouter } from "next/navigation"
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper"
import { NotificationDropdown } from "@/components/dashboard/NotificationDropdown"
import { useGetNotificationCountsQuery } from "@/redux/api/notificationsApi"
import { useGetMeQuery } from "@/redux/api/usersApi"
import { baseApi } from "@/redux/api/baseApi"
import { useDispatch } from "react-redux"
import { Badge } from "@/components/ui/badge"
import { setActiveTab } from "@/redux/features/vehicleSlice"

type HeaderUser = {
    organizationId?: {
        logo?: string
    }
}

type HeaderMenuItem = {
    label: string
    href?: string
    tabName?: string
    icon: typeof LayoutDashboard
}

type HeaderMenuSection = {
    id: string
    label: string
    items: HeaderMenuItem[]
}

function ProfileDropdown({
    isOpen,
    displayName,
    email,
    role,
    user,
    onProfile,
    onSettings,
    onLogout,
}: {
    isOpen: boolean
    displayName: string
    email: string
    role: string
    user?: HeaderUser
    onProfile: () => void
    onSettings: () => void
    onLogout: () => void
}) {
    if (!isOpen) return null

    return (
        <div className="absolute right-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-[24px] border border-[#d8e6d2] bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-[#e8f1e3] bg-[#f6fbf4] px-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-[#cfe3c9] bg-white">
                    {user?.organizationId?.logo ? (
                        <img
                            src={`http://localhost:5000${user.organizationId.logo}`}
                            alt="Org Logo"
                            className="h-full w-full object-contain p-1"
                        />
                    ) : (
                        <span className="text-base font-black text-[#225c28]">{displayName.charAt(0).toUpperCase()}</span>
                    )}
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-black text-slate-900">{displayName}</p>
                    <p className="truncate text-xs text-slate-500">{email}</p>
                    <span className="mt-1 inline-flex rounded-full bg-[#ecf8ea] px-2 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#2f8d35]">
                        {role}
                    </span>
                </div>
            </div>

            <div className="p-2">
                <button onClick={onProfile} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#f5faf3]">
                    <User className="h-4 w-4 text-[#38a63c]" />
                    My Profile
                </button>
                <button onClick={onSettings} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-slate-700 transition hover:bg-[#f5faf3]">
                    <Settings className="h-4 w-4 text-[#38a63c]" />
                    Settings
                </button>
                <button onClick={onLogout} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50">
                    <LogOut className="h-4 w-4" />
                    Logout
                </button>
            </div>
        </div>
    )
}

function LogoutConfirmModal({
    isOpen,
    onConfirm,
    onCancel,
}: {
    isOpen: boolean
    onConfirm: () => void
    onCancel: () => void
}) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-all duration-300">
            <div className="w-full max-w-sm rounded-[32px] border border-[#dbe7d4] bg-white p-8 shadow-2xl animate-in zoom-in duration-200">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
                    <AlertTriangle className="h-8 w-8" />
                </div>
                <div className="mt-6 text-center">
                    <h3 className="text-xl font-black text-slate-900 tracking-tight">Are you sure?</h3>
                    <p className="mt-2 text-sm text-slate-500 font-medium">You are about to sign out and end your active session.</p>
                </div>
                <div className="mt-8 flex flex-col gap-3">
                    <button
                        onClick={onConfirm}
                        className="w-full rounded-2xl bg-[#ea4335] py-4 text-sm font-bold text-white transition hover:bg-[#d93025] hover:shadow-lg active:scale-95 shadow-md shadow-red-500/10"
                    >
                        Sign Out
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full rounded-2xl border border-[#dbe7d4] bg-[#f7fbf5] py-4 text-sm font-bold text-slate-600 transition hover:bg-[#ecf8ea] hover:text-[#2f8d35] active:scale-95"
                    >
                        Keep me logged in
                    </button>
                </div>
            </div>
        </div>
    )
}

export function Header({
    vehicleSummary,
}: {
    vehicleSummary?: { label: string; speed: number }
}) {
    const [showProfileDropdown, setShowProfileDropdown] = useState(false)
    const [showStaticsDropdown, setShowStaticsDropdown] = useState(false)
    const [showNotifications, setShowNotifications] = useState(false)
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
    const [activeMenuSection, setActiveMenuSection] = useState("statistics")
    const [now, setNow] = useState(() => new Date())
    const [userRole, setUserRole] = useState<string | null>(null)
    const router = useRouter()
    const dispatch = useDispatch()
    const profileRef = useRef<HTMLDivElement>(null)
    const staticsRef = useRef<HTMLDivElement>(null)
    const notifRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        setUserRole(getSecureItem("userRole"))
    }, [])

    const { data: meData } = useGetMeQuery(undefined, { refetchOnMountOrArgChange: true })
    const { data: notificationCounts } = useGetNotificationCountsQuery(undefined, {
        pollingInterval: 30000,
        refetchOnMountOrArgChange: true,
    })
    const user = meData?.data
    const displayName = useMemo(() => {
        if (!user) return "User"
        return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "User"
    }, [user])
    const email = user?.email || ""
    const role = user?.role || userRole || "user"
    const normalizedRole = String(role).toLowerCase()
    const canOpenStatics = normalizedRole === "admin" || normalizedRole === "manager" || normalizedRole === "subadmin"
    const unreadCount = notificationCounts?.unread || notificationCounts?.data?.unread || 0
    const headerMenuSections = useMemo<HeaderMenuSection[]>(() => {
        const sections: HeaderMenuSection[] = []

        const monitorItems: HeaderMenuItem[] = []
        if (normalizedRole === "admin") {
            monitorItems.push(
                { label: "Dashboard Overview", href: "/admin", icon: LayoutDashboard },
                { label: "Live Tracking", href: "/dashboard", icon: Car }
            )
        }
        monitorItems.push(
            { label: "History Playback", href: "/admin/history", icon: History },
            { label: "Daily Status", href: "/admin/daily-status", icon: Clock3 }
        )

        sections.push({
            id: "monitor",
            label: "Monitor",
            items: monitorItems,
        })

        sections.push({
            id: "statistics",
            label: "Statistics",
            items: [
                { label: "Travel Summary", tabName: "Travel Summary", icon: LayoutDashboard },
                { label: "Trip Summary", tabName: "Trip Summary", icon: LayoutDashboard },
                { label: "AC Summary", tabName: "AC Summary", icon: LayoutDashboard },
                { label: "Vehicle Status", tabName: "Vehicle Status", icon: LayoutDashboard },
                { label: "Alert Summary", tabName: "Alert Summary", icon: LayoutDashboard },
                { label: "Daywise Distance", tabName: "Daywise Distance", icon: LayoutDashboard },
            ],
        })

        sections.push({
            id: "configuration",
            label: "Configuration",
            items: [
                { label: "Dashboard Settings", href: "/dashboard/settings", icon: Settings },
            ],
        })

        sections.push({
            id: "user-rights",
            label: "User Rights",
            items: [
                { label: "My Profile", href: "/dashboard/profile", icon: User },
            ],
        })

        return sections
    }, [normalizedRole])
    const activeSection = headerMenuSections.find((section) => section.id === activeMenuSection) || headerMenuSections[0]

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000)
        return () => clearInterval(interval)
    }, [])

    useEffect(() => {
        if (!headerMenuSections.some((section) => section.id === activeMenuSection) && headerMenuSections[0]) {
            setActiveMenuSection(headerMenuSections[0].id)
        }
    }, [activeMenuSection, headerMenuSections])

    useEffect(() => {
        function handler(e: MouseEvent) {
            if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
                setShowProfileDropdown(false)
            }
            if (staticsRef.current && !staticsRef.current.contains(e.target as Node)) {
                setShowStaticsDropdown(false)
            }
            if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
                setShowNotifications(false)
            }
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    const dateLabel = useMemo(
        () =>
            now.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "2-digit",
                month: "long",
                year: "numeric",
            }),
        [now]
    )
    const timeLabel = useMemo(
        () =>
            now.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true,
            }),
        [now]
    )

    const handleLogout = async () => {
        try {
            await fetch("http://localhost:5000/api/users/logout", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${getSecureItem("token")}`,
                },
            })
        } catch {
        } finally {
            if (typeof window !== "undefined") {
                localStorage.clear()
                sessionStorage.clear()
                dispatch(baseApi.util.resetApiState())
            }
            setShowLogoutConfirm(false)
            router.replace("/")
        }
    }

    return (
        <header className="sticky top-0 z-30 border-b border-[#2f8d35]/15 bg-[#38a63c] text-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => router.push("/dashboard")}
                        className="flex items-center gap-3"
                    >
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-white shadow-sm">
                            {user?.organizationId?.logo ? (
                                <img
                                    src={`http://localhost:5000${user.organizationId.logo}`}
                                    alt="Logo"
                                    className="h-full w-full object-contain p-1"
                                />
                            ) : (
                                <span className="text-lg font-black text-[#225c28]">AT</span>
                            )}
                        </div>
                        <div className="text-left">
                            <p className="text-2xl font-black tracking-tight">AjivaTracker</p>
                            <p className="text-xs font-semibold text-white/80">Fleet Intelligence</p>
                        </div>
                    </button>

                    {canOpenStatics && (
                        <div className="flex items-center gap-4 ml-4">
                            <div ref={staticsRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowStaticsDropdown((prev) => !prev)}
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white transition hover:bg-white/15"
                                    aria-label="Open quick menu"
                                >
                                    <Menu className="h-5 w-5" />
                                </button>
                                {showStaticsDropdown && (
                                    <div className="absolute left-0 top-full z-50 mt-3 flex overflow-hidden rounded-md border border-[#d9d9d9] bg-white shadow-2xl">
                                        <div className="w-[156px] border-r border-[#d9d9d9] bg-[#f7f7f7] py-1">
                                            {headerMenuSections.map((section) => {
                                                const isActive = activeSection?.id === section.id
                                                return (
                                                    <button
                                                        key={section.id}
                                                        type="button"
                                                        onMouseEnter={() => setActiveMenuSection(section.id)}
                                                        onFocus={() => setActiveMenuSection(section.id)}
                                                        onClick={() => setActiveMenuSection(section.id)}
                                                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs ${isActive
                                                            ? "bg-white text-[#2f8d35]"
                                                            : "text-slate-600 hover:bg-white hover:text-[#2f8d35]"
                                                            }`}
                                                    >
                                                        <span>{section.label}</span>
                                                        <ChevronRight className="h-3.5 w-3.5" />
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        <div className="w-[220px] bg-white py-1">
                                            {activeSection?.items.map((item) => (
                                                <button
                                                    key={item.href || item.tabName}
                                                    type="button"
                                                    onClick={() => {
                                                        setShowStaticsDropdown(false)
                                                        if (item.tabName) {
                                                            dispatch(setActiveTab(item.tabName))
                                                        } else if (item.href) {
                                                            router.push(item.href)
                                                        }
                                                    }}
                                                    className="flex w-full items-center gap-2 border-b border-[#ececec] px-3 py-2 text-left text-xs text-slate-600 transition last:border-b-0 hover:bg-[#f5faf3] hover:text-[#2f8d35]"
                                                >
                                                    <item.icon className="h-3.5 w-3.5 text-[#38a63c]" />
                                                    <span>{item.label}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="hidden flex-1 items-center justify-center gap-3 xl:flex">
                    <div className="flex h-[48px] items-center gap-1 px-5 rounded-full border border-white/30 bg-[#2f8d35] text-[11px] font-black uppercase tracking-tight shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">
                        <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 opacity-80" />
                            <span className="whitespace-nowrap">{dateLabel}</span>
                        </div>
                        <span className="mx-3 opacity-20">|</span>
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 opacity-80" />
                            <span className="whitespace-nowrap">{timeLabel}</span>
                        </div>
                        <span className="mx-3 opacity-20">|</span>
                        <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 opacity-80" />
                            <span className="whitespace-nowrap">{vehicleSummary?.label || "Vehicle"} ; {vehicleSummary?.speed || 0} km/h</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative" ref={notifRef}>
                        <button
                            onClick={() => setShowNotifications(!showNotifications)}
                            className="relative rounded-2xl border border-white/25 bg-white/10 p-2.5 text-white shadow-sm transition-colors hover:bg-white/15"
                            title="Notifications"
                        >
                            <Bell size={20} />
                            {unreadCount > 0 && (
                                <Badge 
                                    variant="default" 
                                    className="absolute -top-1 -right-1 min-w-[20px] h-5 text-xs font-bold bg-red-600 text-white flex items-center justify-center"
                                >
                                    {unreadCount > 99 ? '99+' : unreadCount}
                                </Badge>
                            )}
                        </button>

                        <NotificationDropdown 
                            isOpen={showNotifications} 
                            onClose={() => setShowNotifications(false)} 
                        />
                    </div>

                    <div ref={profileRef} className="relative">
                        <button
                            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                            className={`flex items-center gap-2 rounded-full border px-2 py-1 transition-all ${showProfileDropdown 
                                ? 'border-white bg-white/20' 
                                : 'border-white/25 bg-white/10 hover:bg-white/15'
                            }`}
                        >
                            <div className="h-9 w-9 rounded-full bg-[#0076bb] border-2 border-white shadow-sm overflow-hidden flex items-center justify-center">
                                {user?.organizationId?.logo ? (
                                    <img
                                        src={`http://localhost:5000${user.organizationId.logo}`}
                                        alt="Avatar"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <span className="font-bold text-white uppercase">{displayName.charAt(0)}</span>
                                )}
                            </div>
                            <div className="hidden lg:flex items-center text-left text-xs text-white">
                                <div className="flex flex-col">
                                    <span className="font-black text-[10px] uppercase tracking-wider opacity-70 leading-none mb-0.5">Account</span>
                                    <span className="font-bold leading-none">{displayName}</span>
                                </div>
                                <ChevronDown className={`ml-2 h-4 w-4 transition-transform ${showProfileDropdown ? 'rotate-180' : ''}`} />
                            </div>
                        </button>

                        <ProfileDropdown
                            isOpen={showProfileDropdown}
                            displayName={displayName}
                            email={email}
                            role={role}
                            user={user}
                            onProfile={() => {
                                router.push("/dashboard/profile")
                                setShowProfileDropdown(false)
                            }}
                            onSettings={() => {
                                router.push("/dashboard/settings")
                                setShowProfileDropdown(false)
                            }}
                            onLogout={() => {
                                setShowLogoutConfirm(true)
                                setShowProfileDropdown(false)
                            }}
                        />
                    </div>
                </div>
            </div>

            <LogoutConfirmModal
                isOpen={showLogoutConfirm}
                onConfirm={handleLogout}
                onCancel={() => setShowLogoutConfirm(false)}
            />
        </header>
    )
}
