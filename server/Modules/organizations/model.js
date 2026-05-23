const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const organizationSchema = {
  name: {
    type: String,
    required: true,
    trim: true,
  },

  organizationType: {
    type: String,
    enum: ["logistics", "transport", "school", "taxi", "fleet"],
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  logo: {
    type: String,
    default: null,
  },

  // Nested Address Object
  address: {
    addressLine: {
      type: String,
      default: "",
    },
    city: {
      type: String,
      default: "",
    },
    state: {
      type: String,
      default: "",
    },
    country: {
      type: String,
      default: "",
    },
    pincode: {
      type: String,
      default: "",
    },
  },

  // Nested Geo Location Object
  geo: {
    lat: {
      type: Number,
      min: -90,
      max: 90,
      default: null,
    },
    lng: {
      type: Number,
      min: -180,
      max: 180,
      default: null,
    },
    timezone: {
      type: String,
      default: "Asia/Kolkata",
    },
  },

  // Nested Settings Object
  settings: {
    speedAlert: {
      type: Boolean,
      default: false,
    },
    speedLimit: {
      type: Number,
      min: 0,
      max: 300,
      default: 80,
    },
    idleTimeThreshold: {
      type: Number,
      default: 5,
    },
    lowFuelThreshold: {
      type: Number,
      min: 0,
      max: 100,
      default: 20,
    },
    workingHours: {
      type: String,
      default: "09:00-18:00",
    },
  },

  // Hierarchical path for nested organizations
  path: {
    type: String,
    default: "/",
  },

  // Admin User of Organization
  adminUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },

  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },

  // Parent–Child organisation support
  parentOrganizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Organization",
    default: null,
  },

  // SuperAdmin / OrgAdmin
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },

  updatedAt: {
    type: Date,
    default: Date.now,
  },
};

const OrganizationModel = new ajModel(
  "Organization",
  organizationSchema
).getModel();

module.exports = OrganizationModel;
