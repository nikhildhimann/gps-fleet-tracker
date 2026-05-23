const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const gpsDeviceSchema = {
  // Device Identification
  imei: {
    type: String,
    required: true,
    unique: true,
    length: 15,
    index: true,
  },

  // Organization & Vehicle Mapping
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    index: true,
  },

  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    default: null,
    index: true,
  },

  // AIS-140 Mandatory Fields
  vendorId: {
    type: String,
    default: "ROADRPA",
    maxlength: 10,
  },

  softwareVersion: {
    type: String,
    required: true,
    maxlength: 20,
  },

  // UI-facing metadata fields
  deviceModel: {
    type: String,
    default: "",
    trim: true,
  },

  manufacturer: {
    type: String,
    default: "",
    trim: true,
  },

  simNumber: {
    type: String,
    default: "",
    trim: true,
  },

  serialNumber: {
    type: String,
    default: "",
    trim: true,
  },

  firmwareVersion: {
    type: String,
    default: "",
    trim: true,
  },

  hardwareVersion: {
    type: String,
    default: "",
    trim: true,
  },

  warrantyExpiry: {
    type: Date,
    default: null,
  },

  connectionStatus: {
    type: String,
    enum: ["online", "offline"],
    default: "offline",
  },

  vehicleRegistrationNumber: {
    type: String,
    uppercase: true,
    index: true,
  },

  // Connection Status
  isOnline: {
    type: Boolean,
    default: false,
  },

  lastSeen: {
    type: Date,
    default: null,
  },

  lastLoginTime: {
    type: Date,
    default: null,
  },

  // Configuration Settings (as per AIS-140 commands)
  configuration: {
    // Server Settings
    primaryIP: String,
    primaryPort: Number,
    secondaryIP: String,
    secondaryPort: Number,
    emergencyIP: String,
    emergencyPort: Number,

    // Network Settings
    apn: {
      type: String,
      default: "auto",
    },

    // Update Rates (in seconds/minutes)
    updateRateIgnitionOn: {
      type: Number,
      default: 60, // seconds
      min: 5,
    },

    updateRateIgnitionOff: {
      type: Number,
      default: 60, // seconds
    },

    updateRateSleepMode: {
      type: Number,
      default: 60, // minutes
    },

    updateRateEmergency: {
      type: Number,
      default: 60, // seconds
      min: 5,
    },

    updateRateHealth: {
      type: Number,
      default: 60, // minutes
    },

    // Alert Thresholds
    speedLimit: {
      type: Number,
      default: 70, // km/h
    },

    harshBrakeThreshold: {
      type: Number,
      default: 0.55, // g (m/s²)
    },

    harshAccelerationThreshold: {
      type: Number,
      default: 0.43, // g (m/s²)
    },

    rashTurningThreshold: {
      type: Number,
      default: 30, // km/h
    },

    lowBatteryThreshold: {
      type: Number,
      default: 20, // percentage
    },

    tiltAngle: {
      type: Number,
      default: 45, // degrees
    },

    sleepTime: {
      type: Number,
      default: 3, // minutes
    },

    // Feature Flags
    turnByTurnTracking: {
      type: Boolean,
      default: false,
    },

    relayEnabled: {
      type: Boolean,
      default: false,
    },

    boxEventDisabled: {
      type: Boolean,
      default: false,
    },

    smsEnabled: {
      type: Boolean,
      default: true,
    },
  },

  // Contact Numbers
  emergencyNumber: String, // M0
  userMobile1: String, // M1
  userMobile2: String, // M2
  userMobile3: String, // M3

  // Device Password
  password: {
    type: String,
    default: "rpointais",
  },

  // Status
  status: {
    type: String,
    enum: ["active", "inactive", "suspended"],
    default: "active",
  },

  inventory: {
    status: {
      type: String,
      enum: ["in_stock", "assigned", "installed", "faulty", "repair", "retired"],
      default: "in_stock",
    },
    purchaseDate: {
      type: Date,
      default: null,
    },
    purchasePrice: {
      type: Number,
      default: null,
      min: 0,
    },
    supplierName: {
      type: String,
      default: "",
      trim: true,
    },
    invoiceNumber: {
      type: String,
      default: "",
      trim: true,
    },
    stockLocation: {
      type: String,
      default: "",
      trim: true,
    },
    rackNumber: {
      type: String,
      default: "",
      trim: true,
    },
    faultReason: {
      type: String,
      default: "",
      trim: true,
    },
    repairStatus: {
      type: String,
      default: "",
      trim: true,
    },
    lastAuditAt: {
      type: Date,
      default: null,
    },
    updatedAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
};

const instance = new ajModel("GpsDevice", gpsDeviceSchema);
instance.index({ "inventory.status": 1 });
instance.index({ warrantyExpiry: 1 });
instance.index({ manufacturer: 1 });

module.exports = instance.getModel();
