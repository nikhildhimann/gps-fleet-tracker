const redis = require("redis");
require("dotenv").config({ quiet: true });

const REDIS_URL =
  (process.env.REDIS_URL || process.env.REDIS_URI || "redis://127.0.0.1:6379").trim();

// Production-grade reconnect strategy: do not spam connection logs infinitely if Redis is offline
const client = redis.createClient({
  url: REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => {
      // Allow up to 3 retries before giving up and running on in-memory/DB fallback
      if (retries > 3) {
        console.warn("⚠️ Redis connection failed. App will fall back to direct DB/API operations without cache.");
        return false; // Return false to stop reconnecting
      }
      return 1000; // wait 1s between retries
    }
  }
});

client.on("error", (err) => {
  // Only log if client is active to avoid connection refused spams on startup
  if (client.isOpen) {
    console.error("Redis Connection Error:", err && err.message ? err.message : err);
  }
});

client
  .connect()
  .then(() => {
    console.log("✅ Redis Connected Successfully");
  })
  .catch((e) => {
    console.warn("⚠️ Redis not available. Running with direct database/API lookups.");
  });

// Provide setex alias for compatibility with older code, with safety check
client.setex = async (key, seconds, value) => {
  if (!client.isOpen) return null;
  try {
    return await client.setEx(
      key,
      seconds,
      typeof value === "string" ? value : JSON.stringify(value),
    );
  } catch (err) {
    return null;
  }
};

// Wrap native get method to prevent crash/errors if client is not connected
const originalGet = client.get.bind(client);
client.get = async (key) => {
  if (!client.isOpen) return null;
  try {
    return await originalGet(key);
  } catch (err) {
    return null;
  }
};

module.exports = client;
