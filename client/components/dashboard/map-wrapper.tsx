"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

import type { Vehicle } from "@/lib/vehicles"
import type { VehiclePositions } from "@/lib/use-vehicle-positions"

interface MapWrapperProps {
    selectedVehicleId?: string | null;
    positions?: VehiclePositions;
    vehicles?: Vehicle[];
}

// Dynamically import Map with no SSR
const Map = dynamic<MapWrapperProps>(() => import("./map-view").then((mod) => mod.MapView), {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center bg-[#f6fbf4] text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-[#2f8d35]" />
            <span className="ml-2 font-semibold">Loading Map...</span>
        </div>
    ),
})



export function MapWrapper(props: MapWrapperProps) {
    return <Map {...props} />
}
