/**
 * ACTIVATION HANDLER
 * Handles $ACT packets (Device Activation acknowledgement)
 */

const GpsDevice = require("../../Modules/gpsDevice/model");

module.exports = async function activationHandler(socket, packet) {
  try {
    /* ------------------------------------------------------------ */
    /* 1️⃣ BASIC SAFETY CHECK                                        */
    /* ------------------------------------------------------------ */
    if (!socket.imei || !socket.gpsDeviceId) {
      console.warn("⚠️ ACT packet before login, ignored");
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
     * $ACT,IMEI,STATUS(ON/OFF),details
     */
    const imei = parts[1];
    const status = (parts[2] || "ON").toUpperCase();
    const details = parts[3] || "";

    /* ------------------------------------------------------------ */
    /* 3️⃣ UPDATE DEVICE STATUS                                      */
    /* ------------------------------------------------------------ */
    await GpsDevice.updateOne(
      { _id: socket.gpsDeviceId },
      {
        $set: {
          isOnline: true,
          connectionStatus: "online",
          lastSeen: new Date(),
          status: status === "ON" ? "active" : "inactive",
        },
      },
    );

    /* ------------------------------------------------------------ */
    /* 4️⃣ ACK                                                       */
    /* ------------------------------------------------------------ */
    socket.write("ON\r\n");

    console.log("✅ ACTIVATION", {
      imei,
      status,
      details,
    });
  } catch (err) {
    console.error("❌ Activation handler error:", err.message);
  }
};
