const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const alertSchema = {
  // References
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    index: true,
  },

  gpsDeviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GpsDevice",
    required: true,
    index: true,
  },

  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    index: true,
  },

  imei: {
    type: String,
    required: true,
  },

  vehicleRegistrationNumber: String,

  // AIS-140 Alert Information
  alertId: {
    type: Number,
    required: true,
    index: true,
    /*
      1: Location Update
      2: Location Update (History)
      3: Mains off
      4: Low Battery
      5: Low Battery removed
      6: Mains On
      7: Ignition On
      8: Ignition Off
      9: Tamper Alert
      10: Emergency On
      11: Emergency Off
      12: OTA Alert
      13: Harsh Breaking
      14: Harsh Acceleration
      15: Rash Turning
      16: Wire Disconnect
      17: Overspeed
      22: Tilt Alert
    */
  },

  alertName: {
    type: String,
    required: true,
    enum: [
      "Location Update",
      "Location Update (History)",
      "Main Power Disconnected",
      "Low Battery",
      "Low Battery Removed",
      "Main Power Connected",
      "Ignition On",
      "Ignition Off",
      "Tamper Alert",
      "Emergency On",
      "Emergency Off",
      "OTA Alert",
      "Harsh Braking",
      "Harsh Acceleration",
      "Rash Turning",
      "Wire Disconnect",
      "Overspeed",
      "Tilt Alert",
    ],
  },

  packetType: {
    type: String,
    enum: [
      "EA",
      "TA",
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
    required: true,
  },

  // Alert Severity
  severity: {
    type: String,
    enum: ["info", "warning", "critical"],
    default: "info",
  },

  // Location at time of alert
  latitude: Number,
  latitudeDirection: String,
  longitude: Number,
  longitudeDirection: String,

  locationCoordinates: {
    type: [Number], // [longitude, latitude] for GeoJSON
    index: "2dsphere",
  },

  address: String,

  // GPS Data at alert time
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
  emergencyStatus: Boolean,
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

  // Alert Management
  acknowledged: {
    type: Boolean,
    default: false,
    index: true,
  },

  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },

  acknowledgedAt: Date,

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

  // System
  receivedAt: {
    type: Date,
    default: Date.now,
  },
};

// Indexes

module.exports = new ajModel("Alert", alertSchema)

  // ✅ compound indexes
  .index({ vehicleId: 1, gpsTimestamp: -1 })
  .index({ alertId: 1, acknowledged: 1 })
  .index({ severity: 1, acknowledged: 1 })

  // ✅ finalize model
  .getModel();
