const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const vehicleDailyStatsSchema = {
  // Relations
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
  },

  imei: String,

  // Date
  date: {
    type: Date,
    required: true,
    index: true,
  },

  // Distance & Speed
  totalDistance: {
    type: Number,
    default: 0,
    min: 0,
  },

  maxSpeed: {
    type: Number,
    default: 0,
    min: 0,
  },

  avgSpeed: {
    type: Number,
    default: 0,
    min: 0,
  },

  speedSampleCount: {
    type: Number,
    default: 0,
    min: 0,
  },

  // Time metrics (seconds)
  runningTime: {
    type: Number,
    default: 0,
    min: 0,
  },

  idleTime: {
    type: Number,
    default: 0,
    min: 0,
  },

  stoppedTime: {
    type: Number,
    default: 0,
    min: 0,
  },

  // Ignition Events
  firstIgnitionOn: Date,
  lastIgnitionOff: Date,

  ignitionOnCount: {
    type: Number,
    default: 0,
  },

  // AIS-140 Specific Alerts Count
  alertCounts: {
    overspeedCount: { type: Number, default: 0 },
    harshBrakingCount: { type: Number, default: 0 },
    harshAccelerationCount: { type: Number, default: 0 },
    rashTurningCount: { type: Number, default: 0 },
    tamperAlertCount: { type: Number, default: 0 },
    emergencyCount: { type: Number, default: 0 },
  },

  // Fuel & Battery
  fuelConsumed: Number,
  avgBatteryVoltage: Number,

  // Stops
  totalStops: {
    type: Number,
    default: 0,
  },

  stops: [
    {
      latitude: Number,
      longitude: Number,
      startTime: Date,
      endTime: Date,
      duration: Number, // seconds
    },
  ],

  // Trip Summary
  totalTrips: {
    type: Number,
    default: 0,
  },

  // Odometer
  startOdometer: Number,
  endOdometer: Number,

  // Network Quality
  avgGsmSignalStrength: Number,
  gpsFixPercentage: Number,

  // Last updated
  lastCalculatedAt: {
    type: Date,
    default: Date.now,
  },
};

// Unique constraint

module.exports = new ajModel("VehicleDailyStats", vehicleDailyStatsSchema)

  // ✅ yahin compound index lagta hai
  .index({ vehicleId: 1, date: 1 }, { unique: true })

  // 🚨 LAST LINE ALWAYS
  .getModel();
