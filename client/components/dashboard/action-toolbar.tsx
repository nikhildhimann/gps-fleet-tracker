import { BarChart3, Blocks, FileText, MapPin, Settings, Shield } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/redux/hooks"
import { setActiveTab } from "@/redux/features/vehicleSlice"
import { AnalyticsDropdown } from "./modules/analytics/AnalyticsDropdown"

export function ActionToolbar({
    compact = false,
    className = "",
    onReportsClick,
}: {
    compact?: boolean
    className?: string
    onReportsClick?: () => void
}) {
    const dispatch = useAppDispatch()
    const activeTab = useAppSelector((state) => state.vehicle.activeTab)

    const actions = [
        { label: "Tracking", icon: MapPin },
        { label: "Reports", icon: FileText },
        { label: "Analytics", icon: BarChart3 },
        { label: "Geofences", icon: Shield },
        { label: "App Config", icon: Blocks },
        { label: "Sys Config", icon: Settings },
    ]

    return (
        <div className={`flex items-center gap-2 overflow-x-auto border-b border-[#dbe7d4] bg-white px-4 ${compact ? "py-3" : "py-4"} ${className}`}>
            {actions.map((action) => {
                const isActive = activeTab === action.label
                const isAnalytics = action.label === "Analytics"

                return (
                    <div key={action.label} className="relative flex items-center">
                        <button
                            type="button"
                            onClick={() => {
                                if (action.label === "Reports" && onReportsClick) {
                                    onReportsClick();
                                } else {
                                    dispatch(setActiveTab(action.label));
                                }
                            }}
                            className={`group relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${isActive
                                ? "bg-[#ecf8ea] text-[#2f8d35]"
                                : "text-slate-500 hover:bg-[#f4faf2] hover:text-[#2f8d35]"
                                }`}
                        >
                            <action.icon className={`h-4 w-4 ${isActive ? "text-[#2f8d35]" : "text-slate-400 group-hover:text-[#2f8d35]"}`} />
                            <span className="whitespace-nowrap">{action.label}</span>
                            <span className={`absolute inset-x-3 -bottom-3 h-0.5 rounded-full transition-opacity ${isActive ? "bg-[#2f8d35] opacity-100" : "opacity-0"}`} />
                        </button>
                        
                        {/*{isAnalytics && (
                             <div className="ml-[-8px]">
                                <AnalyticsDropdown asChevronOnly />
                             </div>
                        )}*/}
                    </div>
                )
            })}
        </div>
    )
}
