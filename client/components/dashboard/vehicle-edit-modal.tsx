"use client"

import { useEffect, useState } from "react"
import { X, SaveAll, Loader2, AlertCircle } from "lucide-react"
import { useUpdateVehicleMutation } from "@/redux/api/vehicleApi"
import type { VehicleRecord } from "@/lib/api"

interface Props {
    vehicle: VehicleRecord | null
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

interface FormState {
    vehicleNumber: string
    imei: string
    driverName: string
    make: string
    model: string
    color: string
    vehicleType: string
}

interface FormErrors {
    vehicleNumber?: string
    imei?: string
    driverName?: string
}

export default function VehicleEditModal({ vehicle, isOpen, onClose, onSuccess }: Props) {
    const [updateVehicle, { isLoading }] = useUpdateVehicleMutation()
    const [form, setForm] = useState<FormState>({
        vehicleNumber: "",
        imei: "",
        driverName: "",
        make: "",
        model: "",
        color: "",
        vehicleType: "",
    })
    const [errors, setErrors] = useState<FormErrors>({})
    const [serverError, setServerError] = useState<string | null>(null)

    // Pre-fill form when vehicle changes
    useEffect(() => {
        if (vehicle) {
            setForm({
                vehicleNumber: vehicle.vehicleNumber || vehicle.registrationNumber || "",
                imei: vehicle.imei || vehicle.deviceImei || "",
                driverName: vehicle.driverName || "",
                make: vehicle.make || "",
                model: vehicle.model || "",
                color: vehicle.color || "",
                vehicleType: vehicle.vehicleType || "",
            })
            setErrors({})
            setServerError(null)
        }
    }, [vehicle])

    if (!isOpen || !vehicle) return null

    function validate(): boolean {
        const errs: FormErrors = {}
        if (!form.vehicleNumber.trim()) errs.vehicleNumber = "Vehicle Name / Number is required"
        if (!form.imei.trim()) errs.imei = "IMEI is required"
        if (form.imei.trim() && !/^\d{10,20}$/.test(form.imei.trim())) {
            errs.imei = "IMEI must be 10–20 digits"
        }
        setErrors(errs)
        return Object.keys(errs).length === 0
    }

    const handleChange = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }))
        setErrors((prev) => ({ ...prev, [field]: undefined }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setServerError(null)
        if (!validate()) return

        try {
            await updateVehicle({
                id: vehicle._id,
                vehicleNumber: form.vehicleNumber.trim(),
                imei: form.imei.trim(),
                driverName: form.driverName.trim(),
                make: form.make.trim(),
                model: form.model.trim(),
                color: form.color.trim(),
                vehicleType: form.vehicleType.trim(),
            }).unwrap()
            onSuccess()
            onClose()
        } catch (err: unknown) {
            const e = err as { data?: { message?: string }; message?: string }
            setServerError(e?.data?.message || e?.message || "Update failed. Try again.")
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="relative w-full max-w-lg mx-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-800/60">
                    <div>
                        <h2 className="text-base font-bold text-slate-100">Edit Vehicle</h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                            ID: <span className="font-mono text-emerald-300">{vehicle._id}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {serverError && (
                        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            {serverError}
                        </div>
                    )}

                    {/* Vehicle Name */}
                    <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Vehicle Name / Number <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.vehicleNumber}
                            onChange={handleChange("vehicleNumber")}
                            placeholder="e.g. MH 12 AB 1234"
                            className={`w-full rounded-xl bg-slate-800 border px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all
                ${errors.vehicleNumber ? "border-red-500 focus:ring-red-500/30" : "border-white/10 focus:ring-emerald-500/30 focus:border-emerald-500/50"}`}
                        />
                        {errors.vehicleNumber && (
                            <p className="text-xs text-red-400 mt-1">{errors.vehicleNumber}</p>
                        )}
                    </div>

                    {/* IMEI */}
                    <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            IMEI <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            value={form.imei}
                            onChange={handleChange("imei")}
                            placeholder="10–20 digit IMEI number"
                            maxLength={20}
                            className={`w-full rounded-xl bg-slate-800 border px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 transition-all
                ${errors.imei ? "border-red-500 focus:ring-red-500/30" : "border-white/10 focus:ring-emerald-500/30 focus:border-emerald-500/50"}`}
                        />
                        {errors.imei && (
                            <p className="text-xs text-red-400 mt-1">{errors.imei}</p>
                        )}
                    </div>

                    {/* Driver Name */}
                    <div className="space-y-1">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Driver Name
                        </label>
                        <input
                            type="text"
                            value={form.driverName}
                            onChange={handleChange("driverName")}
                            placeholder="Driver name (optional)"
                            className="w-full rounded-xl bg-slate-800 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                        />
                    </div>

                    {/* Make & Model in a grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Make
                            </label>
                            <input
                                type="text"
                                value={form.make}
                                onChange={handleChange("make")}
                                placeholder="e.g. Honda"
                                className="w-full rounded-xl bg-slate-800 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Model
                            </label>
                            <input
                                type="text"
                                value={form.model}
                                onChange={handleChange("model")}
                                placeholder="e.g. Hornet"
                                className="w-full rounded-xl bg-slate-800 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                            />
                        </div>
                    </div>

                    {/* Color & Vehicle Type in a grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Color
                            </label>
                            <input
                                type="text"
                                value={form.color}
                                onChange={handleChange("color")}
                                placeholder="e.g. Black"
                                className="w-full rounded-xl bg-slate-800 border border-white/10 px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                Type
                            </label>
                            <select
                                value={form.vehicleType}
                                onChange={handleChange("vehicleType")}
                                className="w-full rounded-xl bg-slate-800 border border-white/10 px-4 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500/50 transition-all"
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
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <SaveAll className="h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
