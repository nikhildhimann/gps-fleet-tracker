"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Car, Plus, RefreshCw } from "lucide-react"
import { VehicleTable } from "@/components/dashboard/vehicle-table"
import VehicleModal from "@/components/admin/Modals/VehicleModal"
import { getSecureItem } from "@/app/admin/Helpers/encryptionHelper"

export default function VehiclesPage() {
    const router = useRouter()
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isAuthed, setIsAuthed] = useState(false)
    const [canCreate, setCanCreate] = useState(false)
    const [key, setKey] = useState(0)

    useEffect(() => {
        const token = getSecureItem("token")
        const role = getSecureItem("userRole")
        if (!token) {
            router.replace("/")
            return
        }
        if (role && ["admin", "manager", "driver"].includes(role)) {
            setIsAuthed(true)
            setCanCreate(role === "admin")
        } else {
            router.replace("/")
        }
    }, [router])

    if (!isAuthed) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 text-sm">
                Checking session…
            </div>
        )
    }

    return (
        <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
            {/* Page header */}
            <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/60 px-6 py-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => router.push("/dashboard")}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
                        title="Back to dashboard"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Car className="h-5 w-5 text-emerald-400" />
                        <div>
                            <h1 className="text-base font-bold text-slate-100">Vehicle Management</h1>
                            <p className="text-xs text-slate-400">View, edit and manage all vehicles</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setKey((k) => k + 1)}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-colors"
                    >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Refresh
                    </button>
                    {canCreate && (
                        <button
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-emerald-400 transition-colors"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add Vehicle
                        </button>
                    )}
                </div>
            </div>

            {/* Table fills the rest of the screen */}
            <div className="flex-1 min-h-0 overflow-hidden">
                <VehicleTable key={key} />
            </div>

            {/* Add Vehicle Modal */}
            {canCreate && (
                <VehicleModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onCreated={() => {
                        setIsModalOpen(false)
                        setKey((k) => k + 1)
                    }}
                />
            )}
        </div>
    )
}
