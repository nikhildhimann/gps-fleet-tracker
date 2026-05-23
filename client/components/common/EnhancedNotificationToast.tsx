"use client";

import { toast } from "sonner";
import { AlertTriangle, ShieldX, Activity, AlertCircle, MapPin, X, Phone, Navigation, Clock, User } from "lucide-react";
import { useState } from "react";

// Enhanced toast notification with rich content and actions
export const showEnhancedNotificationToast = (notification: any) => {
  const getAlertIcon = (type: string, severity: string) => {
    const iconClass = "w-5 h-5";
    
    if (type?.toLowerCase().includes("overspeed") || type?.toLowerCase().includes("speed")) {
      return <AlertTriangle className={`${iconClass} text-red-500`} />;
    }
    if (type?.toLowerCase().includes("ignition")) {
      return severity?.toLowerCase().includes("on") ? 
        <Activity className={`${iconClass} text-green-500`} /> : 
        <ShieldX className={`${iconClass} text-gray-500`} />;
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

  const getSeverityConfig = (severity: string) => {
    const severityLower = severity?.toLowerCase();
    
    if (severityLower?.includes("critical") || severityLower?.includes("emergency")) {
      return {
        color: "text-red-600",
        bgColor: "bg-red-500/10",
        borderColor: "border-red-500/30",
        duration: 0, // No auto-hide for critical
        sound: true,
        pulse: true
      };
    }
    if (severityLower?.includes("warning") || severityLower?.includes("medium")) {
      return {
        color: "text-amber-600",
        bgColor: "bg-amber-500/10",
        borderColor: "border-amber-500/30",
        duration: 10000, // 10 seconds
        sound: false,
        pulse: false
      };
    }
    if (severityLower?.includes("info") || severityLower?.includes("low")) {
      return {
        color: "text-blue-600",
        bgColor: "bg-blue-500/10",
        borderColor: "border-blue-500/30",
        duration: 5000, // 5 seconds
        sound: false,
        pulse: false
      };
    }
    
    return {
      color: "text-gray-600",
      bgColor: "bg-gray-500/10",
      borderColor: "border-gray-500/30",
      duration: 5000,
      sound: false,
      pulse: false
    };
  };

  // Format time to relative
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

  const vehicleNumber = notification.vehicleNumber || notification.imei || 'Unknown Vehicle';
  const alertTitle = notification.title || notification.type || 'System Alert';
  const config = getSeverityConfig(notification.severity || notification.priority);
  const location = notification.address || 'Location unavailable';
  const driverName = notification.driverName || 'Unknown Driver';

  return toast.custom(
    (id) => (
      <div className={`flex items-start gap-3 p-4 bg-white rounded-lg border ${config.borderColor} shadow-lg max-w-sm w-80 ${config.pulse ? 'animate-pulse' : ''}`}>
        {/* Alert Icon */}
        <div className={`flex-shrink-0 mt-1 p-2 rounded-lg ${config.bgColor}`}>
          {getAlertIcon(notification.title || notification.type, notification.severity || notification.priority)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-bold ${config.color} truncate pr-2`}>
              {config.pulse ? '🔴 CRITICAL' : alertTitle}
            </h4>
            <button
              onClick={() => toast.dismiss()}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-slate-700">{vehicleNumber}</span>
            {notification.driverName && (
              <>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-600 flex items-center gap-1">
                  <User size={10} />
                  {driverName}
                </span>
              </>
            )}
          </div>
          
          {notification.speed && (
            <div className="text-xs text-gray-600 mb-1 flex items-center gap-1">
              <span>⚡</span>
              <span>{notification.speed} km/h</span>
              {notification.speedLimit && (
                <span className="text-red-500">in {notification.speedLimit} zone</span>
              )}
            </div>
          )}
          
          <div className="text-xs text-gray-500 mb-2 flex items-center gap-1">
            <MapPin size={10} />
            <span>{location}</span>
          </div>
          
          <div className="text-xs text-gray-400 mb-3 flex items-center gap-1">
            <Clock size={10} />
            <span>{formatRelativeTime(notification.createdAt || notification.timestamp)}</span>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {notification.vehicleId && (
              <button
                onClick={() => {
                  window.location.href = `/dashboard?vehicle=${notification.vehicleId}`;
                  toast.dismiss();
                }}
                className="flex-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-2 py-1.5 rounded transition-colors flex items-center justify-center gap-1"
              >
                <Navigation size={10} />
                Track
              </button>
            )}
            
            {notification.driverPhone && (
              <button
                onClick={() => {
                  window.open(`tel:${notification.driverPhone}`);
                  toast.dismiss();
                }}
                className="flex-1 text-xs font-semibold text-green-600 bg-green-50 hover:bg-green-100 px-2 py-1.5 rounded transition-colors flex items-center justify-center gap-1"
              >
                <Phone size={10} />
                Call
              </button>
            )}
            
            <button
              onClick={() => toast.dismiss()}
              className="text-xs font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100 px-2 py-1.5 rounded transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    ),
    {
      duration: config.duration,
      position: 'bottom-right' as const,
    }
  );
};

// Export function to be used by socket listeners
export const handleEnhancedRealTimeAlert = (alert: any) => {
  console.log('Enhanced real-time alert received:', alert);
  showEnhancedNotificationToast(alert);
};
