"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import dynamic from "next/dynamic"
import { PlayCircle, Navigation, Filter as FilterIcon, ChevronRight, CalendarDays, History } from "lucide-react"
import {
    useGetTravelSummaryQuery,
    useGetTripSummaryQuery,
} from "@/redux/api/gpsHistoryApi"
import { ReportFilterBar, ReportFilterState, getDefaultReportFilter } from "./ReportFilterBar"
import React from "react"
const TravelPlaybackInline = dynamic(() => import("@/components/reports/TravelPlaybackInline"), {
    ssr: false,
    loading: () => (
        <div className="h-[400px] w-full flex items-center justify-center bg-slate-50 border-y border-slate-200">
            <div className="flex flex-col items-center gap-2">
                <div className="animate-spin h-8 w-8 border-4 border-[#2f8d35]/20 border-t-[#2f8d35] rounded-full"></div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Initializing Map...</p>
            </div>
        </div>
    )
})

const PLAYBACK_PANEL_HEIGHT = 560

function DragScrollArea({
    children,
    className = "",
}: {
    children: React.ReactNode
    className?: string
}) {
    const dragState = useRef({ active: false, startX: 0, scrollLeft: 0 })

    const stopDragging = (element?: HTMLDivElement | null) => {
        dragState.current.active = false
        if (element) {
            element.style.cursor = "grab"
        }
    }

    return (
        <div
            className={`cursor-grab select-none ${className}`}
            onMouseDown={(event) => {
                const target = event.target as HTMLElement
                if (target.closest("button, a, input, select, textarea, label")) return
                const element = event.currentTarget
                dragState.current = {
                    active: true,
                    startX: event.clientX,
                    scrollLeft: element.scrollLeft,
                }
                element.style.cursor = "grabbing"
            }}
            onMouseMove={(event) => {
                if (!dragState.current.active) return
                event.preventDefault()
                const element = event.currentTarget
                const deltaX = event.clientX - dragState.current.startX
                element.scrollLeft = dragState.current.scrollLeft - deltaX
            }}
            onMouseUp={(event) => stopDragging(event.currentTarget)}
            onMouseLeave={(event) => stopDragging(event.currentTarget)}
        >
            {children}
        </div>
    )
}

const formatDuration = (seconds?: number) => {
    const total = Math.max(0, Number(seconds || 0))
    const hrs = String(Math.floor(total / 3600)).padStart(2, "0")
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0")
    const secs = String(total % 60).padStart(2, "0")
    return `${hrs}:${mins}:${secs}`
}

const formatLocation = (location?: { address?: string; latitude?: number; longitude?: number }) => {
    if (!location) return "-"
    const address = typeof location.address === "string" ? location.address.trim() : ""
    if (!address || /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/.test(address)) {
        return "Resolving address..."
    }
    return address
}

const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
    }).replace(/\//g, "-").replace(",", "");
};

const getDayKey = (dateStr?: string) => {
    if (!dateStr) return "unknown";
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return "unknown";
    return date.toLocaleDateString("en-CA");
}

