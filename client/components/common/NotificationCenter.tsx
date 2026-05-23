"use client";

import { useState, useEffect, useRef } from "react";
import { Bell, X, Check, Search, Filter, Settings, AlertTriangle, Activity, MapPin, AlertCircle, Navigation, Phone, Clock, User } from "lucide-react";
import { useGetNotificationsQuery, useMarkAsReadMutation, useClearAllNotificationsMutation } from "@/redux/api/notificationsApi";
import { AlertManagementModal } from "./AlertManagementModal";
import { NotificationSettings } from "./NotificationSettings";

interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className = "" }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { data: notificationsData, isLoading, refetch } = useGetNotificationsQuery(undefined);
  const [markAsRead] = useMarkAsReadMutation();
  const [clearAll] = useClearAllNotificationsMutation();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = (notificationsData?.data || []).filter((notif: any) => {
    const matchesSearch = !searchTerm || 
      notif.vehicleNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      notif.address?.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (activeFilter === "critical") return notif.severity === "Critical";
    if (activeFilter === "warning") return notif.severity === "Warning";
    if (activeFilter === "info") return notif.severity === "Info";
    
    return true;
  });

  const unreadCount = notifications.filter((notif: any) => !notif.read).length;
  const criticalCount = notifications.filter((notif: any) => notif.severity === "Critical").length;
  const warningCount = notifications.filter((notif: any) => notif.severity === "Warning").length;
  const infoCount = notifications.filter((notif: any) => notif.severity === "Info").length;

  const getAlertIcon = (type: string, severity: string) => {
    const iconClass = "w-4 h-4";
    
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

  const handleClearAll = async () => {
    try {
      await clearAll(undefined).unwrap();
      refetch();
    } catch (error) {
      console.error("Failed to clear all:", error);
    }
  };

  const handleViewAll = () => {
    setIsOpen(false);
    setShowModal(true);
  };

  return (
    <>
      <div className={`relative ${className}`} ref={dropdownRef}>
        {/* Bell Icon with Badge */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-blue-600' : 'text-gray-600'}`} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-bounce">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg border border-gray-200 shadow-xl z-50 max-h-[600px] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-2 py-1 rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleClearAll}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Clear All
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Filter Tabs - Only show if there are notifications */}
            {notifications.length > 0 && (
              <div className="flex items-center gap-2 p-3 border-b border-gray-200">
                <button
                  onClick={() => setActiveFilter("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === "all" 
                      ? "bg-gray-100 text-gray-900" 
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  All ({notifications.length})
                </button>
                <button
                  onClick={() => setActiveFilter("critical")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === "critical" 
                      ? "bg-red-100 text-red-700" 
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  🔴 Critical ({criticalCount})
                </button>
                <button
                  onClick={() => setActiveFilter("warning")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === "warning" 
                      ? "bg-amber-100 text-amber-700" 
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  🟡 Warning ({warningCount})
                </button>
                <button
                  onClick={() => setActiveFilter("info")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeFilter === "info" 
                      ? "bg-blue-100 text-blue-700" 
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  🔵 Info ({infoCount})
                </button>
              </div>
            )}

            {/* Search Bar - Only show if there are notifications */}
            {notifications.length > 0 && (
              <div className="p-3 border-b border-gray-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search notifications..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Bell className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.slice(0, 5).map((notif: any, index: number) => (
                    <div
                      key={notif._id || index}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notif.read ? 'bg-blue-50/30' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`p-2 rounded-lg border ${getSeverityColor(notif.severity)}`}>
                          {getAlertIcon(notif.title, notif.severity)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1">
                              <h4 className="text-sm font-semibold text-gray-900 truncate">
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
                            <button
                              onClick={() => handleMarkAsRead(notif._id)}
                              className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <Check size={14} />
                            </button>
                          </div>

                          {notif.speed && (
                            <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
                              <span>⚡</span>
                              <span>{notif.speed} km/h</span>
                              {notif.speedLimit && (
                                <span className="text-red-500">in {notif.speedLimit} zone</span>
                              )}
                            </div>
                          )}

                          <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                            <MapPin size={10} />
                            <span>{notif.address || 'Location unavailable'}</span>
                          </div>

                          <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                            <Clock size={10} />
                            <span>{formatRelativeTime(notif.createdAt)}</span>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {notif.vehicleId && (
                              <button
                                onClick={() => {
                                  window.location.href = `/dashboard?vehicle=${notif.vehicleId}`;
                                  setIsOpen(false);
                                }}
                                className="flex-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1"
                              >
                                <Navigation size={10} />
                                View
                              </button>
                            )}
                            
                            {notif.driverPhone && (
                              <button
                                onClick={() => {
                                  window.open(`tel:${notif.driverPhone}`);
                                }}
                                className="flex-1 text-xs font-medium text-green-600 hover:text-green-700 transition-colors flex items-center gap-1"
                              >
                                <Phone size={10} />
                                Call
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {/* Show more indicator if there are more notifications */}
                  {notifications.length > 5 && (
                    <div className="p-3 text-center text-sm text-gray-500 bg-gray-50">
                      Showing 5 of {notifications.length} notifications
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer - Removed View All and Settings buttons */}
            <div className="p-3 border-t border-gray-200">
              {/* Footer content removed as requested */}
            </div>
          </div>
        )}
      </div>

      {/* Full Modal */}
      <AlertManagementModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />

      {/* Settings Modal */}
      <NotificationSettings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={(settings) => {
          console.log("Settings saved:", settings);
          setShowSettings(false);
        }}
      />
    </>
  );
}
