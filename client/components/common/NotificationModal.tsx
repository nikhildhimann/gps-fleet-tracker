"use client";

import { useState, useEffect } from "react";
import { 
  X, 
  Search, 
  Filter, 
  Download, 
  Plus,
  Check,
  Clock,
  User,
  Navigation,
  Phone,
  AlertTriangle, 
  Activity, 
  MapPin, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Settings
} from "lucide-react";
import { useGetNotificationsQuery, useMarkAsReadMutation, useClearAllNotificationsMutation, useDeleteNotificationMutation } from "@/redux/api/notificationsApi";

interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationModal({ isOpen, onClose }: NotificationModalProps) {
  const [selectedAlert, setSelectedAlert] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<"all" | "critical" | "warning" | "info">("all");
  const [selectedType, setSelectedType] = useState("all");
  const [dateRange, setDateRange] = useState("7days");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const { data: notificationsData, isLoading, refetch } = useGetNotificationsQuery(undefined);
  const [markAsRead] = useMarkAsReadMutation();
  const [clearAll] = useClearAllNotificationsMutation();
  const [deleteAlert] = useDeleteNotificationMutation();

  const notifications = (notificationsData?.data || []).filter((notif: any) => {
    const matchesSearch = !searchTerm || 
      notif.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (selectedSeverity === "critical") return notif.severity === "Critical";
    if (selectedSeverity === "warning") return notif.severity === "Warning";
    if (selectedSeverity === "info") return notif.severity === "Info";
    
    return true;
  });

  const totalPages = Math.ceil(notifications.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentNotifications = notifications.slice(startIndex, endIndex);

  const criticalCount = notifications.filter((notif: any) => notif.severity === "Critical").length;
  const warningCount = notifications.filter((notif: any) => notif.severity === "Warning").length;
  const infoCount = notifications.filter((notif: any) => notif.severity === "Info").length;

  const getAlertIcon = (type: string, severity: string) => {
    const iconClass = "w-5 h-5";
    
    if (type?.toLowerCase().includes("overspeed") || type?.toLowerCase().includes("speed")) {
      return <AlertTriangle className={`${iconClass} text-red-500`} />;
    }
    if (type?.toLowerCase().includes("ignition")) {
      return severity?.toLowerCase().includes("on") ? 
        <Activity className={`${iconClass} text-green-500`} /> : 
        <AlertCircle className={`${iconClass} text-gray-500`} />;
    }
    if (type?.toLowerCase().includes("offline") || type?.toLowerCase().includes("lost")) {
      return <AlertCircle className={`${iconClass} text-red-500`} />;
    }
    if (type?.toLowerCase().includes("sos") || type?.toLowerCase().includes("emergency")) {
      return <AlertTriangle className={`${iconClass} text-red-600`} />;
    }
    if (type?.toLowerCase().includes("geofence") || type?.toLowerCase().includes("location")) {
      return <MapPin className={`${iconClass} text-blue-500`} />;
    }
    
    return <AlertCircle className={`${iconClass} text-gray-500`} />;
  };

  const getSeverityColor = (severity: string) => {
    const severityLower = severity?.toLowerCase();
    
    if (severityLower?.includes("critical") || severityLower?.includes("emergency")) {
      return "text-red-600 bg-red-500/10 border-red-500/20";
    }
    if (severityLower?.includes("warning") || severityLower?.includes("medium")) {
      return "text-amber-600 bg-amber-500/10 border-amber-500/20";
    }
    if (severityLower?.includes("info") || severityLower?.includes("low")) {
      return "text-blue-600 bg-blue-500/10 border-blue-500/20";
    }
    
    return "text-gray-600 bg-gray-500/10 border-gray-500/20";
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id).unwrap();
      refetch();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const handleDeleteAlert = async (id: string) => {
    try {
      await deleteAlert(id).unwrap();
      refetch();
      if (selectedAlert?._id === id) {
        setSelectedAlert(null);
      }
    } catch (error) {
      console.error("Failed to delete alert:", error);
    }
  };

  const handleClearAll = async () => {
    try {
      await clearAll(undefined).unwrap();
      refetch();
      setSelectedAlert(null);
    } catch (error) {
      console.error("Failed to clear all:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal */}
      <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-gray-600" />
            <h1 className="text-2xl font-bold text-gray-900">Alert Management</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700">Critical: {criticalCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-amber-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700">Warning: {warningCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700">Info: {infoCount}</span>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 p-4 border-b border-gray-200 bg-white">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search alerts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="overspeed">Overspeed</option>
            <option value="ignition">Ignition</option>
            <option value="geofence">Geofence</option>
            <option value="offline">Offline</option>
            <option value="sos">SOS</option>
          </select>

          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <X size={16} />
            Clear All
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left Panel - Alert List */}
          <div className="w-3/5 border-r border-gray-200 bg-white">
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                </div>
              ) : currentNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                  <AlertCircle className="w-16 h-16 mb-4 opacity-20" />
                  <p className="text-lg">No alerts found</p>
                  <p className="text-sm">Try adjusting your filters</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {currentNotifications.map((notif: any, index: number) => (
                    <div
                      key={notif._id || index}
                      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${
                        selectedAlert?._id === notif._id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedAlert(notif)}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={notif.read}
                          onChange={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notif._id);
                          }}
                          className="mt-1 rounded border-gray-300"
                        />
                        
                        <div className={`p-2 rounded-lg border ${getSeverityColor(notif.severity)}`}>
                          {getAlertIcon(notif.title, notif.severity)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <div>
                              <h4 className="text-sm font-semibold text-gray-900">
                                {notif.title}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                                <span className="font-medium">{notif.vehicleNumber}</span>
                                {notif.driverName && (
                                  <>
                                    <span>•</span>
                                    <span className="flex items-center gap-1">
                                      <User size={10} />
                                      {notif.driverName}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              notif.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                              notif.severity === 'Warning' ? 'bg-amber-100 text-amber-700' :
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {notif.severity}
                            </span>
                          </div>

                          <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                            <Clock size={10} />
                            <span>{formatRelativeTime(notif.createdAt)}</span>
                          </div>

                          <div className="text-xs text-gray-600">
                            {notif.speed && (
                              <span className="mr-3">⚡ {notif.speed} km/h</span>
                            )}
                            <span className="flex items-center gap-1">
                              <MapPin size={10} />
                              {notif.address || 'Location unavailable'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                <div className="text-sm text-gray-700">
                  Page {currentPage} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  
                  {[...Array(Math.min(5, totalPages))].map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`px-3 py-1 rounded-lg ${
                          currentPage === pageNum
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Alert Details */}
          <div className="w-2/5 bg-white">
            {selectedAlert ? (
              <div className="h-full flex flex-col">
                {/* Alert Header */}
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg border ${getSeverityColor(selectedAlert.severity)}`}>
                        {getAlertIcon(selectedAlert.title, selectedAlert.severity)}
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-gray-900">
                          {selectedAlert.title?.toUpperCase()}
                        </h2>
                        <span className={`text-sm px-2 py-1 rounded-full ${
                          selectedAlert.severity === 'Critical' ? 'bg-red-100 text-red-700' :
                          selectedAlert.severity === 'Warning' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {selectedAlert.severity}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteAlert(selectedAlert._id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <span className="ml-2 font-medium">{selectedAlert.read ? 'Read' : 'Unread'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Time:</span>
                      <span className="ml-2 font-medium">{formatRelativeTime(selectedAlert.createdAt)}</span>
                    </div>
                  </div>
                </div>

                {/* Alert Details */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-6">
                    {/* Vehicle Info */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Vehicle Information</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Vehicle:</span>
                          <span className="font-medium">{selectedAlert.vehicleNumber}</span>
                        </div>
                        {selectedAlert.driverName && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Driver:</span>
                            <span className="font-medium">{selectedAlert.driverName}</span>
                          </div>
                        )}
                        {selectedAlert.driverPhone && (
                          <div className="flex justify-between">
                            <span className="text-gray-500">Phone:</span>
                            <span className="font-medium">{selectedAlert.driverPhone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Location */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Location</h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <MapPin size={16} className="text-gray-400 mt-0.5" />
                          <span>{selectedAlert.address || 'Location unavailable'}</span>
                        </div>
                        {selectedAlert.latitude && selectedAlert.longitude && (
                          <div className="text-gray-500 text-xs">
                            Lat: {selectedAlert.latitude}, Lng: {selectedAlert.longitude}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Speed Details */}
                    {selectedAlert.speed && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3">Speed Details</h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-500">Current Speed:</span>
                            <span className="font-medium">{selectedAlert.speed} km/h</span>
                          </div>
                          {selectedAlert.speedLimit && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Speed Limit:</span>
                              <span className="font-medium">{selectedAlert.speedLimit} km/h</span>
                            </div>
                          )}
                          {selectedAlert.speedLimit && (
                            <div className="flex justify-between">
                              <span className="text-gray-500">Over Speed By:</span>
                              <span className="font-medium text-red-600">
                                {selectedAlert.speed - selectedAlert.speedLimit} km/h
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3">Actions</h3>
                      <div className="space-y-3">
                        <button
                          onClick={() => {
                            window.location.href = `/dashboard?vehicle=${selectedAlert.vehicleId}`;
                            onClose();
                          }}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Navigation size={16} />
                          Track Vehicle
                        </button>
                        
                        {selectedAlert.driverPhone && (
                          <button
                            onClick={() => window.open(`tel:${selectedAlert.driverPhone}`)}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Phone size={16} />
                            Call Driver
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleMarkAsRead(selectedAlert._id)}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                        >
                          <Check size={16} />
                          Mark as Resolved
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <AlertCircle className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p className="text-lg">Select an alert to view details</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

    </>
  );
}
