const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const driverSchema = {
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    required: true,
    index: true
  },

  assignedVehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    default: null
  },

  firstName: {
    type: String,
    trim: true
  },

  lastName: {
    type: String,
    trim: true
  },

  phone: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    lowercase: true,
    trim: true
  },

  licenseNumber: {
    type: String,
    required: true,
    uppercase: true,
    trim: true
  },

  licenseExpiry: {
    type: Date
  },

  photo: {
    type: String,
    default: null,
  },

  address: String,

  status: {
    type: String,
    enum: ["active", "inactive", "blocked"],
    default: "active",
    index: true
  },

  availability: {
    type: Boolean,
    default: true,
    index: true
  },

  totalTrips: {
    type: Number,
    default: 0
  },

  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },

  joiningDate: {
    type: Date,
    default: Date.now
  }
};

module.exports = new ajModel("Driver", driverSchema, null).getModel();
