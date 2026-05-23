/**
 * GPS and Geospatial Utility Functions
 */

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;

  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Convert degrees to radians
 * @param {number} degrees
 * @returns {number} Radians
 */
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Map AIS140 alert types to alertId and alertName
 * @param {string} type - Alert type (e.g., "overspeed", "low_battery")
 * @returns {object} { alertId, alertName, packetType }
 */
function mapAlertType(type) {
  const alertMap = {
    overspeed: {
      alertId: 17,
      alertName: "Overspeed",
      packetType: "OS",
    },
    low_battery: {
      alertId: 4,
      alertName: "Low Battery",
      packetType: "BD",
    },
    battery_removed: {
      alertId: 5,
      alertName: "Low Battery Removed",
      packetType: "BR",
    },
    main_power_off: {
      alertId: 3,
      alertName: "Main Power Disconnected",
      packetType: "BD",
    },
    main_power_on: {
      alertId: 6,
      alertName: "Main Power Connected",
      packetType: "BL",
    },
    ignition_on: {
      alertId: 7,
      alertName: "Ignition On",
      packetType: "IN",
    },
    ignition_off: {
      alertId: 8,
      alertName: "Ignition Off",
      packetType: "IF",
    },
    tamper_alert: {
      alertId: 9,
      alertName: "Tamper Alert",
      packetType: "TA",
    },
    emergency_on: {
      alertId: 10,
      alertName: "Emergency On",
      packetType: "EA",
    },
    emergency_off: {
      alertId: 11,
      alertName: "Emergency Off",
      packetType: "EA",
    },
    harsh_braking: {
      alertId: 13,
      alertName: "Harsh Braking",
      packetType: "HB",
    },
    harsh_acceleration: {
      alertId: 14,
      alertName: "Harsh Acceleration",
      packetType: "HA",
    },
    rash_turning: {
      alertId: 15,
      alertName: "Rash Turning",
      packetType: "RT",
    },
    wire_disconnect: {
      alertId: 16,
      alertName: "Wire Disconnect",
      packetType: "WD",
    },
    tilt_alert: {
      alertId: 22,
      alertName: "Tilt Alert",
      packetType: "TI",
    },
  };

  return (
    alertMap[type] || {
      alertId: 1,
      alertName: "Location Update",
      packetType: "NR",
    }
  );
}

module.exports = {
  calculateDistance,
  toRadians,
  mapAlertType,
};
