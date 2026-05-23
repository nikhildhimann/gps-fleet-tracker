/**
 * HEALTH HANDLER
 * Handles $HLM packets (Health Monitoring)
 */

const HealthMonitoring = require("../../Modules/healthMonitoring/model");
const GpsDevice = require("../../Modules/gpsDevice/model");

module.exports = async function healthHandler(socket, packet) {
  try {
    /* ------------------------------------------------------------ */
    /* 1️⃣ BASIC SAFETY CHECK                                        */
    /* ------------------------------------------------------------ */

    // Device must be logged in
    console.log("🔥 HEALTH HANDLER HIT");
    if (!socket.imei || !socket.gpsDeviceId) {
      console.warn("⚠️ Health packet before login, ignored");
      return;
    }

    /* ------------------------------------------------------------ */
    /* 2️⃣ CLEAN + SPLIT PACKET                                      */
    /* ------------------------------------------------------------ */

    const starIdx = packet.lastIndexOf("*");
    const cleanPacket = (starIdx !== -1 ? packet.slice(0, starIdx) : packet).trim();
    const parts = cleanPacket.split(",");

    if (parts.length < 11) {
      console.warn("⚠️ HLM packet too short:", parts.length, "fields — ignored");
      return;
    }

    const safeNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };

    const vendorId = parts[1];
    const softwareVersion = parts[2];
    const imei = parts[3];

    const batteryPercentage = safeNum(parts[4]);
    const lowBatteryThreshold = safeNum(parts[5]);
    const memoryPercentage = safeNum(parts[6]);
    const dataUpdateRateIgnitionOn = safeNum(parts[7]);
    const dataUpdateRateIgnitionOff = safeNum(parts[8]);
    const digitalInputStatus = parts[9] || null;
    const analogInputStatus = parts[10] || null;

    /* ------------------------------------------------------------ */
    /* 3️⃣ BUILD HEALTH DOCUMENT                                     */
    /* ------------------------------------------------------------ */

    const healthDoc = {
      imei,
      gpsDeviceId: socket.gpsDeviceId,
      organizationId: socket.organizationId,
      vehicleId: socket.vehicleId || null,

      vendorId,
      softwareVersion,

      batteryPercentage,
      lowBatteryThreshold,
      memoryPercentage,

      dataUpdateRateIgnitionOn,
      dataUpdateRateIgnitionOff,

      digitalInputStatus,
      analogInputStatus,

      timestamp: new Date(),
      receivedAt: new Date(),
    };

    // Remove undefined fields safely
    Object.keys(healthDoc).forEach(
      (k) => healthDoc[k] === undefined && delete healthDoc[k],
    );

    /* ------------------------------------------------------------ */
    /* 4️⃣ STORE HEALTH SNAPSHOT                                     */
    /* ------------------------------------------------------------ */

    await HealthMonitoring.create(healthDoc);

    /* ------------------------------------------------------------ */
    /* 5️⃣ UPDATE DEVICE META (OPTIONAL BUT IMPORTANT)               */
    /* ------------------------------------------------------------ */

    await GpsDevice.updateOne(
      { _id: socket.gpsDeviceId },
      {
        $set: {
          isOnline: true,
          connectionStatus: "online",
          lastSeen: new Date(),
          softwareVersion,
        },
      },
    );

    /* ------------------------------------------------------------ */
    /* 6️⃣ ACK DEVICE                                                */
    /* ------------------------------------------------------------ */

    socket.write("OK\r\n");

    console.log("❤️ HEALTH UPDATED", {
      imei,
      battery: batteryPercentage,
      memory: memoryPercentage,
    });
  } catch (err) {
    console.error("❌ Health handler error:", err.message);
  }
};
