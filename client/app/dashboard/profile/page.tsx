"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
    User,
    Mail,
    Phone,
    Building2,
    BadgeCheck,
    ArrowLeft,
    Save,
    Loader2,
    ShieldCheck,
    AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { useGetMeQuery, useUpdateUserMutation } from "@/redux/api/usersApi"
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper"
import { Header } from "@/components/dashboard/header"
import PhoneInputField from "@/components/common/PhoneInputField"

// ─── Form types ───────────────────────────────────────────────────────────────
interface FormState {
    firstName: string
    lastName: string
    email: string
    mobile: string
}

interface FormErrors {
    firstName?: string
    lastName?: string
    email?: string
    mobile?: string
}

function validate(form: FormState): FormErrors {
    const errs: FormErrors = {}
    if (!form.firstName.trim()) errs.firstName = "First name is required"
    if (!form.lastName.trim()) errs.lastName = "Last name is required"
    if (!form.email.trim()) errs.email = "Email is required"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Valid email required"
    if (!form.mobile.trim()) errs.mobile = "Mobile number is required"
    else if (!/^\+?[1-9]\d{7,14}$/.test(form.mobile)) errs.mobile = "Enter valid mobile with country code"
    return errs
}

// ─── Field Component ──────────────────────────────────────────────────────────
function Field({
    label,
    icon: Icon,
    value,
    onChange,
    onBlur,
    error,
    type = "text",
    disabled,
}: {
    label: string
    icon: React.ElementType
    value: string
    onChange: (v: string) => void
    onBlur?: () => void
    error?: string
    type?: string
    disabled?: boolean
}) {
    return (
        <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <Icon className="h-3.5 w-3.5 text-[#38a63c]" />
                {label}
            </label>
            {type === "tel" ? (
                <div className="light-phone-input">
                    <PhoneInputField
                        value={value}
                        onChange={onChange}
                        disabled={disabled}
                        placeholder="Enter phone number"
                        required
                        variant="light"
                    />
                </div>
            ) : (
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onBlur={onBlur}
                    disabled={disabled}
                    className={`w-full rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all outline-none border
          ${error
                            ? "border-red-300 bg-red-50 text-red-900 focus:ring-4 focus:ring-red-500/10 focus:border-red-500"
                            : "border-[#dbe7d4] bg-white text-slate-900 focus:ring-4 focus:ring-[#38a63c]/10 focus:border-[#38a63c]/40"
                        }
          ${disabled ? "bg-slate-50 opacity-60 cursor-not-allowed" : ""}
          placeholder-slate-300 shadow-sm`}
                />
            )}
            {error && <p className="text-[11px] font-bold text-red-500 pl-1">{error}</p>}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function DashboardProfilePage() {
    const router = useRouter()
    const [isAuthed, setIsAuthed] = useState(false)

    const { data: userData, isLoading, isError, refetch } = useGetMeQuery(undefined, {
        refetchOnMountOrArgChange: true,
    })
    const [updateUser, { isLoading: isUpdating }] = useUpdateUserMutation()

    const user = (userData as { data?: Record<string, string & { _id?: string; name?: string }> } | null)?.data

    const [form, setForm] = useState<FormState>({
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
    })
    const [errors, setErrors] = useState<FormErrors>({})
    const [dirty, setDirty] = useState(false)

    // Auth check
    useEffect(() => {
        const token = getSecureItem("token")
        const role = getSecureItem("userRole")
        if (!token) { router.replace("/"); return }
        if (role && ["admin", "manager", "driver"].includes(role)) {
            setIsAuthed(true)
        } else {
            router.replace("/")
        }
    }, [router])

    // Pre-fill form
    useEffect(() => {
        if (user) {
            setForm({
                firstName: (user.firstName as unknown as string) || "",
                lastName: (user.lastName as unknown as string) || "",
                email: (user.email as unknown as string) || "",
                mobile: (user.mobile as unknown as string) || "",
            })
            setDirty(false)
            setErrors({})
        }
    }, [user])

    const handleChange = (field: keyof FormState) => (value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }))
        setDirty(true)
        setErrors((prev) => ({ ...prev, [field]: undefined }))
    }

    const handleBlur = (field: keyof FormState) => () => {
        const errs = validate(form)
        setErrors((prev) => ({ ...prev, [field]: errs[field] }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const errs = validate(form)
        if (Object.keys(errs).length > 0) {
            setErrors(errs)
            toast.error("Please fix the errors before saving")
            return
        }
        try {
            await updateUser({
                id: user?._id as unknown as string,
                firstName: form.firstName.trim(),
                lastName: form.lastName.trim(),
                email: form.email.trim(),
                mobile: form.mobile.trim(),
            }).unwrap()
            toast.success("Profile updated successfully")
            setDirty(false)
            refetch()
        } catch (err: unknown) {
            const e = err as { data?: { message?: string }; message?: string }
            toast.error(e?.data?.message || e?.message || "Update failed")
        }
    }

    if (!isAuthed) return (
        <div className="flex min-h-screen items-center justify-center bg-white text-slate-400">
            Checking session…
        </div>
    )

    const displayName = user
        ? `${(user.firstName as unknown as string) || ""} ${(user.lastName as unknown as string) || ""}`.trim() || "User"
        : "User"
    const orgName = typeof user?.organizationId === "object"
        ? (user?.organizationId as { name?: string })?.name || "My Organization"
        : null
    const orgEmail = typeof user?.organizationId === "object"
        ? (user?.organizationId as { email?: string })?.email
        : null

    return (
        <div className="flex min-h-screen flex-col bg-white text-slate-800">
            <Header vehicleSummary={{ label: "Profile", speed: 0 }} />

            <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
                <div className="mx-auto max-w-5xl">
                    {/* Breadcrumb */}
                    <div className="mb-6 flex items-center gap-2">
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-[#38a63c] transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Dashboard
                        </button>
                        <span className="text-slate-200">/</span>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-900">My Profile</span>
                    </div>

                    {/* Title */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-black text-[#1f3b1f] tracking-tight">Profile Settings</h1>
                        <p className="mt-1 text-sm font-medium text-slate-500">View and update your personal account information.</p>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="h-10 w-10 animate-spin text-[#38a63c]" />
                        </div>
                    ) : isError ? (
                        <div className="rounded-[24px] border border-red-100 bg-red-50/50 p-12 text-center text-red-600">
                            <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
                            <p className="text-lg font-black tracking-tight">Failed to load profile</p>
                            <p className="text-sm text-red-500/70 mb-6">There was an issue retrieving your account details.</p>
                            <button onClick={() => refetch()} className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-600/10">
                                Try Reconnecting
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                            {/* ── Left: Identity Card ── */}
                            <div className="space-y-6 md:col-span-1">
                                {/* Avatar card */}
                                <div className="rounded-[24px] border border-[#dbe7d4] bg-white p-8 text-center shadow-sm">
                                    <div className="mx-auto mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-[#f7fbf5] border-4 border-[#38a63c]/10 text-4xl font-black text-[#2f8d35] shadow-inner">
                                        {displayName.charAt(0).toUpperCase()}
                                    </div>
                                    <h2 className="text-xl font-black text-[#1f3b1f] tracking-tight">{displayName}</h2>
                                    <p className="mt-1 text-sm font-medium text-slate-500">{form.email}</p>
                                    
                                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ecf8ea] border border-[#38a63c]/15 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-[#2f8d35]">
                                            <BadgeCheck className="h-3.5 w-3.5" />
                                            {(user?.role as unknown as string) || "User"}
                                        </span>
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] border
                                            ${(user?.status as unknown as string) === "active"
                                                ? "bg-[#ecf8ea] border-[#38a63c]/15 text-[#2f8d35]"
                                                : "bg-slate-50 border-slate-200 text-slate-400"
                                            }`}>
                                            {(user?.status as unknown as string) || "Active"}
                                        </span>
                                    </div>
                                </div>

                                {/* Account info */}
                                <div className="rounded-[24px] border border-[#dbe7d4] bg-[#f7fbf5] p-6 space-y-4 shadow-sm">
                                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#2f8d35]">
                                        <ShieldCheck className="h-4 w-4" />
                                        Identity Details
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Account ID</span>
                                            <span className="font-mono text-xs font-semibold text-slate-600 break-all bg-white rounded-lg p-2 border border-[#dbe7d4]/50">
                                                {(user?._id as unknown as string) || "—"}
                                            </span>
                                        </div>
                                        {orgName && (
                                            <div className="flex items-center justify-between pt-3 border-t border-[#dbe7d4]">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Organization</span>
                                                    <span className="text-sm font-black text-slate-800">{orgName}</span>
                                                </div>
                                                <Building2 className="h-6 w-6 text-[#38a63c]/20" />
                                            </div>
                                        )}
                                        {orgEmail && (
                                            <div className="flex flex-col pt-3 border-t border-[#dbe7d4]">
                                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Org Contact</span>
                                                <span className="text-sm font-semibold text-slate-600">{orgEmail}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* ── Right: Edit Form ── */}
                            <div className="md:col-span-2">
                                <form
                                    onSubmit={handleSubmit}
                                    className="rounded-[24px] border border-[#dbe7d4] bg-white p-8 space-y-8 shadow-sm"
                                >
                                    <div>
                                        <h3 className="text-lg font-black text-[#1f3b1f] tracking-tight flex items-center gap-2">
                                            <User className="h-5 w-5 text-[#38a63c]" />
                                            Basic Information
                                        </h3>
                                        <p className="mt-1 text-sm font-medium text-slate-500">Update your primary contact and profile names.</p>
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <Field
                                            label="First Name"
                                            icon={User}
                                            value={form.firstName}
                                            onChange={handleChange("firstName")}
                                            onBlur={handleBlur("firstName")}
                                            error={errors.firstName}
                                        />
                                        <Field
                                            label="Last Name"
                                            icon={User}
                                            value={form.lastName}
                                            onChange={handleChange("lastName")}
                                            onBlur={handleBlur("lastName")}
                                            error={errors.lastName}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                                        <Field
                                            label="Email Address"
                                            icon={Mail}
                                            type="email"
                                            value={form.email}
                                            onChange={handleChange("email")}
                                            onBlur={handleBlur("email")}
                                            error={errors.email}
                                        />

                                        <Field
                                            label="Mobile Number"
                                            icon={Phone}
                                            type="tel"
                                            value={form.mobile}
                                            onChange={handleChange("mobile")}
                                            onBlur={handleBlur("mobile")}
                                            error={errors.mobile}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between gap-4 pt-8 border-t border-[#dbe7d4]">
                                        <button
                                            type="button"
                                            onClick={() => router.push("/dashboard")}
                                            className="rounded-2xl border border-[#dbe7d4] bg-[#f7fbf5] px-6 py-3.5 text-sm font-bold text-slate-600 hover:bg-[#ecf8ea] hover:text-[#2f8d35] transition-all active:scale-95"
                                        >
                                            Discard Changes
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isUpdating || !dirty}
                                            className="flex items-center gap-2 rounded-2xl bg-[#38a63c] px-8 py-3.5 text-sm font-black text-white hover:bg-[#2f8d35] transition-all shadow-lg shadow-[#38a63c]/20 active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100"
                                        >
                                            {isUpdating ? (
                                                <><Loader2 className="h-4 w-4 animate-spin" />Saving Info…</>
                                            ) : (
                                                <><Save className="h-5 w-5" />Update Account</>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
