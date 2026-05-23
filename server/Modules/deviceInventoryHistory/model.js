const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const deviceInventoryHistorySchema = {
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GpsDevice",
    required: true,
    index: true,
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true,
  },
  previousStatus: {
    type: String,
    enum: ["in_stock", "assigned", "installed", "faulty", "repair", "retired"],
    required: true,
  },
  newStatus: {
    type: String,
    enum: ["in_stock", "assigned", "installed", "faulty", "repair", "retired"],
    required: true,
  },
  reason: {
    type: String,
    default: "",
    trim: true,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  changedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
};

const instance = new ajModel("DeviceInventoryHistory", deviceInventoryHistorySchema);
instance.index({ deviceId: 1, changedAt: -1 });
instance.index({ organizationId: 1, changedAt: -1 });

module.exports = instance.getModel();
