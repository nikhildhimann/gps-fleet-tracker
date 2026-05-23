// middleware/requestLogger.js
module.exports = function requestLogger(req, res, next) {
  const start = process.hrtime();

  console.log(`➡️ ${req.method} ${req.originalUrl}`);
  console.log("📦 Body:", req.body);
  console.log("🔍 Query:", req.query);

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const ms = (diff[0] * 1e3 + diff[1] / 1e6).toFixed(2);

    console.log(
      `✅ ${req.method} ${req.originalUrl} - ${res.statusCode} - ${ms} ms`
    );
    console.log("--------------------------------------------------");
  });

  next();
};