const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const notificationSchema = {
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200,
  },

  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 2000,
  },

  type: {
    type: String,
    enum: ["alert", "device_health", "mapping", "import", "admin", "system"],
    default: "system",
    index: true,
  },

  severity: {
    type: String,
    enum: ["critical", "warning", "info", "success"],
    default: "info",
    index: true,
  },

  status: {
    type: String,
    enum: ["new", "acknowledged", "resolved"],
    default: "new",
    index: true,
  },

  isRead: {
    type: Boolean,
    default: false,
    index: true,
  },

  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null,
    index: true,
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },

  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    default: null,
    index: true,
  },

  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GpsDevice",
    default: null,
    index: true,
  },

  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
    default: null,
    index: true,
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
    index: true,
  },

  alertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Alert",
    default: null,
    index: true,
  },

  importJobId: {
    type: String,
    default: null,
    trim: true,
    index: true,
  },

  mappingId: {
    type: String,
    default: null,
    trim: true,
    index: true,
  },

  entityType: {
    type: String,
    default: null,
    trim: true,
    index: true,
  },

  entityId: {
    type: String,
    default: null,
    trim: true,
    index: true,
  },

  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },

  actionUrl: {
    type: String,
    default: null,
    trim: true,
  },

  occurredAt: {
    type: Date,
    default: Date.now,
    index: true,
  },

  readAt: {
    type: Date,
    default: null,
  },

  acknowledgedAt: {
    type: Date,
    default: null,
  },

  resolvedAt: {
    type: Date,
    default: null,
  },

  acknowledgedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
};

module.exports = new ajModel("Notification", notificationSchema)
  .index({ organizationId: 1, occurredAt: -1 })
  .index({ organizationId: 1, status: 1, occurredAt: -1 })
  .index({ organizationId: 1, isRead: 1, occurredAt: -1 })
  .index({ organizationId: 1, type: 1, severity: 1, occurredAt: -1 })
  .index({ entityType: 1, entityId: 1, occurredAt: -1 })
  .index({ "metadata.sourceKey": 1 }, { sparse: true })
  .index({ "metadata.cooldownKey": 1, occurredAt: -1 }, { sparse: true })
  .getModel();
