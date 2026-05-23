"use client";
import React, { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "@/components/superadmin/Layout/Header";

interface SuperAdminLayoutProps {
  children: React.ReactNode;
}

export default function SuperAdminLayout({ children }: SuperAdminLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;

    if (isSidebarOpen) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isSidebarOpen]);

  return (
    <div className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.12),_transparent_24%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)]">
      <Sidebar className="hidden lg:flex" />
      {isSidebarOpen ? (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <Sidebar className="relative z-[81] flex h-full" isMobile onClose={() => setIsSidebarOpen(false)} />
        </div>
      ) : null}
      <Header onOpenSidebar={() => setIsSidebarOpen(true)} />
      <main className="min-h-screen pl-0 pt-20 lg:pl-72">
        <div className="mx-auto max-w-7xl px-3 pb-6 text-slate-100 sm:px-5 sm:pb-8 lg:px-6 xl:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
