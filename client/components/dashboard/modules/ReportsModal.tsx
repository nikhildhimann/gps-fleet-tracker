"use client";

import { useState, useMemo, useEffect } from "react";
import { FileText, Download, Calendar, Filter, ChevronDown, X, Search, CheckSquare, Square } from "lucide-react";
import { useDashboardContext } from "../DashboardContext";
import { useGetVehiclesQuery } from "@/redux/api/vehicleApi";
import { useGetDriversQuery } from "@/redux/api/driversApi";
import { useLazyGetVehicleHistoryQuery } from "@/redux/api/gpsHistoryApi";
import { generateCSVExport } from "@/utils/csvExportGenerator";
import { generateExcelExport } from "@/utils/excelExportGenerator";

interface ReportsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ReportsModal({ isOpen, onClose }: ReportsModalProps) {
    const { selectedVehicle } = useDashboardContext();
    const [reportType, setReportType] = useState("General");
    const [dateRange, setDateRange] = useState({ start: "", end: "" });
    const [vehicleSearch, setVehicleSearch] = useState("");
    const [selectedVehicleIds, setSelectedVehicleIds] = useState<string[]>([]);
    const [fetchEnabled, setFetchEnabled] = useState(false);
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize] = useState(20);
    const [showAllTime, setShowAllTime] = useState(false);
    const [vehiclePage, setVehiclePage] = useState(0);
    const vehiclePageSize = 10;

    const { data: vehData } = useGetVehiclesQuery(undefined);
    const { data: driversData } = useGetDriversQuery(undefined);
    const vehicles = useMemo(() => vehData?.vehicles || vehData?.data || [], [vehData]);
    const drivers = useMemo(() => driversData?.drivers || driversData?.data || [], [driversData]);

    useEffect(() => {
        if (selectedVehicle && isOpen) {
            setSelectedVehicleIds([selectedVehicle.id]);
        }
    }, [selectedVehicle, isOpen]);

    // Reset when modal closes
    useEffect(() => {
        if (!isOpen) {
            setFetchEnabled(false);
            setCombinedHistory([]);
            setDateRange({ start: "", end: "" });
            setVehicleSearch("");
            setReportType("General");
            setCurrentPage(0);
            setShowAllTime(false);
            setVehiclePage(0);
        }
    }, [isOpen]);

    const filteredVehicles = useMemo(() => {
        if (!vehicleSearch) return vehicles;
        const lowerSearch = vehicleSearch.toLowerCase();
        return vehicles.filter((v: any) =>
            v.vehicleNumber?.toLowerCase().includes(lowerSearch) ||
            v.driverName?.toLowerCase().includes(lowerSearch) ||
            v.name?.toLowerCase().includes(lowerSearch)
        );
    }, [vehicles, vehicleSearch]);

    // Pagination for vehicles
    const paginatedVehicles = useMemo(() => {
        const startIndex = vehiclePage * vehiclePageSize;
        const endIndex = startIndex + vehiclePageSize;
        return filteredVehicles.slice(startIndex, endIndex);
    }, [filteredVehicles, vehiclePage]);

    const totalVehiclePages = Math.ceil(filteredVehicles.length / vehiclePageSize);
    const hasNextVehiclePage = vehiclePage < totalVehiclePages - 1;
    const hasPrevVehiclePage = vehiclePage > 0;

    const allSelected = paginatedVehicles.length > 0 && selectedVehicleIds.length === filteredVehicles.length;

    const toggleSelectAll = () => {
        if (allSelected) {
            setSelectedVehicleIds([]);
        } else {
            setSelectedVehicleIds(filteredVehicles.map((v: any) => v.id || v._id));
        }
    };

    const toggleVehicle = (id: string) => {
        setSelectedVehicleIds(prev =>
            prev.includes(id) ? prev.filter(vid => vid !== id) : [...prev, id]
        );
    };

    const [triggerFetchHistory] = useLazyGetVehicleHistoryQuery();
    const [combinedHistory, setCombinedHistory] = useState<any[]>([]);
    const [isFetching, setIsFetching] = useState(false);

    const handleGenerate = async () => {
        if (selectedVehicleIds.length === 0) {
            alert("Please select at least one vehicle.");
            return;
        }
        if (!showAllTime && (!dateRange.start || !dateRange.end)) {
            alert("Please select a date range or choose 'All Time'.");
            return;
        }

        setIsFetching(true);
        setFetchEnabled(true);
        setCombinedHistory([]);
        setCurrentPage(0);

        try {
            let results: any[] = [];

            // Different API calls based on report type
            switch (reportType) {
                case "Trip":
                    // Use trip summary API
                    const tripPromises = selectedVehicleIds.map(async (vid) => {
                        const res = await triggerFetchHistory({
                            vehicleId: vid,
                            from: showAllTime ? undefined : dateRange.start,
                            to: showAllTime ? undefined : dateRange.end,
                            page: 0,
                            limit: showAllTime ? 10000 : 1000
                        }).unwrap();
                        
                        const vehicleObj = vehicles.find((v: any) => (v.id || v._id) === vid);
                        return (res.data || res.history || [])
                            .filter((point: any) => point.ignition && point.speed > 0) // Only moving points
                            .map((point: any) => ({
                                ...point,
                                vehicleName: vehicleObj?.name || vehicleObj?.vehicleNumber || "Unknown",
                                driverName: getDriverName(vehicleObj),
                                vehicleNumber: vehicleObj?.vehicleNumber || "Unknown Vehicle",
                                deviceImei: getDeviceImei(vehicleObj),
                                reportType: "Trip"
                            }));
                    });
                    results = (await Promise.all(tripPromises)).flat();
                    break;

                case "Idle":
                    // Filter for idle points
                    const idlePromises = selectedVehicleIds.map(async (vid) => {
                        const res = await triggerFetchHistory({
                            vehicleId: vid,
                            from: showAllTime ? undefined : dateRange.start,
                            to: showAllTime ? undefined : dateRange.end,
                            page: 0,
                            limit: showAllTime ? 10000 : 1000
                        }).unwrap();
                        
                        const vehicleObj = vehicles.find((v: any) => (v.id || v._id) === vid);
                        return (res.data || res.history || [])
                            .filter((point: any) => !point.ignition || (point.speed !== undefined && point.speed <= 2)) // Ignition off or very low speed
                            .map((point: any) => ({
                                ...point,
                                vehicleName: vehicleObj?.name || vehicleObj?.vehicleNumber || "Unknown",
                                driverName: getDriverName(vehicleObj),
                                vehicleNumber: vehicleObj?.vehicleNumber || "Unknown Vehicle",
                                deviceImei: getDeviceImei(vehicleObj),
                                reportType: "Idle"
                            }));
                    });
                    results = (await Promise.all(idlePromises)).flat();
                    break;

                case "Alert":
                    // Filter for alert conditions (high speed, geofence violations, etc.)
                    const alertPromises = selectedVehicleIds.map(async (vid) => {
                        const res = await triggerFetchHistory({
                            vehicleId: vid,
                            from: showAllTime ? undefined : dateRange.start,
                            to: showAllTime ? undefined : dateRange.end,
                            page: 0,
                            limit: showAllTime ? 10000 : 1000
                        }).unwrap();
                        
                        const vehicleObj = vehicles.find((v: any) => (v.id || v._id) === vid);
                        return (res.data || res.history || [])
                            .filter((point: any) => {
                                // Alert conditions: overspeeding, sudden stops, etc.
                                return point.speed && point.speed > 80; // Speeding alerts
                            })
                            .map((point: any) => ({
                                ...point,
                                vehicleName: vehicleObj?.name || vehicleObj?.vehicleNumber || "Unknown",
                                driverName: getDriverName(vehicleObj),
                                vehicleNumber: vehicleObj?.vehicleNumber || "Unknown Vehicle",
                                deviceImei: getDeviceImei(vehicleObj),
                                reportType: "Alert",
                                alertType: "Speeding"
                            }));
                    });
                    results = (await Promise.all(alertPromises)).flat();
                    break;

                case "Fuel":
                    // Simulate fuel data (would normally come from fuel API)
                    const fuelPromises = selectedVehicleIds.map(async (vid) => {
                        const res = await triggerFetchHistory({
                            vehicleId: vid,
                            from: showAllTime ? undefined : dateRange.start,
                            to: showAllTime ? undefined : dateRange.end,
                            page: 0,
                            limit: showAllTime ? 10000 : 1000
                        }).unwrap();
                        
                        const vehicleObj = vehicles.find((v: any) => (v.id || v._id) === vid);
                        return (res.data || res.history || [])
                            .map((point: any) => ({
                                ...point,
                                vehicleName: vehicleObj?.name || vehicleObj?.vehicleNumber || "Unknown",
                                driverName: getDriverName(vehicleObj),
                                vehicleNumber: vehicleObj?.vehicleNumber || "Unknown Vehicle",
                                deviceImei: getDeviceImei(vehicleObj),
                                reportType: "Fuel",
                                fuelLevel: Math.floor(Math.random() * 100), // Simulated fuel data
                                fuelConsumption: (point.speed || 0) * 0.1 // Simulated consumption
                            }));
                    });
                    results = (await Promise.all(fuelPromises)).flat();
                    break;

                default: // General Report
                    const generalPromises = selectedVehicleIds.map(async (vid) => {
                        const res = await triggerFetchHistory({
                            vehicleId: vid,
                            from: showAllTime ? undefined : dateRange.start,
                            to: showAllTime ? undefined : dateRange.end,
                            page: 0,
                            limit: showAllTime ? 10000 : 1000
                        }).unwrap();
                        
                        const vehicleObj = vehicles.find((v: any) => (v.id || v._id) === vid);
                        return (res.data || res.history || []).map((point: any) => ({
                            ...point,
                            vehicleName: vehicleObj?.name || vehicleObj?.vehicleNumber || "Unknown",
                            driverName: getDriverName(vehicleObj),
                            vehicleNumber: vehicleObj?.vehicleNumber || "Unknown Vehicle",
                            deviceImei: getDeviceImei(vehicleObj),
                            reportType: "General"
                        }));
                    });
                    results = (await Promise.all(generalPromises)).flat();
                    break;
            }

            // Sort by timestamp
            const sortedResults = results.sort((a, b) =>
                new Date(b.timestamp || b.createdAt).getTime() - new Date(a.timestamp || a.createdAt).getTime()
            );

            setCombinedHistory(sortedResults);
        } catch (error) {
            console.error("Failed to fetch reports:", error);
            alert("Failed to fetch some reports. Please try again.");
        } finally {
            setIsFetching(false);
        }
    };

    // Reset fetch when params change
    useEffect(() => {
        if (isOpen) {
            setFetchEnabled(false);
            setCombinedHistory([]);
            setCurrentPage(0);
        }
    }, [selectedVehicleIds, dateRange, reportType, showAllTime, isOpen]);

    const getTableColumns = () => {
        switch (reportType) {
            case "Trip":
                return [
                    { key: "vehicleNumber", label: "Main Vehicle" },
                    { key: "timestamp", label: "Trip Start" },
                    { key: "speed", label: "Avg Speed (km/h)" },
                    { key: "location", label: "Route" },
                    { key: "ignition", label: "Status" },
                    { key: "driverName", label: "Driver" }
                ];
            case "Idle":
                return [
                    { key: "vehicleNumber", label: "Main Vehicle" },
                    { key: "timestamp", label: "Idle Start" },
                    { key: "speed", label: "Duration" },
                    { key: "location", label: "Location" },
                    { key: "ignition", label: "Engine Status" },
                    { key: "driverName", label: "Driver" }
                ];
            case "Alert":
                return [
                    { key: "vehicleNumber", label: "Main Vehicle" },
                    { key: "timestamp", label: "Alert Time" },
                    { key: "alertType", label: "Alert Type" },
                    { key: "speed", label: "Speed (km/h)" },
                    { key: "location", label: "Location" },
                    { key: "driverName", label: "Driver" }
                ];
            case "Fuel":
                return [
                    { key: "vehicleNumber", label: "Main Vehicle" },
                    { key: "timestamp", label: "Reading Time" },
                    { key: "fuelLevel", label: "Fuel Level (%)" },
                    { key: "fuelConsumption", label: "Consumption (L/h)" },
                    { key: "location", label: "Location" },
                    { key: "driverName", label: "Driver" }
                ];
            default: // General
                return [
                    { key: "vehicleNumber", label: "Main Vehicle" },
                    { key: "timestamp", label: "Timestamp" },
                    { key: "speed", label: "Speed (km/h)" },
                    { key: "location", label: "Location" },
                    { key: "ignition", label: "Ignition" },
                    { key: "driverName", label: "Driver Name" },
                    { key: "deviceImei", label: "Device IMEI" }
                ];
        }
    };

    const getDeviceImei = (vehicle: any) => {
        // Try multiple possible fields for device IMEI
        if (vehicle.deviceImei) return vehicle.deviceImei;
        if (vehicle.imei) return vehicle.imei;
        if (vehicle.assignedDeviceId?.imei) return vehicle.assignedDeviceId.imei;
        if (vehicle.gpsDeviceId?.imei) return vehicle.gpsDeviceId.imei;
        if (vehicle.device?.imei) return vehicle.device.imei;
        
        // If no IMEI found, try to get it from the device ID
        if (vehicle.assignedDeviceId) {
            return vehicle.assignedDeviceId; // Return the device ID as fallback
        }
        
        return "Unknown Device";
    };

    const getDriverName = (vehicle: any) => {
        // Create driver lookup map (similar to dashboard page)
        const driverById = new Map();
        const driverByVehicleId = new Map();
        
        drivers?.forEach((driver: any) => {
            if (driver._id) driverById.set(driver._id, driver);
            if (driver.vehicleId) driverByVehicleId.set(driver.vehicleId, driver);
        });
        
        // Use the same logic as dashboard page
        const vehicleDriverId = vehicle.driverId?._id || vehicle.driverId;
        const driverFromVehicleId = vehicleDriverId ? driverById.get(vehicleDriverId) : null;
        const driverFromAssignedVehicle = driverByVehicleId.get(vehicle._id) || null;
        const driverData =
            (vehicle.driverId && typeof vehicle.driverId === "object" ? vehicle.driverId : null) ||
            driverFromVehicleId ||
            driverFromAssignedVehicle;
        
        const driverFirstName = driverData?.firstName || "";
        const driverLastName = driverData?.lastName || "";
        const driverName = [
            `${driverFirstName} ${driverLastName}`.trim(),
            driverData?.name,
            driverData?.fullName,
            vehicle?.driverName,
        ].find(Boolean);
        
        return driverName || "Unknown Driver";
    };

    const renderTableCell = (row: any, column: any) => {
        const value = row[column.key];
        
        switch (column.key) {
            case "timestamp":
                return new Date(value || row.createdAt).toLocaleString();
            case "location":
                return `${row.latitude?.toFixed(4) || "0"}, ${row.longitude?.toFixed(4) || "0"}`;
            case "ignition":
                return row.ignition || row.ignitionStatus ? (
                    <span className="bg-[#38a63c]/10 text-[#38a63c] px-2 py-1 rounded">ON</span>
                ) : (
                    <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded">OFF</span>
                );
            case "speed":
                return value || 0;
            case "alertType":
                return <span className="bg-red-100 text-red-700 px-2 py-1 rounded font-semibold">{value}</span>;
            case "fuelLevel":
                return `${value}%`;
            case "fuelConsumption":
                return `${value?.toFixed(2) || 0} L/h`;
            default:
                return value || "N/A";
        }
    };

    // Pagination
    const paginatedData = useMemo(() => {
        const startIndex = currentPage * pageSize;
        const endIndex = startIndex + pageSize;
        return combinedHistory.slice(startIndex, endIndex);
    }, [combinedHistory, currentPage, pageSize]);

    const totalPages = Math.ceil(combinedHistory.length / pageSize);
    const hasNextPage = currentPage < totalPages - 1;
    const hasPrevPage = currentPage > 0;
    const tableColumns = getTableColumns();

    const handleExportCSV = () => {
        if (combinedHistory.length === 0) {
            alert("No data to export");
            return;
        }

        const allowedFields = [
            "vehicleName",
            "vehicleNumber",
            "driverName", 
            "deviceImei",
            "timestamp",
            "createdAt",
            "speed",
            "latitude",
            "longitude",
            "ignition",
            "ignitionStatus",
            "address",
            "poi"
        ];

        const fileName = `vehicle-report-${new Date().toISOString().split('T')[0]}.csv`;
        generateCSVExport({ data: combinedHistory, allowedFields, fileName });
    };

    const handleExportExcel = async () => {
        if (combinedHistory.length === 0) {
            alert("No data to export");
            return;
        }

        const allowedFields = [
            "vehicleName",
            "vehicleNumber",
            "driverName", 
            "deviceImei",
            "timestamp",
            "createdAt",
            "speed",
            "latitude",
            "longitude",
            "ignition",
            "ignitionStatus",
            "address",
            "poi"
        ];

        const fileName = `vehicle-report-${new Date().toISOString().split('T')[0]}.xlsx`;
        const sheetName = "Vehicle Report";
        await generateExcelExport({ data: combinedHistory, allowedFields, fileName, sheetName });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative w-full max-w-6xl max-h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-[#ecf8ea] border-b border-[#d8e6d2] px-6 py-4 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-[#2f8d35]">Vehicle Reports</h2>
                        <p className="text-sm text-slate-600 mt-1">Generate detailed reports for selected vehicles</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-full bg-white/80 hover:bg-white border border-[#d8e6d2] p-2 text-slate-400 shadow-sm transition-colors hover:text-slate-600"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Vehicle Selection Section */}
                    <div className="space-y-4 border border-[#d8e6d2] rounded-2xl p-4 bg-[#f7fbf5]">
                        <div className="flex items-center justify-between">
                            <label className="text-sm font-bold text-[#2f8d35] uppercase tracking-wide">Select Vehicles</label>
                            <div className="relative w-64">
                                <input
                                    type="text"
                                    placeholder="Search vehicle..."
                                    value={vehicleSearch}
                                    onChange={(e) => setVehicleSearch(e.target.value)}
                                    className="w-full bg-white border border-[#d8e6d2] rounded-xl pl-10 pr-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38a63c]/20"
                                />
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>

                        <div className="flex flex-col border border-[#d8e6d2] rounded-xl overflow-hidden max-h-48 bg-white">
                            <div
                                className="flex items-center gap-3 p-3 border-b border-[#d8e6d2] bg-[#f7fbf5] cursor-pointer hover:bg-[#ecf8ea]"
                                onClick={toggleSelectAll}
                            >
                                {allSelected ? <CheckSquare size={16} className="text-[#38a63c]" /> : <Square size={16} className="text-slate-500" />}
                                <span className="text-sm font-semibold text-slate-700">Select All ({filteredVehicles.length})</span>
                            </div>
                            <div className="overflow-y-auto">
                                {paginatedVehicles.map((v: any) => {
                                    const vid = v.id || v._id;
                                    const isSelected = selectedVehicleIds.includes(vid);
                                    return (
                                        <div
                                            key={vid}
                                            className="flex items-center gap-3 p-3 border-b border-[#d8e6d2]/50 cursor-pointer hover:bg-[#f7fbf5]"
                                            onClick={() => toggleVehicle(vid)}
                                        >
                                            {isSelected ? <CheckSquare size={16} className="text-[#38a63c]" /> : <Square size={16} className="text-slate-500" />}
                                            <span className="text-sm text-slate-700">{v.vehicleNumber || v.name || "Unknown Vehicle"}{getDriverName(v) ? ` - ${getDriverName(v)}` : ""}</span>
                                        </div>
                                    );
                                })}
                                {paginatedVehicles.length === 0 && (
                                    <div className="p-4 text-center text-sm text-slate-500">No vehicles found.</div>
                                )}
                            </div>
                            
                            {/* Vehicle Pagination */}
                            {filteredVehicles.length > vehiclePageSize && (
                                <div className="flex items-center justify-between px-3 py-2 border-t border-[#d8e6d2] bg-[#f7fbf5]">
                                    <div className="text-xs text-slate-600">
                                        Showing {vehiclePage * vehiclePageSize + 1} to {Math.min((vehiclePage + 1) * vehiclePageSize, filteredVehicles.length)} of {filteredVehicles.length} vehicles
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setVehiclePage(prev => Math.max(0, prev - 1))}
                                            disabled={!hasPrevVehiclePage}
                                            className="px-2 py-1 text-xs font-semibold bg-white border border-[#d8e6d2] rounded hover:bg-[#f7fbf5] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <span className="px-2 py-1 text-xs text-slate-600">
                                            Page {vehiclePage + 1} of {totalVehiclePages}
                                        </span>
                                        <button
                                            onClick={() => setVehiclePage(prev => Math.min(totalVehiclePages - 1, prev + 1))}
                                            disabled={!hasNextVehiclePage}
                                            className="px-2 py-1 text-xs font-semibold bg-white border border-[#d8e6d2] rounded hover:bg-[#f7fbf5] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Report Type */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[#2f8d35] uppercase tracking-wide">Report Type</label>
                            <div className="relative">
                                <select
                                    value={reportType}
                                    onChange={(e) => setReportType(e.target.value)}
                                    className="w-full bg-white border border-[#d8e6d2] rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#38a63c]/20 transition-all hover:border-[#38a63c]/30"
                                >
                                    <option value="General">General Report</option>
                                    <option value="Trip">Trip Report</option>
                                    <option value="Idle">Idle Report</option>
                                    <option value="Alert">Alert Report</option>
                                    <option value="Fuel">Fuel Report</option>
                                </select>
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* All Time Toggle */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[#2f8d35] uppercase tracking-wide">Date Range</label>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowAllTime(!showAllTime);
                                        if (!showAllTime) {
                                            setDateRange({ start: "", end: "" });
                                        }
                                    }}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                                        showAllTime 
                                            ? 'bg-[#38a63c] text-white' 
                                            : 'bg-white border border-[#d8e6d2] text-slate-700 hover:border-[#38a63c]/30'
                                    }`}
                                >
                                    All Time
                                </button>
                            </div>
                        </div>

                        {/* Date From */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[#2f8d35] uppercase tracking-wide">Date From</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={dateRange.start}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                    disabled={showAllTime}
                                    className="w-full bg-white border border-[#d8e6d2] rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38a63c]/20 transition-all [color-scheme:light] disabled:opacity-50 disabled:bg-slate-100"
                                />
                                <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>

                        {/* Date To */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-[#2f8d35] uppercase tracking-wide">Date To</label>
                            <div className="relative">
                                <input
                                    type="date"
                                    value={dateRange.end}
                                    onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                    disabled={showAllTime}
                                    className="w-full bg-white border border-[#d8e6d2] rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#38a63c]/20 transition-all [color-scheme:light] disabled:opacity-50 disabled:bg-slate-100"
                                />
                                <Calendar size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 py-4 border-y border-[#d8e6d2]">
                        <button 
                            onClick={handleGenerate} 
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#38a63c] text-white rounded-xl text-sm font-bold uppercase tracking-tight hover:bg-[#2f8d35] transition-all active:scale-95 disabled:opacity-50"
                            disabled={isFetching}
                        >
                            <Filter size={16} /> {isFetching ? "Generating..." : "Generate Report"}
                        </button>
                        <button 
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-[#d8e6d2] text-slate-700 rounded-xl text-sm font-bold hover:bg-[#f7fbf5] transition-all disabled:opacity-50"
                            disabled={combinedHistory.length === 0}
                        >
                            <Download size={16} /> Export CSV
                        </button>
                        <button 
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-[#d8e6d2] text-slate-700 rounded-xl text-sm font-bold hover:bg-[#f7fbf5] transition-all disabled:opacity-50"
                            disabled={combinedHistory.length === 0}
                        >
                            <Download size={16} /> Export Excel
                        </button>
                    </div>

                    {/* Data Table */}
                    {fetchEnabled ? (
                        <div className="rounded-2xl border border-[#d8e6d2] bg-white overflow-hidden min-h-[300px]">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-[#f7fbf5] border-b border-[#d8e6d2]">
                                        <tr>
                                            {tableColumns.map((column, index) => (
                                                <th key={index} className="px-4 py-3 font-bold text-slate-700">
                                                    {column.label}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#d8e6d2]/30">
                                        {isFetching ? (
                                            <tr>
                                                <td colSpan={tableColumns.length} className="px-4 py-8 text-center text-slate-500">Generating report...</td>
                                            </tr>
                                        ) : paginatedData.length > 0 ? (
                                            paginatedData.map((row: any, i: number) => (
                                                <tr key={i} className="hover:bg-[#f7fbf5]">
                                                    {tableColumns.map((column, colIndex) => (
                                                        <td key={colIndex} className="px-4 py-3 text-slate-600">
                                                            {renderTableCell(row, column)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={tableColumns.length} className="px-4 py-8 text-center text-slate-500">No data found for this period.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {/* Pagination */}
                            {combinedHistory.length > pageSize && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-[#d8e6d2] bg-[#f7fbf5]">
                                    <div className="text-sm text-slate-600">
                                        Showing {currentPage * pageSize + 1} to {Math.min((currentPage + 1) * pageSize, combinedHistory.length)} of {combinedHistory.length} records
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.max(0, prev - 1))}
                                            disabled={!hasPrevPage}
                                            className="px-3 py-1 text-sm font-semibold bg-white border border-[#d8e6d2] rounded-lg hover:bg-[#f7fbf5] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Previous
                                        </button>
                                        <span className="px-3 py-1 text-sm text-slate-600">
                                            Page {currentPage + 1} of {totalPages}
                                        </span>
                                        <button
                                            onClick={() => setCurrentPage(prev => Math.min(totalPages - 1, prev + 1))}
                                            disabled={!hasNextPage}
                                            className="px-3 py-1 text-sm font-semibold bg-white border border-[#d8e6d2] rounded-lg hover:bg-[#f7fbf5] disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Next
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="rounded-2xl border border-[#d8e6d2] bg-[#f7fbf5] p-8 flex flex-col items-center justify-center text-slate-500 italic text-center min-h-[300px]">
                            <FileText size={48} className="mb-4 opacity-20" />
                            <p className="text-sm">Select vehicles, date range, and click "Generate Report" to view results</p>
                            <p className="text-xs uppercase tracking-widest mt-2 opacity-50">Report engine ready</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
