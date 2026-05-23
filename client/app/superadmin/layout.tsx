"use client";
import React from "react";
import SuperAdminLayout from "@/components/superadmin/Layout/SuperAdminLayout";
import AuthGuard from "@/components/superadmin/Auth/AuthGuard";

import { PopupProvider } from "./Helpers/PopupContext";

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <AuthGuard>
            <PopupProvider>
                <SuperAdminLayout>{children}</SuperAdminLayout>
            </PopupProvider>
        </AuthGuard>
    );
}
