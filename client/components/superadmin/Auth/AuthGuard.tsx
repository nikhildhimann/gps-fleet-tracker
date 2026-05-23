"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useGetMeQuery } from "@/redux/api/usersApi";
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper";

const clearAuthState = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("userRole");
  window.localStorage.removeItem("user");
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const token = useMemo(() => getSecureItem("token"), []);
  const storedRole = useMemo(() => getSecureItem("userRole"), []);
  const hasLocalSuperadminSession = Boolean(token) && storedRole === "superadmin";

  const { data: meData, isLoading: isMeLoading, isError } = useGetMeQuery(undefined, {
    skip: !hasLocalSuperadminSession,
  });

  useEffect(() => {
    if (!hasLocalSuperadminSession) {
      clearAuthState();
      router.replace("/");
      return;
    }

    if (isError) {
      clearAuthState();
      router.replace("/");
      return;
    }

    if (meData?.data && meData.data.role !== "superadmin") {
      clearAuthState();
      router.replace("/");
    }
  }, [hasLocalSuperadminSession, isError, meData, pathname, router]);

  if (!hasLocalSuperadminSession || (isMeLoading && !meData)) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950">
        <Loader2 className="animate-spin text-emerald-400" size={42} />
      </div>
    );
  }

  return <>{children}</>;
}