const formatDayLabel = (dayKey: string) => {
    if (dayKey === "unknown") return "Unknown Date";
    const date = new Date(`${dayKey}T00:00:00`);
    if (isNaN(date.getTime())) return dayKey;
    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

const formatDayName = (dayKey: string) => {
    if (dayKey === "unknown") return "-";
    const date = new Date(`${dayKey}T00:00:00`);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString("en-GB", { weekday: "long" });
}

const averageOf = (values: number[]) => {
    if (!values.length) return 0;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const buildTripPlaybackKey = (trip: { startTime: string; endTime: string }, index: number) =>
    `${trip.startTime}|${trip.endTime}|${index}`;

const buildTripDayGroups = (individualTrips: any[] = []) => {
    const grouped = new Map<string, any[]>();

    individualTrips.forEach((trip) => {
        const dayKey = getDayKey(trip?.startTime || trip?.endTime);
        const existing = grouped.get(dayKey) || [];
        existing.push(trip);
        grouped.set(dayKey, existing);
    });

    return Array.from(grouped.entries())
        .sort(([left], [right]) => right.localeCompare(left))
        .map(([dayKey, items]) => {
            const sortedItems = [...items].sort((a, b) => {
                const leftTime = new Date(a?.startTime || a?.endTime || 0).getTime();
                const rightTime = new Date(b?.startTime || b?.endTime || 0).getTime();
                return leftTime - rightTime;
            });

            const firstTrip = sortedItems[0];
            const lastTrip = sortedItems[sortedItems.length - 1];
            const avgSpeeds = sortedItems
                .map((trip) => Number(trip?.avgSpeed))
                .filter((value) => Number.isFinite(value));
            const maxSpeeds = sortedItems
                .map((trip) => Number(trip?.maxSpeed))
                .filter((value) => Number.isFinite(value));

            return {
                key: dayKey,
                dateLabel: formatDayLabel(dayKey),
                dayName: formatDayName(dayKey),
                tripCount: sortedItems.length,
                distance: sortedItems.reduce((sum, trip) => sum + Number(trip?.distance || 0), 0),
                runningTime: sortedItems.reduce((sum, trip) => sum + Number(trip?.runningTime || 0), 0),
                idleTime: sortedItems.reduce((sum, trip) => sum + Number(trip?.idleTime || 0), 0),
                stopTime: sortedItems.reduce((sum, trip) => sum + Number(trip?.stopTime || 0), 0),
                inactiveTime: sortedItems.reduce((sum, trip) => sum + Number(trip?.inactiveTime || 0), 0),
                alerts: sortedItems.reduce((sum, trip) => sum + Number(trip?.alerts || 0), 0),
                overSpeedCount: sortedItems.reduce((sum, trip) => {
                    if (typeof trip?.overSpeed === "number") return sum + trip.overSpeed;
                    return sum + (trip?.overSpeed === "Y" ? 1 : 0);
                }, 0),
                avgSpeed: averageOf(avgSpeeds),
                maxSpeed: maxSpeeds.length ? Math.max(...maxSpeeds) : 0,
                firstIgnitionOn: firstTrip ? { time: firstTrip.startTime, location: firstTrip.startLocation } : null,
                lastIgnitionOff: lastTrip ? { time: lastTrip.endTime, location: lastTrip.endLocation } : null,
                playbackRange: firstTrip && lastTrip
                    ? { from: firstTrip.startTime, to: lastTrip.endTime }
                    : null,
                trips: sortedItems,
            };
        });
}

export function TravelSummaryPage({
    organizations,
    vehicles,
    userRole,
    userOrgId,
    mode = "travel",
}: {
    organizations: any[]
    vehicles: any[]
    userRole: string | null
    userOrgId: string | null
    mode?: "travel" | "trip"
}) {
    const [filters, setFilters] = useState<ReportFilterState>(getDefaultReportFilter())
    const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null)
    const [expandedTripDays, setExpandedTripDays] = useState<Record<string, string | null>>({})
    const [playbackVehicleId, setPlaybackVehicleId] = useState<string | null>(null)
    const [playbackDate, setPlaybackDate] = useState<string | null>(null)
    const [playbackRange, setPlaybackRange] = useState<{ from: string; to: string; dayKey?: string | null; tripKey?: string | null } | null>(null)
    const tableCardRef = useRef<HTMLDivElement | null>(null)
    const playbackAnchorRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const [playbackPanelTop, setPlaybackPanelTop] = useState<number | null>(null)

    const isValidVehicle = filters.vehicleId !== ""

    const travelQuery = useGetTravelSummaryQuery(
        { vehicleId: filters.vehicleId, from: filters.from, to: filters.to },
        { skip: !isValidVehicle || mode !== "travel" },
    )

    const tripQuery = useGetTripSummaryQuery(
        { vehicleId: filters.vehicleId, from: filters.from, to: filters.to },
        { skip: !isValidVehicle || mode !== "trip" },
    )

    const data = mode === "travel" ? travelQuery.data?.data : tripQuery.data?.data;
    const trips = (Array.isArray(data?.trips) ? data.trips : []) as Array<any>;
    const isFetching = mode === "travel" ? travelQuery.isFetching : tripQuery.isFetching;
    const error = mode === "travel" ? travelQuery.error : tripQuery.error;
    const tripGroupsByVehicle = useMemo(
        () =>
            Object.fromEntries(
                trips.map((row) => [row.vehicleId, buildTripDayGroups(Array.isArray(row.individualTrips) ? row.individualTrips : [])]),
            ),
        [trips],
    );
    const selectedPlaybackRow = useMemo(
        () => trips.find((row) => row.vehicleId === playbackVehicleId) || null,
        [trips, playbackVehicleId],
    );

    useEffect(() => {
        if (!selectedPlaybackRow?.vehicleId || !tableCardRef.current) {
            setPlaybackPanelTop(null)
            return
        }

        const updatePlaybackPanelTop = () => {
            const container = tableCardRef.current
            const anchor = playbackAnchorRefs.current[selectedPlaybackRow.vehicleId]

            if (!container || !anchor) {
                setPlaybackPanelTop(null)
                return
            }

            const containerRect = container.getBoundingClientRect()
            const anchorRect = anchor.getBoundingClientRect()
            setPlaybackPanelTop(anchorRect.top - containerRect.top)
        }

        updatePlaybackPanelTop()
        window.addEventListener("resize", updatePlaybackPanelTop)

        return () => {
            window.removeEventListener("resize", updatePlaybackPanelTop)
        }
    }, [selectedPlaybackRow, expandedVehicleId, expandedTripDays, playbackDate, playbackRange, mode, trips.length])

    // Prepare report data for export
    const reportData = useMemo(() => {
        console.log("TravelSummaryPage - mode:", mode)
        console.log("TravelSummaryPage - trips array:", trips)
        console.log("TravelSummaryPage - trips length:", trips.length)
        
        if (mode === "travel") {
            const exportData = trips.map((trip) => ({
                Branch: trip.branchName || "-",
                Vehicle: trip.vehicleNumber || "-",
                "Vehicle Make": trip.make || "-",
                "Vehicle Model": trip.model || "-",
                Driver: trip.driverName || "-",
                "IMEI No": trip.imei || "-",
                Distance: Number(trip.distance || 0).toFixed(2),
                Running: formatDuration(trip.runningTime),
                Idle: formatDuration(trip.idleTime),
                Stop: formatDuration(trip.stopTime),
                Inactive: formatDuration(trip.inactiveTime),
                "Running V/S Stop": `${formatDuration(trip.runningTime)} / ${formatDuration(trip.stopTime)}`,
                "First Ignition On": formatDateTime(trip.firstIgnitionOn),
                "Last Ignition Off": formatDateTime(trip.lastIgnitionOff),
                Speed: `${Number(trip.avgSpeed || 0).toFixed(1)} km/h`,
                IMMobilize: trip.isImmobilized ? "Yes" : "No",
                "Over speed": trip.overspeedCount || 0,
                "Alert(s)": trip.alertCount || 0,
                "No of trip": trip.tripCount || 0,
                Playback: trip.hasPlayback ? "Yes" : "No",
                "On Time": formatDateTime(trip.onTime),
                "On location": trip.onLocation || "-",
                "Off Time": formatDateTime(trip.offTime),
                "Off location": trip.offLocation || "-",
                AVG: `${Number(trip.avgSpeed || 0).toFixed(1)} km/h`,
                MAX: `${Number(trip.maxSpeed || 0).toFixed(1)} km/h`
            }))
            console.log("TravelSummaryPage - export data:", exportData)
            return exportData
        } else {
            // Trip mode - flatten individual trips
            const flattenedTrips: any[] = []
            trips.forEach((vehicle) => {
                const individualTrips = Array.isArray(vehicle.individualTrips) ? vehicle.individualTrips : []
                individualTrips.forEach((trip: any) => {
                    flattenedTrips.push({
                        Branch: vehicle.branchName || "-",
                        Vehicle: vehicle.vehicleNumber || "-",
                        "Vehicle Make": vehicle.make || "-",
                        "Vehicle Model": vehicle.model || "-",
                        Driver: vehicle.driverName || "-",
                        "IMEI No": vehicle.imei || "-",
                        "Trip Start": formatDateTime(trip.startTime),
                        "Trip End": formatDateTime(trip.endTime),
                        Distance: Number(trip.distance || 0).toFixed(2),
                        Duration: formatDuration(trip.duration),
                        "Max Speed": `${Number(trip.maxSpeed || 0).toFixed(1)} km/h`,
                        "Avg Speed": `${Number(trip.avgSpeed || 0).toFixed(1)} km/h`,
                        "Start Location": formatLocation(trip.startLocation),
                        "End Location": formatLocation(trip.endLocation)
                    })
                })
            })
            console.log("TravelSummaryPage - flattened trips:", flattenedTrips)
            return flattenedTrips
        }
    }, [trips, mode])

    const toggleTripDay = (vehicleId: string, dayKey: string) => {
        setExpandedTripDays((current) => ({
            ...current,
            [vehicleId]: current[vehicleId] === dayKey ? null : dayKey,
        }));
    }

    const renderProgressBar = (running: number, stop: number, idle: number, height: string = "h-1.5") => {
        const total = (running || 0) + (stop || 0) + (idle || 0);
        if (total === 0) return (
            <div className={`flex ${height} w-full overflow-hidden rounded-full bg-slate-100`}></div>
        );
        const runP = ((running || 0) / total) * 100;
        const stopP = ((stop || 0) / total) * 100;
        const idleP = ((idle || 0) / total) * 100;

        return (
            <div className={`flex ${height} w-full overflow-hidden rounded-full bg-slate-200 min-w-[80px]`}>
                <div className="bg-[#2f8d35]" style={{ width: `${runP}%` }}></div>
                <div className="bg-[#ea4335]" style={{ width: `${stopP}%` }}></div>
            </div>
        )
    }

    return (
        <div className="flex h-full flex-col bg-slate-50">
            <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 bg-[#2f8d35]/10 rounded-lg flex items-center justify-center text-[#2f8d35]">
                        <Navigation size={16} />
                    </div>
                    <div>
                        <h2 className="text-sm font-black text-slate-800 tracking-tight uppercase">
                            {mode === "travel" ? "Travel Summary" : "Trip Summary"}
                        </h2>
                    </div>
                </div>
            </div>

            <ReportFilterBar
                organizations={organizations}
                vehicles={vehicles}
                userRole={userRole}
                userOrgId={userOrgId}
                value={filters}
                onApply={setFilters}
                reportData={reportData}
                reportType={mode === "travel" ? "travel-summary" : "trip-summary"}
            />

            <div className="flex-1 overflow-auto p-2">
                {!isValidVehicle ? (
                    <div className="flex h-full flex-col items-center justify-center text-slate-400 bg-white rounded-xl border border-dashed border-slate-200">
                        <Navigation className="h-10 w-10 opacity-20 mb-4" />
                        <p className="text-xs font-bold uppercase tracking-widest">Select Scope to View Report</p>
                    </div>
                ) : isFetching ? (
                    <div className="flex h-full items-center justify-center bg-white rounded-xl">
                        <div className="animate-spin h-8 w-8 border-4 border-[#2f8d35]/20 border-t-[#2f8d35] rounded-full"></div>
                    </div>
                ) : error ? (
                    <div className="flex h-full items-center justify-center bg-white rounded-xl text-red-400">
                        <p className="text-sm font-bold">Failed to load {mode} data.</p>
                    </div>
                ) : (
                    <div ref={tableCardRef} className="relative bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <DragScrollArea className="w-full overflow-x-auto overflow-y-hidden">
                            {mode === "travel" ? (
                                <table className="w-max min-w-full border-collapse text-[10px] text-slate-600">
                                    <thead>
                                        <tr className="bg-[#2f8d35] text-white">
                                            <th className="border border-white/10 p-2 text-center w-6"><FilterIcon size={10} /></th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Branch</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Vehicle</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">
                                                Vehicle Make
                                            </th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Vehicle Model</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Driver</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">IMEI No</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center min-w-[220px] max-w-[280px] break-words">Start Location</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Start Odometer</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Distance</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Running V/S Stop</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words text-white">Running</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words text-[#f2a600]">Idle</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words text-[#ea4335]">Stop</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words text-blue">Inactive</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Duration</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Max Stoppage</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">No of Idle</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Speed (AVG/MAX)</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Over speed</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Alert(s)</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">End Odometer</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center min-w-[220px] max-w-[280px] break-words">End Location</th>
                                            <th className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Playback</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trips.map((row, idx) => {
                                            const isExpanded = expandedVehicleId === row.vehicleId;
                                            return (
                                                <React.Fragment key={row.vehicleId || idx}>
                                                    <tr className="hover:bg-slate-50 border-b border-slate-100">
                                                        <td className="p-2 text-center"><button onClick={() => setExpandedVehicleId(isExpanded ? null : row.vehicleId)} className={`transition-transform duration-200 ${isExpanded ? "rotate-90 text-slate-800" : "text-[#2f8d35]"}`}><Navigation size={10} fill="currentColor" /></button></td>
                                                        <td className="p-2 uppercase text-center">{row.branchName}</td>
                                                        <td className="p-2 font-bold text-center">{row.vehicleNumber}</td>
                                                        <td className="p-2 text-center">{row.make}</td>
                                                        <td className="p-2 text-center">{row.model}</td>
                                                        <td className="p-2 text-center text-slate-400">{row.driverName}</td>
                                                        <td className="p-2 text-center">{row.imei}</td>
                                                        <td className="min-w-[220px] max-w-[280px] p-2 text-center whitespace-normal break-words" title={formatLocation(row.startLocation)}>{formatLocation(row.startLocation)}</td>
                                                        <td className="p-2 text-center">{Number(row.startOdometer || 0).toFixed(2)}</td>
                                                        <td className="p-2 font-bold text-center">{Number(row.distance || 0).toFixed(2)}</td>
                                                        <td className="p-2 text-center min-w-[100px]">{renderProgressBar(row.runningTime, row.stopTime, row.idleTime)}</td>
                                                        <td className="p-2 text-[#2f8d35] font-bold text-center">{formatDuration(row.runningTime)}</td>
                                                        <td className="p-2 text-[#f2a600] font-bold text-center">{formatDuration(row.idleTime)}</td>
                                                        <td className="p-2 text-[#ea4335] font-bold text-center">{formatDuration(row.stopTime)}</td>
                                                        <td className="p-2 text-[#4285f4] font-bold text-center">{formatDuration(row.inactiveTime)}</td>
                                                        <td className="p-2 text-center">{formatDuration(row.duration)}</td>
                                                        <td className="p-2 text-[#ea4335] text-center">{formatDuration(row.maxStoppage)}</td>
                                                        <td className="p-2 text-center">{row.idleCount || 0}</td>
                                                        <td className="p-2 text-center"><span className="text-[#2f8d35]">{Math.round(row.avgSpeed)}</span> / <span className="text-[#ea4335]">{Math.round(row.maxSpeed)}</span></td>
                                                        <td className="p-2 text-center">{row.overSpeedCount || 0}</td>
                                                        <td className="p-2 text-[#ea4335] font-bold text-center">{row.alerts || 0}</td>
                                                        <td className="p-2 text-center">{Number(row.endOdometer || 0).toFixed(2)}</td>
                                                        <td className="min-w-[220px] max-w-[280px] p-2 text-center whitespace-normal break-words" title={formatLocation(row.endLocation)}>{formatLocation(row.endLocation)}</td>
                                                        <td className="p-2 text-center">
                                                            <button
                                                                onClick={() => {
                                                                    if (playbackVehicleId === row.vehicleId && !playbackDate) {
                                                                        setPlaybackVehicleId(null);
                                                                    } else {
                                                                        setPlaybackVehicleId(row.vehicleId);
                                                                        setPlaybackDate(null);
                                                                    }
                                                                }}
                                                                className="text-[#2f8d35] hover:scale-110 transition-transform"
                                                            >
                                                                <PlayCircle
                                                                    size={14}
                                                                    fill={playbackVehicleId === row.vehicleId && !playbackDate ? "#2f8d35" : "none"}
                                                                    className={playbackVehicleId === row.vehicleId && !playbackDate ? "text-[#2f8d35]" : "text-[#2f8d35]"}
                                                                />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && row.dailyBreakdown && (
                                                        <tr>
                                                            <td colSpan={24} className="bg-slate-800 p-0">
                                                                <DragScrollArea className="overflow-x-auto overflow-y-hidden">
                                                                <table className="w-max min-w-full border-collapse text-[9px] text-white/70">
                                                                    <thead className="bg-[#1a3d1a] text-white/50 uppercase font-bold text-[8px]">
                                                                        <tr>
                                                                            <th className="p-2 border border-white/5">Date</th>
                                                                            <th className="p-2 border border-white/5">Day</th>
                                                                            <th className="p-2 border border-white/5 text-[#2f8d35]">First Ignition ON</th>
                                                                            <th className="min-w-[220px] max-w-[280px] p-2 border border-white/5">Start Location</th>
                                                                            <th className="p-2 border border-white/5">Distance</th>
                                                                            <th className="p-2 border border-white/5 text-[#2f8d35]">Running</th>
                                                                            <th className="p-2 border border-white/5 text-[#f2a600]">Idle</th>
                                                                            <th className="p-2 border border-white/5 text-[#ea4335]">Stop</th>
                                                                            <th className="p-2 border border-white/5 text-[#4285f4]">Inactive</th>
                                                                            <th className="p-2 border border-white/5">Running V/S Stop</th>
                                                                            <th className="p-2 border border-white/5">Duration</th>
                                                                            <th className="p-2 border border-white/5">Speed (AVG/MAX)</th>
                                                                            <th className="p-2 border border-white/5">Alert</th>
                                                                            <th className="p-2 border border-white/5">Odometer (Start/End)</th>
                                                                            <th className="p-2 border border-white/5 text-[#ea4335]">Last Ignition Off</th>
                                                                            <th className="min-w-[220px] max-w-[280px] p-2 border border-white/5">End Location</th>
                                                                            <th className="p-2 border border-white/5">History</th>
                                                                            <th className="p-2 border border-white/5">Playback</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {row.dailyBreakdown.map((day: any, dIdx: number) => (
                                                                            <tr key={dIdx} className="hover:bg-white/5 border-b border-white/5">
                                                                                <td className="p-2 text-center text-white">{day.date}</td>
                                                                                <td className="p-2 text-center">{day.day}</td>
                                                                                <td className="p-2 text-center text-[#2f8d35]">{formatDateTime(day.firstIgnitionOn?.time)}</td>
                                                                                <td className="min-w-[220px] max-w-[280px] p-2 text-center whitespace-normal break-words" title={formatLocation(day.startLocation)}>{formatLocation(day.startLocation)}</td>
                                                                                <td className="p-2 text-center font-bold text-white">{Number(day.distance || 0).toFixed(2)}</td>
                                                                                <td className="p-2 text-center text-[#2f8d35] font-bold">{formatDuration(day.runningTime)}</td>
                                                                                <td className="p-2 text-center text-[#f2a600] font-bold">{formatDuration(day.idleTime)}</td>
                                                                                <td className="p-2 text-center text-[#ea4335] font-bold">{formatDuration(day.stopTime)}</td>
                                                                                <td className="p-2 text-center text-[#4285f4] font-bold">{formatDuration(day.inactiveTime)}</td>
                                                                                <td className="p-2 text-center min-w-[80px]">{renderProgressBar(day.runningTime, day.stopTime, day.idleTime, "h-1")}</td>
                                                                                <td className="p-2 text-center">{formatDuration(day.duration)}</td>
                                                                                <td className="p-2 text-center"><span className="text-[#2f8d35]">{Math.round(day.avgSpeed)}</span> / <span className="text-[#ea4335]">{Math.round(day.maxSpeed)}</span></td>
                                                                                <td className="p-2 text-center text-[#ea4335]">{day.alerts || 0}</td>
                                                                                <td className="p-2 text-center">{Number(day.startOdometer || 0).toFixed(1)} / {Number(day.endOdometer || 0).toFixed(1)}</td>
                                                                                <td className="p-2 text-center text-[#ea4335]">{formatDateTime(day.lastIgnitionOff?.time)}</td>
                                                                                <td className="min-w-[220px] max-w-[280px] p-2 text-center whitespace-normal break-words" title={formatLocation(day.endLocation)}>{formatLocation(day.endLocation)}</td>
                                                                                <td className="p-2 text-center"><button className="text-[#2f8d35] hover:scale-110"><History size={12} /></button></td>
                                                                                <td className="p-2 text-center">
                                                                                    <button
                                                                                        onClick={() => {
                                                                                            const parts = day.date.split("-");
                                                                                            const formatted = `${parts[2]}-${parts[1]}-${parts[0]}`;
                                                                                            setPlaybackVehicleId(row.vehicleId);
                                                                                            setPlaybackDate(formatted);
                                                                                        }}
                                                                                        className="text-[#2f8d35] hover:scale-110"
                                                                                    >
                                                                                        <PlayCircle
                                                                                            size={12}
                                                                                            fill={playbackVehicleId === row.vehicleId && playbackDate === (day.date.split("-").reverse().join("-")) ? "currentColor" : "none"}
                                                                                            className="text-[#2f8d35] fill-[#2f8d35]/20"
                                                                                        />
                                                                                    </button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                                </DragScrollArea>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {playbackVehicleId === row.vehicleId && (
                                                        <tr>
                                                            <td colSpan={24} className="border-none bg-transparent p-0">
                                                                <div
                                                                    ref={(node) => {
                                                                        playbackAnchorRefs.current[row.vehicleId] = node
                                                                    }}
                                                                    style={{ height: PLAYBACK_PANEL_HEIGHT }}
                                                                />
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            ) : (
                                <table className="w-max min-w-full border-collapse text-[10px] text-slate-600">
                                    <thead>
                                        <tr className="bg-[#2f8d35] text-white">
                                            <th rowSpan={2} className="border border-white/10 p-2 text-center w-6"><FilterIcon size={10} /></th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Branch</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Vehicle</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Vehicle Make</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Vehicle Model</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Driver</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">IMEI No</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Distance</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center text-white">Running</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center text-[#f2a600]">Idle</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center text-[#ea4335]">Stop</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center text-[#4285f4]">Inactive</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-normal text-center max-w-[100px] break-words">Running V/S Stop</th>
                                            <th colSpan={2} className="border border-white/10 p-1 font-bold whitespace-normal text-center max-w-[100px] break-words">First Ignition On</th>
                                            <th colSpan={2} className="border border-white/10 p-1 font-bold whitespace-normal text-center max-w-[100px] break-words">Last Ignition Off</th>
                                            <th colSpan={2} className="border border-white/10 p-1 font-bold whitespace-nowrap text-center bg-white/10">Speed</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">IMMobilize</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Over speed</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Alert(s)</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">No of trip</th>
                                            <th rowSpan={2} className="border border-white/10 p-2 font-bold whitespace-nowrap text-center">Playback</th>
                                        </tr>
                                        <tr className="bg-[#2f8d35] text-white/80 text-[8px]">
                                            <th className="border border-white/10 p-1 font-bold text-center">On Time</th>
                                            <th className="border border-white/10 p-1 font-bold text-center">On location</th>
                                            <th className="border border-white/10 p-1 font-bold text-center">Off Time</th>
                                            <th className="border border-white/10 p-1 font-bold text-center">Off location</th>
                                            <th className="border border-white/10 p-1 font-bold text-center">AVG</th>
                                            <th className="border border-white/10 p-1 font-bold text-center">MAX</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trips.map((row, idx) => {
                                            const isExpanded = expandedVehicleId === row.vehicleId;
                                            return (
                                                <React.Fragment key={row.vehicleId || idx}>
                                                    <tr className="hover:bg-slate-50 border-b border-slate-100">
                                                        <td className="p-2 text-center"><button onClick={() => setExpandedVehicleId(isExpanded ? null : row.vehicleId)} className={`transition-transform duration-200 ${isExpanded ? "rotate-90 text-slate-800" : "text-[#2f8d35]"}`}><Navigation size={10} fill="currentColor" /></button></td>
                                                        <td className="p-2 uppercase text-center">{row.branchName}</td>
                                                        <td className="p-2 font-bold text-center">{row.vehicleNumber}</td>
                                                        <td className="p-2 text-center">{row.make}</td>
                                                        <td className="p-2 text-center">{row.model}</td>
                                                        <td className="p-2 text-center text-slate-400">{row.driverName}</td>
                                                        <td className="p-2 text-center">{row.imei}</td>
                                                        <td className="p-2 font-bold text-center">{Number(row.distance || 0).toFixed(2)}</td>
                                                        <td className="p-2 text-[#2f8d35] font-bold text-center">{formatDuration(row.runningTime)}</td>
                                                        <td className="p-2 text-[#f2a600] font-bold text-center">{formatDuration(row.idleTime)}</td>
                                                        <td className="p-2 text-[#ea4335] font-bold text-center">{formatDuration(row.stopTime)}</td>
                                                        <td className="p-2 text-[#4285f4] font-bold text-center">{formatDuration(row.inactiveTime)}</td>
                                                        <td className="p-2 text-center min-w-[80px]">{renderProgressBar(row.runningTime, row.stopTime, row.idleTime)}</td>
                                                        <td className="p-1 text-center font-bold text-[#2f8d35]">{formatDateTime(row.firstIgnitionOn?.time)}</td>
                                                        <td className="min-w-[220px] max-w-[280px] p-1 text-center text-[9px] whitespace-normal break-words" title={formatLocation(row.firstIgnitionOn?.location)}>
                                                            {formatLocation(row.firstIgnitionOn?.location)}
                                                        </td>
                                                        <td className="p-1 text-center font-bold text-[#ea4335]">{formatDateTime(row.lastIgnitionOff?.time)}</td>
                                                        <td className="min-w-[220px] max-w-[280px] p-1 text-center text-[9px] whitespace-normal break-words" title={formatLocation(row.lastIgnitionOff?.location)}>
                                                            {formatLocation(row.lastIgnitionOff?.location)}
                                                        </td>
                                                        <td className="p-2 text-center font-bold">{Math.round(row.avgSpeed)}</td>
                                                        <td className="p-2 text-[#ea4335] font-bold text-center">{Math.round(row.maxSpeed)}</td>
                                                        <td className="p-2 text-center font-bold">{row.immobilize}</td>
                                                        <td className="p-2 text-center">{row.overSpeedCount || 0}</td>
                                                        <td className="p-2 text-[#ea4335] font-bold text-center">{row.alerts || 0}</td>
                                                        <td className="p-2 font-bold text-center text-[#2f8d35]">{row.tripCount || 0}</td>
                                                        <td className="p-2 text-center">
                                                            <button
                                                                onClick={() => {
                                                                    if (playbackVehicleId === row.vehicleId && !playbackDate && !playbackRange) {
                                                                        setPlaybackVehicleId(null);
                                                                    } else {
                                                                        setPlaybackVehicleId(row.vehicleId);
                                                                        setPlaybackDate(null);
                                                                        setPlaybackRange(null);
                                                                    }
                                                                }}
                                                                className="text-[#2f8d35] hover:scale-110 transition-transform"
                                                            >
                                                                <PlayCircle
                                                                    size={14}
                                                                    fill={playbackVehicleId === row.vehicleId && !playbackDate && !playbackRange ? "#2f8d35" : "none"}
                                                                    className={playbackVehicleId === row.vehicleId && !playbackDate && !playbackRange ? "text-[#2f8d35]" : "text-[#2f8d35]"}
                                                                />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr>
                                                            <td colSpan={24} className="bg-[#121212] p-4">
                                                                <div className="space-y-3">
                                                                    <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-[#171717] px-4 py-3">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2f8d35]/15 text-[#7bdd7f]">
                                                                                <CalendarDays size={16} />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-white/80">Day-wise Trip Breakdown</p>
                                                                                <p className="text-[10px] text-white/45">Expand a day to inspect all trips and open exact playback ranges.</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="rounded-full border border-[#2f8d35]/25 bg-[#2f8d35]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#9ff5a5]">
                                                                            {tripGroupsByVehicle[row.vehicleId]?.length || 0} day group(s)
                                                                        </div>
                                                                    </div>

                                                                    {tripGroupsByVehicle[row.vehicleId]?.map((dayGroup: any) => {
                                                                        const isDayExpanded = expandedTripDays[row.vehicleId] === dayGroup.key

                                                                        return (
                                                                            <div key={dayGroup.key} className="overflow-hidden rounded-2xl border border-white/10 bg-[#161616]">
                                                                                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-white/5 bg-[#1d1d1d] px-4 py-3">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => toggleTripDay(row.vehicleId, dayGroup.key)}
                                                                                        className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10"
                                                                                    >
                                                                                        <ChevronRight size={16} className={`transition-transform ${isDayExpanded ? "rotate-90" : ""}`} />
                                                                                    </button>
                                                                                    <div className="grid flex-1 grid-cols-2 gap-3 md:grid-cols-6 xl:grid-cols-11">
                                                                                        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Date</p><p className="mt-1 text-[11px] font-bold text-white">{dayGroup.dateLabel}</p><p className="text-[10px] text-white/45">{dayGroup.dayName}</p></div>
                                                                                        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Trips</p><p className="mt-1 text-[11px] font-bold text-[#9ff5a5]">{dayGroup.tripCount}</p></div>
                                                                                        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Distance</p><p className="mt-1 text-[11px] font-bold text-white">{Number(dayGroup.distance || 0).toFixed(2)} km</p></div>
                                                                                        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Running / Idle</p><p className="mt-1 text-[11px] font-bold text-[#7bdd7f]">{formatDuration(dayGroup.runningTime)}</p><p className="text-[10px] text-[#f2a600]">{formatDuration(dayGroup.idleTime)}</p></div>
                                                                                        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Stop / Inactive</p><p className="mt-1 text-[11px] font-bold text-[#ea4335]">{formatDuration(dayGroup.stopTime)}</p><p className="text-[10px] text-[#4285f4]">{formatDuration(dayGroup.inactiveTime)}</p></div>
                                                                                        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Ignition On</p><p className="mt-1 text-[11px] font-bold text-white">{formatDateTime(dayGroup.firstIgnitionOn?.time)}</p></div>
                                                                                        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Ignition Off</p><p className="mt-1 text-[11px] font-bold text-white">{formatDateTime(dayGroup.lastIgnitionOff?.time)}</p></div>
                                                                                        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Speed</p><p className="mt-1 text-[11px] font-bold text-white">{Math.round(dayGroup.avgSpeed)} / <span className="text-[#ea4335]">{Math.round(dayGroup.maxSpeed)}</span></p></div>
                                                                                        <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Alerts</p><p className="mt-1 text-[11px] font-bold text-[#ea4335]">{dayGroup.alerts || 0}</p></div>
                                                                                        <div className="md:col-span-2"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/35">Running V/S Stop</p><div className="mt-2">{renderProgressBar(dayGroup.runningTime, dayGroup.stopTime, dayGroup.idleTime)}</div></div>
                                                                                    </div>
                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={!dayGroup.playbackRange}
                                                                                        onClick={() => {
                                                                                            setPlaybackVehicleId(row.vehicleId)
                                                                                            setPlaybackRange(null)
                                                                                            setPlaybackDate(dayGroup.key === "unknown" ? null : dayGroup.key)
                                                                                        }}
                                                                                        className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#2f8d35]/25 bg-[#2f8d35]/10 px-3 text-[10px] font-black uppercase tracking-[0.14em] text-[#a2f3a4] transition hover:bg-[#2f8d35]/20 disabled:cursor-not-allowed disabled:opacity-50"
                                                                                    >
                                                                                        <PlayCircle size={14} fill={playbackVehicleId === row.vehicleId && playbackDate === dayGroup.key && !playbackRange ? "currentColor" : "none"} />
                                                                                        Day Playback
                                                                                    </button>
                                                                                </div>

                                                                                {isDayExpanded && (
                                                                                    <DragScrollArea className="overflow-x-auto overflow-y-hidden border-t border-white/5 bg-[#111111]">
                                                                                        <table className="w-max min-w-full border-collapse text-[9px] text-white/65">
                                                                                            <thead className="bg-[#151515] text-[8px] font-black uppercase tracking-[0.12em] text-white/45">
                                                                                                <tr>
                                                                                                    <th className="border border-white/5 p-2 text-center">Start Time</th>
                                                                                                    <th className="min-w-[220px] max-w-[280px] border border-white/5 p-2 text-center">Start Location</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">Start Odometer</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">End Time</th>
                                                                                                    <th className="min-w-[220px] max-w-[280px] border border-white/5 p-2 text-center">End Location</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">End Odometer</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">Driver</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">Distance</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">Running</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">Idle</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">Stop</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">Inactive</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">AVG / MAX</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">Alerts</th>
                                                                                                    <th className="border border-white/5 p-2 text-center">Show Path</th>
                                                                                                </tr>
                                                                                            </thead>
                                                                                            <tbody>
                                                                                                {dayGroup.trips.map((it: any, itIdx: number) => (
                                                                                                    <tr key={`${dayGroup.key}-${itIdx}`} className="border-b border-white/5 hover:bg-white/5">
                                                                                                        <td className="p-2 text-center font-bold text-white/90">{formatDateTime(it.startTime)}</td>
                                                                                                        <td className="min-w-[220px] max-w-[280px] p-2 text-center whitespace-normal break-words" title={formatLocation(it.startLocation)}>{formatLocation(it.startLocation)}</td>
                                                                                                        <td className="p-2 text-center font-mono opacity-60">{Number(it.startOdometer || 0).toFixed(1)}</td>
                                                                                                        <td className="p-2 text-center font-bold text-white/90">{formatDateTime(it.endTime)}</td>
                                                                                                        <td className="min-w-[220px] max-w-[280px] p-2 text-center whitespace-normal break-words" title={formatLocation(it.endLocation)}>{formatLocation(it.endLocation)}</td>
                                                                                                        <td className="p-2 text-center font-mono opacity-60">{Number(it.endOdometer || 0).toFixed(1)}</td>
                                                                                                        <td className="p-2 text-center text-white/45">{it.driverName}</td>
                                                                                                        <td className="p-2 text-center font-bold text-[#7bdd7f]">{Number(it.distance || 0).toFixed(2)}</td>
                                                                                                        <td className="p-2 text-center text-[#2f8d35]">{formatDuration(it.runningTime)}</td>
                                                                                                        <td className="p-2 text-center text-[#f2a600]">{formatDuration(it.idleTime)}</td>
                                                                                                        <td className="p-2 text-center text-[#ea4335]">{formatDuration(it.stopTime)}</td>
                                                                                                        <td className="p-2 text-center text-[#4285f4]">{formatDuration(it.inactiveTime)}</td>
                                                                                                        <td className="p-2 text-center font-bold text-white">{Math.round(it.avgSpeed || 0)} / <span className="text-[#ea4335]">{Math.round(it.maxSpeed || 0)}</span></td>
                                                                                                        <td className="p-2 text-center font-bold text-[#ea4335]">{it.alerts || 0}</td>
                                                                                                        <td className="p-2 text-center">
                                                                                                            <button
                                                                                                                onClick={() => {
                                                                                                                    setPlaybackVehicleId(row.vehicleId)
                                                                                                                    setPlaybackRange({
                                                                                                                        from: it.startTime,
                                                                                                                        to: it.endTime,
                                                                                                                        dayKey: dayGroup.key,
                                                                                                                        tripKey: buildTripPlaybackKey(it, itIdx),
                                                                                                                    })
                                                                                                                    setPlaybackDate(dayGroup.key)
                                                                                                                }}
                                                                                                                className="text-[#2f8d35] transition-transform hover:scale-125"
                                                                                                            >
                                                                                                                <PlayCircle size={13} fill={playbackVehicleId === row.vehicleId && playbackRange?.from === it.startTime ? "currentColor" : "none"} />
                                                                                                            </button>
                                                                                                        </td>
                                                                                                    </tr>
                                                                                                ))}
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </DragScrollArea>
                                                                                )}
                                                                            </div>
                                                                        )
                                                                    })}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                    {playbackVehicleId === row.vehicleId && (
                                                        <tr>
                                                            <td colSpan={24} className="border-none bg-transparent p-0">
                                                                <div
                                                                    ref={(node) => {
                                                                        playbackAnchorRefs.current[row.vehicleId] = node
                                                                    }}
                                                                    style={{ height: PLAYBACK_PANEL_HEIGHT }}
                                                                />
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            )}
                        </DragScrollArea>
                        {selectedPlaybackRow && playbackPanelTop !== null && (
                            <div
                                className="absolute left-0 right-0 z-20 overflow-hidden border-y border-slate-200 bg-white shadow-lg"
                                style={{ top: playbackPanelTop }}
                            >
                                <TravelPlaybackInline
                                    vehicleId={selectedPlaybackRow.vehicleId}
                                    vehicleNumber={selectedPlaybackRow.vehicleNumber}
                                    from={playbackRange?.from || filters.from}
                                    to={playbackRange?.to || filters.to}
                                    metadata={{
                                        brand: selectedPlaybackRow.make,
                                        model: selectedPlaybackRow.model,
                                        driverName: selectedPlaybackRow.driverName,
                                        imei: selectedPlaybackRow.imei,
                                        organization: selectedPlaybackRow.branchName,
                                        totalDistance: Number(selectedPlaybackRow.distance || 0),
                                        avgSpeed: Number(selectedPlaybackRow.avgSpeed || 0),
                                        vehicleType: selectedPlaybackRow.model,
                                    }}
                                    onClose={() => {
                                        setPlaybackVehicleId(null)
                                        setPlaybackRange(null)
                                        setPlaybackDate(null)
                                    }}
                                    initialDay={playbackRange?.dayKey || playbackDate || undefined}
                                    isTripPlayback={!!playbackRange}
                                    initialTripRange={playbackRange}
                                    tripDayGroups={tripGroupsByVehicle[selectedPlaybackRow.vehicleId] || []}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
