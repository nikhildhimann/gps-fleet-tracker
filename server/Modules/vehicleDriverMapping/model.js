const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const vehicleDriverMappingSchema = {
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true
  },

  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    required: true,
  },

  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
    required: true,
  },

  assignedAt: {
    type: Date,
    default: Date.now
  },

  unassignedAt: {
    type: Date,
    default: null
  },

  status: {
    type: String,
    enum: ["assigned", "unassigned"],
    default: "assigned",
    index: true
  }
};

const instance = new ajModel("VehicleDriverMapping", vehicleDriverMappingSchema);
instance.index(
  { vehicleId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      unassignedAt: null,
    },
  },
);

instance.index(
  { driverId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      unassignedAt: null,
    },
  },
);

module.exports = instance.getModel();
