const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const gpsLiveDataSchema = {
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
    default: "NR",
  },

  alertId: {
    type: Number,
    min: 1,
    max: 22,
  },

  packetStatus: {
    type: String,
    enum: ["L", "H"], // Live or History
    default: "L",
  },

  // GPS Data
  gpsTimestamp: {
    type: Date,
    required: true,
    index: true,
  },

  gpsDate: String, // DDMMYYYY format
  gpsTime: String, // HHMMSS format

  latitude: {
    type: Number,
    required: true,
    min: -90,
    max: 90,
  },

  latitudeDirection: {
    type: String,
    enum: ["N", "S"],
    default: "N",
  },

  longitude: {
    type: Number,
    required: true,
    min: -180,
    max: 180,
  },

  longitudeDirection: {
    type: String,
    enum: ["E", "W"],
    default: "E",
  },

  currentLocation: String, // Reverse geocoded address
  poi: String,
  poiId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "POI",
    default: null,
  },

  // GPS Quality
  gpsFixed: {
    type: Boolean,
    default: false,
  },

  numberOfSatellites: {
    type: Number,
    min: 0,
    max: 32,
  },

  altitude: {
    type: Number, // meters
    default: 0,
  },

  pdop: Number, // Positional Dilution of Precision
  hdop: Number, // Horizontal Dilution of Precision

  // Motion Data
  currentSpeed: {
    type: Number, // km/h
    default: 0,
    min: 0,
  },

  heading: {
    type: Number, // degrees (0-360)
    min: 0,
    max: 360,
  },

  // Vehicle Status
  ignitionStatus: {
    type: Boolean,
    default: false,
  },

  engineStatus: {
    type: Boolean,
    default: false,
  },

  movementStatus: {
    type: String,
    enum: ["running", "idle", "stopped", "inactive"],
    default: "inactive",
  },

  // Power & Battery
  mainPowerStatus: {
    type: Boolean,
    default: true,
  },

  mainInputVoltage: {
    type: Number, // Volts (12V system)
    default: 12.0,
  },

  internalBatteryVoltage: {
    type: Number, // Volts
    default: 4.2,
  },

  batteryLevel: {
    type: Number, // Percentage
    min: 0,
    max: 100,
  },

  // Emergency & Alerts
  emergencyStatus: {
    type: Boolean,
    default: false,
  },

  tamperAlert: {
    type: String,
    enum: ["O", "C"], // Open or Closed
    default: "C",
  },

  // Network Information
  operatorName: String,

  gsmSignalStrength: {
    type: Number,
    min: 0,
    max: 31,
  },

  mcc: {
    type: String,
    default: "404", // India
  },

  mnc: String,

  lac: String, // Location Area Code

  cellId: String,

  // Network Measurement Report (4 neighboring cells)
  nmr: {
    cell1: {
      cellId: String,
      lac: String,
      signalStrength: Number,
    },
    cell2: {
      cellId: String,
      lac: String,
      signalStrength: Number,
    },
    cell3: {
      cellId: String,
      lac: String,
      signalStrength: Number,
    },
    cell4: {
      cellId: String,
      lac: String,
      signalStrength: Number,
    },
  },

  // Digital I/O
  digitalInputStatus: {
    type: String,
    default: "0000", // [DIN3, DIN2, DIN1, DIN0]
  },

  digitalOutputStatus: {
    type: String,
    default: "00", // [DOUT1, DOUT0]
  },

  // Analog Inputs
  analogInput1: {
    type: Number, // mV
    default: 0,
  },

  analogInput2: {
    type: Number, // mV
    default: 0,
  },

  // Additional Fields
  frameNumber: {
    type: String,
    default: "000001",
  },

  currentMileage: {
    type: Number, // km (odometer)
    default: 0,
  },

  // Misc Fields (for future use)
  miscField1: String,
  miscField2: String,
  miscField3: String,
  miscField4: String,

  // Debug Information
  debugInfo: {
    creg: String, // GSM registration status
    cgreg: String, // GPRS registration status
    socket1Status: Number, // Primary socket
    socket2Status: Number, // Secondary socket
  },

  // Checksum
  checksum: String,

  // Additional computed fields
  fuelPercentage: Number,
  acStatus: Boolean,
  temperature: String,

  lastIgnitionOn: Date,
  lastIgnitionOff: Date,

  // System timestamp (when packet received)
  receivedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
};

// Indexes
const instance = new ajModel("GpsLiveData", gpsLiveDataSchema);
instance.index({ imei: 1, gpsTimestamp: -1 });
instance.index({ vehicleId: 1, gpsTimestamp: -1 });

module.exports = instance.getModel();
