"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell, Menu, LayoutDashboard } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGetMeQuery } from "@/redux/api/usersApi";
import { useGetAdminNotificationCountsQuery } from "@/redux/api/adminNotificationsApi";
import { NotificationDropdown } from "./NotificationDropdown";
import { Badge } from "@/components/ui/badge";
import AdminGlobalSearch from "@/components/admin/search/AdminGlobalSearch";

type HeaderProps = {
    onOpenSidebar?: () => void;
    isSidebarOpen?: boolean;
};

export default function Header({ onOpenSidebar, isSidebarOpen = false }: HeaderProps) {
    const router = useRouter();
    const [showNotifications, setShowNotifications] = useState(false);

    // Redux Hooks
    const { data: userData } = useGetMeQuery(undefined, { refetchOnMountOrArgChange: true });
    const { data: notificationCounts } = useGetAdminNotificationCountsQuery(undefined, {
        pollingInterval: 30000, // Poll every 30 seconds for real-time updates
        refetchOnMountOrArgChange: true,
    });

    const adminUser = userData?.data || {};
    const notifRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const unreadCount = notificationCounts?.data?.unread ?? 0;

    const displayName = [adminUser.firstName, adminUser.lastName].filter(Boolean).join(" ") || adminUser.name || "Admin User";
    const userInitials = displayName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .substring(0, 2)
        .toUpperCase() || "AD";

    return (
        <header className={`fixed left-0 right-0 top-0 z-40 border-b border-slate-200/80 bg-white/75 px-3 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)] backdrop-blur-xl sm:px-4 md:left-72 md:px-6 ${isSidebarOpen ? "hidden md:block" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
                <button
                    type="button"
                    onClick={onOpenSidebar}
                    className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 shadow-sm transition hover:bg-slate-50 md:hidden"
                    aria-label="Open sidebar"
                >
                    <Menu size={18} />
                </button>
                <AdminGlobalSearch />
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3 md:gap-4">

                <button
                    onClick={() => router.push("/dashboard")}
                    className="group hidden items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-slate-600 shadow-sm transition-all hover:bg-slate-50 lg:flex"
                    title="Main Dashboard"
                >
                    <LayoutDashboard size={18} className="group-hover:text-emerald-500 transition-colors" />
                    <span className="text-xs font-bold uppercase tracking-wider hidden sm:block">Dashboard</span>
                </button>


                {/* Enhanced Notification Bell */}
                <div className="relative" ref={notifRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="relative rounded-2xl border border-slate-200 bg-white p-2.5 text-gray-500 shadow-sm transition-colors hover:bg-slate-50"
                        title="Notifications"
                    >
                        <Bell size={20} />
                        {/* Unread count badge */}
                        {unreadCount > 0 && (
                            <Badge 
                                variant="default" 
                                className="absolute -top-1 -right-1 min-w-[20px] h-5 text-xs font-bold bg-red-600 text-white flex items-center justify-center"
                            >
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </Badge>
                        )}
                    </button>

                    {/* Enhanced Notification Dropdown */}
                    <NotificationDropdown 
                        isOpen={showNotifications} 
                        onClose={() => setShowNotifications(false)} 
                    />
                </div>

                <div className="hidden h-8 w-px bg-slate-200 sm:block"></div>

                <button
                    onClick={() => router.push("/admin/profile")}
                    className="flex min-w-0 cursor-pointer items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-2 shadow-sm transition-colors hover:bg-slate-50 sm:gap-3 sm:px-2.5"
                >
                    <div className="text-right hidden sm:block">
                        <div className="mb-0.5">
                            <p className="text-sm font-semibold text-slate-900">{displayName}</p>
                        </div>
                        <p className="text-xs text-slate-500">{adminUser.email || "admin@example.com"}</p>
                    </div>
                    {adminUser?.organizationId?.logo ? (
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center border-2 border-blue-200 overflow-hidden shadow-sm">
                            <img
                                src={`http://localhost:5000${adminUser.organizationId.logo}`}
                                alt="Org Logo"
                                className="w-full h-full object-contain p-1"
                            />
                        </div>
                    ) : (
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold border-2 border-blue-200">
                            {userInitials}
                        </div>
                    )}
                </button>
            </div>
            </div>
        </header>
    );
}
