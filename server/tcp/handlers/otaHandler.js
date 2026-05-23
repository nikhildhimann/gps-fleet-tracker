/**
 * OTA HANDLER
 * Handles $OTA packets (Over-The-Air firmware update status)
 */

const GpsDevice = require("../../Modules/gpsDevice/model");

module.exports = async function otaHandler(socket, packet) {
  try {
    /* ------------------------------------------------------------ */
    /* 1️⃣ BASIC SAFETY CHECK                                        */
    /* ------------------------------------------------------------ */
    if (!socket.imei || !socket.gpsDeviceId) {
      console.warn("⚠️ OTA packet before login, ignored");
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
     * $OTA,IMEI,STATUS,fromVersion,toVersion,details
     */
    const imei = parts[1];
    const status = parts[2] || "UNKNOWN";
    const fromVersion = parts[3] || "";
    const toVersion = parts[4] || "";
    const details = parts[5] || "";

    /* ------------------------------------------------------------ */
    /* 3️⃣ UPDATE DEVICE FIRMWARE VERSION                            */
    /* ------------------------------------------------------------ */
    const updateFields = {
      isOnline: true,
      connectionStatus: "online",
      lastSeen: new Date(),
    };

    if (status === "SUCCESS" && toVersion) {
      updateFields.softwareVersion = toVersion;
    }

    await GpsDevice.updateOne(
      { _id: socket.gpsDeviceId },
      { $set: updateFields },
    );

    /* ------------------------------------------------------------ */
    /* 4️⃣ ACK                                                       */
    /* ------------------------------------------------------------ */
    socket.write("OK\r\n");

    console.log("📦 OTA UPDATE", {
      imei,
      status,
      from: fromVersion,
      to: toVersion,
      details,
    });
  } catch (err) {
    console.error("❌ OTA handler error:", err.message);
  }
};
