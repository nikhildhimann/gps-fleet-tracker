"use client";

import { useMemo } from "react";
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper";

export interface OrgContext {
    role: string | null;
    isSuperAdmin: boolean;
    isRootOrgAdmin: boolean;
    isSubOrgAdmin: boolean;
    orgId: string | null;
    orgName: string;
    orgPath: string;
    orgDepth: number;
    user: any;
}

export const useOrgContext = (): OrgContext => {
    const user = useMemo(() => {
        if (typeof window === "undefined") return null;
        return getSecureItem("user");
    }, []);

    return useMemo(() => {
        if (!user) {
            return {
                role: null,
                isSuperAdmin: false,
                isRootOrgAdmin: false,
                isSubOrgAdmin: false,
                orgId: null,
                orgName: "Guest",
                orgPath: "",
                orgDepth: 0,
                user: null,
            };
        }

        const role = user.role;
        const organizationPath = user.organizationPath || "";
        const orgDepth = organizationPath.split("/").filter(Boolean).length;

        const isSuperAdmin = role === "superadmin";
        const isRootOrgAdmin =
            !isSuperAdmin &&
            role === "admin" &&
            orgDepth === 1;

        const isSubOrgAdmin =
            !isSuperAdmin &&
            role === "admin" &&
            orgDepth > 1;

        return {
            role,
            isSuperAdmin,
            isRootOrgAdmin,
            isSubOrgAdmin,
            orgId: user.organizationId || null,
            orgName: user.organizationName || "Organization",
            orgPath: organizationPath,
            orgDepth,
            user,
        };
    }, [user]);
};
