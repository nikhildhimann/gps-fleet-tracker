const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "..", ".env"),
  quiet: true,
});

const GpsDevice = require("../Modules/gpsDevice/model");

async function cleanupStaleDevices() {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const result = await GpsDevice.updateMany(
    { isOnline: true, lastSeen: { $lt: fiveMinutesAgo } },
    { $set: { isOnline: false, connectionStatus: "offline" } }
  );
  console.log(`✅ Startup cleanup: ${result.modifiedCount} stale devices marked offline`);
}

function startHeartbeatChecker() {
  setInterval(async () => {
    try {
      const staleThreshold = new Date(Date.now() - 6 * 60 * 1000);
      const result = await GpsDevice.updateMany(
        { isOnline: true, lastSeen: { $lt: staleThreshold } },
        { $set: { isOnline: false, connectionStatus: "offline" } }
      );
      if (result.modifiedCount > 0) {
        console.log(`🔁 Heartbeat: ${result.modifiedCount} device(s) marked offline`);
      }
    } catch (err) {
      console.error("❌ Heartbeat cleanup error:", err.message);
    }
  }, 2 * 60 * 1000);

  console.log("💓 Heartbeat checker started (runs every 2 minutes)");
}

const connectDB = async () => {
  try {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB Atlas Connected");

    await cleanupStaleDevices();
    startHeartbeatChecker();
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  }
};

module.exports = connectDB;