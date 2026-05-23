"use client";

import { useState, useEffect, useRef } from "react";
import { X, ChevronUp, ChevronDown, Bell, Search, Filter, Check, Phone, Navigation, Clock, MapPin, User } from "lucide-react";
import { useGetNotificationsQuery, useMarkAsReadMutation } from "@/redux/api/notificationsApi";

interface MobileNotificationSheetProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export function MobileNotificationSheet({ isOpen, onClose, className = "" }: MobileNotificationSheetProps) {
  const [activeFilter, setActiveFilter] = useState<"all" | "critical" | "warning" | "info">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  
  const { data: notificationsData, isLoading, refetch } = useGetNotificationsQuery(undefined);
  const [markAsRead] = useMarkAsReadMutation();

  // Handle swipe gestures
  useEffect(() => {
    if (!isOpen) return;

    let startY = 0;
    let currentY = 0;
    let isDragging = false;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      isDragging = true;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const deltaY = currentY - startY;
      
      // Swipe down to close
      if (deltaY > 100 && !isExpanded) {
        onClose();
      }
      
      // Swipe up to expand
      if (deltaY < -50 && !isExpanded) {
        setIsExpanded(true);
      }
    };

    const handleTouchEnd = () => {
      isDragging = false;
    };

    const element = sheetRef.current;
    if (element) {
      element.addEventListener('touchstart', handleTouchStart);
      element.addEventListener('touchmove', handleTouchMove);
      element.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      if (element) {
        element.removeEventListener('touchstart', handleTouchStart);
        element.removeEventListener('touchmove', handleTouchMove);
        element.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, [isOpen, isExpanded, onClose]);

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
      return <div className={`${iconClass} bg-red-500 rounded-full flex items-center justify-center text-white text-xs`}>!</div>;
    }
    if (type?.toLowerCase().includes("ignition")) {
      return severity?.toLowerCase().includes("on") ? 
        <div className={`${iconClass} bg-green-500 rounded-full flex items-center justify-center text-white text-xs`}>✓</div> :
        <div className={`${iconClass} bg-gray-500 rounded-full flex items-center justify-center text-white text-xs`}>○</div>;
    }
    if (type?.toLowerCase().includes("offline") || type?.toLowerCase().includes("lost")) {
      return <div className={`${iconClass} bg-red-600 rounded-full flex items-center justify-center text-white text-xs`}>×</div>;
    }
    if (type?.toLowerCase().includes("sos") || type?.toLowerCase().includes("emergency")) {
      return <div className={`${iconClass} bg-red-600 rounded-full flex items-center justify-center text-white text-xs`}>!</div>;
    }
    if (type?.toLowerCase().includes("geofence") || type?.toLowerCase().includes("location")) {
      return <div className={`${iconClass} bg-blue-500 rounded-full flex items-center justify-center text-white text-xs`}>📍</div>;
    }
    
    return <div className={`${iconClass} bg-gray-500 rounded-full flex items-center justify-center text-white text-xs`}>i</div>;
  };

  const getSeverityColor = (severity: string) => {
    const severityLower = severity?.toLowerCase();
    
    if (severityLower?.includes("critical") || severityLower?.includes("emergency")) {
      return "border-red-500 bg-red-50";
    }
    if (severityLower?.includes("warning") || severityLower?.includes("medium")) {
      return "border-amber-500 bg-amber-50";
    }
    if (severityLower?.includes("info") || severityLower?.includes("low")) {
      return "border-blue-500 bg-blue-50";
    }
    
    return "border-gray-500 bg-gray-50";
  };

  const formatRelativeTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await markAsRead(id).unwrap();
      refetch();
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div 
        ref={sheetRef}
        className={`fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-2xl shadow-2xl transition-transform duration-300 ${
          isExpanded ? 'h-[85vh]' : 'h-[50vh]'
        } ${className}`}
      >
        {/* Drag Handle */}
        <div className="flex justify-center py-2">
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>

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
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 p-3 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === "all" 
                ? "bg-gray-100 text-gray-900" 
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            onClick={() => setActiveFilter("critical")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === "critical" 
                ? "bg-red-100 text-red-700" 
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            🔴 Critical ({criticalCount})
          </button>
          <button
            onClick={() => setActiveFilter("warning")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === "warning" 
                ? "bg-amber-100 text-amber-700" 
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            🟡 Warning ({warningCount})
          </button>
          <button
            onClick={() => setActiveFilter("info")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeFilter === "info" 
                ? "bg-blue-100 text-blue-700" 
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            🔵 Info ({infoCount})
          </button>
        </div>

        {/* Search Bar */}
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
              {notifications.map((notif: any, index: number) => (
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
                              onClose();
                            }}
                            className="flex-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded transition-colors flex items-center justify-center gap-1"
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
                            className="flex-1 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 px-2 py-1.5 rounded transition-colors flex items-center justify-center gap-1"
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
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => {
              window.location.href = '/dashboard/alerts';
              onClose();
            }}
            className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            View All →
          </button>
          <div className="text-xs text-gray-500">
            {isExpanded ? 'Swipe down to minimize' : 'Swipe up to expand'}
          </div>
        </div>
      </div>
    </>
  );
}
