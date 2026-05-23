const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const vehicleSchema = {
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },

  vehicleType: {
    type: String,
    enum: ["car", "bus", "truck", "bike", "other"],
    required: true,
  },

  vehicleNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    index: true,
  },

  // AIS-140 specific
  ais140Compliant: {
    type: Boolean,
    default: false,
  },

  ais140CertificateNumber: String,

  make: String,
  model: String,
  year: {
    type: Number,
    min: 1900,
    max: new Date().getFullYear() + 1,
  },
  color: String,

  // Device Assignment
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GpsDevice",
    default: null,
    index: true,
  },

  deviceImei: String, // Denormalized for quick access

  // Driver Assignment
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
    default: null,
  },

  // Status
  status: {
    type: String,
    enum: ["active", "inactive", "maintenance", "decommissioned"],
    default: "active",
    index: true,
  },

  runningStatus: {
    type: String,
    enum: ["running", "idle", "stopped", "inactive"],
    default: "inactive",
    index: true,
  },

  // Current Stats (denormalized from live data)
  currentLocation: {
    latitude: Number,
    longitude: Number,
    address: String,
    coordinates: {
      type: [Number],
      index: "2dsphere",
    },
  },
  poi: String,
  poiId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "POI",
    default: null,
  },

  lastUpdated: Date,

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
};

const instance = new ajModel("Vehicle", vehicleSchema);
instance.index({ organizationId: 1, vehicleNumber: 1 }, { unique: true });

module.exports = instance.getModel();
