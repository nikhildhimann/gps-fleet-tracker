/**
 * Smart Alert Grouping Utility
 * 
 * Groups similar alerts to reduce notification noise and improve user experience
 */

export interface GroupedAlert {
  id: string;
  type: string;
  title: string;
  severity: string;
  location: string;
  startTime: string;
  endTime: string;
  count: number;
  vehicles: string[];
  alertIds: string[];
  coordinates?: { lat: number; lng: number };
}

export interface Alert {
  id: string;
  type: string;
  title: string;
  severity: string;
  location: string;
  createdAt: string;
  vehicleNumber: string;
  latitude?: number;
  longitude?: number;
  speed?: number;
  driverName?: string;
}

/**
 * Group similar alerts based on type, location, and time window
 */
export function groupAlerts(
  alerts: Alert[],
  timeWindowMinutes: number = 5,
  locationRadiusMeters: number = 500,
  maxGroupSize: number = 10
): GroupedAlert[] {
  if (alerts.length === 0) return [];

  const groups: Map<string, Alert[]> = new Map();
  const timeWindowMs = timeWindowMinutes * 60 * 1000;

  // Sort alerts by creation time
  const sortedAlerts = [...alerts].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  for (const alert of sortedAlerts) {
    let grouped = false;

    // Check existing groups for potential matches
    for (const [groupId, groupAlerts] of groups.entries()) {
      const firstAlert = groupAlerts[0];
      
      // Check if alerts can be grouped
      if (canGroupAlerts(firstAlert, alert, timeWindowMs, locationRadiusMeters)) {
        // Check group size limit
        if (groupAlerts.length < maxGroupSize) {
          groupAlerts.push(alert);
          grouped = true;
          break;
        }
      }
    }

    // Create new group if not grouped
    if (!grouped) {
      const groupId = generateGroupId(alert);
      groups.set(groupId, [alert]);
    }
  }

  // Convert groups to GroupedAlert format
  return Array.from(groups.entries()).map(([groupId, groupAlerts]) => {
    const firstAlert = groupAlerts[0];
    const lastAlert = groupAlerts[groupAlerts.length - 1];
    
    // Calculate center coordinates for grouped alerts
    let centerCoordinates;
    const alertsWithCoords = groupAlerts.filter(a => a.latitude && a.longitude);
    if (alertsWithCoords.length > 0) {
      const avgLat = alertsWithCoords.reduce((sum, a) => sum + a.latitude!, 0) / alertsWithCoords.length;
      const avgLng = alertsWithCoords.reduce((sum, a) => sum + a.longitude!, 0) / alertsWithCoords.length;
      centerCoordinates = { lat: avgLat, lng: avgLng };
    }

    return {
      id: groupId,
      type: firstAlert.type,
      title: `${groupAlerts.length} ${firstAlert.title.toUpperCase()} ALERTS`,
      severity: getHighestSeverity(groupAlerts),
      location: getGroupLocation(groupAlerts),
      startTime: firstAlert.createdAt,
      endTime: lastAlert.createdAt,
      count: groupAlerts.length,
      vehicles: [...new Set(groupAlerts.map(a => a.vehicleNumber))],
      alertIds: groupAlerts.map(a => a.id),
      coordinates: centerCoordinates,
    };
  });
}

/**
 * Check if two alerts can be grouped together
 */
function canGroupAlerts(
  alert1: Alert,
  alert2: Alert,
  timeWindowMs: number,
  locationRadiusMeters: number
): boolean {
  // Same alert type
  if (alert1.type !== alert2.type) return false;

  // Time window check
  const timeDiff = Math.abs(
    new Date(alert1.createdAt).getTime() - new Date(alert2.createdAt).getTime()
  );
  if (timeDiff > timeWindowMs) return false;

  // Location proximity check (if coordinates available)
  if (alert1.latitude && alert1.longitude && alert2.latitude && alert2.longitude) {
    const distance = calculateDistance(
      alert1.latitude,
      alert1.longitude,
      alert2.latitude,
      alert2.longitude
    );
    if (distance > locationRadiusMeters) return false;
  }

  // Same severity level (optional - can be relaxed)
  if (alert1.severity !== alert2.severity) return false;

  return true;
}

