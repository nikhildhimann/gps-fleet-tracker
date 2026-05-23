const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const healthMonitoringSchema = {
  // References
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization"
  },

  gpsDeviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GpsDevice",
    required: true,
    index: true
  },

  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle"
  },

  imei: {
    type: String,
    required: true,
    index: true
  },

  // Device Health
  vendorId: String,
  softwareVersion: String,

  batteryPercentage: {
    type: Number,
    min: 0,
    max: 100
  },

  lowBatteryThreshold: {
    type: Number,
    default: 20
  },

  memoryPercentage: {
    type: Number,
    min: 0,
    max: 100
  },

  // Update Rates
  dataUpdateRateIgnitionOn: {
    type: Number, // seconds
    default: 60
  },

  dataUpdateRateIgnitionOff: {
    type: Number, // seconds
    default: 60
  },

  // I/O Status
  digitalInputStatus: {
    type: String,
    default: "0000" // [DIN3, DIN2, DIN1, DIN0]
  },

  analogInputStatus: {
    type: String,
    default: "00"
  },

  // Timestamp
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },

  // System
  receivedAt: {
    type: Date,
    default: Date.now
  }
};

// Indexes
healthMonitoringSchema.index({ imei: 1, timestamp: -1 });
healthMonitoringSchema.index({ gpsDeviceId: 1, timestamp: -1 });

module.exports = new ajModel("HealthMonitoring", healthMonitoringSchema).getModel();