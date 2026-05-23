"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, Loader2 } from "lucide-react"
import { z } from "zod"

import { saveSecureItem } from "@/app/admin/Helpers/encryptionHelper"

// Roles information
const ROLE_REDIRECTS: Record<string, string> = {
  superadmin: "/superadmin",
  admin: "/dashboard",
  manager: "/dashboard",
  driver: "/dashboard",
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const loginSchema = z.object({
    email: z.string().email("Valid email is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
  })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    setFieldErrors({})

    const parsed = loginSchema.safeParse({ email, password })
    if (!parsed.success) {
      const nextErrors: { email?: string; password?: string } = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === "email" || key === "password") {
          nextErrors[key] = issue.message
        }
      }
      setFieldErrors(nextErrors)
      return
    }

    setIsSubmitting(true)

    try {
      const res = await fetch(`${API_BASE_URL}/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (res.ok && data?.token) {
        // 🔐 ORG CONTEXT UPDATE
        const role = data?.user?.role || "admin";
        saveSecureItem("token", data.token);
        saveSecureItem("userRole", role);
        saveSecureItem("user", data.user);

        if (role === "superadmin") {
          router.push("/superadmin");
        } else {
          router.push("/dashboard");
        }
        return;
      }

      // Use real backend response
      setError(data?.message || "Invalid email or password.")
      setIsSubmitting(false)
      return
    } catch (err: any) {
      setError(err.message || "An error occurred")
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(14,116,144,0.25),_transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 top-16 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="relative z-10 grid w-full max-w-5xl gap-10 px-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="flex flex-col justify-center gap-6">
          <div className="inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.35em] text-emerald-200">
            GPS Tracker
          </div>
          <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
            Command your fleet with confidence
          </h1>
          <p className="max-w-xl text-base text-slate-200/80">
            Log in to review live positions, alerts, and health metrics for every vehicle. Stay focused
            with a unified dashboard for all roles.
          </p>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Live tracking</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Smart alerts</span>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">Reports</span>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold text-white">Sign in</h2>
            <p className="text-sm text-slate-300">
              Enter your credentials to access the fleet management system.
            </p>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-300">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  className="h-12 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 pl-10 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
                {fieldErrors.email && (
                  <p className="mt-1 text-xs text-rose-300">{fieldErrors.email}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  className="h-12 w-full rounded-xl border border-white/10 bg-slate-900/60 px-4 pl-10 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  placeholder="••••••••"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  disabled={isSubmitting}
                />
                {fieldErrors.password && (
                  <p className="mt-1 text-xs text-rose-300">{fieldErrors.password}</p>
                )}
              </div>
            </div>

            {error ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 text-sm font-semibold uppercase tracking-[0.3em] text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-emerald-400/60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <div className="mt-6 p-4 rounded-2xl border border-white/10 bg-white/5 text-center">
            <p className="text-xs text-slate-400">
              Authorized personnel only. All access is logged.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
