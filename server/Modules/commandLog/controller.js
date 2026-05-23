const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const commandLogSchema = {
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

  // Command Details
  commandType: {
    type: String,
    enum: ["SET", "GET", "CLR", "SERVICE"],
    required: true
  },

  commandKey: {
    type: String,
    required: true
    /*
      PIP, PPT, EIP, EPT, SIP, SPT, M0, EO, ED, APN, ST, SL,
      HBT, HAT, RTT, LBT, VN, URS, PIN, PIF, URE, URH, VID, FV,
      M1, M2, M3, PWD, SEN, TA, TBT, IRL, RL, ODM, BED, RST,
      STG, TEST, NWINFO, WHERE, ACTV, HCHK, NWSWITCH, IDENTIFY, OTA
    */
  },

  commandValue: String, // Only for SET commands

  fullCommand: {
    type: String,
    required: true
  },

  // Source
  commandSource: {
    type: String,
    enum: ["SERVER", "SMS", "WEB", "API"],
    required: true
  },

  sourceValue: String, // IP or phone number

  sentBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },

  sentAt: {
    type: Date,
    default: Date.now,
    index: true
  },

  // Response
  responseReceived: {
    type: Boolean,
    default: false
  },

  responseData: String,

  responseReceivedAt: Date,

  // OTA Information (from OTA ACK packet)
  otaInfo: String,

  // Status
  status: {
    type: String,
    enum: ["PENDING", "SENT", "ACKNOWLEDGED", "FAILED", "TIMEOUT"],
    default: "PENDING",
    index: true
  },

  errorMessage: String,

  // Retry Information
  retryCount: {
    type: Number,
    default: 0
  },

  maxRetries: {
    type: Number,
    default: 3
  }
};

// Indexes
commandLogSchema.index({ imei: 1, sentAt: -1 });
commandLogSchema.index({ status: 1, sentAt: -1 });

module.exports = new ajModel("CommandLog", commandLogSchema).getModel();