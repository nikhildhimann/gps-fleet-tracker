const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const gpsHistorySchema = {
  // References
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    index: true,
  },

  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    index: true,
  },

  gpsDeviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GpsDevice",
    required: true,
    index: true,
  },

  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
  },

  tripId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Trip",
  },

  imei: {
    type: String,
    required: true,
    index: true,
  },

  vehicleRegistrationNumber: String,

  // Packet Information
  packetType: {
    type: String,
    enum: [
      "NR",
      "EA",
      "TA",
      "HP",
      "IN",
      "IF",
      "BD",
      "BR",
      "BL",
      "HB",
      "HA",
      "RT",
      "TI",
      "WD",
      "OS",
      "OA",
    ],
  },

  alertId: Number,

  packetStatus: {
    type: String,
    enum: ["L", "H"], // Live or History
    default: "H",
  },

  // GPS Data
  gpsTimestamp: {
    type: Date,
    required: true,
    index: true,
  },

  latitude: {
    type: Number,
    required: true,
  },

  latitudeDirection: {
    type: String,
    enum: ["N", "S"],
  },

  longitude: {
    type: Number,
    required: true,
  },

  longitudeDirection: {
    type: String,
    enum: ["E", "W"],
  },

  address: String,
  poi: String,
  poiId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "POI",
    default: null,
  },

  // GPS Quality
  gpsFixed: Boolean,
  numberOfSatellites: Number,
  altitude: Number,
  pdop: Number,
  hdop: Number,

  // Motion
  speed: {
    type: Number,
    default: 0,
  },

  heading: Number,

  // Status
  ignitionStatus: Boolean,
  acStatus: Boolean,
  mainPowerStatus: Boolean,
  emergencyStatus: Boolean,
  tamperAlert: String,

  // Power
  mainInputVoltage: Number,
  internalBatteryVoltage: Number,

  // Network
  operatorName: String,
  gsmSignalStrength: Number,
  mcc: String,
  mnc: String,
  lac: String,
  cellId: String,

  // I/O
  digitalInputStatus: String,
  digitalOutputStatus: String,
  analogInput1: Number,
  analogInput2: Number,

  // Additional
  frameNumber: String,
  odometer: Number,

  debugInfo: {
    creg: String,
    cgreg: String,
    socket1Status: Number,
    socket2Status: Number,
  },

  checksum: String,

  // System
  receivedAt: {
    type: Date,
    default: Date.now,
  },
};

// Compound indexes for efficient querying
// gpsHistorySchema.index({ vehicleId: 1, gpsTimestamp: -1 });
// gpsHistorySchema.index({ imei: 1, gpsTimestamp: -1 });
// gpsHistorySchema.index({ tripId: 1, gpsTimestamp: 1 });
const instance = new ajModel("GpsHistory", gpsHistorySchema);
instance.index({ vehicleId: 1, gpsTimestamp: -1 });
instance.index({ imei: 1, gpsTimestamp: -1 });
instance.index({ tripId: 1, gpsTimestamp: 1 });
instance.index({ organizationId: 1, vehicleId: 1, gpsTimestamp: -1 });
instance.index({ vehicleId: 1, gpsTimestamp: 1 }, { unique: true });


module.exports = instance.getModel();
