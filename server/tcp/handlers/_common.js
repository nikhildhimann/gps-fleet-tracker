const GpsDevice = require("../../Modules/gpsDevice/model");
const VehicleDeviceMapping = require("../../Modules/deviceMapping/model");
const GpsLiveData = require("../../Modules/gpsLiveData/model");

function splitPacket(packet) {
  return String(packet || "")
    .replace("*", "")
    .trim()
    .split(",")
    .map((v) => String(v || "").trim());
}

function isImei(value) {
  return /^\d{15}$/.test(String(value || ""));
}

function findImeiInParts(parts = []) {
  for (const part of parts) {
    if (isImei(part)) return part;
  }
  return null;
}

function nmeaToDecimal(value) {
  const num = parseFloat(value);
  if (!Number.isFinite(num)) return null;
  const abs = Math.abs(num);
  const degrees = Math.floor(abs / 100);
  const minutes = abs - degrees * 100;
  return degrees + minutes / 60;
}

function parseCoordinate(value, direction, fallback = null) {
  if (value === undefined || value === null || value === "") return fallback;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return fallback;

  let out = Math.abs(n) > 180 ? nmeaToDecimal(value) : n;
  if (!Number.isFinite(out)) return fallback;

  const dir = String(direction || "").toUpperCase();
  if (dir === "S" || dir === "W") out = -Math.abs(out);
  if (dir === "N" || dir === "E") out = Math.abs(out);

  return out;
}

async function ensureSocketContext(socket, imeiHint = null) {
  if (socket?.imei && socket?.gpsDeviceId && socket?.organizationId) {
    return {
      imei: socket.imei,
      gpsDeviceId: socket.gpsDeviceId,
      organizationId: socket.organizationId,
      vehicleId: socket.vehicleId || null,
      fromSocket: true,
    };
  }

  const imei = imeiHint || socket?.imei;
  if (!isImei(imei)) return null;

  const device = await GpsDevice.findOne({ imei });
  if (!device || device.status !== "active") return null;

  socket.imei = imei;
  socket.gpsDeviceId = device._id;
  socket.organizationId = device.organizationId;
  socket.vehicleId = device.vehicleId || null;

  if (!socket.vehicleId) {
    const activeMapping = await VehicleDeviceMapping.findOne({
      gpsDeviceId: device._id,
      unassignedAt: null,
    });
    socket.vehicleId = activeMapping?.vehicleId || null;
  }

  return {
    imei: socket.imei,
    gpsDeviceId: socket.gpsDeviceId,
    organizationId: socket.organizationId,
    vehicleId: socket.vehicleId || null,
    fromSocket: false,
  };
}

async function getFallbackLive(gpsDeviceId) {
  if (!gpsDeviceId) return null;
  return GpsLiveData.findOne({ gpsDeviceId })
    .select("latitude longitude currentSpeed heading")
    .lean();
}

function parseEventState(value, fallback = true) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return fallback;
  if (["0", "OFF", "FALSE", "INACTIVE", "END", "RESOLVED"].includes(raw)) return false;
  if (["1", "ON", "TRUE", "ACTIVE", "START", "TRIGGERED"].includes(raw)) return true;
  return fallback;
}

module.exports = {
  splitPacket,
  isImei,
  findImeiInParts,
  parseCoordinate,
  ensureSocketContext,
  getFallbackLive,
  parseEventState,
};

