"use client"

import { useState } from "react"
import { Trash2, X, AlertTriangle, Loader2 } from "lucide-react"
import { useDeleteVehicleMutation } from "@/redux/api/vehicleApi"
import type { VehicleRecord } from "@/lib/api"

interface Props {
    vehicle: VehicleRecord | null
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export default function VehicleDeleteDialog({ vehicle, isOpen, onClose, onSuccess }: Props) {
    const [deleteVehicle, { isLoading }] = useDeleteVehicleMutation()
    const [serverError, setServerError] = useState<string | null>(null)

    if (!isOpen || !vehicle) return null

    const displayName = vehicle.vehicleNumber || vehicle.registrationNumber || vehicle._id

    const handleDelete = async () => {
        setServerError(null)
        try {
            await deleteVehicle(vehicle._id).unwrap()
            onSuccess()
            onClose()
        } catch (err: unknown) {
            const e = err as { data?: { message?: string }; message?: string }
            setServerError(e?.data?.message || e?.message || "Delete failed. Please try again.")
        }
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div className="relative w-full max-w-md mx-4 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-red-500/10">
                    <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/20">
                            <Trash2 className="h-5 w-5 text-red-400" />
                        </div>
                        <h2 className="text-base font-bold text-slate-100">Delete Vehicle</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-6 space-y-5">
                    {/* Warning */}
                    <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                        <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                        <p className="text-sm text-amber-200">
                            This action <span className="font-bold">cannot be undone</span>. All tracking data
                            associated with this vehicle will be permanently removed.
                        </p>
                    </div>

                    <div className="space-y-1">
                        <p className="text-sm text-slate-300">
                            Are you sure you want to delete this vehicle?
                        </p>
                        <p className="text-base font-bold text-white">
                            &ldquo;{displayName}&rdquo;
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                            ID: {vehicle._id}
                        </p>
                    </div>

                    {serverError && (
                        <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                            {serverError}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 pb-6">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="flex-1 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Deleting…
                            </>
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4" />
                                Delete
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
