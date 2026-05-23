"use client";

import { DashboardProvider } from "@/components/dashboard/DashboardContext";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return <DashboardProvider>{children}</DashboardProvider>;
}
