"use client";

import { toast } from "sonner";
import { AlertTriangle, ShieldX, Activity, AlertCircle, MapPin, X } from "lucide-react";

// Toast notification component for real-time alerts
export const showNotificationToast = (notification: any) => {
  const getAlertIcon = (type: string, severity: string) => {
    const iconClass = "w-6 h-6";
    
    if (type?.toLowerCase().includes("overspeed") || type?.toLowerCase().includes("speed")) {
      return <AlertTriangle className={`${iconClass} text-amber-500`} />;
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

  const getSeverityColor = (severity: string) => {
    const severityLower = severity?.toLowerCase();
    
    if (severityLower?.includes("critical") || severityLower?.includes("emergency")) {
      return "text-red-600";
    }
    if (severityLower?.includes("warning") || severityLower?.includes("medium")) {
      return "text-amber-600";
    }
    if (severityLower?.includes("info") || severityLower?.includes("low")) {
      return "text-blue-600";
    }
    
    return "text-gray-600";
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
  const severityColor = getSeverityColor(notification.severity || notification.priority);
  const location = notification.address || 'Location unavailable';

  return toast.custom(
    (
      <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200 shadow-lg max-w-sm w-80">
        {/* Alert Icon */}
        <div className="flex-shrink-0 mt-1">
          {getAlertIcon(notification.title || notification.type, notification.severity || notification.priority)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className={`text-sm font-bold ${severityColor} truncate pr-2`}>
              {vehicleNumber}
            </h4>
            <button
              onClick={() => toast.dismiss()}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          
          <div className={`text-xs font-semibold ${severityColor} mb-1`}>
            {alertTitle}
          </div>
          
          {notification.speed && (
            <div className="text-xs text-gray-600 mb-1">
              Speed: {notification.speed} km/h
            </div>
          )}
          
          <div className="text-xs text-gray-500 mb-2">
            📍 {location}
          </div>
          
          <div className="text-xs text-gray-400">
            {formatRelativeTime(notification.createdAt || notification.timestamp)}
          </div>

          {/* Action Button */}
          {notification.vehicleId && (
            <button
              onClick={() => {
                // Navigate to vehicle page if supported
                if (notification.vehicleId) {
                  window.location.href = `/admin/vehicles?vehicle=${notification.vehicleId}`;
                }
                toast.dismiss();
              }}
              className="mt-2 w-full text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-colors"
            >
              View Vehicle
            </button>
          )}
        </div>
      </div>
    ),
    {
      duration: 5000, // Auto close after 5 seconds
      position: 'bottom-right' as const,
    }
  );
};

// Export function to be used by socket listeners
export const handleRealTimeAlert = (alert: any) => {
  console.log('Real-time alert received:', alert);
  showNotificationToast(alert);
};
