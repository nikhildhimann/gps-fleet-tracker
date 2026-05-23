"use client"

import dynamic from "next/dynamic"
import { Loader2 } from "lucide-react"

// Dynamically import Map with no SSR
const Map = dynamic(() => import("./map-view-legacy").then((mod) => mod.MapViewLegacy), {
    ssr: false,
    loading: () => (
        <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading Map...</span>
        </div>
    ),
})

export function LegacyMapWrapper(props: any) {
    return <Map {...props} />
}
