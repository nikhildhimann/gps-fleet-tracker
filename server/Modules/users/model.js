const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const userSchema = {
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null, // superadmin ke liye
  },

  firstName: {
    type: String,
    required: true,
    trim: true,
  },

  lastName: {
    type: String,
    trim: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  mobile: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  passwordHash: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["superadmin", "admin", "driver"],
    required: true,
  },

  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },

  assignedVehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Vehicle",
    default: null,
  },

  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Driver",
    default: null,
  },

  lastLoginAt: {
    type: Date,
  },
};

const UserModel = new ajModel("User", userSchema).getModel();
module.exports = UserModel;
