const net = require("net");
const os = require("os");
const packetRouter = require("./packetRouter");
const GpsDevice = require("../Modules/gpsDevice/model");

const TCP_PORT = process.env.TCP_PORT || 6000;
const TCP_HOST = process.env.TCP_HOST || "0.0.0.0";

function getTcpEndpoints(host, port) {
  if (host && host !== "0.0.0.0" && host !== "::") {
    return [`tcp://${host}:${port}`];
  }

  const endpoints = new Set([`tcp://127.0.0.1:${port}`, `tcp://localhost:${port}`]);
  const interfaces = os.networkInterfaces();

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (entry.family === "IPv4" && !entry.internal) {
        endpoints.add(`tcp://${entry.address}:${port}`);
      }
    });
  });

  return Array.from(endpoints);
}

// ─────────────────────────────────────────────
// TCP SERVER
// ─────────────────────────────────────────────

const server = net.createServer((socket) => {
  console.log(
    `📡 Device connected from ${socket.remoteAddress}:${socket.remotePort}`,
  );

  // 🔹 Every socket gets its own buffer
  socket.buffer = "";
  const MAX_BUFFER_BYTES = 4096;

  // 🔹 Socket level configs (industry standard)
  socket.setKeepAlive(true, 60000); // keep alive every 60s
  socket.setTimeout(300000); // 5 min idle timeout
  socket.setNoDelay(true);

  // ─────────────────────────────────────────
  // DATA EVENT
  // ─────────────────────────────────────────
  socket.on("data", async (data) => {
    try {
      // Convert buffer → string
      const incoming = data.toString("utf8");

      // Append to existing buffer
      socket.buffer += incoming;

      if (socket.buffer.length > MAX_BUFFER_BYTES) {
        console.warn(`⚠️ Buffer overflow from ${socket.remoteAddress}, closing`);
        socket.buffer = "";
        socket.end();
        return;
      }

      /**
       * AIS devices usually end packets with:
       * \n  or  \r\n  or  *
       * We will safely split on newline
       */
      const packets = socket.buffer.split(/\r?\n/);

      // Last packet may be incomplete → keep it
      socket.buffer = packets.pop();

      for (const rawPacket of packets) {
        const packet = rawPacket.trim();

        if (!packet) continue;

        await packetRouter(socket, packet);
      }
    } catch (err) {
      console.error("❌ Error processing data:", err.message);
    }
  });

  // ─────────────────────────────────────────
  // SOCKET CLOSE
  // ─────────────────────────────────────────
  socket.on("close", () => {
    console.log(
      `📴 Device disconnected ${socket.imei ? `IMEI: ${socket.imei}` : ""}`,
    );
    if (socket.gpsDeviceId) {
      GpsDevice.updateOne(
        { _id: socket.gpsDeviceId },
        {
          $set: {
            isOnline: false,
            connectionStatus: "offline",
            lastSeen: new Date(),
          },
        },
      ).catch((err) => {
        console.error("❌ Failed to update offline status on close:", err.message);
      });
    }
  });

  // ─────────────────────────────────────────
  // SOCKET TIMEOUT
  // ─────────────────────────────────────────
  socket.on("timeout", () => {
    console.warn("⏱️ Socket timeout, closing connection");
    if (socket.gpsDeviceId) {
      GpsDevice.updateOne(
        { _id: socket.gpsDeviceId },
        {
          $set: {
            isOnline: false,
            connectionStatus: "offline",
            lastSeen: new Date(),
          },
        },
      ).catch((err) => {
        console.error("❌ Failed to update offline status on timeout:", err.message);
      });
    }
    socket.end();
  });

  // ─────────────────────────────────────────
  // SOCKET ERROR
  // ─────────────────────────────────────────
  socket.on("error", (err) => {
    if (socket.gpsDeviceId) {
      GpsDevice.updateOne(
        { _id: socket.gpsDeviceId },
        {
          $set: {
            isOnline: false,
            connectionStatus: "offline",
            lastSeen: new Date(),
          },
        },
      ).catch((updateErr) => {
        console.error("❌ Failed to update offline status on error:", updateErr.message);
      });
    }
    if (err.code === "ECONNRESET") {
      console.log(
        `⚠️ Device disconnected abruptly (ECONNRESET) ${socket.imei || ""}`,
      );
    } else {
      console.error("❌ Socket error:", err.message);
    }
  });
});

// ─────────────────────────────────────────────
// SERVER ERROR
// ─────────────────────────────────────────────
server.on("error", (err) => {
  console.error("❌ TCP Server error:", err.message);
});

function gracefulShutdown(signal) {
  console.log(`🛑 ${signal} received. Closing TCP server...`);
  server.close(() => {
    console.log("✅ TCP server closed.");
    process.exit(0);
  });
  setTimeout(() => {
    console.warn("⚠️ Forcing exit after 10s");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────
server.listen(TCP_PORT, TCP_HOST, () => {
  console.log(`🚀 TCP AIS Server running on ${TCP_HOST}:${TCP_PORT}`);
  getTcpEndpoints(TCP_HOST, TCP_PORT).forEach((endpoint) => {
    console.log(`🔗 TCP Endpoint: ${endpoint}`);
  });
});

module.exports = server;
