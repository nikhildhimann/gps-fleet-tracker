const GpsDevice = require("../../Modules/gpsDevice/model");
const VehicleDeviceMapping = require("../../Modules/deviceMapping/model");
const { syncInventoryStatus } = require("../../Modules/gpsDevice/service");

module.exports = async function loginHandler(socket, packet) {
  try {
    console.log("🔥 LOGIN HANDLER HIT");

    // ─────────────────────────────────────────────
    // 1️⃣ CLEAN & PARSE PACKET
    // ─────────────────────────────────────────────
    const starIdx = packet.lastIndexOf("*");
    const clean = (starIdx !== -1 ? packet.slice(0, starIdx) : packet).trim();
    const parts = clean.split(",");

    /**
     * Expected LOGIN packet format (example):
     * $LGN,TS09ER1234,123456789012345,2.5AIS
     *
     * parts[0] → $LGN
     * parts[1] → vehicleRegNo / deviceCode
     * parts[2] → IMEI
     * parts[3] → softwareVersion
     */

    const vehicleRegNo = parts[1];
    const imei = parts[2];
    const softwareVersion = parts[3];

    console.log("🧪 LOGIN RAW PACKET:", packet);
    console.log("🧪 PARSED PARTS:", parts);
    console.log("🧪 IMEI EXTRACTED:", imei);

    // ─────────────────────────────────────────────
    // 2️⃣ BASIC VALIDATION
    // ─────────────────────────────────────────────
    if (!imei || !/^\d{15}$/.test(imei)) {
      console.log("❌ Invalid IMEI:", imei);
      socket.write("DENY\r\n");
      return socket.end();
    }

    // ─────────────────────────────────────────────
    // 3️⃣ FIND DEVICE
    // ─────────────────────────────────────────────
    const device = await GpsDevice.findOne({ imei });

    console.log(
      "🧪 DEVICE FOUND:",
      device
        ? {
          imei: device.imei,
          status: device.status,
          organizationId: device.organizationId,
        }
        : "❌ NULL - Device not in database",
    );

    if (!device) {
      socket.write("DENY\r\n");
      return socket.end();
    }

    if (device.status !== "active") {
      console.log("❌ Device not active. Status:", device.status);
      socket.write("DENY\r\n");
      return socket.end();
    }

    // ─────────────────────────────────────────────
    // 4️⃣ BIND SOCKET CONTEXT (🔥 MOST IMPORTANT 🔥)
    // ─────────────────────────────────────────────
    socket.isLoggedIn = true; // ✅ THIS FIXES YOUR ISSUE
    socket.imei = imei;
    socket.gpsDeviceId = device._id;
    socket.organizationId = device.organizationId;
    socket.vehicleId = device.vehicleId || null;

    // ─────────────────────────────────────────────
    // 5️⃣ RESOLVE VEHICLE (IF NOT DIRECTLY ATTACHED)
    // ─────────────────────────────────────────────
    if (!socket.vehicleId) {
      const mapping = await VehicleDeviceMapping.findOne({
        gpsDeviceId: device._id,
        unassignedAt: null,
      });

      socket.vehicleId = mapping?.vehicleId || null;
    }

    // ─────────────────────────────────────────────
    // 6️⃣ UPDATE DEVICE METADATA
    // ─────────────────────────────────────────────
    await GpsDevice.updateOne(
      { _id: device._id },
      {
        $set: {
          isOnline: true,
          connectionStatus: "online",
          lastLoginTime: new Date(),
          lastSeen: new Date(),
          softwareVersion,
          vehicleRegistrationNumber: vehicleRegNo,
        },
      },
    );
    await syncInventoryStatus(device._id, "installed");

    console.log("✅ DEVICE LOGGED IN SUCCESSFULLY", {
      imei,
      org: device.organizationId,
      vehicleId: socket.vehicleId,
    });

    // ─────────────────────────────────────────────
    // 7️⃣ SEND LOGIN ACK (AIS-140 SAFE)
    // ─────────────────────────────────────────────
    socket.write("ON\r\n");
  } catch (err) {
    console.error("❌ LOGIN HANDLER ERROR:", err);
    socket.write("ERROR\r\n");
  }
};
