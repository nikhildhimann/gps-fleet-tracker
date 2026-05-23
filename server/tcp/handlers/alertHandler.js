/**
 * ALERT HANDLER
 * Handles $ALT packets (Alerts: overspeed, tamper, harsh braking, etc.)
 */

const Alert = require("../../Modules/alerts/model");
const GpsDevice = require("../../Modules/gpsDevice/model");
const VehicleDailyStats = require("../../Modules/vehicleDailyStats/model");
const { createNotificationFromAlert } = require("../../Modules/notifications/producers");

// Map alert identifiers to alertId numbers and alertName enum values
const ALERT_MAP = {
  overspeed: { alertId: 17, alertName: "Overspeed", packetType: "OS" },
  tamper: { alertId: 9, alertName: "Tamper Alert", packetType: "TA" },
  harsh_braking: { alertId: 13, alertName: "Harsh Braking", packetType: "BD" },
  harsh_acceleration: { alertId: 14, alertName: "Harsh Acceleration", packetType: "HA" },
  rash_turning: { alertId: 15, alertName: "Rash Turning", packetType: "RT" },
  low_battery: { alertId: 4, alertName: "Low Battery", packetType: "BL" },
  wire_disconnect: { alertId: 16, alertName: "Wire Disconnect", packetType: "WD" },
  mains_off: { alertId: 3, alertName: "Main Power Disconnected", packetType: "BD" },
  mains_on: { alertId: 6, alertName: "Main Power Connected", packetType: "BR" },
  ignition_on: { alertId: 7, alertName: "Ignition On", packetType: "IN" },
  ignition_off: { alertId: 8, alertName: "Ignition Off", packetType: "IF" },
  emergency_on: { alertId: 10, alertName: "Emergency On", packetType: "EA" },
  emergency_off: { alertId: 11, alertName: "Emergency Off", packetType: "EA" },
  ota: { alertId: 12, alertName: "OTA Alert", packetType: "OA" },
  tilt: { alertId: 22, alertName: "Tilt Alert", packetType: "TI" },
};

function parseNmeaCoordinate(value, direction) {
  const num = Number(value);
  if (!Number.isFinite(num) || num === 0) return null;
  const degrees = Math.floor(num / 100);
  const minutes = num - degrees * 100;
  const decimal = degrees + minutes / 60;
  const dir = String(direction || "").toUpperCase();
  return (dir === "S" || dir === "W") ? -Math.abs(decimal) : Math.abs(decimal);
}

module.exports = async function alertHandler(socket, packet) {
  try {
    /* ------------------------------------------------------------ */
    /* 1️⃣ BASIC SAFETY CHECK                                        */
    /* ------------------------------------------------------------ */
    if (!socket.imei || !socket.gpsDeviceId) {
      console.warn("⚠️ ALT packet before login, ignored");
      return;
    }

    /* ------------------------------------------------------------ */
    /* 2️⃣ PARSE PACKET                                              */
    /* ------------------------------------------------------------ */
    const starIdx = packet.lastIndexOf("*");
    const clean = (starIdx !== -1 ? packet.slice(0, starIdx) : packet).trim();
    const parts = clean.split(",");

    /**
     * Expected:
     * $ALT,IMEI,alertIdentifier,latValue,latDir,lngValue,lngDir,speed,heading,severity,message
     */
    const imei = parts[1];
    const alertIdentifier = (parts[2] || "").toLowerCase();
    const latValue = parts[3];
    const latDir = parts[4];
    const lngValue = parts[5];
    const lngDir = parts[6];
    const safeNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const speed = safeNum(parts[7]);
    const heading = safeNum(parts[8]);
    const severity = parts[9] || "info";
    const message = parts[10] || "";

    const alertInfo = ALERT_MAP[alertIdentifier] || {
      alertId: 1,
      alertName: "Location Update",
      packetType: "NR",
    };

    const latitude = parseNmeaCoordinate(latValue, latDir);
    const longitude = parseNmeaCoordinate(lngValue, lngDir);

    /* ------------------------------------------------------------ */
    /* 3️⃣ STORE ALERT                                               */
    /* ------------------------------------------------------------ */
    const alertDoc = {
      organizationId: socket.organizationId,
      gpsDeviceId: socket.gpsDeviceId,
      vehicleId: socket.vehicleId || null,
      imei,
      alertId: alertInfo.alertId,
      alertName: alertInfo.alertName,
      packetType: alertInfo.packetType,
      severity,
      latitude,
      latitudeDirection: latDir,
      longitude,
      longitudeDirection: lngDir,
      locationCoordinates: [longitude, latitude],
      speed,
      heading,
      gpsTimestamp: new Date(),
      rawPacketData: packet,
      receivedAt: new Date(),
    };

    // Remove undefined fields
    Object.keys(alertDoc).forEach(
      (k) => alertDoc[k] === undefined && delete alertDoc[k],
    );

    const alert = await Alert.create(alertDoc);
    void createNotificationFromAlert(alert, { orgScope: "ALL" });

    /* ------------------------------------------------------------ */
    /* 4️⃣ UPDATE DAILY STATS (overspeed counter)                    */
    /* ------------------------------------------------------------ */
    if (alertIdentifier === "overspeed" && socket.vehicleId) {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);

      await VehicleDailyStats.updateOne(
        { vehicleId: socket.vehicleId, date: today },
        {
          $inc: { "alertCounts.overspeedCount": 1 },
          $setOnInsert: {
            organizationId: socket.organizationId,
            vehicleId: socket.vehicleId,
            date: today,
          },
        },
        { upsert: true },
      );
    }

    /* ------------------------------------------------------------ */
    /* 5️⃣ UPDATE DEVICE META                                        */
    /* ------------------------------------------------------------ */
    await GpsDevice.updateOne(
      { _id: socket.gpsDeviceId },
      {
        $set: {
          isOnline: true,
          connectionStatus: "online",
          lastSeen: new Date(),
        },
      },
    );

    /* ------------------------------------------------------------ */
    /* 6️⃣ ACK                                                       */
    /* ------------------------------------------------------------ */
    socket.write("ACK\r\n");

    console.log("🚨 ALERT STORED", {
      imei,
      alertName: alertInfo.alertName,
      severity,
      speed,
    });
  } catch (err) {
    console.error("❌ Alert handler error:", err.message);
  }
};
