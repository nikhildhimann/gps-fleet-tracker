const redis = require("redis");
require("dotenv").config({ quiet: true });

const REDIS_URL =
  (process.env.REDIS_URL || process.env.REDIS_URI || "redis://127.0.0.1:6379").trim();

const client = redis.createClient({ url: REDIS_URL });

client.on("error", (err) => {
  console.error(
    "Redis Connection Error:",
    err && err.message ? err.message : err,
  );
});

client
  .connect()
  .then(() => {
    console.log("✅ Redis Connected");
  })
  .catch((e) => {
    console.error("Redis connect failed:", e && e.message ? e.message : e);
  });

// Provide setex alias for compatibility with older code
client.setex = async (key, seconds, value) => {
  return client.setEx(
    key,
    seconds,
    typeof value === "string" ? value : JSON.stringify(value),
  );
};

module.exports = client;
