"use client"

import { useState } from "react"
import { Header } from "@/components/dashboard/header"
import { ActionToolbar } from "@/components/dashboard/action-toolbar"
import { StatusCards } from "@/components/dashboard/status-cards"
import { VehicleSidebar } from "@/components/dashboard/vehicle-sidebar"
import { MapWrapper } from "@/components/dashboard/map-wrapper"
import { useVehiclePositions } from "@/lib/use-vehicle-positions"
import { vehicles as seedVehicles } from "@/lib/vehicles"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const [selectedVehicle, setSelectedVehicle] = useState<string | null>(null)
    const positions = useVehiclePositions(seedVehicles)

    return (
        <div className="flex min-h-screen flex-col bg-slate-950 font-sans text-slate-100 overflow-hidden">
            <Header />
            <div className="shrink-0 border-b border-white/10 bg-slate-950/80 shadow-sm">
                <StatusCards vehicles={seedVehicles} />
            </div>

            <div className="flex flex-1 min-h-0 flex-col overflow-hidden lg:flex-row">
                <div className="flex w-full flex-1 min-h-0 flex-col overflow-hidden lg:w-[60%]">
                    <ActionToolbar compact className="border-b border-white/10" />
                    <div className="flex flex-1 min-h-0 overflow-hidden">
                        <div className="w-90 shrink-0 border-r border-white/10">
                            <VehicleSidebar
                                vehicles={seedVehicles}
                                selectedId={selectedVehicle}
                                onSelect={(id) => setSelectedVehicle(id === selectedVehicle ? null : id)}
                                isFullWidth={false}
                            />
                        </div>
                        <div className="flex-1 overflow-hidden bg-slate-950">
                            <div className="h-full w-full overflow-hidden">
                                <MapWrapper
                                    selectedVehicleId={selectedVehicle}
                                    positions={positions}
                                    vehicles={seedVehicles}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex w-full flex-1 min-h-0 flex-col overflow-hidden border-l border-white/10 bg-slate-950 lg:w-[40%]">
                    <div className="flex-1 overflow-auto p-6 text-slate-200">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    )
}
