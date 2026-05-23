"use client";

import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper";

interface AdminLayoutProps {
    children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userRole] = useState<string | null>(() => getSecureItem("userRole"));

    useEffect(() => {
        if (typeof document === "undefined") {
            return;
        }

        const { body } = document;
        const previousOverflow = body.style.overflow;

        if (isSidebarOpen) {
            body.style.overflow = "hidden";
        }

        return () => {
            body.style.overflow = previousOverflow;
        };
    }, [isSidebarOpen]);

    return (
        <div className="min-h-screen overflow-x-clip bg-[radial-gradient(circle_at_top_left,_rgba(96,165,250,0.10),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)]">
            <Sidebar className="hidden md:flex" role={userRole} />
            {isSidebarOpen && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <button
                        type="button"
                        className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                        aria-label="Close sidebar"
                        onClick={() => setIsSidebarOpen(false)}
                    />
                    <Sidebar
                        className="relative z-50 h-full"
                        role={userRole}
                        showClose
                        onNavigate={() => setIsSidebarOpen(false)}
                        onClose={() => setIsSidebarOpen(false)}
                    />
                </div>
            )}
            <Header
                onOpenSidebar={() => setIsSidebarOpen(true)}
                isSidebarOpen={isSidebarOpen}
            />
            <main className="min-h-screen overflow-x-clip pl-0 pt-24 md:pl-72 md:pt-20">
                <div className="mx-auto max-w-[1600px] px-3 pb-4 pt-0 sm:px-5 sm:pb-6 md:px-6 xl:px-8 xl:pb-8">
                    {children}
                </div>
            </main>
        </div>
    );
}
