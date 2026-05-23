"use client";
import React from "react";
import AdminLayout from "@/components/admin/Layout/AdminLayout";
import AuthGuard from "@/components/admin/Auth/AuthGuard";

import { PopupProvider } from "./Helpers/PopupContext";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <PopupProvider>
                <AdminLayout>{children}</AdminLayout>
            </PopupProvider>
        </AuthGuard>
    );
}
