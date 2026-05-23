const { ajModel } = require("../../common/classes/Model");
const mongoose = require("mongoose");

const geofenceSchema = {
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "Organization" },
  name: String,
  type: String,
  circleCenterType: String,
  circleCenterCoordinates: Array,
  circleRadius: Number,
  polygon: Array,
  alertOnEnter: Boolean,
  alertOnExit: Boolean
};

module.exports = new ajModel("Geofence", geofenceSchema).getModel();