/**
 * Generate a unique group ID based on alert characteristics
 */
function generateGroupId(alert: Alert): string {
  const type = alert.type.toLowerCase();
  const severity = alert.severity.toLowerCase();
  const location = alert.location.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 10);
  const time = new Date(alert.createdAt).getTime();
  
  return `${type}-${severity}-${location}-${time}`;
}

/**
 * Get the highest severity from a group of alerts
 */
function getHighestSeverity(alerts: Alert[]): string {
  const severityOrder = { critical: 3, warning: 2, info: 1 };
  
  let highestSeverity = alerts[0].severity;
  let highestScore = severityOrder[highestSeverity.toLowerCase() as keyof typeof severityOrder] || 0;
  
  for (const alert of alerts) {
    const score = severityOrder[alert.severity.toLowerCase() as keyof typeof severityOrder] || 0;
    if (score > highestScore) {
      highestScore = score;
      highestSeverity = alert.severity;
    }
  }
  
  return highestSeverity;
}

/**
 * Get a representative location for the group
 */
function getGroupLocation(alerts: Alert[]): string {
  // If all alerts have the same location, use that
  const locations = alerts.map(a => a.location);
  const uniqueLocations = [...new Set(locations)];
  
  if (uniqueLocations.length === 1) {
    return uniqueLocations[0];
  }
  
  // If multiple locations, create a summary
  const areaNames = uniqueLocations
    .map(loc => {
      // Extract area name (e.g., "Andheri West" from "Andheri West, Mumbai")
      const parts = loc.split(',');
      return parts[0].trim();
    })
    .filter((name, index, arr) => arr.indexOf(name) === index) // unique
    .slice(0, 3); // max 3 areas
  
  if (areaNames.length === 1) {
    return `${areaNames[0]} Area`;
  }
  
  return `${areaNames.join(', ')} Areas`;
}

/**
 * Calculate distance between two coordinates in meters
 */
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Create a summary message for grouped alerts
 */
export function createGroupedAlertMessage(group: GroupedAlert): string {
  const timeSpan = formatTimeSpan(group.startTime, group.endTime);
  const vehicleList = group.vehicles.slice(0, 3).join(', ');
  const additionalVehicles = group.vehicles.length > 3 ? ` +${group.vehicles.length - 3} more` : '';
  
  let message = `${group.count} ${group.type.toLowerCase()} alerts detected`;
  
  if (group.vehicles.length > 1) {
    message += ` from ${vehicleList}${additionalVehicles}`;
  }
  
  message += ` in ${group.location}`;
  
  if (timeSpan) {
    message += ` over ${timeSpan}`;
  }
  
  return message;
}

/**
 * Format time span between two timestamps
 */
function formatTimeSpan(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  
  if (diffMins < 1) return "under 1 minute";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''}`;
  
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''}`;
}

/**
 * Get suggested actions for grouped alerts
 */
export function getSuggestedActions(group: GroupedAlert): string[] {
  const actions: string[] = [];
  
  switch (group.type.toLowerCase()) {
    case 'overspeed':
      actions.push('Warn All Drivers');
      actions.push('Review Speed Limits');
      actions.push('Contact Fleet Manager');
      break;
      
    case 'geofence':
      if (group.title.toLowerCase().includes('exit')) {
        actions.push('Check Unauthorized Movement');
        actions.push('Contact Security');
      } else {
        actions.push('Log Entry Time');
        actions.push('Update Schedule');
      }
      break;
      
    case 'ignition':
      actions.push('Verify Driver Identity');
      actions.push('Check Fuel Levels');
      break;
      
    case 'offline':
      actions.push('Check Device Status');
      actions.push('Contact Technical Support');
      break;
      
    case 'sos':
    case 'emergency':
      actions.push('Emergency Response');
      actions.push('Contact Driver Immediately');
      actions.push('Dispatch Assistance');
      break;
      
    default:
      actions.push('Investigate Further');
      actions.push('Contact Driver');
  }
  
  return actions;
}
