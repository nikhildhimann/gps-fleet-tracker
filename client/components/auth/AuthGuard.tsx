"use client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper"

export function AuthGuard({
  children,
  requiredRoles = ["admin", "manager", "superadmin"]
}: {
  children: React.ReactNode,
  requiredRoles?: string[]
}) {
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getSecureItem("token")
    const userRole = getSecureItem("userRole") as string | null

    if (!token || !userRole) {
      router.push("/")
      return
    }

    if (!requiredRoles.includes(userRole)) {
      router.push("/")
      return
    }

    setIsAuthorized(true)
    setIsLoading(false)
  }, [router, requiredRoles])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-400 mx-auto mb-4" />
          <p className="text-white">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthorized) {
    return null
  }

  return <>{children}</>
}
