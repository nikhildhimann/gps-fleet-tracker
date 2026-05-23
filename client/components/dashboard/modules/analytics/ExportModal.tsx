"use client"

import { useState } from "react"
import { X, Download, FileSpreadsheet, FileText, Calendar, ArrowRight } from "lucide-react"
import { generateCSVExport } from "@/utils/csvExportGenerator"
import { generateExcelExport } from "@/utils/excelExportGenerator"

export interface ExportModalState {
    from: string
    to: string
    format: "csv" | "excel"
    dateRange: "current" | "custom" | "all"
}

interface ExportModalProps {
    isOpen: boolean
    onClose: () => void
    reportData: any[]
    reportType: string
    currentFilters: { from: string; to: string }
}

export function getDefaultExportState(currentFilters: { from: string; to: string }): ExportModalState {
    return {
        from: currentFilters.from,
        to: currentFilters.to,
        format: "csv",
        dateRange: "current"
    }
}

export function ExportModal({ isOpen, onClose, reportData, reportType, currentFilters }: ExportModalProps) {
    const [exportState, setExportState] = useState<ExportModalState>(
        getDefaultExportState(currentFilters)
    )

    if (!isOpen) return null

    const handleExport = async () => {
        if (!reportData || reportData.length === 0) {
            console.warn("No data to export")
            return
        }

        // Determine dates based on selection
        let exportFrom = exportState.from
        let exportTo = exportState.to
        let dataToExport = reportData

        if (exportState.dateRange === "all") {
            // For "All Dates", use a very wide date range
            exportFrom = "2020-01-01"
            exportTo = new Date().toISOString().split('T')[0]
            console.log("All dates selected - using wide date range")
        } else if (exportState.dateRange === "current") {
            // Use current filter dates
            exportFrom = currentFilters.from
            exportTo = currentFilters.to
        }
        // For "custom", use the dates from the date inputs

        // Determine fields based on report type
        let allowedFields: string[] = []
        let fileName = "report"

        if (reportType === "statistics") {
            allowedFields = ["Metric", "Value"]
            fileName = `statistics-report-${exportFrom}-to-${exportTo}`
        } else if (reportType === "daywise") {
            allowedFields = ["Date", "Distance"]
            fileName = `daywise-distance-${exportFrom}-to-${exportTo}`
        } else if (reportType === "daywise-distance") {
            allowedFields = Object.keys(reportData[0] || {})
            fileName = `daywise-distance-report-${exportFrom}-to-${exportTo}`
        } else if (reportType === "travel-summary") {
            allowedFields = Object.keys(reportData[0] || {})
            fileName = `travel-summary-${exportFrom}-to-${exportTo}`
        } else if (reportType === "trip-summary") {
            allowedFields = Object.keys(reportData[0] || {})
            fileName = `trip-summary-${exportFrom}-to-${exportTo}`
        } else if (reportType === "alert-summary") {
            allowedFields = Object.keys(reportData[0] || {})
            fileName = `alert-summary-${exportFrom}-to-${exportTo}`
        } else if (reportType === "vehicle-status") {
            allowedFields = Object.keys(reportData[0] || {})
            fileName = `vehicle-status-${exportFrom}-to-${exportTo}`
        } else if (reportType === "ac-summary") {
            allowedFields = Object.keys(reportData[0] || {})
            fileName = `ac-summary-${exportFrom}-to-${exportTo}`
        } else {
            // Default: use all fields from first row
            allowedFields = Object.keys(reportData[0] || {})
            fileName = `${reportType || 'report'}-${exportFrom}-to-${exportTo}`
        }

        const exportOptions = {
            data: dataToExport,
            allowedFields,
            fileName: exportState.format === "excel" ? `${fileName}.xlsx` : `${fileName}.csv`,
            sheetName: reportType === "statistics" ? "Statistics" : 
                      reportType === "daywise" || reportType === "daywise-distance" ? "Daywise Distance" :
                      reportType === "travel-summary" ? "Travel Summary" :
                      reportType === "trip-summary" ? "Trip Summary" :
                      reportType === "alert-summary" ? "Alert Summary" :
                      reportType === "vehicle-status" ? "Vehicle Status" :
                      reportType === "ac-summary" ? "AC Summary" : "Report"
        }

        if (exportState.format === "excel") {
            await generateExcelExport(exportOptions)
        } else {
            generateCSVExport(exportOptions)
        }

        onClose()
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl border border-[#d8e6d2] shadow-xl max-w-md w-full">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[#edf3e8]">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-[#f0f9ef] flex items-center justify-center">
                            <Download className="h-5 w-5 text-[#2f8d35]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-[#1f3b1f]">Export Report</h3>
                            <p className="text-sm text-slate-500">Choose format and date range</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="h-8 w-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                    >
                        <X className="h-4 w-4 text-slate-400" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {/* Date Range */}
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 mb-3">
                            Date Range
                        </label>
                        
                        {/* Date Range Options */}
                        <div className="grid grid-cols-3 gap-2 mb-3">
                            <button
                                onClick={() => setExportState(prev => ({ ...prev, dateRange: "current" }))}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                    exportState.dateRange === "current"
                                        ? "bg-[#2f8d35] text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                            >
                                Current
                            </button>
                            <button
                                onClick={() => setExportState(prev => ({ ...prev, dateRange: "custom" }))}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                    exportState.dateRange === "custom"
                                        ? "bg-[#2f8d35] text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                            >
                                Custom
                            </button>
                            <button
                                onClick={() => setExportState(prev => ({ ...prev, dateRange: "all" }))}
                                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                                    exportState.dateRange === "all"
                                        ? "bg-[#2f8d35] text-white"
                                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                }`}
                            >
                                All Dates
                            </button>
                        </div>

                        {/* Custom Date Inputs */}
                        {exportState.dateRange === "custom" && (
                            <div className="flex items-center gap-3 bg-[#f7fbf5] border border-[#d8e6d2] rounded-xl p-3">
                                <Calendar size={16} className="text-[#2f8d35]" />
                                <input
                                    type="date"
                                    value={exportState.from}
                                    onChange={(e) => setExportState(prev => ({ ...prev, from: e.target.value }))}
                                    className="flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                                />
                                <ArrowRight size={14} className="text-slate-300" />
                                <input
                                    type="date"
                                    value={exportState.to}
                                    onChange={(e) => setExportState(prev => ({ ...prev, to: e.target.value }))}
                                    className="flex-1 bg-transparent text-sm font-semibold text-slate-700 outline-none"
                                />
                            </div>
                        )}

                        {/* Current/All Dates Display */}
                        {exportState.dateRange !== "custom" && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <div className="flex items-center gap-2">
                                    <Calendar size={16} className="text-slate-400" />
                                    <span className="text-sm font-semibold text-slate-600">
                                        {exportState.dateRange === "current" 
                                            ? `${currentFilters.from} → ${currentFilters.to}`
                                            : "All available data"
                                        }
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Format Selection */}
                    <div>
                        <label className="block text-[11px] font-black uppercase tracking-[0.22em] text-slate-500 mb-3">
                            Export Format
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setExportState(prev => ({ ...prev, format: "csv" }))}
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                    exportState.format === "csv"
                                        ? "border-[#2f8d35] bg-[#f0f9ef]"
                                        : "border-[#d8e6d2] bg-white hover:border-[#2f8d35]/30"
                                }`}
                            >
                                <FileText className={`h-5 w-5 ${exportState.format === "csv" ? "text-[#2f8d35]" : "text-slate-400"}`} />
                                <div className="text-left">
                                    <p className={`text-sm font-bold ${exportState.format === "csv" ? "text-[#2f8d35]" : "text-slate-700"}`}>
                                        CSV
                                    </p>
                                    <p className="text-xs text-slate-500">Comma separated values</p>
                                </div>
                            </button>

                            <button
                                onClick={() => setExportState(prev => ({ ...prev, format: "excel" }))}
                                className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                                    exportState.format === "excel"
                                        ? "border-[#2f8d35] bg-[#f0f9ef]"
                                        : "border-[#d8e6d2] bg-white hover:border-[#2f8d35]/30"
                                }`}
                            >
                                <FileSpreadsheet className={`h-5 w-5 ${exportState.format === "excel" ? "text-[#2f8d35]" : "text-slate-400"}`} />
                                <div className="text-left">
                                    <p className={`text-sm font-bold ${exportState.format === "excel" ? "text-[#2f8d35]" : "text-slate-700"}`}>
                                        Excel
                                    </p>
                                    <p className="text-xs text-slate-500">Spreadsheet format</p>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Export Info */}
                    <div className="bg-slate-50 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-2 w-2 rounded-full bg-[#2f8d35]"></div>
                            <p className="text-xs font-semibold text-slate-600">
                                Ready to export {reportData.length} record{reportData.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                        <p className="text-xs text-slate-500">
                            File will be downloaded as: <span className="font-mono text-slate-700">
                                {reportType}-{exportState.dateRange === "current" ? `${currentFilters.from}-to-${currentFilters.to}` : 
                                 exportState.dateRange === "all" ? "all-dates" : 
                                 `${exportState.from}-to-${exportState.to}`}.{exportState.format}
                            </span>
                        </p>
                        {exportState.dateRange === "all" && (
                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-xs text-blue-700">
                                    📊 All available data will be exported from the system.
                                </p>
                            </div>
                        )}
                        {exportState.dateRange === "custom" && (
                            <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                <p className="text-xs text-amber-700">
                                    ⚠️ Custom date range selected. Export will use current displayed data.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center gap-3 p-6 border-t border-[#edf3e8]">
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-xl border border-[#d8e6d2] bg-white text-sm font-bold text-slate-700 hover:bg-[#eef8ec] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex-1 px-4 py-2.5 rounded-xl bg-[#2f8d35] text-sm font-bold text-white hover:bg-[#26702b] transition-colors flex items-center justify-center gap-2"
                    >
                        <Download className="h-4 w-4" />
                        Export {exportState.format === "excel" ? "Excel" : "CSV"}
                    </button>
                </div>
            </div>
        </div>
    )
}
