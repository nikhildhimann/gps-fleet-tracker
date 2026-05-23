"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Car, Plus, Loader2, AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useCreateVehicleMutation } from "@/redux/api/vehicleApi"
import { useGetOrganizationsQuery } from "@/redux/api/organizationApi"
import { Header } from "@/components/dashboard/header"
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper"

// ─── Types ────────────────────────────────────────────────────────────────────
interface FormState {
    vehicleNumber: string
    imei: string
    driverName: string
    model: string
    vehicleType: string
    color: string
    year: string
    organizationId: string
}

interface FormErrors {
    vehicleNumber?: string
    imei?: string
    organizationId?: string
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({
    label,
    value,
    onChange,
    onBlur,
    error,
    required,
    type = "text",
    placeholder,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    onBlur?: () => void
    error?: string
    required?: boolean
    type?: string
    placeholder?: string
}) {
    return (
        <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {label} {required && <span className="text-red-400">*</span>}
            </label>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                placeholder={placeholder}
                className={`w-full rounded-xl px-4 py-3 text-sm font-medium outline-none transition-all
          bg-slate-800/60 border placeholder-slate-600 text-slate-100
          focus:ring-2
          ${error
                        ? "border-red-500/50 focus:ring-red-500/20"
                        : "border-white/10 focus:ring-emerald-500/20 focus:border-emerald-500/40"
                    }`}
            />
            {error && (
                <p className="flex items-center gap-1 text-xs text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    {error}
                </p>
            )}
        </div>
    )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function AddVehiclePage() {
    const router = useRouter()
    const [isAuthed, setIsAuthed] = useState(false)
    const [success, setSuccess] = useState(false)

    const [createVehicle, { isLoading }] = useCreateVehicleMutation()
    const { data: orgData } = useGetOrganizationsQuery(undefined)
    const organizations = (orgData as { organizations?: Array<{ _id: string; name?: string }> } | null)?.organizations ||
        (orgData as { data?: Array<{ _id: string; name?: string }> } | null)?.data || []

    const [form, setForm] = useState<FormState>({
        vehicleNumber: "",
        imei: "",
        driverName: "",
        model: "",
        vehicleType: "",
        color: "",
        year: new Date().getFullYear().toString(),
        organizationId: "",
    })
    const [errors, setErrors] = useState<FormErrors>({})

    // Auth guard
    useEffect(() => {
        const token = getSecureItem("token")
        const role = getSecureItem("userRole")
        if (!token) { router.replace("/"); return }
        if (role === "admin") {
            setIsAuthed(true)
            // Pre-fill org if manager
        } else {
            toast.error("Only admins can add vehicles")
            router.replace("/dashboard")
        }
    }, [router])

    const handleChange = (field: keyof FormState) => (value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }))
        setErrors((prev) => ({ ...prev, [field]: undefined }))
    }

    function validate(): boolean {
        const errs: FormErrors = {}
        if (!form.vehicleNumber.trim()) errs.vehicleNumber = "Vehicle number is required"
        if (!form.imei.trim()) {
            errs.imei = "IMEI is required"
        } else if (!/^\d{10,20}$/.test(form.imei.trim())) {
            errs.imei = "IMEI must be 10–20 digits"
        }
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validate()) return

        try {
            await createVehicle({
                vehicleNumber: form.vehicleNumber.trim(),
                deviceImei: form.imei.trim(),
                imei: form.imei.trim(),
                driverName: form.driverName.trim() || undefined,
                model: form.model.trim() || undefined,
                vehicleType: form.vehicleType || undefined,
                color: form.color.trim() || undefined,
                year: form.year || undefined,
                organizationId: form.organizationId || undefined,
            }).unwrap()

            toast.success("Vehicle created successfully!")
            setSuccess(true)
        } catch (err: unknown) {
            const e = err as { data?: { message?: string }; message?: string }
            toast.error(e?.data?.message || e?.message || "Failed to create vehicle")
        }
    }

    const handleAddAnother = () => {
        setForm({
            vehicleNumber: "",
            imei: "",
            driverName: "",
            model: "",
            vehicleType: "",
            color: "",
            year: new Date().getFullYear().toString(),
            organizationId: "",
        })
        setErrors({})
        setSuccess(false)
    }

    if (!isAuthed) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
                Checking session…
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
            <Header vehicleSummary={{ label: "Add Vehicle", speed: 0 }} />

            <div className="flex-1 overflow-y-auto px-4 py-8 md:px-8">
                <div className="mx-auto max-w-2xl">
                    {/* Breadcrumb */}
                    <div className="mb-6 flex items-center gap-2">
                        <button
                            onClick={() => router.push("/dashboard")}
                            className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            Dashboard
                        </button>
                        <span className="text-slate-600">/</span>
                        <button
                            onClick={() => router.push("/dashboard/vehicles")}
                            className="text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                        >
                            Vehicles
                        </button>
                        <span className="text-slate-600">/</span>
                        <span className="text-sm font-semibold text-slate-200">Add Vehicle</span>
                    </div>

                    {/* Title */}
                    <div className="mb-8 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30">
                            <Car className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">Add New Vehicle</h1>
                            <p className="mt-0.5 text-sm text-slate-400">Register a vehicle in the GPS tracking system</p>
                        </div>
                    </div>

                    {/* Success State */}
                    {success ? (
                        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-10 text-center">
                            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                                <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                            </div>
                            <h2 className="text-xl font-bold text-emerald-300">Vehicle Added Successfully!</h2>
                            <p className="mt-2 text-sm text-slate-400">
                                The vehicle has been registered and will appear in your tracker shortly.
                            </p>
                            <div className="mt-8 flex items-center justify-center gap-4">
                                <button
                                    onClick={handleAddAnother}
                                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    Add Another
                                </button>
                                <button
                                    onClick={() => router.push("/dashboard/vehicles")}
                                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-bold text-slate-900 hover:bg-emerald-400 transition-colors"
                                >
                                    <Car className="h-4 w-4" />
                                    View All Vehicles
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* Form */
                        <form
                            onSubmit={handleSubmit}
                            className="rounded-2xl border border-white/10 bg-slate-900/60 p-6 space-y-5"
                        >
                            {/* Required section */}
                            <div>
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                                    <span className="h-px flex-1 bg-emerald-500/20" />
                                    Required Fields
                                    <span className="h-px flex-1 bg-emerald-500/20" />
                                </h3>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Vehicle Number / Name"
                                        value={form.vehicleNumber}
                                        onChange={handleChange("vehicleNumber")}
                                        onBlur={() => {
                                            if (!form.vehicleNumber.trim())
                                                setErrors((p) => ({ ...p, vehicleNumber: "Required" }))
                                        }}
                                        error={errors.vehicleNumber}
                                        required
                                        placeholder="e.g. MH 12 AB 1234"
                                    />
                                    <Field
                                        label="IMEI Number"
                                        value={form.imei}
                                        onChange={handleChange("imei")}
                                        onBlur={() => {
                                            if (!form.imei.trim()) setErrors((p) => ({ ...p, imei: "Required" }))
                                            else if (!/^\d{10,20}$/.test(form.imei))
                                                setErrors((p) => ({ ...p, imei: "10–20 digits only" }))
                                        }}
                                        error={errors.imei}
                                        required
                                        placeholder="10–20 digit IMEI"
                                    />
                                </div>
                            </div>

                            {/* Optional section */}
                            <div>
                                <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <span className="h-px flex-1 bg-white/10" />
                                    Optional Details
                                    <span className="h-px flex-1 bg-white/10" />
                                </h3>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Driver Name"
                                        value={form.driverName}
                                        onChange={handleChange("driverName")}
                                        placeholder="Driver assigned to vehicle"
                                    />
                                    <Field
                                        label="Model"
                                        value={form.model}
                                        onChange={handleChange("model")}
                                        placeholder="e.g. Swift, Creta"
                                    />
                                    <Field
                                        label="Color"
                                        value={form.color}
                                        onChange={handleChange("color")}
                                        placeholder="e.g. White"
                                    />
                                    <Field
                                        label="Year"
                                        value={form.year}
                                        onChange={handleChange("year")}
                                        type="number"
                                        placeholder={new Date().getFullYear().toString()}
                                    />
                                </div>

                                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    {/* Vehicle Type select */}
                                    <div className="space-y-1.5">
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                            Vehicle Type
                                        </label>
                                        <select
                                            value={form.vehicleType}
                                            onChange={(e) => handleChange("vehicleType")(e.target.value)}
                                            className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                        >
                                            <option value="">Select type…</option>
                                            <option value="car">Car</option>
                                            <option value="truck">Truck</option>
                                            <option value="bus">Bus</option>
                                            <option value="bike">Bike</option>
                                            <option value="van">Van</option>
                                            <option value="other">Other</option>
                                        </select>
                                    </div>

                                    {/* Organization select (admin only) */}
                                    {organizations.length > 0 && (
                                        <div className="space-y-1.5">
                                            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                                Organization
                                            </label>
                                            <select
                                                value={form.organizationId}
                                                onChange={(e) => handleChange("organizationId")(e.target.value)}
                                                className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-3 text-sm font-medium text-slate-100 outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                                            >
                                                <option value="">All organizations</option>
                                                {organizations.map((org) => (
                                                    <option key={org._id} value={org._id}>
                                                        {org.name || org._id}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-4 border-t border-white/10 pt-4">
                                <button
                                    type="button"
                                    onClick={() => router.push("/dashboard/vehicles")}
                                    disabled={isLoading}
                                    className="rounded-xl border border-white/10 bg-white/5 px-6 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/10 transition-colors disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-8 py-2.5 text-sm font-bold text-slate-900 hover:bg-emerald-400 transition-colors disabled:opacity-60"
                                >
                                    {isLoading ? (
                                        <><Loader2 className="h-4 w-4 animate-spin" />Creating…</>
                                    ) : (
                                        <><Plus className="h-4 w-4" />Create Vehicle</>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
