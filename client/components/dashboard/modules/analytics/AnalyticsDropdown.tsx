"use client"

import { useEffect, useRef, useState } from "react"
import { BarChart3, ChevronDown } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/redux/hooks"
import { setActiveTab } from "@/redux/features/vehicleSlice"

const analyticsItems = [
    "Analytics",
    "Intelligence Hub",
    "Statistics",
    "Travel Summary",
    "Trip Summary",
    "AC Summary",
    "Vehicle Status",
    "Alert Summary",
    "Daywise Distance",
]

export function AnalyticsDropdown({ asChevronOnly = false }: { asChevronOnly?: boolean }) {
    const dispatch = useAppDispatch()
    const activeTab = useAppSelector((state) => state.vehicle.activeTab)
    const [open, setOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const isActive = analyticsItems.includes(activeTab)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    return (
        <div ref={containerRef} className="relative">
            {asChevronOnly ? (
                <button
                    type="button"
                    onClick={() => setOpen((prev) => !prev)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${isActive ? "text-[#2f8d35] hover:bg-[#ecf8ea]" : "text-slate-400 hover:bg-[#f4faf2]"}`}
                >
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                </button>
            ) : (
                <button
                    type="button"
                    onClick={() => setOpen((prev) => !prev)}
                    className={`group relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${isActive
                        ? "bg-[#ecf8ea] text-[#2f8d35]"
                        : "text-slate-500 hover:bg-[#f4faf2] hover:text-[#2f8d35]"
                        }`}
                >
                    <BarChart3 className={`h-4 w-4 ${isActive ? "text-[#2f8d35]" : "text-slate-400 group-hover:text-[#2f8d35]"}`} />
                    <span className="whitespace-nowrap">Analytics</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    <span className={`absolute inset-x-3 -bottom-3 h-0.5 rounded-full transition-opacity ${isActive ? "bg-[#2f8d35] opacity-100" : "opacity-0"}`} />
                </button>
            )}

            {open && (
                <div className="absolute left-0 top-full z-50 mt-3 w-56 overflow-hidden rounded-[20px] border border-[#d8e6d2] bg-white shadow-2xl">
                    <div className="p-2">
                        {analyticsItems.map((item) => (
                            <button
                                key={item}
                                type="button"
                                onClick={() => {
                                    dispatch(setActiveTab(item))
                                    setOpen(false)
                                }}
                                className={`flex w-full items-center rounded-2xl px-3 py-2.5 text-left text-sm font-semibold transition ${activeTab === item
                                    ? "bg-[#ecf8ea] text-[#2f8d35]"
                                    : "text-slate-700 hover:bg-[#f5faf3] hover:text-[#2f8d35]"
                                    }`}
                            >
                                {item}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
