"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";

// 🔐 ORG CONTEXT UPDATE
import { useOrgContext } from "@/hooks/useOrgContext";

import {
    LayoutDashboard,
    Users,
    Map,
    Car,
    Radio,
    Link as LinkIcon,
    Building2,
    Settings,
    LogOut,
    X,
} from "lucide-react";

const menuGroups = [
    {
        title: "System",
        items: [
            { name: "Dashboard", icon: LayoutDashboard, href: "/admin", exact: true, roles: ["admin", "superadmin"] },
            { name: "Live Tracking", icon: Map, href: "/admin/live-tracking", roles: ["admin", "superadmin"] },
        ]
    },
    {
        title: "Management",
        items: [
            { name: "Organizations", icon: Building2, href: "/admin/organizations", roles: ["admin", "superadmin"], superOnly: true },
            { name: "Vehicles", icon: Car, href: "/admin/vehicles", roles: ["admin", "superadmin"] },
            { name: "GPS Devices", icon: Radio, href: "/admin/gps-devices", roles: ["admin", "superadmin"] },
            { name: "Users", icon: Users, href: "/admin/users", roles: ["admin", "superadmin"] },
            { name: "Drivers", icon: Users, href: "/admin/drivers", roles: ["admin", "superadmin"] },
        ]
    },
    {
        title: "Operations",
        items: [
            { name: "Device Mapping", icon: LinkIcon, href: "/admin/device-mapping", roles: ["admin", "superadmin"] },
            { name: "Driver Mapping", icon: LinkIcon, href: "/admin/driver-mapping", roles: ["admin", "superadmin"] },
        ]
    },
    {
        title: "Config",
        items: [
            { name: "Settings", icon: Settings, href: "/admin/settings", roles: ["admin", "superadmin"] },
            { name: "Permissions", icon: Settings, href: "/admin/permissions", roles: ["admin", "superadmin"] },
        ]
    }
];

type MenuItem = {
    name: string;
    icon: React.ComponentType<{ size?: number }>;
    href: string;
    exact?: boolean;
    roles?: string[];
    superOnly?: boolean;
};

type SidebarProps = {
    className?: string;
    showClose?: boolean;
    onClose?: () => void;
    onNavigate?: () => void;
    role?: string | null;
};

export default function Sidebar({ className, showClose, onClose, onNavigate, role }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();

    // 🔐 ORG CONTEXT UPDATE
    const { orgName, isSuperAdmin, isRootOrgAdmin } = useOrgContext();

    const visibleGroups = menuGroups
        .map((group) => ({
            ...group,
            items: group.items.filter((item: MenuItem) => {
                // 🔐 ORG CONTEXT UPDATE
                if (item.name === "Organizations" || item.name === "Settings" || item.name === "Permissions") {
                    if (!isSuperAdmin) {
                        // Special case: root org admin can see Organizations but only for sub-orgs
                        // But menu definition says "superOnly" usually.
                        // Let's stick to strict: only superadmin for Settings/Permissions.
                        // Root Org Admin can see Organizations (checked below).
                        if (item.name === "Settings" || item.name === "Permissions") return false;
                        if (item.name === "Organizations" && !isRootOrgAdmin) return false;
                    }
                }
                if (!item.roles) return true;
                return item.roles.includes(role || "admin");
            }),
        }))
        .filter((group) => group.items.length > 0);

    return (
        <aside className={`fixed left-0 top-0 z-50 flex h-screen w-[min(18rem,calc(100vw-1rem))] max-w-full flex-col border-r border-slate-200/80 bg-white/90 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:w-72 ${className || ""}`}>
            <div className="border-b border-slate-200 px-4 py-4 sm:px-6 sm:py-5">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.34em] text-slate-400">Operations Console</p>
                        <span className="mt-2 block text-xl font-black tracking-tight text-slate-950">
                            {orgName}
                        </span>
                        <span className="mt-2 inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em] text-blue-700">
                            Admin Workspace
                        </span>
                    </div>
                    {showClose && (
                        <button
                            type="button"
                            className="md:hidden rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
                            onClick={onClose}
                            aria-label="Close sidebar"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4 sm:py-6">
                <div className="space-y-6 px-3 sm:space-y-7 sm:px-4">
                    {visibleGroups.map((group) => (
                        <div key={group.title}>
                            <h3 className="mb-3 px-2 text-[10px] font-black uppercase tracking-[0.34em] text-slate-400">
                                {group.title}
                            </h3>
                            <ul className="space-y-1.5">
                                {group.items.map((item: MenuItem) => {
                                    // Fix active state: exact match for dashboard, prefix match for others
                                    const isActive = item.exact
                                        ? pathname === item.href
                                        : pathname === item.href || (pathname.startsWith(`${item.href}/`) && item.href !== "/admin");
                                    return (
                                        <li key={item.name}>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    router.push(item.href);
                                                    onNavigate?.();
                                                }}
                                                className={`relative flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-all ${isActive
                                                    ? "bg-slate-950 text-white shadow-[0_12px_24px_rgba(15,23,42,0.18)]"
                                                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                                                    }`}
                                                aria-current={isActive ? "page" : undefined}
                                            >
                                                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? "bg-white/12 text-white" : "bg-slate-100 text-slate-500"}`}>
                                                    <item.icon size={18} />
                                                </span>
                                                {item.name}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            </nav>

            {/* Footer / Logout */}
            <div className="border-t border-slate-200 p-3 sm:p-4">
                <button
                    onClick={() => {
                        if (typeof window !== "undefined") {
                            const confirmLogout = window.confirm("Are you sure you want to sign out?");
                            if (confirmLogout) {
                                localStorage.removeItem("token");
                                localStorage.removeItem("userRole");
                                localStorage.removeItem("user");
                                window.location.href = "/";
                            }
                        }
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100">
                    <LogOut size={20} />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
