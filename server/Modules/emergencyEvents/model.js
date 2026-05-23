const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const emergencyEventSchema = {
  // References
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },

  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true,
    index: true,
  },

  gpsDeviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GpsDevice",
    required: true,
    index: true,
  },

  imei: {
    type: String,
    required: true,
    index: true,
  },

  vehicleRegistrationNumber: String,

  // Event Type
  eventType: {
    type: String,
    enum: ["emergency_on", "emergency_off"],
    required: true,
  },

  // Location at time of emergency
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

  locationCoordinates: {
    type: [Number], // [longitude, latitude] for GeoJSON
    index: "2dsphere",
  },

  address: String,

  // GPS Data at emergency time
  gpsTimestamp: {
    type: Date,
    required: true,
    index: true,
  },

  speed: Number,
  heading: Number,
  altitude: Number,

  // Vehicle Status
  ignitionStatus: Boolean,
  mainPowerStatus: Boolean,
  mainInputVoltage: Number,
  internalBatteryVoltage: Number,

  // Network
  gsmSignalStrength: Number,
  operatorName: String,

  // Additional Context
  frameNumber: String,
  odometer: Number,

  // Full packet data (for reference)
  rawPacketData: String,

  // Emergency Management
  status: {
    type: String,
    enum: ["active", "resolved", "false_alarm"],
    default: "active",
    index: true,
  },

  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  resolvedAt: Date,

  notes: String,

  // Notification Status
  notificationSent: {
    type: Boolean,
    default: false,
  },

  notificationSentAt: Date,

  notificationChannels: [
    {
      type: String,
      enum: ["sms", "email", "push", "webhook"],
    },
  ],

  // Response tracking
  responseTime: Number, // seconds from trigger to resolution

  // System
  receivedAt: {
    type: Date,
    default: Date.now,
  },
};

module.exports = new ajModel("EmergencyEvent", emergencyEventSchema)
  .index({ vehicleId: 1, gpsTimestamp: -1 })
  .index({ status: 1, gpsTimestamp: -1 })
  .index({ organizationId: 1, status: 1 })
  .getModel();
