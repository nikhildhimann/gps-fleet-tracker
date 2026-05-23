const express = require("express");
const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
  quiet: true,
});
const fs = require("fs");

const cors = require("cors");

const responseTimeLogger = require("./middleware/responseTimeLogger");
const connectDB = require("./config/database");

connectDB();

const http = require("http");
const { initializeSocket } = require("./socket");

const app = express();
const server = http.createServer(app);
const io = initializeSocket(server);
const DEFAULT_HTTP_PORT = Number(process.env.PORT) || 5000;
const MAX_PORT_FALLBACK_ATTEMPTS = Number(process.env.PORT_FALLBACK_ATTEMPTS) || 10;
let tcpServerStarted = false;

const modulesPath = path.join(__dirname, "Modules");

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(responseTimeLogger);

// 🔕 Chrome DevTools noise suppression (debug only)
app.get("/json/list", (req, res) => res.send([]));
app.get("/json/version", (req, res) =>
  res.json({ Browser: "Node", "Protocol-Version": "1.3" }),
);

// Serve uploaded files as static content
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["*"], // Allow all requested headers
  }),
);

app.get("/", (req, res) => {
  res.send("API is running...");
});

// auto load all module routes
fs.readdirSync(modulesPath).forEach((folder) => {
  const routePath = path.join(modulesPath, folder, "routes.js");

  if (fs.existsSync(routePath)) {
    const route = require(routePath);

    // 🚨 SAFETY CHECK
    if (typeof route !== "function") {
      console.warn(`❌ Skipped ${folder} → routes.js does not export a router`);
      return;
    }

    app.use(`/api/${folder.toLowerCase()}`, route);
    console.log(`✅ Loaded routes for : /api/${folder.toLowerCase()}`);

    if (folder === "gpsDevice") {
      app.use("/api/gps-device", route);
      console.log("✅ Loaded routes for : /api/gps-device");
    }

    if (folder === "gpsHistory") {
      app.use("/api/gps-history", route);
      console.log("✅ Loaded routes for : /api/gps-history");
    }
  }
});

function startTcpServerOnce() {
  if (tcpServerStarted) return;
  tcpServerStarted = true;
  require("./tcp/server");
}

function startHttpServer(port, attemptsRemaining = MAX_PORT_FALLBACK_ATTEMPTS) {
  const handleListening = () => {
    server.off("error", handleError);
    console.log(`Server running on port ${port}`);
    startTcpServerOnce();
  };

  const handleError = (err) => {
    server.off("listening", handleListening);

    if (err.code === "EADDRINUSE" && attemptsRemaining > 0) {
      const nextPort = Number(port) + 1;
      console.warn(
        `⚠️ HTTP port ${port} is already in use. Retrying on ${nextPort}...`,
      );
      setTimeout(() => startHttpServer(nextPort, attemptsRemaining - 1), 250);
      return;
    }

    if (err.code === "EADDRINUSE") {
      console.error(
        `❌ Unable to start HTTP server. Tried ports ${DEFAULT_HTTP_PORT}-${Number(port)}.`,
      );
    } else {
      console.error("❌ HTTP Server startup error:", err);
    }

    process.exit(1);
  };

  server.once("listening", handleListening);
  server.once("error", handleError);
  server.listen(port);
}

startHttpServer(DEFAULT_HTTP_PORT);

// 💀 GLOBAL ERROR HANDLERS (DEBUGGING)
process.on("uncaughtException", (err) => {
  console.error("🔥 CRITICAL: Uncaught Exception:", err);
  // Keep process alive for debugging? No, usually bad practice, but for dev:
  // process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🔥 CRITICAL: Unhandled Rejection:", reason);
});
