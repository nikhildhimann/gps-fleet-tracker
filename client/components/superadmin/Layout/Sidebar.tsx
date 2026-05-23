"use client";
import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, X } from "lucide-react";
import { superAdminNavItems } from "./navigation";

type SidebarProps = {
  className?: string;
  isMobile?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ className, isMobile = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const normalizedPath = pathname?.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname;

  return (
    <aside className={`fixed left-0 top-0 z-[82] flex h-screen w-[min(18rem,calc(100vw-1rem))] max-w-full flex-col border-r border-slate-800/80 bg-slate-950/95 text-slate-200 shadow-[0_24px_60px_rgba(15,23,42,0.35)] backdrop-blur ${className || ""}`}>
      <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4 sm:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-500/15 font-black text-emerald-200">
            GT
          </div>
          <div className="leading-tight">
            <p className="text-sm font-black text-white">SuperAdmin</p>
            <p className="text-[10px] uppercase tracking-[0.32em] text-emerald-400">Global Control</p>
          </div>
        </div>
        {isMobile ? (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 p-2 text-slate-400 transition hover:bg-slate-900 hover:text-white"
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 sm:px-4">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.34em] text-slate-500">Platform Scope</p>
          <p className="mt-2 text-sm font-semibold text-slate-200">
            Platform-owner access for organizations, org admin accounts, and global platform oversight.
          </p>
        </div>

        <div className="mt-5 space-y-1.5">
          {superAdminNavItems.map((item) => {
            const isDashboard = item.href === "/superadmin";
            const isActive = isDashboard
              ? normalizedPath === item.href
              : normalizedPath === item.href || normalizedPath?.startsWith(`${item.href}/`);

            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  router.push(item.href);
                  onClose?.();
                }}
                className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-all ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-100 ring-1 ring-emerald-500/30"
                    : "text-slate-300 hover:bg-slate-900 hover:text-white"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${isActive ? "bg-emerald-400/15 text-emerald-200" : "bg-slate-900 text-slate-400"}`}>
                  <item.icon size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{item.label}</span>
                  <span className="block text-xs text-slate-500">{item.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="border-t border-slate-800 p-4">
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              const confirmLogout = window.confirm(
                "Are you sure you want to sign out?"
              );
              if (confirmLogout) {
                localStorage.removeItem("token");
                localStorage.removeItem("userRole");
                localStorage.removeItem("user");
                window.location.href = "/";
              }
            }
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-sm font-semibold text-rose-300 transition-colors hover:bg-rose-500/15"
        >
          <LogOut size={20} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
