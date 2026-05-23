import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper";
import { Loader2 } from "lucide-react";

// 🔐 ORG CONTEXT UPDATE
import { useOrgContext } from "@/hooks/useOrgContext";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [authorized, setAuthorized] = useState(false);

    // 🔐 ORG CONTEXT UPDATE
    const { isSuperAdmin, user } = useOrgContext();

    useEffect(() => {
        const token = getSecureItem("token");

        if (!token || !user) {
            router.push("/");
            return;
        }

        const role = user.role;
        const isSuperadminPath = pathname.startsWith("/superadmin");

        if (isSuperadminPath && !isSuperAdmin) {
            // Non-superadmins cannot access /superadmin
            router.push("/admin");
        } else if (!isSuperadminPath && isSuperAdmin) {
            // Superadmins redirected to /superadmin (optional, but follows existing logic)
            // router.push("/superadmin"); 
            setAuthorized(true);
        } else {
            setAuthorized(true);
        }
    }, [router, pathname, user, isSuperAdmin]);

    if (!authorized) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-gray-50">
                <Loader2 className="animate-spin text-[#1877F2]" size={48} />
            </div>
        );
    }

    return <>{children}</>;
}
