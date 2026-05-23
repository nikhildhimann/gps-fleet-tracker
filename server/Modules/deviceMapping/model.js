const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const vehicleMappingSchema = {
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
  },
  gpsDeviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GpsDevice",
    required: true,
  },
  assignedAt: {
    type: Date,
    default: Date.now,
  },
  unassignedAt: {
    type: Date,
    default: null,
  },
};

const instance = new ajModel("DeviceMapping", vehicleMappingSchema);
instance.index(
  { vehicleId: 1 },
  { unique: true, partialFilterExpression: { unassignedAt: null } },
);

instance.index(
  { gpsDeviceId: 1 },
  { unique: true, partialFilterExpression: { unassignedAt: null } },
);

module.exports = instance.getModel();
